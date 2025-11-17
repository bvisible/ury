import React, { useState, useEffect } from 'react';
import { X, Percent, Coins, CreditCard, Smartphone } from 'lucide-react';
import { usePOSStore } from '../store/pos-store';
import { cn, formatCurrency } from '../lib/utils';
import { Button, Input, Dialog, DialogContent } from './ui';
import { call } from '../lib/frappe-sdk';
import { __ } from '../lib/i18n';
import StripeTerminalDialog from './StripeTerminalDialog';
import TwintPaymentDialog from './TwintPaymentDialog';
import { DEFAULT_PAYMENT_MODE } from '../data/order-types';


interface PaymentDialogProps {
  onClose: () => void;
  grandTotal: number;
  roundedTotal: number;
  invoice: string;
  customer: string;
  posProfile: string;
  table: string | null;
  cashier: string;
  owner: string;
  fetchOrders: () =>Promise<void>;
  clearSelectedOrder: () => void;
}

const PaymentDialog: React.FC<PaymentDialogProps> = ({
  onClose,
  grandTotal,
  roundedTotal,
  invoice,
  customer,
  posProfile,
  table,
  cashier,
  owner,
  fetchOrders,
  clearSelectedOrder
}) => {
  const {
    paymentModes,
    fetchPaymentModes,
    fetchPaymentProcessorConfigs,
    posProfile: storePosProfile,
    stripeTerminalConfig,
    twintConfig,
    isSpecialPaymentMode,
    addProcessorPayment
  } = usePOSStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discountType] = useState<'percentage'>('percentage'); // Only percentage now
  const [discountValue, setDiscountValue] = useState<string>('');
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [paymentInputs, setPaymentInputs] = useState<{ [mode: string]: string }>({});
  const [activeProcessorDialog, setActiveProcessorDialog] = useState<'stripe' | 'twint' | null>(null);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string | null>(null);
  const [processorTransactions, setProcessorTransactions] = useState<{ [mode: string]: { transactionId: string, paymentIntentId?: string } }>({});

  // localStorage key for draft payments
  const STORAGE_KEY = `ury_pos_draft_payments_${invoice}`;

  /**
   * Load draft payments from localStorage on mount
   */
  useEffect(() => {
    fetchPaymentModes();
    fetchPaymentProcessorConfigs();

    // Load saved payments from localStorage
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const { paymentInputs: savedInputs, processorTransactions: savedTransactions } = JSON.parse(savedData);
        if (savedInputs) setPaymentInputs(savedInputs);
        if (savedTransactions) setProcessorTransactions(savedTransactions);
      }
    } catch (error) {
      console.error('Failed to load draft payments:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Save draft payments to localStorage when they change
   */
  useEffect(() => {
    try {
      if (Object.keys(paymentInputs).length > 0 || Object.keys(processorTransactions).length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          paymentInputs,
          processorTransactions
        }));
      }
    } catch (error) {
      console.error('Failed to save draft payments:', error);
    }
  }, [paymentInputs, processorTransactions, STORAGE_KEY]);

  // Calculate split payment total
  const payments = paymentModes
    .map((mode: any) => {
      const id = typeof mode === 'string' ? mode : mode.id;
      const amount = parseFloat(paymentInputs[id] || '');
      return amount > 0 ? { mode_of_payment: id, amount } : null;
    })
    .filter(Boolean);
  const paymentsTotal = payments.reduce((sum, p: any) => sum + p.amount, 0);

  const handleApplyDiscount = () => {
    const value = parseFloat(discountValue);
    if (isNaN(value) || value <= 0) {
      setError('Please enter a valid discount value');
      return;
    }
    if (value > 100) {
      setError('Percentage discount cannot exceed 100%');
      return;
    }
    const calculatedDiscount = (grandTotal * value) / 100;
    setAppliedDiscount(calculatedDiscount);
    setError(null);
  };

  // Order summary logic
  const subtotal = grandTotal;
  const adjustment = roundedTotal - grandTotal;
  const roundedAdjustment = Math.round(adjustment * 100) / 100;
  const showAdjustment = Math.abs(roundedAdjustment) > 0.001;
  const totalDiscount = appliedDiscount;
  const discountedTotal = Math.max(0, subtotal - totalDiscount);

  // Use ERPNext's rounded_total instead of custom rounding logic
  // When discount is applied, adjust the rounded_total proportionally
  const finalTotal = appliedDiscount > 0
    ? roundedTotal - (grandTotal - discountedTotal)  // Apply discount to rounded total
    : roundedTotal;  // No discount: use ERPNext's rounded_total directly

  const finalAdjustment = finalTotal - discountedTotal;
  const roundedFinalAdjustment = Math.round(finalAdjustment * 100) / 100;
  const showFinalAdjustment = Math.abs(roundedFinalAdjustment) > 0.001;

  useEffect(()=>{
    const defaultPaymentModePresent=paymentModes.find((mode)=>mode===DEFAULT_PAYMENT_MODE)
    //only one payment mode should be present, then autofill the final amount, if not do not fill
    const otherPaymentModesNotEntered=Object.keys(paymentInputs).length<=1;
    if(finalTotal && paymentModes && DEFAULT_PAYMENT_MODE && defaultPaymentModePresent && otherPaymentModesNotEntered){
      //check if default payment mode is present in paymentModes
      setPaymentInputs((prev)=>({ 
        ...prev,
        [DEFAULT_PAYMENT_MODE]:String(finalTotal) 
      }))
    }
  },[finalTotal,paymentModes])

  // Helper to calculate remaining balance
  const getRemainingBalance = (currentId: string) => {
    const totalEntered = Object.entries(paymentInputs)
      .filter(([id]) => id !== currentId)
      .reduce((sum, [_, val]) => sum + (parseFloat(val) || 0), 0);
    return Math.max(0, finalTotal - totalEntered);
  };

  // Handler for input focus to auto-fill remaining balance
  const handlePaymentInputFocus = (id: string) => {
    setPaymentInputs(inputs => {
      // Only auto-fill if the field is empty or zero
      if (!inputs[id] || parseFloat(inputs[id]) === 0) {
        const remaining = getRemainingBalance(id);
        return { ...inputs, [id]: remaining > 0 ? String(remaining) : '' };
      }
      return inputs;
    });
  };

  /**
   * Handle click on payment mode input
   * If it's a special payment mode (Stripe/TWINT), open the appropriate dialog
   */
  const handlePaymentModeClick = (modeId: string) => {
    // Check if this is a special payment mode
    if (stripeTerminalConfig?.enabled && stripeTerminalConfig.modeOfPayment === modeId) {
      setSelectedPaymentMode(modeId);
      setActiveProcessorDialog('stripe');
    } else if (twintConfig?.enabled && twintConfig.modeOfPayment === modeId) {
      setSelectedPaymentMode(modeId);
      setActiveProcessorDialog('twint');
    }
  };

  /**
   * Handle successful Stripe Terminal payment
   */
  const handleStripeTerminalSuccess = (amount: number, transactionId: string, paymentIntentId: string) => {
    if (selectedPaymentMode) {
      // Store transaction reference (keep latest transaction)
      setProcessorTransactions(prev => ({
        ...prev,
        [selectedPaymentMode]: { transactionId, paymentIntentId }
      }));

      // Add to existing amount instead of replacing it
      setPaymentInputs(inputs => {
        const currentAmount = parseFloat(inputs[selectedPaymentMode] || '0');
        const newTotal = currentAmount + amount;
        return {
          ...inputs,
          [selectedPaymentMode]: newTotal.toFixed(2)
        };
      });

      // Add to processor payments tracking
      addProcessorPayment({
        mode: selectedPaymentMode,
        amount,
        transactionId,
        paymentIntentId,
        status: 'completed',
        processor: 'stripe_terminal'
      });
    }

    setActiveProcessorDialog(null);
    setSelectedPaymentMode(null);
  };

  /**
   * Handle successful TWINT payment
   */
  const handleTwintSuccess = (amount: number, transactionId: string) => {
    if (selectedPaymentMode) {
      // Store transaction reference (keep latest transaction)
      setProcessorTransactions(prev => ({
        ...prev,
        [selectedPaymentMode]: { transactionId }
      }));

      // Add to existing amount instead of replacing it
      setPaymentInputs(inputs => {
        const currentAmount = parseFloat(inputs[selectedPaymentMode] || '0');
        const newTotal = currentAmount + amount;
        return {
          ...inputs,
          [selectedPaymentMode]: newTotal.toFixed(2)
        };
      });

      // Add to processor payments tracking
      addProcessorPayment({
        mode: selectedPaymentMode,
        amount,
        transactionId,
        status: 'completed',
        processor: 'twint'
      });
    }

    setActiveProcessorDialog(null);
    setSelectedPaymentMode(null);
  };

  /**
   * Close processor dialog
   */
  const handleCloseProcessorDialog = () => {
    setActiveProcessorDialog(null);
    setSelectedPaymentMode(null);
  };

  const handlePayment = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      // Enhance payments with processor transaction references
      const enhancedPayments = payments.map((payment: any) => {
        const transaction = processorTransactions[payment.mode_of_payment];
        if (transaction) {
          return {
            ...payment,
            transaction_id: transaction.transactionId,
            payment_intent_id: transaction.paymentIntentId
          };
        }
        return payment;
      });

      await call.post('ury.ury.doctype.ury_order.ury_order.make_invoice', {
        additionalDiscount: discountValue ? parseInt(discountValue) : null,
        cashier,
        customer,
        invoice,
        owner,
        payments: enhancedPayments,
        pos_profile: posProfile,
        table,
      });

      // Clear draft payments from localStorage after successful payment
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.error('Failed to clear draft payments:', error);
      }

      // Show toast and reload orders (assume showToast and reload available globally)
      if (typeof window !== 'undefined' && (window as any).showToast) {
        (window as any).showToast.success(__('Payment successful'));
      }
      onClose();
      clearSelectedOrder();
      await fetchOrders();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Stripe Terminal Dialog */}
      {activeProcessorDialog === 'stripe' && stripeTerminalConfig && (
        <div className="fixed inset-0 z-[100000]">
          <StripeTerminalDialog
            isOpen={true}
            onClose={handleCloseProcessorDialog}
            onSuccess={handleStripeTerminalSuccess}
            maxAmount={finalTotal - paymentsTotal}
            currency={storePosProfile?.currency || 'CHF'}
            posProfile={posProfile}
            referenceDoctype="URY Order"
            referenceDocname={invoice}
          />
        </div>
      )}

      {/* TWINT Payment Dialog */}
      {activeProcessorDialog === 'twint' && twintConfig && (
        <div className="fixed inset-0 z-[100000]">
          <TwintPaymentDialog
            isOpen={true}
            onClose={handleCloseProcessorDialog}
            onSuccess={handleTwintSuccess}
            maxAmount={finalTotal - paymentsTotal}
            currency={storePosProfile?.currency || 'CHF'}
            referenceDoctype="URY Order"
            referenceDocname={invoice}
            customerName={customer}
          />
        </div>
      )}

      {/* Main Payment Dialog */}
      <Dialog open={true} onOpenChange={onClose}>
      <DialogContent variant="xlarge" className="bg-white w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row p-0" showCloseButton={false}>
        {/* Left Column - Discount and Payment Mode */}
        <div className="md:w-1/2 p-6 border-b md:border-b-0 md:border-r border-gray-200 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{__('Payment')}</h2>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="p-2"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Discount Section (conditional) */}
          {storePosProfile?.enable_discount === 1 && (
            <div className="space-y-4 mb-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Percent className="w-5 h-5" />
                {__('Apply Discount')}
              </h3>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={'Enter %'}
                  size="sm"
                  className="flex-1"
                />
                <Button
                  onClick={handleApplyDiscount}
                  variant="default"
                  size="sm"
                >
                  {__('Apply')}
                </Button>
              </div>
            </div>
          )}

          {/* Payment Methods Section - Split Payment */}
          <div className="space-y-4 mb-6">
            <h3 className="text-lg font-semibold">{__('Payment Methods')}</h3>
            <div className="grid grid-cols-1 gap-3">
              {paymentModes.map((mode: any) => {
                const id = typeof mode === 'string' ? mode : mode.id;
                const isStripeMode = stripeTerminalConfig?.enabled && stripeTerminalConfig.modeOfPayment === id;
                const isTwintMode = twintConfig?.enabled && twintConfig.modeOfPayment === id;
                const isSpecialMode = isStripeMode || isTwintMode;
                const hasProcessorTransaction = processorTransactions[id];

                return (
                  <div key={id} className="flex items-center gap-2">
                    <span className="w-24 font-medium text-sm">{typeof mode === 'string' ? mode : mode.name}</span>

                    {/* Regular input or read-only amount for completed processor payment */}
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentInputs[id] || ''}
                      onChange={e => !isSpecialMode && setPaymentInputs(inputs => ({ ...inputs, [id]: e.target.value }))}
                      onFocus={() => !isSpecialMode && handlePaymentInputFocus(id)}
                      placeholder={isSpecialMode ? __('0.00') : __('Amount')}
                      className={cn(
                        "flex-1",
                        isSpecialMode && hasProcessorTransaction && "bg-green-50 border-green-500 font-semibold",
                        isSpecialMode && !hasProcessorTransaction && "bg-gray-50"
                      )}
                      size="sm"
                      disabled={isProcessing || isSpecialMode}
                      readOnly={isSpecialMode}
                    />

                    {/* Special payment mode button - always visible for multiple payments */}
                    {isSpecialMode && (
                      <Button
                        onClick={() => handlePaymentModeClick(id)}
                        variant="outline"
                        size="sm"
                        className={cn(
                          "flex items-center gap-2 flex-1",
                          isStripeMode && "border-blue-500 text-blue-700 hover:bg-blue-50",
                          isTwintMode && "border-purple-500 text-purple-700 hover:bg-purple-50"
                        )}
                        disabled={isProcessing}
                      >
                        {isStripeMode && <CreditCard className="h-4 w-4" />}
                        {isTwintMode && <Smartphone className="h-4 w-4" />}
                        {__('Pay with')} {isStripeMode ? __('Terminal') : __('TWINT')}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-sm">
              <span className="font-medium">{__('Total Entered')}</span>
              <span className={'text-green-600 font-semibold flex items-center gap-1'}>
                {formatCurrency(paymentsTotal)} / {formatCurrency(finalTotal)}
                {paymentsTotal > finalTotal && (
                  <span className="text-yellow-700 font-semibold">
                    <Coins className="inline w-4 h-4 ml-1 text-yellow-500" />
                    <span className="text-yellow-500 font-bold ml-1">{formatCurrency(paymentsTotal - finalTotal)}</span>
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column - Order Summary and Pay Button */}
        <div className="md:w-1/2 p-6 overflow-y-auto">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Order Summary */}
          <div className="space-y-3 mb-6">
            <h3 className="text-lg font-semibold">{__('Order Summary')}</h3>
            <div className="space-y-2 text-sm">
              {/* Subtotal (Grand Total) */}
              <div className="flex justify-between">
                <span className="text-gray-600">{__('Subtotal')}</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {/* Discount */}
              {appliedDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>{__('Discount')}</span>
                  <span>-{formatCurrency(appliedDiscount)}</span>
                </div>
              )}
              {/* Adjustment (if any) */}
              {showFinalAdjustment && (
                <div className="flex justify-between text-blue-600">
                  <span>{__('Adjustment')}</span>
                  <span>{roundedFinalAdjustment > 0 ? '+' : ''}{formatCurrency(roundedFinalAdjustment)}</span>
                </div>
              )}
              {/* Final Total (Rounded) */}
              <div className="border-t pt-2">
                <div className="flex justify-between font-semibold text-lg">
                  <span>{__('Total')}</span>
                  <span>{formatCurrency(finalTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Button */}
          <Button
            onClick={handlePayment}
            disabled={isProcessing || payments.length === 0 || paymentsTotal < finalTotal}
            variant={isProcessing || payments.length === 0 || paymentsTotal < finalTotal ? "secondary" : "default"}
            className="w-full"
          >
            {isProcessing ? __('Processing...') : `${__('Pay')} ${formatCurrency(paymentsTotal>0?paymentsTotal:finalTotal)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default PaymentDialog; 