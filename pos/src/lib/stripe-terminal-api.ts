import { _ } from './i18n';
import { call, db } from './frappe-sdk';

// Declare window extensions for Stripe Terminal SDK
declare global {
  interface Window {
    neopay_integration?: {
      terminal: {
        init: (terminalId: string) => Promise<any>;
        connect: (terminalInstance: any) => Promise<void>;
        collectPaymentMethod: (terminalInstance: any, clientSecret: string) => Promise<any>;
        processPayment: (terminalInstance: any, paymentIntent: any) => Promise<any>;
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
  try {
    // Check if SDK is already loaded
    if (window.neopay_integration && window.neopay_integration.terminal) {
      console.log('Stripe Terminal SDK already loaded');
      return true;
    }

    console.log('Loading stripe_terminal_handler.js');

    // Load the SDK script
    await new Promise<void>((resolve, reject) => {
      // Check if script is already in DOM
      if (document.querySelector('script[src*="stripe_terminal_handler.js"]')) {
        console.log('Script stripe_terminal_handler.js already in DOM');
        return resolve();
      }

      const script = document.createElement('script');
      script.src = '/assets/neopay_integration/js/stripe_terminal_handler.js';
      script.onload = () => {
        console.log('stripe_terminal_handler.js loaded successfully');
        resolve();
      };
      script.onerror = (err) => {
        console.error('Error loading stripe_terminal_handler.js:', err);
        reject(new Error('Failed to load Stripe Terminal SDK'));
      };
      document.head.appendChild(script);
    });

    // Verify SDK is available
    if (!window.neopay_integration || !window.neopay_integration.terminal) {
      throw new Error('Stripe Terminal SDK loaded but neopay_integration.terminal is not available');
    }

    return true;
  } catch (error) {
    console.error('Error initializing Stripe Terminal SDK:', error);
    throw error;
  }
};

/**
 * Get connection token for Stripe Terminal SDK
 */
export const getConnectionToken = async (): Promise<string> => {
  try {
    const response = await call.post('neopay_integration.api.get_connection_token', {});
    return response.message;
  } catch (error) {
    console.error('Failed to get connection token:', error);
    throw error;
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
  try {
    const response = await call.post('neopay_integration.api.create_payment_intent', {
      terminal_id: terminalId || 'default',
      amount: amount * 100, // Convert to cents
      currency: currency.toLowerCase(),
      reference_doctype: referenceDoctype,
      reference_docname: referenceDocname,
      description: description || `Payment for ${referenceDocname}`
    });

    return response.message;
  } catch (error) {
    console.error('Failed to create payment intent:', error);
    throw error;
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
  transactionId: string,
  status: string,
  paymentIntentId?: string
): Promise<void> => {
  try {
    await call.post('neopay_integration.api.update_transaction_status', {
      transaction_id: transactionId,
      status: status,
      payment_intent_id: paymentIntentId
    });
  } catch (error) {
    console.error('Failed to update transaction status:', error);
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
  try {
    // Ensure SDK is initialized
    await initializeStripeSDK();

    console.log('Connecting to terminal:', terminalId);

    // Verify terminal exists
    const terminalInfo = await getTerminalInfo(terminalId);
    if (!terminalInfo) {
      throw new Error(`Terminal not found: ${terminalId}`);
    }

    // Initialize the terminal instance
    window.stripeTerminalInstance = await window.neopay_integration!.terminal.init(terminalId);

    // Connect to the terminal
    await window.neopay_integration!.terminal.connect(window.stripeTerminalInstance);

    console.log('Successfully connected to terminal:', terminalId);
    return true;
  } catch (error) {
    console.error('Failed to connect to terminal:', error);
    throw error;
  }
};

/**
 * Process payment using connected terminal
 * @param clientSecret - Payment intent client secret
 * @returns Promise<any> - Payment result
 */
export const processPaymentWithTerminal = async (clientSecret: string): Promise<any> => {
  try {
    if (!window.stripeTerminalInstance) {
      throw new Error('No terminal connected. Please connect to a terminal first.');
    }

    console.log('Collecting payment method from terminal...');

    // Collect payment method
    const paymentMethod = await window.neopay_integration!.terminal.collectPaymentMethod(
      window.stripeTerminalInstance,
      clientSecret
    );

    console.log('Processing payment...');

    // Process the payment
    const result = await window.neopay_integration!.terminal.processPayment(
      window.stripeTerminalInstance,
      paymentMethod
    );

    console.log('Payment processed successfully:', result);
    return result;
  } catch (error) {
    console.error('Failed to process payment with terminal:', error);
    throw error;
  }
};
