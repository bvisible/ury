import { useState } from 'react';
import { usePOSStore } from '../store/pos-store';
import { db, call } from '../lib/frappe-sdk';
import { __ } from '../lib/i18n';

interface Payment {
  mode_of_payment: string;
  amount: number;
}

export function useCheckout() {
  const {
    activeOrders,
    selectedCustomer,
    selectedAggregator,
    selectedTable,
    selectedRoom,
    selectedOrderType,
    posProfile,
    orderId,
    isUpdatingOrder,
    resetOrderState,
  } = usePOSStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateOrder = (): { valid: boolean; error?: string } => {
    // Check if there are items in the cart
    if (activeOrders.length === 0) {
      return { valid: false, error: 'Cart is empty' };
    }

    // Check if customer or aggregator is selected
    if (!selectedCustomer && !selectedAggregator) {
      return { valid: false, error: 'Please select a customer' };
    }

    // Check if table is selected for Dine In orders
    if (selectedOrderType === 'Dine In' && !selectedTable) {
      return { valid: false, error: 'Please select a table for Dine In orders' };
    }

    // Check if aggregator is selected for Aggregators order type
    if (selectedOrderType === 'Aggregators' && !selectedAggregator) {
      return { valid: false, error: 'Please select an aggregator' };
    }

    return { valid: true };
  };

  const submitPayment = async (payments: Payment[], discountPercentage: number = 0) => {
    setIsProcessing(true);
    setError(null);

    try {
      // Validate order before submission
      const validation = validateOrder();
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Validate payments
      if (payments.length === 0) {
        throw new Error(__('Please select at least one payment method'));
      }

      const totalPayment = payments.reduce((sum, p) => sum + p.amount, 0);
      const orderTotal = activeOrders.reduce((sum, item) => {
        const basePrice = item.selectedVariant?.price || item.price;
        const addonsTotal = item.selectedAddons?.reduce((s, a) => s + a.price, 0) || 0;
        return sum + (basePrice + addonsTotal) * item.quantity;
      }, 0);

      const discountAmount = (orderTotal * discountPercentage) / 100;
      const finalTotal = orderTotal - discountAmount;

      if (totalPayment < finalTotal) {
        throw new Error(__('Payment amount is less than order total'));
      }

      // Get current user
      const user = await call.get('frappe.auth.get_logged_user');

      // Prepare API call parameters
      const params = {
        customer: selectedCustomer?.id || selectedAggregator?.customer,
        payments: payments,
        cashier: posProfile?.cashier || user,
        pos_profile: posProfile?.name,
        owner: user,
        additionalDiscount: discountPercentage > 0 ? discountPercentage : null,
        table: selectedTable || null,
        invoice: orderId || null, // For updating existing orders
      };

      console.log('[useCheckout] Submitting payment with params:', params);

      // Call make_invoice API
      const response: any = await call.post('ury.ury.doctype.ury_order.ury_order.make_invoice', params);

      console.log('[useCheckout] Payment successful, response:', response);

      setIsProcessing(false);
      return {
        success: true,
        invoiceNumber: response.message?.name || response.name || 'N/A',
        data: response.message || response,
      };
    } catch (err: any) {
      console.error('[useCheckout] Payment error:', err);

      // Parse Frappe error messages
      let errorMessage = 'Payment failed. Please try again.';

      if (err._server_messages) {
        try {
          const messages = JSON.parse(err._server_messages);
          const messageObj = JSON.parse(messages[0]);
          errorMessage = messageObj.message || errorMessage;
        } catch (parseError) {
          console.error('[useCheckout] Error parsing server messages:', parseError);
        }
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setIsProcessing(false);
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const resetCheckout = () => {
    setIsProcessing(false);
    setError(null);
    resetOrderState();
  };

  return {
    isProcessing,
    error,
    validateOrder,
    submitPayment,
    resetCheckout,
  };
}
