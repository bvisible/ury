import React from 'react';
import { Sheet } from 'react-modal-sheet';
import { CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatCurrency } from '../../lib/utils';
import { Button } from '../ui/button';

interface PaymentSuccessSheetProps {
  isOpen: boolean;
  invoiceNumber: string;
  totalAmount: number;
  onStartNewOrder: () => void;
}

export function PaymentSuccessSheet({
  isOpen,
  invoiceNumber,
  totalAmount,
  onStartNewOrder,
}: PaymentSuccessSheetProps) {
  return (
    <Sheet
      isOpen={isOpen}
      onClose={onStartNewOrder}
      snapPoints={[0, 0.6]}
      initialSnap={1}
    >
      <Sheet.Container>
        <Sheet.Content>
          <div className="flex flex-col items-center justify-center h-full px-6 py-8">
            {/* Success Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', duration: 0.5 }}
            >
              <div className="w-24 h-24 flex items-center justify-center bg-green-100 rounded-full mb-6">
                <CheckCircle2 className="w-16 h-16 text-green-600" />
              </div>
            </motion.div>

            {/* Success Message */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center mb-8"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Payment Successful!
              </h2>
              <p className="text-gray-600">
                Your order has been completed
              </p>
            </motion.div>

            {/* Invoice Details */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="w-full bg-gray-50 rounded-lg p-6 mb-6"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">Invoice Number</span>
                <span className="text-sm font-semibold text-gray-900">{invoiceNumber}</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <span className="text-base font-semibold text-gray-700">Total Amount</span>
                <span className="text-xl font-bold text-primary-600">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </motion.div>

            {/* Action Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="w-full"
            >
              <Button
                onClick={onStartNewOrder}
                className="w-full h-12 text-base font-semibold bg-primary-600 hover:bg-primary-700"
              >
                Start New Order
              </Button>
            </motion.div>
          </div>
        </Sheet.Content>
      </Sheet.Container>

      <Sheet.Backdrop onTap={onStartNewOrder} />
    </Sheet>
  );
}
