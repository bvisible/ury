import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatCurrency } from '../../lib/utils';

interface FloatingCartButtonProps {
  itemCount: number;
  total: number;
  onClick: () => void;
  className?: string;
}

export function FloatingCartButton({
  itemCount,
  total,
  onClick,
  className,
}: FloatingCartButtonProps) {
  const hasItems = itemCount > 0;

  return (
    <AnimatePresence>
      {hasItems && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClick}
          className={cn(
            'fixed bottom-20 right-4 z-40',
            'bg-primary-600 hover:bg-primary-700',
            'text-white rounded-full shadow-2xl',
            'flex items-center gap-3',
            'px-5 py-4',
            'transition-colors',
            className
          )}
        >
          {/* Cart Icon with Badge */}
          <div className="relative">
            <ShoppingCart className="w-6 h-6" />

            {/* Item Count Badge */}
            <motion.div
              key={itemCount}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
            >
              {itemCount > 99 ? '99+' : itemCount}
            </motion.div>
          </div>

          {/* Total Amount */}
          <div className="flex flex-col items-start">
            <span className="text-xs opacity-90">Total</span>
            <span className="text-base font-bold">{formatCurrency(total)}</span>
          </div>

          {/* Pulse Animation when cart is updated */}
          <motion.div
            className="absolute inset-0 bg-primary-400 rounded-full -z-10"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.2, opacity: 0 }}
            transition={{ duration: 0.6, repeat: Infinity }}
          />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
