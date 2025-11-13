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

// Bridge state management
interface BridgeState {
  terminal: Terminal | null;
  isInitialized: boolean;
  isConnecting: boolean;
  isProcessing: boolean;
  connectedReader: Reader | null;
  connectionStatus: 'not_connected' | 'connecting' | 'connected';
  lastError: string | null;
  simulationMode: boolean;
}

const state: BridgeState = {
  terminal: null,
  isInitialized: false,
  isConnecting: false,
  isProcessing: false,
  connectedReader: null,
  connectionStatus: 'not_connected',
  lastError: null,
  simulationMode: false
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

    // Verify SDK is available
    if (!window.StripeTerminal) {
      throw new Error('Stripe Terminal SDK loaded but StripeTerminal is not available');
    }

    console.log('[StripeTerminalBridge] SDK initialization complete');
    return true;
  } catch (error) {
    console.error('[StripeTerminalBridge] Initialization error:', error);
    state.lastError = error instanceof Error ? error.message : 'Unknown error';
    throw error;
  }
};

/**
 * Get connection token from backend
 */
const fetchConnectionToken = async (): Promise<string> => {
  try {
    console.log('[StripeTerminalBridge] Fetching connection token...');
    const response = await call.post('neopay_integration.api.get_connection_token_any', {});
    return response.message;
  } catch (error) {
    console.error('[StripeTerminalBridge] Failed to fetch connection token:', error);
    throw error;
  }
};

/**
 * Initialize Terminal instance
 * Creates the Terminal object with callbacks
 */
export const initializeTerminal = async (): Promise<Terminal> => {
  try {
    // Ensure SDK is loaded
    await init();

    if (!window.StripeTerminal) {
      throw new Error('Stripe Terminal SDK not available');
    }

    console.log('[StripeTerminalBridge] Creating Terminal instance...');

    // Create terminal instance
    const terminal = window.StripeTerminal.create({
      onFetchConnectionToken: fetchConnectionToken,
      onUnexpectedReaderDisconnect: () => {
        console.warn('[StripeTerminalBridge] Unexpected reader disconnect');
        state.connectedReader = null;
        state.connectionStatus = 'not_connected';
      },
      onConnectionStatusChange: (event: ConnectionStatusEvent) => {
        console.log('[StripeTerminalBridge] Connection status:', event.status);
        state.connectionStatus = event.status;
      }
    });

    state.terminal = terminal;
    state.isInitialized = true;

    console.log('[StripeTerminalBridge] Terminal instance created');
    return terminal;
  } catch (error) {
    console.error('[StripeTerminalBridge] Failed to initialize terminal:', error);
    state.lastError = error instanceof Error ? error.message : 'Unknown error';
    throw error;
  }
};

/**
 * Discover available readers
 * @param simulationMode - Use simulated terminals for testing
 */
export const discoverReaders = async (simulationMode: boolean = false): Promise<Reader[]> => {
  try {
    if (!state.terminal) {
      await initializeTerminal();
    }

    if (!state.terminal) {
      throw new Error('Terminal not initialized');
    }

    console.log('[StripeTerminalBridge] Discovering readers...', { simulationMode });

    state.simulationMode = simulationMode;

    const config: DiscoverConfig = {
      simulated: simulationMode
    };

    const discoverResult = await state.terminal.discoverReaders(config);

    console.log('[StripeTerminalBridge] Discovered readers:', discoverResult.discoveredReaders);

    return discoverResult.discoveredReaders;
  } catch (error) {
    console.error('[StripeTerminalBridge] Discovery error:', error);
    state.lastError = error instanceof Error ? error.message : 'Unknown error';
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

    console.log('[StripeTerminalBridge] Connecting to reader:', reader.label);

    state.isConnecting = true;

    // Configure simulator if in simulation mode
    if (state.simulationMode && reader.device_type === 'simulated') {
      console.log('[StripeTerminalBridge] Configuring simulator...');
      state.terminal.setSimulatorConfiguration({
        testCardNumber: '4242424242424242'
      });
    }

    const connectedReader = await state.terminal.connectReader(reader, {
      fail_if_in_use: false
    });

    state.connectedReader = connectedReader;
    state.connectionStatus = 'connected';
    state.isConnecting = false;

    // Save to localStorage for auto-reconnect
    localStorage.setItem('last_stripe_terminal', JSON.stringify({
      id: reader.id,
      label: reader.label,
      device_type: reader.device_type
    }));

    console.log('[StripeTerminalBridge] Connected to reader:', connectedReader.label);

    return connectedReader;
  } catch (error) {
    console.error('[StripeTerminalBridge] Connection error:', error);
    state.isConnecting = false;
    state.lastError = error instanceof Error ? error.message : 'Unknown error';
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

    console.log('[StripeTerminalBridge] Disconnecting reader...');

    await state.terminal.disconnectReader();

    state.connectedReader = null;
    state.connectionStatus = 'not_connected';

    console.log('[StripeTerminalBridge] Reader disconnected');
  } catch (error) {
    console.error('[StripeTerminalBridge] Disconnect error:', error);
    state.lastError = error instanceof Error ? error.message : 'Unknown error';
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
  try {
    if (!state.terminal) {
      throw new Error('Terminal not initialized');
    }

    if (!state.connectedReader) {
      throw new Error('No reader connected');
    }

    console.log('[StripeTerminalBridge] Collecting payment method...');
    state.isProcessing = true;

    // Collect payment method
    const collectResult = await state.terminal.collectPaymentMethod(clientSecret, {
      config_override: {
        skip_tipping: true
      }
    });

    console.log('[StripeTerminalBridge] Payment method collected, processing payment...');

    // Process payment
    const processResult = await state.terminal.processPayment(collectResult.paymentIntent);

    state.isProcessing = false;

    console.log('[StripeTerminalBridge] Payment processed successfully:', processResult.paymentIntent);

    return processResult.paymentIntent;
  } catch (error) {
    console.error('[StripeTerminalBridge] Payment processing error:', error);
    state.isProcessing = false;
    state.lastError = error instanceof Error ? error.message : 'Unknown error';
    throw error;
  }
};

/**
 * Cancel payment collection
 */
export const cancelPayment = async (): Promise<void> => {
  try {
    if (!state.terminal) {
      return;
    }

    console.log('[StripeTerminalBridge] Cancelling payment...');

    await state.terminal.cancelCollectPaymentMethod();

    state.isProcessing = false;

    console.log('[StripeTerminalBridge] Payment cancelled');
  } catch (error) {
    console.error('[StripeTerminalBridge] Cancel payment error:', error);
    state.lastError = error instanceof Error ? error.message : 'Unknown error';
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
