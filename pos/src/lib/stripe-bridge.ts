import { call } from './frappe-sdk';

// Stripe Terminal SDK types
interface StripeTerminalSDK {
  create: (options: TerminalOptions) => Terminal;
}

interface TerminalOptions {
  onFetchConnectionToken: () => Promise<string>;
  onUnexpectedReaderDisconnect?: () => void;
  onConnectionStatusChange?: (event: ConnectionStatusEvent) => void;
}

interface ConnectionStatusEvent {
  status: 'not_connected' | 'connecting' | 'connected';
}

interface Terminal {
  discoverReaders: (config: DiscoverConfig) => Promise<DiscoverResult>;
  connectReader: (reader: Reader, options?: ConnectReaderOptions) => Promise<Reader>;
  disconnectReader: () => Promise<void>;
  collectPaymentMethod: (clientSecret: string, options?: CollectPaymentMethodOptions) => Promise<CollectPaymentMethodResult>;
  processPayment: (paymentIntent: PaymentIntent) => Promise<ProcessPaymentResult>;
  cancelCollectPaymentMethod: () => Promise<void>;
  setSimulatorConfiguration: (config: SimulatorConfig) => void;
  clearReaderDisplay: () => Promise<void>;
  setReaderDisplay: (display: ReaderDisplay) => Promise<void>;
  getConnectionStatus: () => string;
  getConnectedReader: () => Reader | null;
}

interface DiscoverConfig {
  simulated?: boolean;
  location?: string;
}

interface DiscoverResult {
  discoveredReaders: Reader[];
}

interface Reader {
  id?: string;
  object?: string;
  device_type?: string;
  ip_address?: string;
  label?: string;
  location?: string;
  serial_number?: string;
  status?: string;
}

interface ConnectReaderOptions {
  fail_if_in_use?: boolean;
}

interface CollectPaymentMethodOptions {
  config_override?: {
    skip_tipping?: boolean;
    tipping?: {
      eur?: {
        percentages?: number[];
      };
    };
  };
  update_payment_intent?: boolean;
}

interface CollectPaymentMethodResult {
  paymentIntent: PaymentIntent;
}

interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
  client_secret?: string;
  charges?: {
    data: Array<{
      id: string;
      payment_method_details?: {
        card_present?: {
          last4?: string;
          brand?: string;
        };
      };
    }>;
  };
}

interface ProcessPaymentResult {
  paymentIntent: PaymentIntent;
}

interface SimulatorConfig {
  testCardNumber?: string;
  testPaymentMethod?: string;
}

interface ReaderDisplay {
  type: 'cart';
  cart: {
    line_items: Array<{
      description: string;
      amount: number;
      quantity: number;
    }>;
    tax: number;
    total: number;
    currency: string;
  };
}

// Declare Stripe Terminal on window
declare global {
  interface Window {
    StripeTerminal?: StripeTerminalSDK;
  }
}

// Terminal states for FSM (Finite State Machine)
export type TerminalState =
  | 'uninitialized'
  | 'initializing'
  | 'ready'
  | 'discovering'
  | 'connecting'
  | 'connected'
  | 'processing'
  | 'disconnecting'
  | 'error';

// Bridge state management with FSM pattern
interface BridgeState {
  terminal: Terminal | null;
  terminalId: string | null;
  currentState: TerminalState;
  isConnecting: boolean;
  isProcessing: boolean;
  connectedReader: Reader | null;
  connectionStatus: 'not_connected' | 'connecting' | 'connected';
  lastError: string | null;
  simulationMode: boolean;
  errorCount: number;
  maxRetries: number;
}

const state: BridgeState = {
  terminal: null,
  terminalId: null,
  currentState: 'uninitialized',
  isConnecting: false,
  isProcessing: false,
  connectedReader: null,
  connectionStatus: 'not_connected',
  lastError: null,
  simulationMode: false,
  errorCount: 0,
  maxRetries: 3
};

/**
 * Validate state transition
 * Ensures state machine follows valid transitions
 */
const canTransition = (from: TerminalState, to: TerminalState): boolean => {
  const validTransitions: Record<TerminalState, TerminalState[]> = {
    uninitialized: ['initializing', 'error'],
    initializing: ['ready', 'error'],
    ready: ['discovering', 'error'],
    discovering: ['connecting', 'ready', 'error'],
    connecting: ['connected', 'ready', 'error'],
    connected: ['processing', 'disconnecting', 'error'],
    processing: ['connected', 'error'],
    disconnecting: ['ready', 'uninitialized', 'error'],
    error: ['ready', 'uninitialized']
  };

  return validTransitions[from]?.includes(to) || false;
};

/**
 * Transition to a new state
 * @param newState - The new state to transition to
 * @throws Error if transition is invalid
 */
const transitionTo = (newState: TerminalState): void => {
  if (!canTransition(state.currentState, newState)) {
    console.warn(
      `[STRIPE-FSM] ⚠️ Invalid transition: ${state.currentState} -> ${newState}`
    );
    // Allow transition anyway but log warning
  }

  console.log(`[STRIPE-FSM] ${state.currentState} → ${newState}`);
  state.currentState = newState;
};

/**
 * Initialize Stripe Terminal SDK
 * Loads the SDK from Stripe CDN if not already loaded
 */
export const init = async (): Promise<boolean> => {
  try {
    console.log('[StripeTerminalBridge] Initializing Stripe Terminal SDK...');

    // Check if SDK is already loaded
    if (window.StripeTerminal) {
      console.log('[StripeTerminalBridge] SDK already loaded');
      return true;
    }

    // Load SDK from CDN
    await new Promise<void>((resolve, reject) => {
      // Check if script is already in DOM
      if (document.querySelector('script[src*="js.stripe.com/terminal"]')) {
        console.log('[StripeTerminalBridge] SDK script already in DOM');
        return resolve();
      }

      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/terminal/v1/';
      script.onload = () => {
        console.log('[StripeTerminalBridge] SDK loaded successfully');
        resolve();
      };
      script.onerror = (err) => {
        console.error('[StripeTerminalBridge] Error loading SDK:', err);
        reject(new Error('Failed to load Stripe Terminal SDK'));
      };
      document.head.appendChild(script);
    });

    // Wait for SDK to be available (with retry)
    // Sometimes the SDK takes a moment to initialize even after script load
    const maxAttempts = 10;
    const retryDelay = 100; // ms

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (window.StripeTerminal) {
        console.log('[StripeTerminalBridge] SDK initialization complete');
        return true;
      }

      if (attempt < maxAttempts - 1) {
        console.log(`[StripeTerminalBridge] Waiting for SDK to initialize (attempt ${attempt + 1}/${maxAttempts})...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    throw new Error('Stripe Terminal SDK loaded but StripeTerminal is not available after retries');
  } catch (error) {
    console.error('[StripeTerminalBridge] Initialization error:', error);
    state.lastError = error instanceof Error ? error.message : 'Unknown error';
    throw error;
  }
};

/**
 * Get connection token from backend
 * @param terminalId - The terminal ID to get connection token for
 */
const fetchConnectionToken = async (terminalId: string): Promise<string> => {
  try {
    console.log('[StripeTerminalBridge] Fetching connection token for terminal:', terminalId);

    if (!terminalId) {
      throw new Error('Terminal ID is required to fetch connection token');
    }

    const response = await call.post('neopay_integration.api.get_connection_token', {
      terminal: terminalId
    });

    if (!response.message) {
      throw new Error('No connection token received from server');
    }

    console.log('[StripeTerminalBridge] Connection token received');
    return response.message;
  } catch (error) {
    console.error('[StripeTerminalBridge] Failed to fetch connection token:', error);
    throw error;
  }
};

/**
 * Initialize Terminal instance
 * Creates the Terminal object with callbacks
 * @param terminalId - The terminal ID for connection token requests
 */
export const initializeTerminal = async (terminalId: string): Promise<Terminal> => {
  try {
    if (!terminalId) {
      throw new Error('Terminal ID is required to initialize terminal');
    }

    transitionTo('initializing');

    // Ensure SDK is loaded
    await init();

    if (!window.StripeTerminal) {
      throw new Error('Stripe Terminal SDK not available');
    }

    console.log('[StripeTerminalBridge] Creating Terminal instance for:', terminalId);

    // Create terminal instance
    const terminal = window.StripeTerminal.create({
      onFetchConnectionToken: () => fetchConnectionToken(terminalId),
      onUnexpectedReaderDisconnect: () => {
        console.warn('[StripeTerminalBridge] Unexpected reader disconnect');
        state.connectedReader = null;
        state.connectionStatus = 'not_connected';
        transitionTo('error');
      },
      onConnectionStatusChange: (event: ConnectionStatusEvent) => {
        console.log('[StripeTerminalBridge] Connection status:', event.status);
        state.connectionStatus = event.status;
      }
    });

    state.terminal = terminal;
    state.terminalId = terminalId;
    state.errorCount = 0; // Reset error count on successful init

    transitionTo('ready');

    console.log('[StripeTerminalBridge] Terminal instance created successfully');
    return terminal;
  } catch (error) {
    console.error('[StripeTerminalBridge] Failed to initialize terminal:', error);
    state.lastError = error instanceof Error ? error.message : 'Unknown error';
    state.errorCount++;
    transitionTo('error');
    throw error;
  }
};

/**
 * Discover available readers
 * @param simulationMode - Use simulated terminals for testing
 * @param terminalId - Optional terminal ID if terminal is not yet initialized
 */
export const discoverReaders = async (
  simulationMode: boolean = false,
  terminalId?: string
): Promise<Reader[]> => {
  try {
    if (!state.terminal) {
      if (!terminalId) {
        throw new Error('Terminal ID is required when terminal is not initialized');
      }
      await initializeTerminal(terminalId);
    }

    if (!state.terminal) {
      throw new Error('Terminal not initialized');
    }

    transitionTo('discovering');

    console.log('[StripeTerminalBridge] Discovering readers...', { simulationMode });

    state.simulationMode = simulationMode;

    // Always discover real readers first (simulated: false)
    // This matches the working neopay_integration pattern
    const config: DiscoverConfig = {
      simulated: false
    };

    const discoverResult = await state.terminal.discoverReaders(config);
    let readers = discoverResult.discoveredReaders;

    console.log('[StripeTerminalBridge] Discovered real readers:', readers);

    // If simulation mode is enabled, manually add a simulated terminal
    // This is the pattern used by neopay_integration which works reliably
    // CRITICAL: Use 'SIMULATOR' not 'tmr_simulator' - this is client-side only, never calls Stripe API
    if (simulationMode) {
      const simulatedReader: Reader = {
        id: 'SIMULATOR',
        object: 'terminal.reader',
        device_type: 'simulated_reader',
        ip_address: '127.0.0.1',
        label: 'Terminal Simulé (Test)',
        serial_number: 'SIMULATOR-001',
        status: 'online'
      };

      // Add simulated reader at the beginning of the list if not already present
      if (!readers.some(r => r.id === 'SIMULATOR')) {
        readers = [simulatedReader, ...readers];
        console.log('[StripeTerminalBridge] Added simulated terminal for testing');
      }
    }

    console.log('[StripeTerminalBridge] Final readers list:', readers);

    transitionTo('ready');

    return readers;
  } catch (error) {
    console.error('[StripeTerminalBridge] Discovery error:', error);
    state.lastError = error instanceof Error ? error.message : 'Unknown error';
    state.errorCount++;
    transitionTo('error');
    throw error;
  }
};

/**
 * Connect to a reader
 * @param reader - The reader to connect to
 */
export const connectToReader = async (reader: Reader): Promise<Reader> => {
  try {
    if (!state.terminal) {
      throw new Error('Terminal not initialized');
    }

    transitionTo('connecting');

    console.log('[StripeTerminalBridge] Connecting to reader:', reader.label);

    state.isConnecting = true;

    // Check if this is a simulated reader (client-side only)
    const isSimulated = reader.id === 'SIMULATOR' || reader.device_type === 'simulated_reader';

    let connectedReader: Reader;

    if (isSimulated) {
      // SIMULATED CONNECTION - Don't call Stripe SDK, just fake it
      console.log('[StripeTerminalBridge] Simulated connection - skipping SDK call');

      // Fake connection delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Use the reader as-is (it's client-side only)
      connectedReader = reader;
    } else {
      // REAL TERMINAL CONNECTION - Call Stripe SDK
      connectedReader = await state.terminal.connectReader(reader, {
        fail_if_in_use: false
      });
    }

    state.connectedReader = connectedReader;
    state.connectionStatus = 'connected';
    state.isConnecting = false;
    state.errorCount = 0; // Reset error count on successful connection

    // Save to localStorage for auto-reconnect
    localStorage.setItem('last_stripe_terminal', JSON.stringify({
      id: reader.id,
      label: reader.label,
      device_type: reader.device_type
    }));

    transitionTo('connected');

    console.log('[StripeTerminalBridge] Connected to reader:', connectedReader.label);

    return connectedReader;
  } catch (error) {
    console.error('[StripeTerminalBridge] Connection error:', error);
    state.isConnecting = false;
    state.lastError = error instanceof Error ? error.message : 'Unknown error';
    state.errorCount++;
    transitionTo('error');
    throw error;
  }
};

/**
 * Disconnect from current reader
 */
export const disconnectReader = async (): Promise<void> => {
  try {
    if (!state.terminal) {
      return;
    }

    transitionTo('disconnecting');

    console.log('[StripeTerminalBridge] Disconnecting reader...');

    await state.terminal.disconnectReader();

    state.connectedReader = null;
    state.connectionStatus = 'not_connected';

    transitionTo('ready');

    console.log('[StripeTerminalBridge] Reader disconnected');
  } catch (error) {
    console.error('[StripeTerminalBridge] Disconnect error:', error);
    state.lastError = error instanceof Error ? error.message : 'Unknown error';
    state.errorCount++;
    transitionTo('error');
    throw error;
  }
};

/**
 * Update line items display on terminal
 */
export const updateLineItems = async (
  items: Array<{ description: string; amount: number; quantity: number }>,
  tax: number,
  total: number,
  currency: string
): Promise<void> => {
  try {
    if (!state.terminal) {
      throw new Error('Terminal not initialized');
    }

    console.log('[StripeTerminalBridge] Updating line items on terminal...');

    const display: ReaderDisplay = {
      type: 'cart',
      cart: {
        line_items: items,
        tax,
        total,
        currency: currency.toLowerCase()
      }
    };

    await state.terminal.setReaderDisplay(display);

    console.log('[StripeTerminalBridge] Line items updated');
  } catch (error) {
    console.error('[StripeTerminalBridge] Update line items error:', error);
    // Don't throw - this is non-critical
  }
};

/**
 * Clear terminal display
 */
export const clearReaderDisplay = async (): Promise<void> => {
  try {
    if (!state.terminal) {
      return;
    }

    await state.terminal.clearReaderDisplay();
  } catch (error) {
    console.error('[StripeTerminalBridge] Clear display error:', error);
  }
};

/**
 * Process payment with terminal
 * @param clientSecret - Payment intent client secret
 */
export const processPayment = async (clientSecret: string): Promise<PaymentIntent> => {
  console.log('[STRIPE-PAYMENT] 🚀 START', {
    hasClientSecret: !!clientSecret,
    secretPreview: clientSecret?.substring(0, 20) + '...',
    currentState: state.currentState,
    hasTerminal: !!state.terminal,
    hasReader: !!state.connectedReader
  });

  try {
    if (!state.terminal) {
      console.error('[STRIPE-PAYMENT] ❌ Terminal not initialized');
      throw new Error('Terminal not initialized');
    }

    if (!state.connectedReader) {
      console.error('[STRIPE-PAYMENT] ❌ No reader connected');
      throw new Error('No reader connected');
    }

    transitionTo('processing');

    state.isProcessing = true;

    // Check if using simulated terminal
    const isSimulated = state.connectedReader.device_type === 'simulated_reader' ||
                        state.connectedReader.id === 'SIMULATOR';

    const mode = isSimulated ? '🤖 SIMULATION' : '💳 REAL';
    console.log('[STRIPE-PAYMENT] Mode detected:', mode, {
      device_type: state.connectedReader.device_type,
      reader_id: state.connectedReader.id
    });

    if (isSimulated) {
      console.log('[STRIPE-PAYMENT] 🤖 SIMULATION MODE - Creating fake PaymentIntent');

      // Simulate 2-second processing delay
      console.log('[STRIPE-PAYMENT] ⏳ Simulating 2-second processing delay...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Create fake payment intent
      const fakePaymentIntent: PaymentIntent = {
        id: 'pi_simulated_' + Date.now(),
        object: 'payment_intent',
        amount: 0, // Will be filled from client_secret
        currency: 'chf',
        status: 'succeeded',
        created: Math.floor(Date.now() / 1000),
        livemode: false
      };

      state.isProcessing = false;
      state.errorCount = 0;
      transitionTo('connected');

      console.log('[STRIPE-PAYMENT] ✅ 🤖 Simulated payment SUCCESS', {
        payment_intent_id: fakePaymentIntent.id,
        status: fakePaymentIntent.status
      });

      return fakePaymentIntent;
    }

    // REAL TERMINAL PAYMENT FLOW
    console.log('[STRIPE-PAYMENT] 💳 REAL MODE - Starting SDK payment flow');
    console.log('[STRIPE-PAYMENT] 📲 Collecting payment method from terminal...');

    // Collect payment method
    const collectResult = await state.terminal.collectPaymentMethod(clientSecret, {
      config_override: {
        skip_tipping: true
      }
    });

    // Check if collection was cancelled
    if (!collectResult || !collectResult.paymentIntent) {
      console.warn('[STRIPE-PAYMENT] ⚠️ Payment method collection was cancelled');
      state.isProcessing = false;
      transitionTo('connected');
      throw new Error('Payment collection was cancelled');
    }

    console.log('[STRIPE-PAYMENT] ✅ Payment method collected', {
      payment_intent_id: collectResult.paymentIntent.id
    });

    console.log('[STRIPE-PAYMENT] ⚡ Processing payment with Stripe SDK...');

    // Process payment
    const processResult = await state.terminal.processPayment(collectResult.paymentIntent);

    state.isProcessing = false;
    state.errorCount = 0; // Reset error count on successful payment

    transitionTo('connected');

    console.log('[STRIPE-PAYMENT] ✅ 💳 Real payment SUCCESS', {
      payment_intent_id: processResult.paymentIntent.id,
      status: processResult.paymentIntent.status,
      amount: processResult.paymentIntent.amount,
      currency: processResult.paymentIntent.currency
    });

    return processResult.paymentIntent;
  } catch (error) {
    console.error('[STRIPE-PAYMENT] ❌ ERROR', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      currentState: state.currentState
    });
    state.isProcessing = false;
    state.lastError = error instanceof Error ? error.message : 'Unknown error';
    state.errorCount++;
    transitionTo('error');
    throw error;
  }
};

/**
 * Cancel payment collection
 */
export const cancelPayment = async (): Promise<void> => {
  try {
    if (!state.terminal) {
      console.warn('[StripeTerminalBridge] No terminal initialized');
      return;
    }

    // Check if we're actually processing a payment
    // This prevents calling cancelCollectPaymentMethod() when no collection is active
    if (!state.isProcessing) {
      console.warn('[StripeTerminalBridge] No active payment collection to cancel');
      return;
    }

    // Additional check: Verify terminal state is 'processing'
    // This ensures the FSM is in the correct state for cancellation
    if (state.currentState !== 'processing') {
      console.warn(
        `[StripeTerminalBridge] Cannot cancel - terminal state is ${state.currentState}, not processing`
      );
      return;
    }

    console.log('[StripeTerminalBridge] Cancelling payment collection...');

    // Only now is it safe to call cancelCollectPaymentMethod
    await state.terminal.cancelCollectPaymentMethod();

    state.isProcessing = false;

    // Transition back to connected state
    transitionTo('connected');

    console.log('[StripeTerminalBridge] Payment collection cancelled successfully');
  } catch (error) {
    console.error('[StripeTerminalBridge] Cancel payment error:', error);
    state.isProcessing = false;
    state.lastError = error instanceof Error ? error.message : 'Unknown error';
    transitionTo('error');
    throw error;
  }
};

/**
 * Get current bridge state
 */
export const getState = (): BridgeState => {
  return { ...state };
};

/**
 * Get last used terminal from localStorage
 */
export const getLastUsedTerminal = (): { id?: string; label?: string; device_type?: string } | null => {
  try {
    const stored = localStorage.getItem('last_stripe_terminal');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

/**
 * Check if terminal is connected
 */
export const isConnected = (): boolean => {
  return state.connectionStatus === 'connected' && state.connectedReader !== null;
};

/**
 * Get connected reader
 */
export const getConnectedReader = (): Reader | null => {
  return state.connectedReader;
};
