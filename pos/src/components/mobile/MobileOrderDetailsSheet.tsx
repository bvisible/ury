import React, { useState } from 'react';
import { Sheet } from 'react-modal-sheet';
import { X, Printer, CreditCard, Edit, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../../lib/utils';
import { Button } from '../ui/button';
import { PaymentMethodSheet } from './PaymentMethodSheet';
import { PaymentSuccessSheet } from './PaymentSuccessSheet';
import { PaymentErrorSheet } from './PaymentErrorSheet';
import { Spinner } from '../ui/spinner';
import { call } from '../../lib/frappe-sdk';
import { useRootStore } from '../../store/root-store';
import { usePOSStore } from '../../store/pos-store';
import { printOrder } from '../../lib/print';
import type { POSInvoice } from '../../store/slices/orders-slice';

interface MobileOrderDetailsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  order: POSInvoice | null;
  onRefresh?: () => void;
}

export function MobileOrderDetailsSheet({
  isOpen,
  onClose,
  order,
  onRefresh,
}: MobileOrderDetailsSheetProps) {
  const navigate = useNavigate();

  // Get order items from store
  const { selectedOrderItems, selectedOrderLoading, selectOrder } = useRootStore();
  const { posProfile, loadOrderForEditing } = usePOSStore();

  // Payment flow states
  const [isPaymentMethodOpen, setIsPaymentMethodOpen] = useState(false);
  const [isPaymentSuccessOpen, setIsPaymentSuccessOpen] = useState(false);
  const [isPaymentErrorOpen, setIsPaymentErrorOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [finalTotal, setFinalTotal] = useState(0);
  const [submittedInvoice, setSubmittedInvoice] = useState<string>('');

  // Cancel flow states
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  if (!order) return null;

  // Calculate totals
  const subtotal = order.grand_total;
  const total = order.rounded_total || order.grand_total;

  // Check if order can be paid or edited
  const canPay = ['Draft', 'Unbilled', 'Recently Paid'].includes(order.status);
  const canEdit = ['Draft', 'Unbilled'].includes(order.status);

  const handlePaymentClick = () => {
    setFinalTotal(total);
    setIsPaymentMethodOpen(true);
  };

  const handleCompletePayment = async (payments: Array<{ mode_of_payment: string; amount: number }>) => {
    setIsPaymentMethodOpen(false);
    setIsProcessing(true);

    try {
      // Get current user
      const user = localStorage.getItem('user_id') || 'Administrator';
      const posProfileData = sessionStorage.getItem('posProfile');
      const profile = posProfileData ? JSON.parse(posProfileData) : null;

      // Call make_invoice API directly with the invoice ID
      const response: any = await call.post('ury.ury.doctype.ury_order.ury_order.make_invoice', {
        additionalDiscount: null,
        cashier: profile?.cashier || user,
        customer: order.customer,
        invoice: order.name, // Pass the existing order ID
        owner: user,
        payments: payments,
        pos_profile: profile?.name,
        table: order.restaurant_table || null,
      });

      setSubmittedInvoice(response.message?.name || response.name || order.name);
      setIsPaymentSuccessOpen(true);
      toast.success('Payment successful!');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('[MobileOrderDetailsSheet] Payment error:', err);

      // Parse Frappe error messages
      let errorMessage = 'Payment failed. Please try again.';
      if (err._server_messages) {
        try {
          const messages = JSON.parse(err._server_messages);
          const messageObj = JSON.parse(messages[0]);
          errorMessage = messageObj.message || errorMessage;
        } catch (parseError) {
          console.error('[MobileOrderDetailsSheet] Error parsing server messages:', parseError);
        }
      } else if (err.message) {
        errorMessage = err.message;
      }

      setIsPaymentErrorOpen(true);
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartNewOrder = () => {
    setIsPaymentSuccessOpen(false);
    onClose();
  };

  const handleRetryPayment = () => {
    setIsPaymentErrorOpen(false);
    setIsPaymentMethodOpen(true);
  };

  const handleCancelPayment = () => {
    setIsPaymentErrorOpen(false);
  };

  const handlePrint = async () => {
    if (!posProfile) {
      toast.error('POS Profile not loaded');
      return;
    }

    setIsPrinting(true);
    try {
      await printOrder({
        orderId: order.name,
        posProfile: posProfile
      });
      toast.success('Printed successfully');

      // Update the order's invoice_printed status
      if (order && selectOrder) {
        await selectOrder({ ...order, invoice_printed: 1 });
      }

      // Refresh orders list
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('[MobileOrderDetailsSheet] Print error:', err);
      toast.error(err.message || 'Failed to print');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleEditOrder = async () => {
    try {
      // Load order items into the cart for editing
      await loadOrderForEditing(order, selectedOrderItems);
      toast.success('Order loaded for editing');
      onClose();
      // Navigate to POS page
      navigate('/');
    } catch (err: any) {
      console.error('[MobileOrderDetailsSheet] Edit error:', err);
      toast.error(err.message || 'Failed to load order');
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelReason.trim()) {
      toast.error('Please enter a reason for cancellation');
      return;
    }

    setIsCancelling(true);
    try {
      await call.post('ury.ury.doctype.ury_order.ury_order.cancel_order', {
        invoice_id: order.name,
        reason: cancelReason
      });

      toast.success('Order cancelled successfully');
      setIsCancelDialogOpen(false);
      setCancelReason('');
      onClose();

      // Refresh orders list
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('[MobileOrderDetailsSheet] Cancel error:', err);
      toast.error(err.message || 'Failed to cancel order');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <>
      <Sheet
        isOpen={isOpen && !isPaymentMethodOpen && !isPaymentSuccessOpen && !isPaymentErrorOpen}
        onClose={onClose}
        snapPoints={[0, 1]}
        initialSnap={1}
      >
        <Sheet.Container>
          <Sheet.Header>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{order.name}</h2>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </Sheet.Header>

          <Sheet.Content style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Order Info */}
            <div className="flex-shrink-0 px-4 py-4 bg-gray-50 border-b border-gray-200">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Customer</p>
                  <p className="font-medium text-gray-900">{order.customer_name || order.customer}</p>
                </div>
                <div>
                  <p className="text-gray-500">Time</p>
                  <p className="font-medium text-gray-900">
                    {order.posting_date} {order.posting_time}
                  </p>
                </div>
                {order.restaurant_table && (
                  <div>
                    <p className="text-gray-500">Table</p>
                    <p className="font-medium text-gray-900">{order.restaurant_table}</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-500">Status</p>
                  <p className="font-medium text-gray-900">{order.status}</p>
                </div>
              </div>
            </div>

            {/* Order Items - Scrollable middle section */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
              <h3 className="font-semibold text-gray-900 mb-3">Order Items</h3>
              {selectedOrderLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner message="Loading items..." />
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedOrderItems && selectedOrderItems.length > 0 ? (
                    selectedOrderItems.map((item, index) => (
                      <div key={index} className="flex items-start justify-between py-2 border-b border-gray-100">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {item.qty}x {item.item_name}
                          </p>
                        </div>
                        <p className="font-semibold text-gray-900 ml-2">
                          {formatCurrency(item.amount)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">No items in this order</p>
                  )}
                </div>
              )}
            </div>

            {/* Totals and Action Buttons - Sticky at bottom within sheet */}
            {(canPay || canEdit) && (
              <div className="flex-shrink-0 border-t border-gray-200 px-4 py-4 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium text-gray-900">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-lg font-bold pt-2 border-t border-gray-200">
                    <span className="text-gray-900">Total</span>
                    <span className="text-primary-600">{formatCurrency(total)}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  {/* Edit & Cancel Buttons (full width, only for Draft/Unbilled) */}
                  {canEdit && (
                    <div className="flex gap-3">
                      <Button
                        onClick={handleEditOrder}
                        disabled={isPrinting || isProcessing || selectedOrderLoading}
                        variant="outline"
                        className="flex-1 h-12"
                      >
                        <Edit className="w-5 h-5 mr-2" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => setIsCancelDialogOpen(true)}
                        disabled={isPrinting || isProcessing || isCancelling}
                        variant="outline"
                        className="flex-1 h-12 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-5 h-5 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  )}

                  {/* Print & Payment Buttons */}
                  {canPay && (
                    <div className="flex gap-3">
                      <Button
                        onClick={handlePrint}
                        disabled={isPrinting || isProcessing}
                        variant="outline"
                        className="flex-1 h-12"
                      >
                        <Printer className="w-5 h-5 mr-2" />
                        {isPrinting ? 'Printing...' : 'Print'}
                      </Button>
                      <Button
                        onClick={handlePaymentClick}
                        disabled={isProcessing || isPrinting}
                        className="flex-1 h-12 bg-primary-600 hover:bg-primary-700"
                      >
                        <CreditCard className="w-5 h-5 mr-2" />
                        Payment
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Sheet.Content>
        </Sheet.Container>

        <Sheet.Backdrop onTap={onClose} />
      </Sheet>

      {/* Payment Method Sheet */}
      <PaymentMethodSheet
        isOpen={isPaymentMethodOpen}
        onClose={() => setIsPaymentMethodOpen(false)}
        onBack={() => setIsPaymentMethodOpen(false)}
        totalAmount={finalTotal}
        onCompletePayment={handleCompletePayment}
      />

      {/* Payment Success Sheet */}
      <PaymentSuccessSheet
        isOpen={isPaymentSuccessOpen}
        invoiceNumber={submittedInvoice}
        totalAmount={finalTotal}
        onStartNewOrder={handleStartNewOrder}
      />

      {/* Payment Error Sheet */}
      <PaymentErrorSheet
        isOpen={isPaymentErrorOpen}
        errorMessage={'Payment failed'}
        onRetry={handleRetryPayment}
        onCancel={handleCancelPayment}
      />

      {/* Cancel Confirmation Sheet */}
      <Sheet
        isOpen={isCancelDialogOpen}
        onClose={() => !isCancelling && setIsCancelDialogOpen(false)}
        snapPoints={[0, 0.5]}
        initialSnap={1}
      >
        <Sheet.Container>
          <Sheet.Header>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Cancel Order</h2>
              <button
                onClick={() => setIsCancelDialogOpen(false)}
                disabled={isCancelling}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </Sheet.Header>

          <Sheet.Content>
            <div className="flex flex-col h-full px-4 py-4">
              {/* Warning Message */}
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  Are you sure you want to cancel order <strong>{order.name}</strong>? This action cannot be undone.
                </p>
              </div>

              {/* Reason Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for cancellation *
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  disabled={isCancelling}
                  placeholder="Enter reason for cancellation..."
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={() => setIsCancelDialogOpen(false)}
                  disabled={isCancelling}
                  variant="outline"
                  className="flex-1 h-12"
                >
                  Keep Order
                </Button>
                <Button
                  onClick={handleCancelOrder}
                  disabled={isCancelling || !cancelReason.trim()}
                  className="flex-1 h-12 bg-red-600 hover:bg-red-700 text-white"
                >
                  {isCancelling ? 'Cancelling...' : 'Confirm Cancel'}
                </Button>
              </div>
            </div>
          </Sheet.Content>
        </Sheet.Container>

        <Sheet.Backdrop onTap={() => !isCancelling && setIsCancelDialogOpen(false)} />
      </Sheet>

      {/* Loading Overlay */}
      {(isProcessing || isPrinting || isCancelling) && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50">
          <Spinner
            message={
              isProcessing ? 'Processing payment...' :
              isPrinting ? 'Printing...' :
              'Cancelling order...'
            }
          />
        </div>
      )}
    </>
  );
}
