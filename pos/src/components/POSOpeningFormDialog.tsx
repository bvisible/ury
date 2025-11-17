import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button, Input } from './ui';
import { createPOSOpeningEntry, BalanceDetail } from '../lib/pos-opening-api';
import { getPaymentModes } from '../lib/payment-api';
import { __ } from '../lib/i18n';

interface POSOpeningFormDialogProps {
  company: string;
  posProfile: string;
  onSuccess: () => void;
}

interface PaymentRow {
  mode_of_payment: string;
  opening_amount: number;
}

const POSOpeningFormDialog: React.FC<POSOpeningFormDialogProps> = ({
  company,
  posProfile,
  onSuccess,
}) => {
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load payment methods on mount
  useEffect(() => {
    const loadPaymentModes = async () => {
      try {
        setIsLoading(true);
        const modes = await getPaymentModes();

        // Initialize rows with all payment methods and zero amounts
        const initialRows = modes.map(mode => ({
          mode_of_payment: mode,
          opening_amount: 0
        }));

        setPaymentRows(initialRows);
        setError(null);
      } catch (err) {
        console.error('Error loading payment modes:', err);
        setError(__('Failed to load payment methods. Please try again.'));
      } finally {
        setIsLoading(false);
      }
    };

    loadPaymentModes();
  }, []);

  const handleAmountChange = (index: number, value: string) => {
    const newRows = [...paymentRows];
    const numValue = parseFloat(value) || 0;

    // Ensure non-negative
    newRows[index].opening_amount = Math.max(0, numValue);
    setPaymentRows(newRows);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate: at least one payment method with amount >= 0
    const hasValidEntry = paymentRows.some(row => row.opening_amount >= 0);

    if (!hasValidEntry) {
      setError(__('Please add at least one payment method with an opening amount.'));
      return;
    }

    // Filter out rows with empty amounts (keep zero amounts)
    const validRows: BalanceDetail[] = paymentRows
      .filter(row => row.mode_of_payment && row.opening_amount !== undefined)
      .map(row => ({
        mode_of_payment: row.mode_of_payment,
        opening_amount: row.opening_amount
      }));

    try {
      setIsSubmitting(true);

      await createPOSOpeningEntry({
        pos_profile: posProfile,
        company: company,
        balance_details: validRows
      });

      // Success - call parent callback to reload
      onSuccess();
    } catch (err: any) {
      console.error('Error creating POS opening entry:', err);

      // Extract error message from Frappe response
      let errorMessage = __('Failed to create POS opening entry. Please try again.');

      if (err._server_messages) {
        try {
          const messages = JSON.parse(err._server_messages);
          if (messages && messages.length > 0) {
            const parsedMessage = JSON.parse(messages[0]);
            errorMessage = parsedMessage.message || errorMessage;
          }
        } catch (parseError) {
          console.error('Error parsing server messages:', parseError);
        }
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {__('Open POS')}
          </h2>
          <p className="text-gray-600 mt-2">
            {__('Please enter opening amounts for each payment method')}
          </p>
        </div>

        {/* Form Content - Scrollable */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">
            {/* Company and POS Profile Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {__('Company')}
                </label>
                <Input
                  type="text"
                  value={company}
                  disabled
                  className="bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {__('POS Profile')}
                </label>
                <Input
                  type="text"
                  value={posProfile}
                  disabled
                  className="bg-gray-50"
                />
              </div>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-3 text-gray-600">{__('Loading payment methods...')}</span>
              </div>
            )}

            {/* Payment Methods Table */}
            {!isLoading && paymentRows.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  {__('Opening Balance Details')}
                </label>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {__('Mode of Payment')}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {__('Opening Amount')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paymentRows.map((row, index) => (
                        <tr key={row.mode_of_payment} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {row.mode_of_payment}
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.opening_amount}
                              onChange={(e) => handleAmountChange(index, e.target.value)}
                              className="w-full"
                              placeholder={__('0.00')}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
                <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}
          </div>

          {/* Footer with Submit Button */}
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <Button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {__('Opening POS...')}
                </>
              ) : (
                __('Open POS')
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Helper function for translations (matches Frappe's __ function)
function __(text: string): string {
  // In a real implementation, this would connect to Frappe's translation system
  // For now, return the text as-is
  return text;
}

export default POSOpeningFormDialog;
