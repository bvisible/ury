import React, { useState } from 'react';
import { Sheet } from 'react-modal-sheet';
import { X, ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn, formatCurrency } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { usePOSStore } from '../../store/pos-store';
import { __ } from '../../lib/i18n';

interface CheckoutSummarySheetProps {
  isOpen: boolean;
  onClose: () => void;
  onProceedToPayment: (discount: number) => void;
}

export function CheckoutSummarySheet({
  isOpen,
  onClose,
  onProceedToPayment,
}: CheckoutSummarySheetProps) {
  const { activeOrders, posProfile } = usePOSStore();
  const [discountPercentage, setDiscountPercentage] = useState<string>('0');

  // Calculate totals
  const calculateItemTotal = (item: typeof activeOrders[0]) => {
    const basePrice = item.selectedVariant?.price || item.price;
    const addonsTotal = item.selectedAddons?.reduce((sum, addon) => sum + addon.price, 0) || 0;
    return (basePrice + addonsTotal) * item.quantity;
  };

  const subtotal = activeOrders.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  const discountAmount = (subtotal * parseFloat(discountPercentage || '0')) / 100;
  const total = subtotal - discountAmount;

  const handleProceed = () => {
    const discount = parseFloat(discountPercentage || '0');
    onProceedToPayment(discount);
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
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-500" />
              </button>
              <h2 className="text-lg font-semibold text-gray-900">{__('Order Summary')}</h2>
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
          {/* Items List - Scrollable middle section */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{__('Order Items')}</h3>

            {activeOrders.map((item) => {
              const itemTotal = calculateItemTotal(item);
              return (
                <motion.div
                  key={item.uniqueId}
                  layout
                  className="flex items-start justify-between py-3 border-b border-gray-100"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-gray-900">{item.quantity}x</span>
                      <span className="font-medium text-gray-900">{item.item_name}</span>
                    </div>

                    {item.selectedVariant && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.selectedVariant.name}
                      </p>
                    )}

                    {item.selectedAddons && item.selectedAddons.length > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        + {item.selectedAddons.map(a => a.name).join(', ')}
                      </p>
                    )}

                    {item.comment && (
                      <p className="text-xs text-gray-500 italic mt-0.5">
                        Note: {item.comment}
                      </p>
                    )}
                  </div>

                  <div className="text-sm font-semibold text-gray-900 ml-4">
                    {formatCurrency(itemTotal)}
                  </div>
                </motion.div>
              );
            })}

            {/* Discount Input */}
            {posProfile?.enable_discount === 1 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Discount (%)
                </label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={discountPercentage}
                  onChange={(e) => setDiscountPercentage(e.target.value)}
                  placeholder={__('0')}
                  className="max-w-xs"
                />
              </div>
            )}
          </div>

          {/* Footer with Totals - Sticky at bottom within sheet */}
          <div className="flex-shrink-0 border-t border-gray-200 p-4 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            {/* Subtotal */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">{__('Subtotal')}</span>
              <span className="text-sm font-medium text-gray-900">
                {formatCurrency(subtotal)}
              </span>
            </div>

            {/* Discount */}
            {discountAmount > 0 && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">
                  Discount ({discountPercentage}%)
                </span>
                <span className="text-sm font-medium text-red-600">
                  - {formatCurrency(discountAmount)}
                </span>
              </div>
            )}

            {/* Total */}
            <div className="flex items-center justify-between mb-4 pt-2 border-t border-gray-200">
              <span className="text-lg font-semibold text-gray-900">{__('Total')}</span>
              <span className="text-xl font-bold text-primary-600">
                {formatCurrency(total)}
              </span>
            </div>

            {/* Proceed Button */}
            <Button
              onClick={handleProceed}
              disabled={activeOrders.length === 0}
              className="w-full h-12 text-base font-semibold bg-primary-600 hover:bg-primary-700"
            >
              Proceed to Payment
            </Button>
          </div>
        </Sheet.Content>
      </Sheet.Container>

      <Sheet.Backdrop onTap={onClose} />
    </Sheet>
  );
}
