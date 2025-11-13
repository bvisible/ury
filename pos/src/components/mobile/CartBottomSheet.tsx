import React, { useState, useEffect } from 'react';
import { Sheet } from 'react-modal-sheet';
import { X, Minus, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { cn, formatCurrency } from '../../lib/utils';
import { Button } from '../ui/button';
import type { OrderItem } from '../../store/pos-store';
import { usePOSStore } from '../../store/pos-store';
import OrderTypeSelect from '../OrderTypeSelect';
import { CustomerSelect } from '../CustomerSelect';
import { syncOrder } from '../../lib/order-api';

interface CartBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout: () => void;
  onItemEdit?: (item: OrderItem) => void;
  disabled?: boolean;
}

export function CartBottomSheet({
  isOpen,
  onClose,
  onCheckout,
  onItemEdit,
  disabled = false,
}: CartBottomSheetProps) {
  // Read directly from Zustand store to ensure we always have the latest state
  const {
    activeOrders,
    updateOrderItemQuantity,
    removeFromOrder,
    selectedCustomer,
    selectedAggregator,
    selectedTable,
    selectedOrderType,
    posProfile,
    paymentModes,
    resetOrderState,
  } = usePOSStore();

  const [isSaving, setIsSaving] = useState(false);

  console.error('[CartBottomSheet] Rendered with activeOrders:', activeOrders);
  console.error('[CartBottomSheet] activeOrders.length:', activeOrders.length);

  // Calculate cart total
  const calculateItemTotal = (item: OrderItem) => {
    const basePrice = item.selectedVariant?.price || item.price;
    const addonsTotal = item.selectedAddons?.reduce((sum, addon) => sum + addon.price, 0) || 0;
    return (basePrice + addonsTotal) * item.quantity;
  };

  const total = activeOrders.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  const items = activeOrders;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Force scroller to use flexbox layout with overflow visible and max-height
  useEffect(() => {
    if (isOpen) {
      const applyStyles = () => {
        const scroller = document.querySelector('.react-modal-sheet-content-scroller');
        const content = document.querySelector('.react-modal-sheet-content');

        if (scroller && content) {
          console.log('[CartBottomSheet] Applying forced styles to scroller');

          // Calculate max height: viewport height minus content top position
          // This accounts for the Sheet.Header which is outside the content
          const contentRect = content.getBoundingClientRect();
          const maxHeight = window.innerHeight - contentRect.top;

          (scroller as HTMLElement).style.display = 'flex';
          (scroller as HTMLElement).style.flexDirection = 'column';
          (scroller as HTMLElement).style.minHeight = '0';
          (scroller as HTMLElement).style.height = 'auto';
          (scroller as HTMLElement).style.maxHeight = `${maxHeight}px`;
          (scroller as HTMLElement).style.flex = '1';
          (scroller as HTMLElement).style.overflow = 'visible';

          console.log('[CartBottomSheet] Scroller styles applied:', {
            display: (scroller as HTMLElement).style.display,
            overflow: (scroller as HTMLElement).style.overflow,
            height: (scroller as HTMLElement).style.height,
            maxHeight: (scroller as HTMLElement).style.maxHeight,
            contentTop: contentRect.top,
            viewportHeight: window.innerHeight,
          });
        } else {
          console.error('[CartBottomSheet] Scroller or content not found!');
        }
      };

      // Apply multiple times to catch animation
      const timer1 = setTimeout(applyStyles, 50);
      const timer2 = setTimeout(applyStyles, 200);
      const timer3 = setTimeout(applyStyles, 400);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [isOpen]);

  // Callback handlers for cart item actions
  const onUpdateQuantity = (uniqueId: string, qty: number) => {
    updateOrderItemQuantity(uniqueId, qty);
  };

  const onRemoveItem = (uniqueId: string) => {
    removeFromOrder(uniqueId);
  };

  // Handle "Add New Order" - Save as Draft
  const handleAddNewOrder = async () => {
    if (!posProfile) {
      toast.error('POS Profile not loaded');
      return;
    }

    if (!selectedCustomer && !selectedAggregator) {
      toast.error('Please select a customer');
      return;
    }

    if (selectedOrderType === 'Dine In' && !selectedTable) {
      toast.error('Please select a table for Dine In orders');
      return;
    }

    setIsSaving(true);

    try {
      // Get current user
      const user = localStorage.getItem('user_id') || 'Administrator';

      // Prepare items for API
      const orderItems = activeOrders.map(item => ({
        item: item.item || item.id, // Use item field from API, fallback to id
        item_name: item.item_name || item.name,
        rate: item.selectedVariant?.price || item.price,
        qty: item.quantity,
      }));

      // Call sync_order API
      await syncOrder({
        table: selectedTable || undefined,
        customer: selectedCustomer?.id || selectedAggregator?.customer,
        items: orderItems,
        no_of_pax: 1,
        cashier: posProfile.cashier || user,
        owner: user,
        mode_of_payment: paymentModes[0], // Use first payment mode from store (same as desktop)
        waiter: posProfile.cashier || user,
        pos_profile: posProfile.name,
        invoice: null,
        aggregator_id: selectedAggregator?.id || null,
        order_type: selectedOrderType || 'Dine In',
        last_invoice: null,
        comments: null,
        room: undefined,
      });

      toast.success('Order saved successfully');
      resetOrderState();
      onClose();
    } catch (error: any) {
      console.error('Error saving order:', error);
      toast.error(error.message || 'Failed to save order');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={[0, 0.6, 0.85, 1]}
      initialSnap={1}
      onSnap={(snapIndex) => {
        // Close sheet when snapped to bottom
        if (snapIndex === 0) {
          onClose();
        }
      }}
    >
      <Sheet.Container>
        <Sheet.Header>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Your Order ({itemCount} {itemCount === 1 ? 'item' : 'items'})
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </Sheet.Header>

        <Sheet.Content className="!flex !flex-col !overflow-visible" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Order Type and Customer Selection - Fixed at top */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 space-y-3">
              {/* Order Type Buttons */}
              <OrderTypeSelect disabled={disabled} />

              {/* Customer Selector */}
              <CustomerSelect disabled={disabled} />
            </div>

            {/* Items List - Scrollable middle section */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <p className="text-lg font-medium">Your cart is empty</p>
                  <p className="text-sm mt-1">Add items to get started</p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {items.map((item) => (
                    <CartItem
                      key={item.uniqueId}
                      item={item}
                      onUpdateQuantity={(qty) => onUpdateQuantity(item.uniqueId, qty)}
                      onRemove={() => onRemoveItem(item.uniqueId)}
                      onEdit={onItemEdit ? () => onItemEdit(item) : undefined}
                      disabled={disabled}
                    />
                  ))}
                </AnimatePresence>
              )}
          </div>

          {/* Footer with Total and Buttons - Fixed at bottom */}
          {items.length > 0 && (
            <div className="flex-shrink-0 border-t border-gray-200 p-4 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                {/* Total */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-semibold text-gray-900">Total</span>
                  <span className="text-xl font-bold text-primary-600">
                    {formatCurrency(total)}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  {/* Add New Order Button - Save as Draft */}
                  <Button
                    onClick={handleAddNewOrder}
                    disabled={disabled || items.length === 0 || isSaving}
                    variant="outline"
                    className="flex-1 h-12 text-base font-semibold"
                  >
                    {isSaving ? 'Saving...' : 'Add New Order'}
                  </Button>

                  {/* Checkout Button - Direct Payment */}
                  <Button
                    onClick={onCheckout}
                    disabled={disabled || items.length === 0}
                    className="flex-1 h-12 text-base font-semibold bg-primary-600 hover:bg-primary-700"
                  >
                    Checkout
                  </Button>
                </div>
            </div>
          )}
        </Sheet.Content>
      </Sheet.Container>

      <Sheet.Backdrop onTap={onClose} />
    </Sheet>
  );
}

interface CartItemProps {
  item: OrderItem;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
  onEdit?: () => void;
  disabled?: boolean;
}

function CartItem({ item, onUpdateQuantity, onRemove, onEdit, disabled }: CartItemProps) {
  const itemTotal = (item.selectedVariant?.price || item.price) * item.quantity;
  const addonsTotal = (item.selectedAddons?.reduce((sum, addon) => sum + addon.price, 0) || 0) * item.quantity;
  const total = itemTotal + addonsTotal;

  return (
    <div className="relative">
      {/* Delete background - shown when swiping */}
      <div className="absolute inset-0 bg-red-500 flex items-center justify-end pr-6">
        <Trash2 className="w-6 h-6 text-white" />
      </div>

      {/* Cart Item - draggable */}
      <motion.div
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={0.2}
        onDragEnd={(e, info) => {
          // If swiped more than 60px to the left, delete
          if (info.offset.x < -60) {
            onRemove();
          }
        }}
        className={cn(
          'relative z-10 flex items-center gap-3 py-3 border-b border-gray-100 bg-white',
          disabled && 'opacity-50 pointer-events-none'
        )}
      >
      {/* Item Image */}
      <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-md overflow-hidden">
        {item.item_image ? (
          <img
            src={item.item_image}
            alt={item.item_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl font-bold">
            {item.item_name.charAt(0)}
          </div>
        )}
      </div>

      {/* Item Details - Clickable to edit */}
      <div
        className="flex-1 min-w-0 cursor-pointer active:opacity-70"
        onClick={(e) => {
          if (onEdit && !disabled) {
            e.stopPropagation();
            onEdit();
          }
        }}
      >
        <h3 className="font-medium text-gray-900 truncate">{item.item_name}</h3>

        {/* Variant */}
        {item.selectedVariant && (
          <p className="text-xs text-gray-500 mt-0.5">{item.selectedVariant.name}</p>
        )}

        {/* Addons */}
        {item.selectedAddons && item.selectedAddons.length > 0 && (
          <p className="text-xs text-gray-500 mt-0.5">
            + {item.selectedAddons.map(a => a.name).join(', ')}
          </p>
        )}

        {/* Comment/Note */}
        {item.comment && (
          <p className="text-xs text-gray-500 italic mt-0.5 line-clamp-2">
            Note: {item.comment}
          </p>
        )}

        {/* Price */}
        <p className="text-sm font-semibold text-primary-600 mt-1">
          {formatCurrency(total)}
        </p>
      </div>

      {/* Quantity Controls */}
      <div className="flex items-center gap-2">
        {/* Decrease */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            if (item.quantity > 1) {
              onUpdateQuantity(item.quantity - 1);
            } else {
              onRemove();
            }
          }}
          disabled={disabled}
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded-full',
            'bg-gray-100 hover:bg-gray-200 transition-colors',
            item.quantity === 1
              ? 'text-red-600 hover:bg-red-50'
              : 'text-gray-700'
          )}
        >
          {item.quantity === 1 ? (
            <Trash2 className="w-4 h-4" />
          ) : (
            <Minus className="w-4 h-4" />
          )}
        </motion.button>

        {/* Quantity */}
        <span className="w-8 text-center font-semibold text-gray-900">
          {item.quantity}
        </span>

        {/* Increase */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => onUpdateQuantity(item.quantity + 1)}
          disabled={disabled}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-primary-600 hover:bg-primary-700 text-white transition-colors"
        >
          <Plus className="w-4 h-4" />
        </motion.button>
      </div>
    </motion.div>
    </div>
  );
}
