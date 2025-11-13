import { __, _ } from '../lib/i18n';
import React, { useState, useEffect } from 'react';
import { CreditCard, AlertCircle, CheckCircle, Loader2, Wifi, WifiOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { cn, formatCurrency } from '../lib/utils';
import PaymentAmountDialog from './PaymentAmountDialog';
import {
  getAvailableTerminals,
  createPaymentIntent,
  StripeTerminal,
  PaymentIntentResponse
} from '../lib/stripe-terminal-api';
import * as StripeBridge from '../lib/stripe-bridge';

interface StripeTerminalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (amount: number, transactionId: string, paymentIntentId: string) => void;
  maxAmount: number;
  currency: string;
  posProfile: string;
  referenceDoctype: string;
  referenceDocname: string;
}

type DialogState = 'terminal-selection' | 'amount' | 'processing' | 'success' | 'error';

/**
 * Stripe Terminal Payment Dialog
 *
 * Flow:
 * 1. Show amount input dialog
 * 2. Show terminal selection
 * 3. Process payment on terminal
 * 4. Show success/error
 */
const StripeTerminalDialog: React.FC<StripeTerminalDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  maxAmount,
  currency,
  posProfile,
  referenceDoctype,
  referenceDocname
}) => {
  const [dialogState, setDialogState] = useState<DialogState>('terminal-selection');
  const [amount, setAmount] = useState<number>(0);
  const [terminals, setTerminals] = useState<any[]>([]);
  const [selectedTerminal, setSelectedTerminal] = useState<any | null>(null);
  const [isLoadingTerminals, setIsLoadingTerminals] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentResult, setPaymentResult] = useState<PaymentIntentResponse | null>(null);
  const [simulationMode, setSimulationMode] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setDialogState('terminal-selection');
      setAmount(0);
      setSelectedTerminal(null);
      setError(null);
      setPaymentResult(null);
    }
  }, [isOpen]);

  // Load terminals when moving to terminal selection
  useEffect(() => {
    if (dialogState === 'terminal-selection' && terminals.length === 0) {
      loadAvailableTerminals();
    }
  }, [dialogState]);

  /**
   * Load available terminals using Stripe Terminal SDK
   */
  const loadAvailableTerminals = async () => {
    setIsLoadingTerminals(true);
    try {
      // Initialize terminal first
      await StripeBridge.initializeTerminal();

      // Discover readers using SDK
      const discoveredReaders = await StripeBridge.discoverReaders(simulationMode);

      // Get ERPNext terminals to map names
      const erpnextTerminals = await getAvailableTerminals(posProfile);

      // Map SDK readers with ERPNext terminal names
      const mappedTerminals = discoveredReaders.map(reader => {
        // Find matching ERPNext terminal by label
        const erpnextTerminal = erpnextTerminals.find(t => t.label === reader.label);
        return {
          ...reader,
          erpnextName: erpnextTerminal?.name || reader.label // Use ERPNext name for API calls
        };
      });

      setTerminals(mappedTerminals);

      // Auto-select last used terminal or first terminal if only one available
      const lastUsed = StripeBridge.getLastUsedTerminal();
      if (lastUsed && mappedTerminals.find(r => r.id === lastUsed.id)) {
        const reader = mappedTerminals.find(r => r.id === lastUsed.id);
        if (reader) {
          setSelectedTerminal(reader);
        }
      } else if (mappedTerminals.length === 1) {
        setSelectedTerminal(mappedTerminals[0]);
      }
    } catch (error) {
      console.error('Failed to load terminals:', error);
      setError('Failed to load terminals. Please try again.');
    } finally {
      setIsLoadingTerminals(false);
    }
  };

  /**
   * Handle amount confirmation and process payment
   */
  const handleAmountConfirm = async (confirmedAmount: number) => {
    setAmount(confirmedAmount);
    // Start processing payment
    await handleProcessPayment(confirmedAmount);
  };

  /**
   * Handle terminal selection
   */
  const handleTerminalSelect = (reader: any) => {
    setSelectedTerminal(reader);
  };

  /**
   * Handle terminal selection and move to amount input
   */
  const handleContinueToAmount = () => {
    if (!selectedTerminal) {
      setError('Please select a terminal');
      return;
    }
    setDialogState('amount');
  };

  /**
   * Process payment using Stripe Terminal SDK
   * Flow:
   * 1. Connect to selected terminal
   * 2. Create payment intent
   * 3. Collect payment method from terminal
   * 4. Process payment
   */
  const handleProcessPayment = async (paymentAmount: number) => {
    if (!selectedTerminal) {
      setError('Please select a terminal');
      return;
    }

    setIsProcessing(true);
    setDialogState('processing');
    setError(null);

    try {
      // Step 1: Connect to terminal
      console.log('Connecting to terminal:', selectedTerminal.label);
      await StripeBridge.connectToReader(selectedTerminal);

      // Step 2: Create payment intent
      console.log('Creating payment intent...');
      console.log('Selected terminal object:', selectedTerminal);
      console.log('Terminal erpnextName:', (selectedTerminal as any).erpnextName);
      console.log('Terminal label:', selectedTerminal.label);

      const terminalId = (selectedTerminal as any).erpnextName || selectedTerminal.label;
      console.log('Using terminal ID:', terminalId);
      console.log('Payment details:', {
        amount: paymentAmount,
        currency,
        referenceDoctype,
        referenceDocname,
        terminalId
      });

      const paymentIntent = await createPaymentIntent(
        paymentAmount,
        currency,
        referenceDoctype,
        referenceDocname,
        `Payment for ${referenceDocname}`,
        terminalId
      );

      if (!paymentIntent.success || !paymentIntent.client_secret) {
        throw new Error('Failed to create payment intent');
      }

      // Step 3 & 4: Collect payment method and process payment using connected terminal
      console.log('Processing payment with terminal...');
      const result = await StripeBridge.processPayment(paymentIntent.client_secret);

      // Extract transaction ID from result
      const transactionId = result.charges?.data[0]?.id || paymentIntent.transaction_id || result.id;

      // Payment successful
      setPaymentResult({
        success: true,
        payment_intent_id: result.id,
        client_secret: paymentIntent.client_secret,
        transaction_id: transactionId
      });
      setDialogState('success');

      // Call success callback after a short delay to show success animation
      setTimeout(() => {
        onSuccess(
          paymentAmount,
          transactionId,
          result.id
        );
        onClose();
      }, 2000);
    } catch (error: any) {
      console.error('Payment processing error:', error);
      setError(error.message || 'Payment failed. Please try again.');
      setDialogState('error');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Render amount dialog
   */
  if (dialogState === 'amount') {
    return (
      <PaymentAmountDialog
        isOpen={isOpen && dialogState === 'amount'}
        onClose={onClose}
        onConfirm={handleAmountConfirm}
        title={'Stripe Terminal Payment'}
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        onClose={onClose}
        size="lg"
        showCloseButton={dialogState !== 'processing'}
      >
        {/* Header */}
        <DialogHeader className="bg-gray-50 border-b p-4">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {'Stripe Terminal Payment'}
          </DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Amount Summary - only show after terminal selection */}
          {dialogState !== 'terminal-selection' && amount > 0 && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-sm text-blue-700">{'Amount to charge'}</div>
              <div className="text-3xl font-bold text-blue-900">
                {formatCurrency(amount, currency)}
              </div>
            </div>
          )}

          {/* Terminal Selection State */}
          {dialogState === 'terminal-selection' && (
            <>
              {/* Terminal List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{'Select Terminal'}</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadAvailableTerminals}
                    disabled={isLoadingTerminals}
                  >
                    {isLoadingTerminals ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Refresh'
                    )}
                  </Button>
                </div>

                {isLoadingTerminals ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                    <p className="text-sm text-gray-500 mt-2">{'Loading terminals...'}</p>
                  </div>
                ) : terminals.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <AlertCircle className="h-12 w-12 mx-auto mb-2" />
                    <p>{'No terminals available'}</p>
                    <p className="text-sm">{'Please check your terminal configuration'}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {terminals.map((reader) => (
                      <button
                        key={reader.id || reader.label}
                        onClick={() => handleTerminalSelect(reader)}
                        className={cn(
                          "w-full p-4 border-2 rounded-lg text-left transition-all",
                          "hover:bg-gray-50",
                          selectedTerminal?.id === reader.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-semibold">{reader.label}</div>
                            <div className="text-sm text-gray-500">
                              {reader.device_type}
                              {reader.serial_number && ` • ${reader.serial_number}`}
                              {simulationMode && <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">SIMULATION</span>}
                            </div>
                            {reader.ip_address && (
                              <div className="text-xs text-gray-400 mt-1">
                                IP: {reader.ip_address}
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            {reader.status === 'online' || reader.device_type === 'simulated' ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <Wifi className="h-4 w-4" />
                                <span className="text-sm font-medium">{'Online'}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-red-600">
                                <WifiOff className="h-4 w-4" />
                                <span className="text-sm font-medium">{'Offline'}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Terminal Status Panel */}
              {selectedTerminal && (
                <div className="bg-gray-50 rounded-lg p-4 border">
                  <h4 className="font-semibold mb-2">{'Terminal Status'}</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">{'Status'}:</span>
                      <span
                        className={cn(
                          "ml-2 font-medium",
                          (selectedTerminal.status === 'online' || selectedTerminal.device_type === 'simulated') ? "text-green-600" : "text-red-600"
                        )}
                      >
                        {(selectedTerminal.status === 'online' || selectedTerminal.device_type === 'simulated') ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">{'Device'}:</span>
                      <span className="ml-2">{selectedTerminal.device_type}</span>
                    </div>
                    {selectedTerminal.ip_address && (
                      <div className="col-span-2">
                        <span className="text-gray-600">{'IP Address'}:</span>
                        <span className="ml-2 font-mono text-xs">{selectedTerminal.ip_address}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleContinueToAmount}
                  disabled={!selectedTerminal}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {'Continue'}
                </Button>
              </div>
            </>
          )}

          {/* Processing State */}
          {dialogState === 'processing' && (
            <div className="text-center py-8">
              <div className="relative mx-auto w-24 h-24 mb-4">
                <Loader2 className="h-24 w-24 animate-spin text-blue-600" />
                <CreditCard className="h-12 w-12 absolute top-6 left-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{'Processing Payment...'}</h3>
              <p className="text-gray-600">{'Please present card to the terminal'}</p>
              <p className="text-sm text-gray-500 mt-2">
                {'Do not close this window'}
              </p>
            </div>
          )}

          {/* Success State */}
          {dialogState === 'success' && (
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
                {'Transaction ID'}: {paymentResult?.transaction_id}
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
                  onClick={() => setDialogState('terminal-selection')}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
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

export default StripeTerminalDialog;
