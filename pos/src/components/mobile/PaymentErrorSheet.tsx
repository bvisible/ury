import React from 'react';
import { Sheet } from 'react-modal-sheet';
import { AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../ui/button';

interface PaymentErrorSheetProps {
  isOpen: boolean;
  errorMessage: string;
  onRetry: () => void;
  onCancel: () => void;
}

export function PaymentErrorSheet({
  isOpen,
  errorMessage,
  onRetry,
  onCancel,
}: PaymentErrorSheetProps) {
  return (
    <Sheet
      isOpen={isOpen}
      onClose={onCancel}
      snapPoints={[0, 0.5]}
      initialSnap={1}
    >
      <Sheet.Container>
        <Sheet.Content>
          <div className="flex flex-col items-center justify-center h-full px-6 py-8">
            {/* Error Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', duration: 0.5 }}
            >
              <div className="w-24 h-24 flex items-center justify-center bg-red-100 rounded-full mb-6">
                <AlertCircle className="w-16 h-16 text-red-600" />
              </div>
            </motion.div>

            {/* Error Message */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center mb-8"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Payment Failed
              </h2>
              <p className="text-gray-600">
                {errorMessage || 'An error occurred while processing your payment'}
              </p>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="w-full space-y-3"
            >
              <Button
                onClick={onRetry}
                className="w-full h-12 text-base font-semibold bg-primary-600 hover:bg-primary-700"
              >
                Retry Payment
              </Button>
              <Button
                onClick={onCancel}
                variant="outline"
                className="w-full h-12 text-base font-semibold"
              >
                Cancel
              </Button>
            </motion.div>
          </div>
        </Sheet.Content>
      </Sheet.Container>

      <Sheet.Backdrop onTap={onCancel} />
    </Sheet>
  );
}
