import { __, _ } from '../lib/i18n';
import React, { useState, useEffect } from 'react';
import { Smartphone, AlertCircle, CheckCircle, Loader2, QrCode, ExternalLink, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { cn, formatCurrency } from '../lib/utils';
import PaymentAmountDialog from './PaymentAmountDialog';
import {
  createTwintPayment,
  pollTwintPaymentStatus,
  cancelTwintPayment,
  TwintPaymentResponse,
  TwintTransactionStatus
} from '../lib/twint-api';

interface TwintPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (amount: number, transactionId: string) => void;
  maxAmount: number;
  currency: string;
  referenceDoctype: string;
  referenceDocname: string;
  customerName?: string;
}

type DialogState = 'amount' | 'qr-code' | 'processing' | 'success' | 'error' | 'timeout';

/**
 * TWINT Payment Dialog
 *
 * Flow:
 * 1. Show amount input dialog
 * 2. Create TWINT payment request
 * 3. Show QR code / payment link
 * 4. Poll payment status (every 2s, timeout 200s)
 * 5. Show success/error/timeout
 */
const TwintPaymentDialog: React.FC<TwintPaymentDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  maxAmount,
  currency,
  referenceDoctype,
  referenceDocname,
  customerName
}) => {
  const [dialogState, setDialogState] = useState<DialogState>('amount');
  const [amount, setAmount] = useState<number>(0);
  const [paymentRequest, setPaymentRequest] = useState<TwintPaymentResponse | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<TwintTransactionStatus | null>(null);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [pollingStartTime, setPollingStartTime] = useState<number>(0);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setDialogState('amount');
      setAmount(0);
      setPaymentRequest(null);
      setPaymentStatus(null);
      setError(null);
      setElapsedTime(0);
      setPollingStartTime(0);
    }
  }, [isOpen]);

  // Timer for elapsed time display
  useEffect(() => {
    if (dialogState === 'processing' && pollingStartTime > 0) {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - pollingStartTime) / 1000));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [dialogState, pollingStartTime]);

  /**
   * Handle amount confirmation
   */
  const handleAmountConfirm = async (confirmedAmount: number) => {
    setAmount(confirmedAmount);
    await createPaymentRequest(confirmedAmount);
  };

  /**
   * Create TWINT payment request
   */
  const createPaymentRequest = async (paymentAmount: number) => {
    setIsCreatingPayment(true);
    setError(null);

    try {
      const response = await createTwintPayment(
        paymentAmount,
        currency,
        referenceDoctype,
        referenceDocname,
        customerName
      );

      setPaymentRequest(response);
      setDialogState('qr-code');
    } catch (error: any) {
      console.error('Failed to create TWINT payment:', error);
      setError(error.message || 'Failed to create payment request. Please try again.');
      setDialogState('error');
    } finally {
      setIsCreatingPayment(false);
    }
  };

  /**
   * Start payment polling
   */
  const startPaymentPolling = async () => {
    if (!paymentRequest) return;

    setDialogState('processing');
    setPollingStartTime(Date.now());
    setElapsedTime(0);

    try {
      const finalStatus = await pollTwintPaymentStatus(
        paymentRequest.request_id,
        (status) => {
          // Status update callback
          setPaymentStatus(status);
        },
        200 // 200 seconds timeout
      );

      // Payment completed successfully
      setPaymentStatus(finalStatus);
      setDialogState('success');

      // Call success callback after a short delay
      setTimeout(() => {
        onSuccess(amount, finalStatus.transaction_id);
        onClose();
      }, 2000);
    } catch (error: any) {
      console.error('TWINT payment error:', error);

      // Check if timeout
      if (error.message.includes('timeout')) {
        setDialogState('timeout');
        setError('Payment timeout. The customer did not complete the payment in time.');
      } else {
        setDialogState('error');
        setError(error.message || 'Payment failed. Please try again.');
      }
    }
  };

  /**
   * Cancel payment
   */
  const handleCancelPayment = async () => {
    if (paymentRequest && dialogState === 'processing') {
      try {
        await cancelTwintPayment(paymentRequest.request_id, 'cancelled_by_user');
      } catch (error) {
        console.error('Failed to cancel payment:', error);
      }
    }
    onClose();
  };

  /**
   * Open payment link in new tab
   */
  const openPaymentLink = () => {
    if (paymentRequest?.payment_url) {
      window.open(paymentRequest.payment_url, '_blank');
    }
  };

  /**
   * Format elapsed time (MM:SS)
   */
  const formatElapsedTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Render amount dialog
   */
  if (dialogState === 'amount') {
    return (
      <PaymentAmountDialog
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={handleAmountConfirm}
        title={'TWINT Payment'}
        maxAmount={maxAmount}
        currency={currency}
        defaultAmount={maxAmount}
      />
    );
  }

  /**
   * Render main dialog
   */
  return (
    <Dialog open={isOpen} onOpenChange={handleCancelPayment}>
      <DialogContent
        onClose={handleCancelPayment}
        size="lg"
        showCloseButton={dialogState !== 'processing'}
      >
        {/* Header */}
        <DialogHeader className="bg-gray-50 border-b p-4">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            {'TWINT Payment'}
          </DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Amount Summary */}
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="text-sm text-purple-700">{'Amount to pay'}</div>
            <div className="text-3xl font-bold text-purple-900">
              {formatCurrency(amount, currency)}
            </div>
          </div>

          {/* QR Code Display State */}
          {dialogState === 'qr-code' && paymentRequest && (
            <>
              {/* QR Code */}
              {paymentRequest.qr_code && (
                <div className="flex flex-col items-center space-y-4">
                  <div className="bg-white p-4 rounded-lg border-2 border-gray-300">
                    <img
                      src={`data:image/png;base64,${paymentRequest.qr_code}`}
                      alt={__('TWINT QR Code')}
                      className="w-64 h-64"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold">{'Scan with TWINT app'}</p>
                    <p className="text-sm text-gray-600">
                      {'Open the TWINT app and scan this QR code'}
                    </p>
                  </div>
                </div>
              )}

              {/* Payment Link */}
              {paymentRequest.payment_url && (
                <div className="bg-gray-50 rounded-lg p-4 border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{'Mobile payment link'}</p>
                      <p className="text-sm text-gray-600">
                        {'Or open on mobile device'}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={openPaymentLink}
                      className="flex items-center gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {'Open Link'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">{'Instructions'}:</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                  <li>{'Open the TWINT app on your phone'}</li>
                  <li>{'Scan the QR code or click the payment link'}</li>
                  <li>{'Confirm the payment in the TWINT app'}</li>
                  <li>{'Wait for the confirmation here'}</li>
                </ol>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleCancelPayment}
                  className="flex-1"
                >
                  {'Cancel'}
                </Button>
                <Button
                  onClick={startPaymentPolling}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {'Start Monitoring'}
                </Button>
              </div>
            </>
          )}

          {/* Processing State */}
          {dialogState === 'processing' && (
            <div className="text-center py-8">
              <div className="relative mx-auto w-24 h-24 mb-4">
                <Loader2 className="h-24 w-24 animate-spin text-purple-600" />
                <Smartphone className="h-12 w-12 absolute top-6 left-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{'Waiting for Payment...'}</h3>
              <p className="text-gray-600">
                {'Please complete the payment in the TWINT app'}
              </p>

              {/* Elapsed Time */}
              <div className="flex items-center justify-center gap-2 mt-4 text-gray-500">
                <Clock className="h-4 w-4" />
                <span className="font-mono">{formatElapsedTime(elapsedTime)} / 03:20</span>
              </div>

              {/* Status Updates */}
              {paymentStatus && (
                <div className="mt-4 text-sm text-gray-600">
                  {'Status'}: <span className="font-medium">{paymentStatus.status}</span>
                </div>
              )}

              <Button
                variant="outline"
                onClick={handleCancelPayment}
                className="mt-6"
              >
                {'Cancel Payment'}
              </Button>
            </div>
          )}

          {/* Success State */}
          {dialogState === 'success' && paymentStatus && (
            <div className="text-center py-8">
              <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-16 w-16 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-green-900 mb-2">
                {'Payment Successful!'}
              </h3>
              <p className="text-2xl font-bold text-green-700">
                {formatCurrency(amount, currency)}
              </p>
              <p className="text-sm text-gray-500 mt-4">
                {'Transaction ID'}: {paymentStatus.transaction_id}
              </p>
            </div>
          )}

          {/* Error State */}
          {dialogState === 'error' && (
            <div className="text-center py-8">
              <div className="mx-auto w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="h-16 w-16 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-red-900 mb-2">
                {'Payment Failed'}
              </h3>
              <p className="text-gray-600">{error}</p>
              <div className="flex gap-3 mt-6 justify-center">
                <Button
                  variant="outline"
                  onClick={onClose}
                >
                  {'Cancel'}
                </Button>
                <Button
                  onClick={() => setDialogState('amount')}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {'Try Again'}
                </Button>
              </div>
            </div>
          )}

          {/* Timeout State */}
          {dialogState === 'timeout' && (
            <div className="text-center py-8">
              <div className="mx-auto w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                <Clock className="h-16 w-16 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold text-orange-900 mb-2">
                {'Payment Timeout'}
              </h3>
              <p className="text-gray-600">
                The payment was not completed within the allowed time (200 seconds)
              </p>
              <div className="flex gap-3 mt-6 justify-center">
                <Button
                  variant="outline"
                  onClick={onClose}
                >
                  {'Cancel'}
                </Button>
                <Button
                  onClick={() => setDialogState('amount')}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {'Try Again'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TwintPaymentDialog;
