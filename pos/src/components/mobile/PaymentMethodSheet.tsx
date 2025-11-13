import React, { useState, useEffect } from 'react';
import { Sheet } from 'react-modal-sheet';
import { X, ChevronLeft, CreditCard, Banknote, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn, formatCurrency } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { usePOSStore } from '../../store/pos-store';

interface PaymentMethodSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  totalAmount: number;
  onCompletePayment: (payments: Array<{ mode_of_payment: string; amount: number }>) => void;
}

type PaymentMode = 'quick' | 'split';

export function PaymentMethodSheet({
  isOpen,
  onClose,
  onBack,
  totalAmount,
  onCompletePayment,
}: PaymentMethodSheetProps) {
  const { paymentModes } = usePOSStore();
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('quick');
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [splitPayments, setSplitPayments] = useState<Record<string, string>>({});

  // Reset when sheet opens
  useEffect(() => {
    if (isOpen) {
      setPaymentMode('quick');
      setSelectedMethod('');
      setSplitPayments({});
    }
  }, [isOpen]);

  // Quick pay handlers
  const handleQuickPay = (method: string) => {
    setSelectedMethod(method);
    // Immediately complete payment with exact amount
    onCompletePayment([{ mode_of_payment: method, amount: totalAmount }]);
  };

  // Split payment handlers
  const calculateSplitTotal = () => {
    return Object.values(splitPayments).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  };

  const remainingBalance = totalAmount - calculateSplitTotal();

  const handleSplitPaymentChange = (method: string, value: string) => {
    setSplitPayments(prev => ({ ...prev, [method]: value }));
  };

  const handleCompleteSplitPayment = () => {
    const payments = Object.entries(splitPayments)
      .filter(([_, amount]) => parseFloat(amount) > 0)
      .map(([method, amount]) => ({
        mode_of_payment: method,
        amount: parseFloat(amount),
      }));

    if (payments.length > 0 && remainingBalance <= 0) {
      onCompletePayment(payments);
    }
  };

  // Get icon for payment method
  const getPaymentIcon = (method: string) => {
    if (!method) return CreditCard;
    const lowerMethod = method.toLowerCase();
    if (lowerMethod.includes('cash')) return Banknote;
    if (lowerMethod.includes('card') || lowerMethod.includes('credit') || lowerMethod.includes('debit')) return CreditCard;
    if (lowerMethod.includes('mobile') || lowerMethod.includes('twint') || lowerMethod.includes('app')) return Smartphone;
    return CreditCard;
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={[0, 1]}
      initialSnap={1}
    >
      <Sheet.Container>
        <Sheet.Header>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <button
                onClick={onBack}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-500" />
              </button>
              <h2 className="text-lg font-semibold text-gray-900">Payment</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </Sheet.Header>

        <Sheet.Content style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Total Amount Display */}
          <div className="flex-shrink-0 px-4 py-4 bg-gray-50 border-b border-gray-200">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Total Amount</p>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalAmount)}</p>
            </div>
          </div>

          {/* Payment Mode Toggle */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200">
            <div className="flex gap-2">
              <button
                onClick={() => setPaymentMode('quick')}
                className={cn(
                  'flex-1 px-4 py-2 rounded-lg font-medium transition-colors',
                  paymentMode === 'quick'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                Quick Pay
              </button>
              <button
                onClick={() => setPaymentMode('split')}
                className={cn(
                  'flex-1 px-4 py-2 rounded-lg font-medium transition-colors',
                  paymentMode === 'split'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                Split Payment
              </button>
            </div>
          </div>

          {/* Payment Methods - Scrollable middle section */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
            {paymentMode === 'quick' ? (
              // Quick Pay Mode
              <div className="grid grid-cols-1 gap-3">
                {paymentModes.map((method) => {
                  const Icon = getPaymentIcon(method);
                  return (
                    <motion.button
                      key={method}
                      onClick={() => handleQuickPay(method)}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-4 p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-primary-600 hover:bg-primary-50 transition-colors"
                    >
                      <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-full">
                        <Icon className="w-6 h-6 text-gray-600" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-gray-900">{method}</p>
                        <p className="text-sm text-gray-500">{formatCurrency(totalAmount)}</p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            ) : (
              // Split Payment Mode
              <div className="space-y-4">
                {paymentModes.map((method) => {
                  const Icon = getPaymentIcon(method);
                  return (
                    <div key={method} className="flex items-center gap-3">
                      <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full flex-shrink-0">
                        <Icon className="w-5 h-5 text-gray-600" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {method}
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={splitPayments[method] || ''}
                          onChange={(e) => handleSplitPaymentChange(method, e.target.value)}
                          placeholder="0.00"
                          className="w-full"
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Remaining Balance Display */}
                {Object.keys(splitPayments).length > 0 && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Paid</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(calculateSplitTotal())}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">Remaining</span>
                      <span className={cn(
                        'text-lg font-bold',
                        remainingBalance > 0 ? 'text-red-600' : 'text-green-600'
                      )}>
                        {formatCurrency(Math.abs(remainingBalance))}
                      </span>
                    </div>
                    {remainingBalance < 0 && (
                      <p className="text-xs text-green-600 mt-2">
                        Change: {formatCurrency(Math.abs(remainingBalance))}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer - Sticky at bottom within sheet, only show for Split Payment */}
          {paymentMode === 'split' && (
            <div className="flex-shrink-0 border-t border-gray-200 p-4 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
              <Button
                onClick={handleCompleteSplitPayment}
                disabled={remainingBalance > 0 || calculateSplitTotal() === 0}
                className="w-full h-12 text-base font-semibold bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300"
              >
                Complete Payment
              </Button>
            </div>
          )}
        </Sheet.Content>
      </Sheet.Container>

      <Sheet.Backdrop onTap={onClose} />
    </Sheet>
  );
}
