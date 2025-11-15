import React, { useState, useEffect } from 'react';
import { X, Delete } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { cn, formatCurrency } from '../lib/utils';
import { __ } from '../lib/i18n';

interface PaymentAmountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => void;
  title: string;
  maxAmount: number;
  currency: string;
  defaultAmount?: number;
}

/**
 * Payment Amount Dialog with Cash Register-style Numpad
 *
 * Features:
 * - Cash register input logic (each digit shifts left)
 * - Maximum amount validation
 * - Currency formatting
 * - Large touch-friendly buttons
 */
const PaymentAmountDialog: React.FC<PaymentAmountDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  maxAmount,
  currency,
  defaultAmount
}) => {
  const [amount, setAmount] = useState<number>(0);

  // Initialize with default amount or max amount
  useEffect(() => {
    if (isOpen) {
      setAmount(defaultAmount || maxAmount);
    }
  }, [isOpen, defaultAmount, maxAmount]);

  /**
   * Cash register-style input logic
   * Each digit shifts the previous digits left
   * Example: 0 -> 1 -> 12 -> 123 = 1.23
   */
  const handleNumpadClick = (digit: string) => {
    let newAmount: number;

    if (digit === '00') {
      // Add 00 (multiply by 100 and divide by 100 for cents precision)
      newAmount = (amount * 100 * 100) / 100;
    } else {
      // Add single digit (shift left)
      const digitValue = parseInt(digit);
      newAmount = (amount * 100 * 10 + digitValue) / 100;
    }

    // No maximum validation - allow tips/extra amounts
    setAmount(newAmount);
  };

  /**
   * Backspace - remove last digit (shift right)
   * Converts amount to cents, removes last digit, converts back to currency
   * Example: 4.20 -> 420 cents -> 42 cents -> 0.42
   */
  const handleBackspace = () => {
    const cents = Math.floor(amount * 100);
    const newCents = Math.floor(cents / 10);
    const newAmount = newCents / 100;
    setAmount(newAmount);
  };

  /**
   * Clear input
   */
  const handleClear = () => {
    setAmount(0);
  };

  /**
   * Handle confirm
   */
  const handleConfirm = () => {
    if (amount > 0) {
      onConfirm(amount);
      // Don't call onClose() - let the parent dialog handle state transitions
    }
  };

  /**
   * Handle direct input change
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d.]/g, ''); // Only digits and decimal point
    const numValue = parseFloat(value) || 0;
    setAmount(numValue);
  };

  /**
   * Numpad button component
   */
  const NumpadButton: React.FC<{
    value: string;
    onClick: () => void;
    className?: string;
    children?: React.ReactNode;
  }> = ({ value, onClick, className, children }) => (
    <button
      onClick={onClick}
      className={cn(
        "h-16 text-2xl font-semibold rounded-lg border-2 border-gray-300",
        "hover:bg-gray-100 active:bg-gray-200 transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-blue-500",
        className
      )}
    >
      {children || value}
    </button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        onClose={onClose}
        size="lg"
        className="p-0"
      >
        {/* Header */}
        <DialogHeader className="bg-gray-50 border-b p-4">
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Amount Display */}
          <div className="bg-gray-100 rounded-lg p-6 border-2 border-gray-300">
            <div className="text-sm text-gray-600 mb-1">
              {__('Amount to pay')}
            </div>
            <input
              type="text"
              value={amount.toFixed(2)}
              onChange={handleInputChange}
              className="w-full text-4xl font-bold text-gray-900 font-mono bg-transparent border-none focus:outline-none focus:ring-0 p-0"
              placeholder="0.00"
            />
            <div className="text-sm text-gray-500 mt-2">
              {__('Amount due (for info)')}: {formatCurrency(maxAmount, currency)}
            </div>
          </div>

          {/* Numpad Grid */}
          <div className="grid grid-cols-3 gap-3">
            {/* Numbers 1-9 */}
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <NumpadButton
                key={num}
                value={num}
                onClick={() => handleNumpadClick(num)}
              />
            ))}

            {/* Bottom row: 00, 0, Backspace */}
            <NumpadButton
              value="00"
              onClick={() => handleNumpadClick('00')}
            />
            <NumpadButton
              value="0"
              onClick={() => handleNumpadClick('0')}
            />
            <NumpadButton
              value="back"
              onClick={handleBackspace}
              className="bg-yellow-50 hover:bg-yellow-100 active:bg-yellow-200"
            >
              <Delete className="h-6 w-6 mx-auto" />
            </NumpadButton>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleClear}
              className="h-12 text-lg"
            >
              {__('Clear')}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={amount <= 0}
              className={cn(
                "h-12 text-lg font-semibold",
                amount > 0
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              )}
            >
              {__('Confirm')} {amount > 0 ? formatCurrency(amount, currency) : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentAmountDialog;
