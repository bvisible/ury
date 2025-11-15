import { __, _ } from '../lib/i18n';
import React, { useState, useEffect } from 'react';
import { CreditCard, AlertCircle, CheckCircle, Loader2, Wifi, WifiOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { cn, formatCurrency } from '../lib/utils';
import { useRootStore } from '../store/root-store';
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
  const { user } = useRootStore();
  const isAdmin = user?.roles?.includes('System Manager') || false;

  // DEBUG: Log user and isAdmin
  console.log('[StripeTerminalDialog] DEBUG - user:', user);
  console.log('[StripeTerminalDialog] DEBUG - user.roles:', user?.roles);
  console.log('[StripeTerminalDialog] DEBUG - isAdmin:', isAdmin);

  const [dialogState, setDialogState] = useState<DialogState>('terminal-selection');
  const [amount, setAmount] = useState<number>(0);
  const [terminals, setTerminals] = useState<any[]>([]);
  const [selectedTerminal, setSelectedTerminal] = useState<any | null>(null);
  const [isLoadingTerminals, setIsLoadingTerminals] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentResult, setPaymentResult] = useState<PaymentIntentResponse | null>(null);
  const [simulationMode, setSimulationMode] = useState(false); // Always start with real terminals

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

  // Load terminals when moving to terminal selection OR when simulation mode changes
  useEffect(() => {
    if (dialogState === 'terminal-selection') {
      // Clear existing terminals when simulation mode changes
      if (terminals.length > 0) {
        setTerminals([]);
        setSelectedTerminal(null);
      }
      loadAvailableTerminals();
    }
  }, [dialogState, simulationMode]);

  /**
   * Load available terminals using Stripe Terminal SDK
   * Flow:
   * 1. Get ERPNext terminals from database
   * 2. Use first terminal's name to initialize SDK
   * 3. Discover readers via SDK
   * 4. Map SDK readers with ERPNext terminal names
   */
  const loadAvailableTerminals = async () => {
    setIsLoadingTerminals(true);
    setError(null);

    try {
      // Step 1: Get ERPNext terminals first
      const erpnextTerminals = await getAvailableTerminals(posProfile);

      if (erpnextTerminals.length === 0) {
        setError(_('Aucun terminal configuré dans le profil POS'));
        setTerminals([]);
        return;
      }

      console.log('[StripeTerminalDialog] ERPNext terminals:', erpnextTerminals);

      // Step 2: Use first terminal's name for SDK initialization
      // In simulation mode, we can use a dummy terminal name since it won't be validated
      const initTerminalId = simulationMode ? 'simulated-terminal' : erpnextTerminals[0].name;

      console.log('[StripeTerminalDialog] Initializing terminal with ID:', initTerminalId);

      // Step 3: Initialize SDK and discover readers
      const discoveredReaders = await StripeBridge.discoverReaders(simulationMode, initTerminalId);

      console.log('[StripeTerminalDialog] Discovered readers:', discoveredReaders);

      if (discoveredReaders.length === 0) {
        setError(
          simulationMode
            ? _('Aucun terminal simulé trouvé')
            : _('Aucun terminal découvert. Vérifiez que vos terminaux sont en ligne.')
        );
        setTerminals([]);
        return;
      }

      // Step 4: Map SDK readers with ERPNext terminal names
      const mappedTerminals = discoveredReaders.map(reader => {
        // Find matching ERPNext terminal by label
        const erpnextTerminal = erpnextTerminals.find(t => t.label === reader.label);
        return {
          ...reader,
          erpnextName: erpnextTerminal?.name || reader.label, // Use ERPNext name for API calls
          status: reader.device_type === 'simulated' ? 'online' : (reader.status || 'offline')
        };
      });

      setTerminals(mappedTerminals);

      // Auto-select last used terminal or first terminal if only one available
      const lastUsed = StripeBridge.getLastUsedTerminal();
      if (lastUsed && mappedTerminals.find(r => r.id === lastUsed.id)) {
        const reader = mappedTerminals.find(r => r.id === lastUsed.id);
        if (reader) {
          setSelectedTerminal(reader);
          console.log('[StripeTerminalDialog] Auto-selected last used terminal:', reader.label);
        }
      } else if (mappedTerminals.length === 1) {
        setSelectedTerminal(mappedTerminals[0]);
        console.log('[StripeTerminalDialog] Auto-selected only terminal:', mappedTerminals[0].label);
      }
    } catch (error: any) {
      console.error('[StripeTerminalDialog] Failed to load terminals:', error);
      setError(
        error.message || _('Échec du chargement des terminaux. Veuillez réessayer.')
      );
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
   * 1. Validate terminal selection
   * 2. Connect to selected terminal
   * 3. Configure simulator if needed
   * 4. Create payment intent
   * 5. Collect payment method from terminal
   * 6. Process payment
   * 7. Handle success/error
   */
  const handleProcessPayment = async (paymentAmount: number) => {
    if (!selectedTerminal) {
      setError(_('Veuillez sélectionner un terminal'));
      return;
    }

    setIsProcessing(true);
    setDialogState('processing');
    setError(null);

    try {
      // Step 1 & 2: Connect to terminal
      console.log('[handleProcessPayment] Connecting to terminal:', selectedTerminal.label);
      await StripeBridge.connectToReader(selectedTerminal);

      // Step 3: Configure simulator if in simulation mode
      if (simulationMode && selectedTerminal.device_type === 'simulated') {
        console.log('[handleProcessPayment] Configuring simulator for success...');
        const terminal = StripeBridge.getState().terminal;
        if (terminal && terminal.setSimulatorConfiguration) {
          terminal.setSimulatorConfiguration({
            testCardNumber: '4242424242424242' // Success card
          });
        }
      }

      // Step 4: Create payment intent
      console.log('[handleProcessPayment] Creating payment intent...');
      const terminalId = (selectedTerminal as any).erpnextName || selectedTerminal.label;

      console.log('[handleProcessPayment] Payment details:', {
        amount: paymentAmount,
        currency,
        referenceDoctype,
        referenceDocname,
        terminalId,
        simulationMode
      });

      const paymentIntent = await createPaymentIntent(
        paymentAmount,
        currency,
        referenceDoctype,
        referenceDocname,
        `Payment for ${referenceDocname}`,
        terminalId
      );

      console.log('[handleProcessPayment] Payment intent created:', paymentIntent);

      if (!paymentIntent.client_secret) {
        throw new Error(_('Échec de création de l\'intention de paiement - secret client manquant'));
      }

      // Step 5 & 6: Collect payment method and process payment
      console.log('[handleProcessPayment] Processing payment with terminal...');
      const result = await StripeBridge.processPayment(paymentIntent.client_secret);

      console.log('[handleProcessPayment] Payment result:', result);

      // Extract transaction ID from result
      const transactionId = result.charges?.data[0]?.id || paymentIntent.transaction_id || result.id;

      // Step 7: Payment successful
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
      console.error('[handleProcessPayment] Payment processing error:', error);

      // Translate common errors to French
      let errorMessage = error.message || _('Le paiement a échoué. Veuillez réessayer.');

      if (errorMessage.includes('canceled') || errorMessage.includes('cancelled')) {
        errorMessage = _('Le paiement a été annulé');
      } else if (errorMessage.includes('timeout')) {
        errorMessage = _('Le paiement a expiré. Veuillez réessayer.');
      } else if (errorMessage.includes('declined') || errorMessage.includes('card_declined')) {
        errorMessage = _('La carte a été refusée');
      } else if (errorMessage.includes('connection')) {
        errorMessage = _('Erreur de connexion au terminal. Vérifiez la connexion.');
      }

      setError(errorMessage);
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
              {/* Simulation Mode Toggle (Admin Only) */}
              {isAdmin && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simulationMode}
                      onChange={(e) => setSimulationMode(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-yellow-900">
                      {__('Use Simulated Terminal (Testing)')}
                    </span>
                  </label>
                  <p className="text-xs text-yellow-700 mt-1 ml-6">
                    {__('Enables test terminal for development and testing purposes')}
                  </p>
                </div>
              )}

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
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900">{__('État du Terminal')}</h4>
                    {(selectedTerminal.status === 'online' || selectedTerminal.device_type === 'simulated') ? (
                      <div className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        <div className="h-2 w-2 bg-green-600 rounded-full animate-pulse"></div>
                        <span className="text-xs font-medium">{__('En ligne')}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-red-600 bg-red-50 px-2 py-1 rounded-full">
                        <div className="h-2 w-2 bg-red-600 rounded-full"></div>
                        <span className="text-xs font-medium">{__('Hors ligne')}</span>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white rounded p-2">
                      <span className="text-gray-500 text-xs">{__('Nom')}:</span>
                      <div className="font-medium text-gray-900 truncate">{selectedTerminal.label}</div>
                    </div>
                    <div className="bg-white rounded p-2">
                      <span className="text-gray-500 text-xs">{__('Type')}:</span>
                      <div className="font-medium text-gray-900">{selectedTerminal.device_type}</div>
                    </div>
                    {selectedTerminal.ip_address && (
                      <div className="col-span-2 bg-white rounded p-2">
                        <span className="text-gray-500 text-xs">{__('Adresse IP')}:</span>
                        <div className="font-mono text-xs text-gray-900">{selectedTerminal.ip_address}</div>
                      </div>
                    )}
                    {selectedTerminal.serial_number && (
                      <div className="col-span-2 bg-white rounded p-2">
                        <span className="text-gray-500 text-xs">{__('Numéro de série')}:</span>
                        <div className="font-mono text-xs text-gray-900">{selectedTerminal.serial_number}</div>
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
              <h3 className="text-xl font-semibold mb-2">{__('Traitement du paiement...')}</h3>
              <p className="text-gray-600">{__('Veuillez présenter la carte au terminal')}</p>
              <p className="text-sm text-gray-500 mt-2">
                {__('Ne fermez pas cette fenêtre')}
              </p>
              {simulationMode && (
                <div className="mt-4 inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-medium">
                  {__('Mode simulation - Paiement de test')}
                </div>
              )}
              {selectedTerminal && (
                <p className="text-xs text-gray-400 mt-3">
                  {__('Terminal')}: {selectedTerminal.label}
                </p>
              )}

              {/* Cancel button */}
              <div className="mt-6">
                <Button
                  variant="outline"
                  onClick={async () => {
                    // Show confirmation dialog before canceling
                    if (!confirm(__('Êtes-vous sûr de vouloir annuler ce paiement ?'))) {
                      return;
                    }

                    try {
                      // Get current state before canceling
                      const bridgeState = StripeBridge.getState();

                      if (!bridgeState.isProcessing) {
                        console.warn('[StripeTerminalDialog] No active payment to cancel');
                        // Just close the dialog
                        setDialogState('terminal-selection');
                        setError(null);
                        setIsProcessing(false);
                        return;
                      }

                      // Now safe to cancel
                      await StripeBridge.cancelPayment();

                      // Update UI with success message
                      setError(__('Paiement annulé par l\'utilisateur'));
                      setDialogState('error'); // Use error state to show message
                      setIsProcessing(false);
                    } catch (err: any) {
                      console.error('[StripeTerminalDialog] Cancel error:', err);

                      // Show error to user
                      setError(
                        err.message || __('Erreur lors de l\'annulation du paiement')
                      );
                      setDialogState('error');
                      setIsProcessing(false);
                    }
                  }}
                  className="border-red-300 text-red-700 hover:bg-red-50"
                  disabled={!isProcessing}
                >
                  {__('Annuler le paiement')}
                </Button>
              </div>
            </div>
          )}

          {/* Success State */}
          {dialogState === 'success' && (
            <div className="text-center py-8">
              <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
                <CheckCircle className="h-16 w-16 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-green-900 mb-2">
                {__('Paiement réussi !')}
              </h3>
              <p className="text-2xl font-bold text-green-700">
                {formatCurrency(amount, currency)}
              </p>
              <p className="text-sm text-gray-500 mt-4">
                {__('ID de transaction')}: {paymentResult?.transaction_id}
              </p>
              {simulationMode && (
                <div className="mt-3 inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-medium">
                  {__('Paiement simulé')}
                </div>
              )}
            </div>
          )}

          {/* Error State */}
          {dialogState === 'error' && (
            <div className="text-center py-8">
              <div className="mx-auto w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="h-16 w-16 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-red-900 mb-2">
                {__('Échec du paiement')}
              </h3>
              <p className="text-gray-700 max-w-md mx-auto">{error}</p>
              {selectedTerminal && (
                <p className="text-xs text-gray-400 mt-3">
                  {__('Terminal')}: {selectedTerminal.label}
                </p>
              )}
              <div className="flex gap-3 mt-6 justify-center">
                <Button
                  variant="outline"
                  onClick={onClose}
                >
                  {__('Annuler')}
                </Button>
                <Button
                  onClick={() => {
                    setDialogState('terminal-selection');
                    setError(null);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {__('Réessayer')}
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
