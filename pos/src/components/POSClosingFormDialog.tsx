import React, { useState, useEffect } from 'react';
import { DollarSign, AlertCircle, Loader2, TrendingUp, TrendingDown, Equal } from 'lucide-react';
import { Button, Input } from './ui';
import { Spinner } from './ui/spinner';
import {
  getPOSClosingPreview,
  createPOSClosingEntry,
  type PaymentReconciliation,
  type POSClosingPreview,
} from '../lib/pos-opening-api';

interface POSClosingFormDialogProps {
  posOpeningEntry: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const POSClosingFormDialog: React.FC<POSClosingFormDialogProps> = ({
  posOpeningEntry,
  onSuccess,
  onCancel,
}) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentReconciliation[]>([]);
  const [summary, setSummary] = useState({
    grand_total: 0,
    net_total: 0,
    total_quantity: 0,
    invoice_count: 0,
  });

  useEffect(() => {
    loadClosingPreview();
  }, [posOpeningEntry]);

  const loadClosingPreview = async () => {
    try {
      setLoading(true);
      setError(null);
      const preview: POSClosingPreview = await getPOSClosingPreview(posOpeningEntry);
      setPayments(preview.payment_reconciliation);
      setSummary({
        grand_total: preview.grand_total,
        net_total: preview.net_total,
        total_quantity: preview.total_quantity,
        invoice_count: preview.invoice_count,
      });
    } catch (err: any) {
      console.error('Error loading closing preview:', err);

      // Extract error message from Frappe response
      let errorMessage = __('Failed to load closing data. Please try again.');
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
      setLoading(false);
    }
  };

  const handleClosingAmountChange = (index: number, value: string) => {
    const newPayments = [...payments];
    const closingAmount = parseFloat(value) || 0;
    newPayments[index].closing_amount = closingAmount;
    newPayments[index].difference = closingAmount - newPayments[index].expected_amount;
    setPayments(newPayments);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setSubmitting(true);
      await createPOSClosingEntry({
        pos_opening_entry: posOpeningEntry,
        payment_details: payments,
      });

      // Success - call parent callback
      onSuccess();
    } catch (err: any) {
      console.error('Error creating POS closing entry:', err);

      // Extract error message from Frappe response
      let errorMessage = __('Failed to close POS. Please try again.');
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
      setSubmitting(false);
    }
  };

  const totalDifference = payments.reduce((sum, p) => sum + p.difference, 0);
  const hasDifference = Math.abs(totalDifference) > 0.01;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">{__('Close POS')}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {__('Enter closing amounts for each payment method')}
          </p>
        </div>

        {/* Content - Scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">{__('Loading closing data...')}</span>
            </div>
          )}

          {!loading && error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Sales Summary */}
              <div className="mb-6 bg-blue-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-3">
                  {__('Sales Summary')}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-blue-700">{__('Invoices')}</p>
                    <p className="text-lg font-bold text-blue-900">{summary.invoice_count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-700">{__('Quantity')}</p>
                    <p className="text-lg font-bold text-blue-900">{summary.total_quantity}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-700">{__('Net Total')}</p>
                    <p className="text-lg font-bold text-blue-900">
                      CHF {summary.net_total.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-700">{__('Grand Total')}</p>
                    <p className="text-lg font-bold text-blue-900">
                      CHF {summary.grand_total.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Reconciliation */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900">
                  {__('Payment Reconciliation')}
                </h3>

                {payments.map((payment, index) => (
                  <div
                    key={payment.mode_of_payment}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">{payment.mode_of_payment}</h4>
                      {Math.abs(payment.difference) > 0.01 && (
                        <div className="flex items-center gap-1">
                          {payment.difference > 0 ? (
                            <TrendingUp className="w-4 h-4 text-green-600" />
                          ) : payment.difference < 0 ? (
                            <TrendingDown className="w-4 h-4 text-red-600" />
                          ) : (
                            <Equal className="w-4 h-4 text-gray-400" />
                          )}
                          <span
                            className={`text-sm font-medium ${
                              payment.difference > 0
                                ? 'text-green-600'
                                : payment.difference < 0
                                ? 'text-red-600'
                                : 'text-gray-600'
                            }`}
                          >
                            {payment.difference > 0 ? '+' : ''}
                            CHF {payment.difference.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          {__('Opening')}
                        </label>
                        <p className="text-sm font-medium text-gray-900">
                          CHF {payment.opening_amount.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          {__('Expected')}
                        </label>
                        <p className="text-sm font-medium text-gray-900">
                          CHF {payment.expected_amount.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          {__('Closing Amount')} *
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={payment.closing_amount}
                          onChange={(e) => handleClosingAmountChange(index, e.target.value)}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Warning if difference */}
              {hasDifference && (
                <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-orange-900">
                      {__('Cash Difference Detected')}
                    </p>
                    <p className="text-sm text-orange-700 mt-1">
                      {__('Total difference')}: CHF {totalDifference.toFixed(2)}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
          >
            {__('Cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading || submitting || !!error}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {__('Closing POS...')}
              </>
            ) : (
              <>
                <DollarSign className="w-4 h-4 mr-2" />
                {__('Close POS')}
              </>
            )}
          </Button>
        </div>
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

export default POSClosingFormDialog;
