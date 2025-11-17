import { _ } from './i18n';
import { call, db } from './frappe-sdk';
import { __ } from '../lib/i18n';

// Declare window extensions for Stripe Terminal SDK
declare global {
  interface Window {
    neopay_integration?: {
      terminal: {
        init: (terminalId: string) =>Promise<any>;
        connect: (terminalInstance: any) =>Promise<void>;
        collectPaymentMethod: (terminalInstance: any, clientSecret: string) =>Promise<any>;
        processPayment: (terminalInstance: any, paymentIntent: any) =>Promise<any>;
      };
    };
    stripeTerminalInstance?: any;
  }
}

// Terminal information interface
export interface StripeTerminal {
  name: string;
  terminal_id: string;
  label: string;
  device_type: string;
  serial_number: string;
  ip_address?: string;
  location?: string;
  status?: 'online' | 'offline';
}

// Payment intent response
export interface PaymentIntentResponse {
  success: boolean;
  payment_intent_id: string;
  client_secret: string;
  transaction_id?: string;
  error?: string;
}

// Transaction status
export interface TransactionStatus {
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  payment_intent_id: string;
  amount?: number;
  currency?: string;
  error_message?: string;
}

// Terminal status
export interface TerminalStatus {
  terminal_id: string;
  status: 'online' | 'offline';
  device_type: string;
  ip_address?: string;
  location?: string;
}

/**
 * Initialize the Stripe Terminal SDK
 * Loads the stripe_terminal_handler.js script if not already loaded
 */
export const initializeStripeSDK = async (): Promise<boolean> => {
  console.log('[STRIPE] 🔧 initializeStripeSDK START');

  try {
    // Check if SDK is already loaded
    if (window.neopay_integration && window.neopay_integration.terminal) {
      console.log('[STRIPE] ✅ SDK already loaded');
      return true;
    }

    console.log('[STRIPE] 📦 Loading stripe_terminal_handler.js from /assets/neopay_integration/js/');

    // Load the SDK script
    await new Promise<void>((resolve, reject) => {
      // Check if script is already in DOM
      if (document.querySelector('script[src*="stripe_terminal_handler.js"]')) {
        console.log('[STRIPE] ✅ Script already in DOM');
        return resolve();
      }

      const script = document.createElement('script');
      script.src = '/assets/neopay_integration/js/stripe_terminal_handler.js';
      script.onload = () => {
        console.log('[STRIPE] ✅ stripe_terminal_handler.js loaded successfully');
        resolve();
      };
      script.onerror = (err) => {
        console.error('[STRIPE] ❌ Error loading stripe_terminal_handler.js:', err);
        reject(new Error('Failed to load Stripe Terminal SDK'));
      };
      document.head.appendChild(script);
    });

    // Verify SDK is available
    if (!window.neopay_integration || !window.neopay_integration.terminal) {
      console.error('[STRIPE] ❌ SDK loaded but neopay_integration.terminal not available');
      throw new Error(__('Stripe Terminal SDK loaded but neopay_integration.terminal is not available'));
    }

    console.log('[STRIPE] ✅ initializeStripeSDK SUCCESS');
    return true;
  } catch (error) {
    console.error('[STRIPE] ❌ initializeStripeSDK ERROR:', error);
    throw error;
  }
};

/**
 * Get connection token for Stripe Terminal SDK
 */
export const getConnectionToken = async (terminal: string): Promise<string> => {
  console.log('[STRIPE] 🔑 getConnectionToken START', { terminal });
  try {
    const response = await call.post('neopay_integration.api.get_connection_token', {
      terminal: terminal
    });
    console.log('[STRIPE] ✅ getConnectionToken SUCCESS', {
      hasMessage: !!response.message,
      secretPreview: (response.message || response)?.substring(0, 15) + '...'
    });
    // Backend returns the secret string directly, not wrapped in message
    return response.message || response;
  } catch (error) {
    console.error('[STRIPE] ❌ getConnectionToken ERROR', { terminal, error });
    throw error;
  }
};

/**
 * Minimum payment amounts by currency (in base units, not cents)
 */
const MINIMUM_AMOUNTS: Record<string, number> = {
  chf: 0.50,
  eur: 0.50,
  usd: 0.50,
  gbp: 0.30
};

/**
 * Validate payment amount for currency
 * @throws Error if amount is invalid
 */
const validatePaymentAmount = (amount: number, currency: string): void => {
  if (amount <= 0) {
    throw new Error(_('Le montant doit être supérieur à zéro'));
  }

  const currencyLower = currency.toLowerCase();
  const minimumAmount = MINIMUM_AMOUNTS[currencyLower] || 0.50;

  if (amount < minimumAmount) {
    throw new Error(
      _(`Le montant minimum pour ${currency.toUpperCase()} est ${minimumAmount.toFixed(2)}`)
    );
  }
};

/**
 * Create a payment intent for terminal payment
 */
export const createPaymentIntent = async (
  amount: number,
  currency: string,
  referenceDoctype: string,
  referenceDocname: string,
  description?: string,
  terminalId?: string
): Promise<PaymentIntentResponse> => {
  console.log('[STRIPE] 💰 createPaymentIntent START', {
    amount,
    currency,
    terminalId,
    referenceDoctype,
    referenceDocname
  });

  try {
    // Validate terminal ID
    if (!terminalId) {
      console.error('[STRIPE] ❌ Terminal ID missing');
      throw new Error(_('L\'ID du terminal est requis'));
    }

    // Validate amount
    console.log('[STRIPE] 🔍 Validating amount', { amount, currency });
    validatePaymentAmount(amount, currency);

    // Backend accepts: terminal_id, amount (in cents), currency
    const requestData = {
      terminal_id: terminalId,
      amount: Math.round(amount * 100), // Convert to cents and round
      currency: currency.toLowerCase()
    };

    console.log('[STRIPE] 📤 API Request', {
      endpoint: 'neopay_integration.api.create_payment_intent',
      requestData
    });

    const response = await call.post('neopay_integration.api.create_payment_intent', requestData);

    console.log('[STRIPE] 📥 API Response received', {
      hasMessage: !!response.message,
      responseKeys: Object.keys(response.message || response)
    });

    if (!response.message) {
      console.error('[STRIPE] ❌ Invalid server response - no message field');
      throw new Error(_('Réponse invalide du serveur'));
    }

    const result = response.message;

    // Validate response has required fields
    if (!result.client_secret) {
      console.error('[STRIPE] ❌ Missing client_secret in response');
      throw new Error(_('Secret client manquant dans la réponse'));
    }

    if (!result.payment_intent_id) {
      console.error('[STRIPE] ❌ Missing payment_intent_id in response');
      throw new Error(_('ID d\'intention de paiement manquant'));
    }

    console.log('[STRIPE] ✅ createPaymentIntent SUCCESS', {
      payment_intent_id: result.payment_intent_id,
      transaction_id: result.transaction_id,
      hasClientSecret: !!result.client_secret
    });

    return result;
  } catch (error: any) {
    console.error('[STRIPE] ❌ createPaymentIntent ERROR', {
      error,
      httpStatus: error.httpStatus,
      exc_type: error.exc_type,
      message: error.message,
      stack: error.stack
    });

    // Translate common Stripe errors to French
    let errorMessage = error.message || _('Échec de création de l\'intention de paiement');

    if (errorMessage.includes('Terminal ID is required')) {
      errorMessage = _('L\'ID du terminal est requis');
    } else if (errorMessage.includes('not found')) {
      errorMessage = _('Terminal non trouvé');
    } else if (errorMessage.includes('amount')) {
      errorMessage = _('Montant invalide');
    }

    throw new Error(errorMessage);
  }
};

/**
 * Process payment with Stripe Terminal
 * This function should be called after terminal is connected and ready
 */
export const processTerminalPayment = async (
  terminalId: string,
  amount: number,
  currency: string,
  referenceDoctype: string,
  referenceDocname: string
): Promise<PaymentIntentResponse> => {
  try {
    const response = await call.post('neopay_integration.terminal.processPayment', {
      terminal_id: terminalId,
      amount: amount,
      currency: currency,
      reference_doctype: referenceDoctype,
      reference_docname: referenceDocname
    });

    return response.message;
  } catch (error) {
    console.error('Failed to process terminal payment:', error);
    throw error;
  }
};

/**
 * Get available terminals from POS Profile
 */
export const getAvailableTerminals = async (posProfile: string): Promise<StripeTerminal[]> => {
  try {
    // Get POS Profile to find linked terminals
    const profile = await db.getDoc('POS Profile', posProfile);

    // Check both custom_enable_stripe_terminal and enable_stripe_terminal
    if (!profile.custom_enable_stripe_terminal && !profile.enable_stripe_terminal) {
      return [];
    }

    // Get all terminals (remove status filter to see all available terminals)
    // The status will be checked when connecting to the terminal
    // Only request basic fields to avoid permission issues
    const terminals = await db.getDocList('Stripe Terminal', {
      fields: ['name', 'label', 'device_type', 'status']
    });

    return terminals as StripeTerminal[];
  } catch (error) {
    console.error('Failed to get available terminals:', error);
    return [];
  }
};

/**
 * Get terminal status
 */
export const getTerminalStatus = async (terminalId: string): Promise<TerminalStatus | null> => {
  try {
    const terminal = await db.getDoc('Stripe Terminal', terminalId);

    return {
      terminal_id: terminal.terminal_id,
      status: terminal.status || 'offline',
      device_type: terminal.device_type,
      ip_address: terminal.ip_address,
      location: terminal.location
    };
  } catch (error) {
    console.error('Failed to get terminal status:', error);
    return null;
  }
};

/**
 * Update transaction status after payment
 */
export const updateTransactionStatus = async (
  paymentIntentId: string,
  status: string,
  simulated: boolean = false
): Promise<void> => {
  const simFlag = simulated ? '🤖 SIMULATION' : '💳 REAL';
  console.log('[STRIPE] 🔄 updateTransactionStatus START', {
    paymentIntentId,
    status,
    mode: simFlag
  });

  try {
    await call.post('neopay_integration.api.update_transaction_status', {
      payment_intent_id: paymentIntentId,
      status: status,
      simulated: simulated
    });
    console.log('[STRIPE] ✅ updateTransactionStatus SUCCESS', { status, mode: simFlag });
  } catch (error) {
    console.error('[STRIPE] ❌ updateTransactionStatus ERROR', { error, paymentIntentId, status });
    throw error;
  }
};

/**
 * Check transaction status
 */
export const checkTransactionStatus = async (transactionId: string): Promise<TransactionStatus> => {
  try {
    const transaction = await db.getDoc('Stripe Transaction', transactionId);

    return {
      status: transaction.status,
      payment_intent_id: transaction.payment_intent_id,
      amount: transaction.amount,
      currency: transaction.currency,
      error_message: transaction.error_message
    };
  } catch (error) {
    console.error('Failed to check transaction status:', error);
    throw error;
  }
};

/**
 * Cancel a payment intent
 */
export const cancelPaymentIntent = async (paymentIntentId: string): Promise<void> => {
  try {
    await call.post('neopay_integration.api.cancel_payment_intent', {
      payment_intent_id: paymentIntentId
    });
  } catch (error) {
    console.error('Failed to cancel payment intent:', error);
    throw error;
  }
};

/**
 * Get Stripe Terminal configuration from POS Profile
 */
export const getStripeTerminalConfig = async (posProfile: string) => {
  try {
    const profile = await db.getDoc('POS Profile', posProfile);

    return {
      enabled: profile.enable_stripe_terminal || profile.custom_enable_stripe_terminal || false,
      modeOfPayment: profile.stripe_mode_of_payment || profile.custom_stripe_mode_of_payment || null,
      defaultTerminal: profile.stripe_terminal || profile.custom_stripe_terminal || null
    };
  } catch (error) {
    console.error('Failed to get Stripe Terminal config:', error);
    return {
      enabled: false,
      modeOfPayment: null,
      defaultTerminal: null
    };
  }
};

/**
 * Get terminal information by ID
 */
export const getTerminalInfo = async (terminalId: string): Promise<any> => {
  try {
    const terminal = await db.getDoc('Stripe Terminal', terminalId);
    return terminal;
  } catch (error) {
    console.error('Failed to get terminal info:', error);
    return null;
  }
};

/**
 * Connect to a specific Stripe Terminal
 * @param terminalId - The ID/name of the terminal to connect to
 * @returns Promise<boolean> - Success status
 */
export const connectToTerminal = async (terminalId: string): Promise<boolean> => {
  console.log('[STRIPE] 🔌 connectToTerminal START', { terminalId });

  try {
    // Ensure SDK is initialized
    await initializeStripeSDK();

    // Verify terminal exists
    console.log('[STRIPE] 🔍 Verifying terminal exists:', terminalId);
    const terminalInfo = await getTerminalInfo(terminalId);
    if (!terminalInfo) {
      console.error('[STRIPE] ❌ Terminal not found:', terminalId);
      throw new Error(`Terminal not found: ${terminalId}`);
    }
    console.log('[STRIPE] ✅ Terminal found', {
      label: terminalInfo.label,
      device_type: terminalInfo.device_type
    });

    // Initialize the terminal instance
    console.log('[STRIPE] 🔧 Initializing terminal instance...');
    window.stripeTerminalInstance = await window.neopay_integration!.terminal.init(terminalId);

    // Connect to the terminal
    console.log('[STRIPE] 🔗 Connecting to terminal...');
    await window.neopay_integration!.terminal.connect(window.stripeTerminalInstance);

    console.log('[STRIPE] ✅ connectToTerminal SUCCESS', { terminalId });
    return true;
  } catch (error) {
    console.error('[STRIPE] ❌ connectToTerminal ERROR', { terminalId, error });
    throw error;
  }
};

/**
 * Process payment using connected terminal
 * @param clientSecret - Payment intent client secret
 * @returns Promise<any> - Payment result
 */
export const processPaymentWithTerminal = async (clientSecret: string): Promise<any> => {
  console.log('[STRIPE] 💳 processPaymentWithTerminal START', {
    hasClientSecret: !!clientSecret,
    secretPreview: clientSecret?.substring(0, 20) + '...'
  });

  try {
    if (!window.stripeTerminalInstance) {
      console.error('[STRIPE] ❌ No terminal connected');
      throw new Error(__('No terminal connected. Please connect to a terminal first.'));
    }

    console.log('[STRIPE] 📲 Collecting payment method from terminal...');

    // Collect payment method
    const paymentMethod = await window.neopay_integration!.terminal.collectPaymentMethod(
      window.stripeTerminalInstance,
      clientSecret
    );

    console.log('[STRIPE] ✅ Payment method collected', { paymentMethod });

    console.log('[STRIPE] ⚡ Processing payment...');

    // Process the payment
    const result = await window.neopay_integration!.terminal.processPayment(
      window.stripeTerminalInstance,
      paymentMethod
    );

    console.log('[STRIPE] ✅ processPaymentWithTerminal SUCCESS', { result });
    return result;
  } catch (error) {
    console.error('[STRIPE] ❌ processPaymentWithTerminal ERROR', { error });
    throw error;
  }
};
