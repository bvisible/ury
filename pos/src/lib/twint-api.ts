import { _ } from './i18n';
import { call, db } from './frappe-sdk';

// TWINT payment request interface
export interface TwintPaymentRequest {
  name: string;
  transaction_id: string;
  status: 'pending' | 'completed' | 'failed' | 'timeout' | 'cancelled';
  amount: number;
  currency: string;
  payment_url: string;
  qr_code?: string; // Base64 encoded QR code
  reference_doctype?: string;
  reference_docname?: string;
}

// TWINT payment response
export interface TwintPaymentResponse {
  success: boolean;
  request_id: string;
  transaction_id: string;
  payment_url: string;
  qr_code?: string;
  error?: string;
}

// TWINT transaction status
export interface TwintTransactionStatus {
  status: 'pending' | 'completed' | 'failed' | 'timeout' | 'cancelled';
  transaction_id: string;
  amount: number;
  currency: string;
  error_message?: string;
  payment_date?: string;
}

// TWINT configuration
export interface TwintConfig {
  enabled: boolean;
  modeOfPayment: string | null;
  merchant_id?: string;
  environment?: 'sandbox' | 'production';
}

/**
 * Create a TWINT payment request
 */
export const createTwintPayment = async (
  amount: number,
  currency: string,
  referenceDoctype: string,
  referenceDocname: string,
  customerName?: string
): Promise<TwintPaymentResponse> => {
  try {
    const response = await call.post('twint_integration.api.create_payment', {
      amount: amount,
      currency: currency,
      reference_doctype: referenceDoctype,
      reference_docname: referenceDocname,
      customer_name: customerName || 'POS Customer'
    });

    return {
      success: true,
      request_id: response.message.name,
      transaction_id: response.message.transaction_id,
      payment_url: response.message.payment_url,
      qr_code: response.message.qr_code
    };
  } catch (error) {
    console.error('Failed to create TWINT payment:', error);
    throw error;
  }
};

/**
 * Check TWINT payment status
 * Used for polling during payment process
 */
export const checkTwintPaymentStatus = async (requestId: string): Promise<TwintTransactionStatus> => {
  try {
    const request = await db.getDoc('Twint Payment Request', requestId);

    return {
      status: request.status,
      transaction_id: request.transaction_id,
      amount: request.amount,
      currency: request.currency,
      error_message: request.error_message,
      payment_date: request.payment_date
    };
  } catch (error) {
    console.error('Failed to check TWINT payment status:', error);
    throw error;
  }
};

/**
 * Poll TWINT payment status with timeout
 * Checks status every 2 seconds for up to 200 seconds
 */
export const pollTwintPaymentStatus = async (
  requestId: string,
  onStatusUpdate?: (status: TwintTransactionStatus) => void,
  timeoutSeconds: number = 200
): Promise<TwintTransactionStatus> => {
  const startTime = Date.now();
  const pollInterval = 2000; // 2 seconds
  const timeoutMs = timeoutSeconds * 1000;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const status = await checkTwintPaymentStatus(requestId);

        // Call status update callback if provided
        if (onStatusUpdate) {
          onStatusUpdate(status);
        }

        // Check if payment is completed
        if (status.status === 'completed') {
          resolve(status);
          return;
        }

        // Check if payment failed or was cancelled
        if (status.status === 'failed' || status.status === 'cancelled') {
          reject(new Error(status.error_message || 'Payment failed or was cancelled'));
          return;
        }

        // Check for timeout
        if (Date.now() - startTime > timeoutMs) {
          // Update status to timeout in backend
          await cancelTwintPayment(requestId, 'timeout');
          reject(new Error('Payment timeout after {0} seconds', [timeoutSeconds]));
          return;
        }

        // Continue polling
        setTimeout(poll, pollInterval);
      } catch (error) {
        reject(error);
      }
    };

    // Start polling
    poll();
  });
};

/**
 * Cancel a TWINT payment
 */
export const cancelTwintPayment = async (requestId: string, reason?: string): Promise<void> => {
  try {
    await call.post('twint_integration.api.cancel_payment', {
      request_id: requestId,
      reason: reason || 'cancelled_by_user'
    });
  } catch (error) {
    console.error('Failed to cancel TWINT payment:', error);
    throw error;
  }
};

/**
 * Get TWINT configuration from POS Profile
 */
export const getTwintConfig = async (posProfile: string): Promise<TwintConfig> => {
  try {
    const profile = await db.getDoc('POS Profile', posProfile);

    // Also get TWINT Settings to check if configured
    let twintSettings = null;
    try {
      twintSettings = await db.getDoc('Twint Settings', 'Twint Settings');
    } catch (e) {
      console.warn('TWINT Settings not found');
    }

    return {
      enabled: (profile.enable_twint || profile.custom_enable_twint || false) && twintSettings !== null,
      modeOfPayment: profile.twint_mode_of_payment || profile.custom_twint_mode_of_payment || null,
      merchant_id: twintSettings?.merchant_id,
      environment: twintSettings?.environment || 'production'
    };
  } catch (error) {
    console.error('Failed to get TWINT config:', error);
    return {
      enabled: false,
      modeOfPayment: null
    };
  }
};

/**
 * Check if TWINT is available and configured
 */
export const isTwintAvailable = async (): Promise<boolean> => {
  try {
    const settings = await db.getDoc('Twint Settings', 'Twint Settings');
    return settings.enabled === 1 && !!settings.merchant_id;
  } catch (error) {
    return false;
  }
};

/**
 * Get TWINT transaction details
 */
export const getTwintTransaction = async (transactionId: string): Promise<TwintTransactionStatus> => {
  try {
    const transaction = await db.getDoc('Twint Transaction', transactionId);

    return {
      status: transaction.status,
      transaction_id: transaction.name,
      amount: transaction.amount,
      currency: transaction.currency,
      error_message: transaction.error_message,
      payment_date: transaction.payment_date
    };
  } catch (error) {
    console.error('Failed to get TWINT transaction:', error);
    throw error;
  }
};

/**
 * Verify TWINT payment before creating invoice
 * This ensures the payment was actually completed before proceeding
 */
export const verifyTwintPayment = async (
  transactionId: string,
  expectedAmount: number
): Promise<boolean> => {
  try {
    const transaction = await getTwintTransaction(transactionId);

    // Check if transaction is completed and amount matches
    if (transaction.status !== 'completed') {
      console.error('TWINT transaction not completed:', transaction.status);
      return false;
    }

    if (Math.abs(transaction.amount - expectedAmount) > 0.01) {
      console.error(
        'TWINT amount mismatch: expected {0}, got {1}', [expectedAmount, transaction.amount]
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to verify TWINT payment:', error);
    return false;
  }
};
