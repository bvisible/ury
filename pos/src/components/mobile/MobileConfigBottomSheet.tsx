import React, { useState } from 'react';
import { Sheet } from 'react-modal-sheet';
import { X, ShoppingBag, UtensilsCrossed, Truck } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { usePOSStore } from '../../store/pos-store';
import { __ } from '../../lib/i18n';

interface MobileConfigBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigured: (orderType: OrderType) => void;
}

type OrderType = 'Dine In' | 'Take Away' | 'Delivery';

export function MobileConfigBottomSheet({
  isOpen,
  onClose,
  onConfigured,
}: MobileConfigBottomSheetProps) {
  const [selectedOrderType, setSelectedOrderType] = useState<OrderType>('Take Away');
  const { setSelectedOrderType: setStoreOrderType, setSelectedCustomer, customers } = usePOSStore();

  // Get translated order types at runtime
  const ORDER_TYPES: { value: OrderType; icon: typeof ShoppingBag; label: string; description: string }[] = [
    { value: 'Take Away', icon: ShoppingBag, label: __('Take Away'), description: __('Takeout order') },
    { value: 'Dine In', icon: UtensilsCrossed, label: __('Dine In'), description: __('Dine in service') },
    { value: 'Delivery', icon: Truck, label: __('Delivery'), description: __('Delivery service') },
  ];

  const handleContinue = () => {
    // Set order type
    setStoreOrderType(selectedOrderType);

    // For Take Away and Delivery, auto-select default customer
    if (selectedOrderType !== 'Dine In') {
      const defaultCustomer = customers?.find(c => c.name === 'Walking Customer' || c.customer_name?.includes('Walk'));
      if (defaultCustomer) {
        setSelectedCustomer(defaultCustomer);
      }
    }

    // Pass the selected order type to parent via callback
    onConfigured(selectedOrderType);
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={[0, 0.7, 1]}
      initialSnap={2}
      disableDrag
    >
      <Sheet.Container>
        <Sheet.Header>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {__('Configure Order')}
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </Sheet.Header>

        <Sheet.Content style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Order Type Selection - Scrollable */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">{__('Order Type')}</h3>
              <div className="space-y-2">
                {ORDER_TYPES.map(({ value, icon: Icon }) => (
                  <motion.button
                    key={value}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedOrderType(value)}
                    className={cn(
                      'w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all',
                      selectedOrderType === value
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    )}
                  >
                    <div className={cn(
                      'w-12 h-12 flex items-center justify-center rounded-full',
                      selectedOrderType === value
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    )}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className={cn(
                        'font-semibold',
                        selectedOrderType === value ? 'text-primary-900' : 'text-gray-900'
                      )}>
                        {__(value)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {value === 'Take Away' ? __('Takeout order') :
                         value === 'Dine In' ? __('Dine in service') :
                         __('Delivery service')}
                      </p>
                    </div>
                    {selectedOrderType === value && (
                      <div className="w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Info Message */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                {selectedOrderType === 'Dine In'
                  ? __('You can select a table after starting the order.')
                  : __('A default customer will be automatically selected.')}
              </p>
            </div>
          </div>

          {/* Continue Button - Fixed at bottom */}
          <div className="flex-shrink-0 px-4 py-4 border-t border-gray-200 bg-white">
            <Button
              onClick={handleContinue}
              className="w-full h-12 text-base font-semibold bg-primary-600 hover:bg-primary-700"
            >
              {__('Continue')}
            </Button>
          </div>
        </Sheet.Content>
      </Sheet.Container>

      <Sheet.Backdrop />
    </Sheet>
  );
}
