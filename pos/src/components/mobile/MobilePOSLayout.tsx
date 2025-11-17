import React, { useState, useRef } from 'react';
import { flushSync } from 'react-dom';
import { toast } from 'react-toastify';
import { MobileHeader } from './MobileHeader';
import { MobileFooter } from './MobileFooter';
import { CategoryHorizontalScroll } from './CategoryHorizontalScroll';
import { MobileMenuGrid } from './MobileMenuGrid';
import { FloatingCartButton } from './FloatingCartButton';
import { CartBottomSheet } from './CartBottomSheet';
import { MobileConfigBottomSheet } from './MobileConfigBottomSheet';
import { CheckoutSummarySheet } from './CheckoutSummarySheet';
import { PaymentMethodSheet } from './PaymentMethodSheet';
import { PaymentSuccessSheet } from './PaymentSuccessSheet';
import { PaymentErrorSheet } from './PaymentErrorSheet';
import TableSelectionDialog from '../TableSelectionDialog';
import ProductDialog from '../ProductDialog';
import { usePOSStore } from '../../store/pos-store';
import { useCheckout } from '../../hooks/useCheckout';
import { Spinner } from '../ui/spinner';
import type { OrderItem } from '../../store/pos-store';

export function MobilePOSLayout() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrderTypeSelectionOpen, setIsOrderTypeSelectionOpen] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [pendingItem, setPendingItem] = useState<any>(null);
  const [forceRender, setForceRender] = useState(0);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<OrderItem | null>(null);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const clickCountRef = useRef(0);

  // Checkout flow states
  const [isCheckoutSummaryOpen, setIsCheckoutSummaryOpen] = useState(false);
  const [isPaymentMethodOpen, setIsPaymentMethodOpen] = useState(false);
  const [isPaymentSuccessOpen, setIsPaymentSuccessOpen] = useState(false);
  const [isPaymentErrorOpen, setIsPaymentErrorOpen] = useState(false);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [finalTotal, setFinalTotal] = useState(0);
  const [submittedInvoice, setSubmittedInvoice] = useState<string>('');

  const {
    menuItems,
    categories,
    selectedCategory,
    setSelectedCategory,
    activeOrders,
    addToOrder,
    updateOrderItemQuantity,
    removeFromOrder,
    setSelectedItem,
    menuLoading,
    selectedOrderType,
  } = usePOSStore();

  // Get fresh store reference for callbacks
  const getStoreState = usePOSStore.getState;

  // Checkout hook
  const { isProcessing, error, submitPayment, resetCheckout } = useCheckout();

  // Filter menu items by selected category
  const filteredItems = selectedCategory
    ? menuItems.filter((item) => item.course === selectedCategory)
    : menuItems;

  // Calculate cart total
  const calculateItemTotal = (item: typeof activeOrders[0]) => {
    const basePrice = item.selectedVariant?.price || item.price;
    const addonsTotal = item.selectedAddons?.reduce((sum, addon) => sum + addon.price, 0) || 0;
    return (basePrice + addonsTotal) * item.quantity;
  };

  const cartTotal = activeOrders.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  const cartItemCount = activeOrders.reduce((sum, item) => sum + item.quantity, 0);

  // Handle item click (single vs double tap)
  const handleItemClick = (item: any) => {
    clickCountRef.current += 1;

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    clickTimerRef.current = setTimeout(() => {
      if (clickCountRef.current === 1) {
        // Single tap - check if this is first item
        const isFirstItem = activeOrders.length === 0;

        if (isFirstItem) {
          // First item - show order type selection first
          console.error('[MobilePOSLayout] Setting pendingItem:', item);
          setPendingItem(item);
          setIsOrderTypeSelectionOpen(true);
        } else {
          // Not first item - add to cart directly
          addToOrder({ ...item, quantity: 1 });
        }
      } else if (clickCountRef.current === 2) {
        // Double tap - open customization
        setSelectedItem(item);
        setItemToEdit(null); // Not editing, adding new
        setIsProductDialogOpen(true);
      }
      clickCountRef.current = 0;
    }, 250);
  };

  // Handle long press for customization
  const handleItemLongPress = (item: any) => {
    setSelectedItem(item);
    setItemToEdit(null); // Not editing, adding new
    setIsProductDialogOpen(true);
  };

  // Checkout flow handlers
  const handleCheckoutClick = () => {
    setIsCartOpen(false);
    setIsCheckoutSummaryOpen(true);
  };

  const handleProceedToPayment = (discount: number) => {
    setDiscountPercentage(discount);
    // Calculate final total with discount
    const subtotal = activeOrders.reduce((sum, item) => sum + calculateItemTotal(item), 0);
    const discountAmount = (subtotal * discount) / 100;
    const total = subtotal - discountAmount;
    setFinalTotal(total);

    setIsCheckoutSummaryOpen(false);
    setIsPaymentMethodOpen(true);
  };

  const handleCompletePayment = async (payments: Array<{ mode_of_payment: string; amount: number }>) => {
    setIsPaymentMethodOpen(false);

    const result = await submitPayment(payments, discountPercentage);

    if (result.success) {
      setSubmittedInvoice(result.invoiceNumber || '');
      setIsPaymentSuccessOpen(true);
      toast.success('Payment successful!');
    } else {
      setIsPaymentErrorOpen(true);
      toast.error(result.error || 'Payment failed');
    }
  };

  const handleStartNewOrder = () => {
    setIsPaymentSuccessOpen(false);
    resetCheckout();
    setDiscountPercentage(0);
    setFinalTotal(0);
    setSubmittedInvoice('');
  };

  const handleRetryPayment = () => {
    setIsPaymentErrorOpen(false);
    setIsPaymentMethodOpen(true);
  };

  const handleCancelPayment = () => {
    setIsPaymentErrorOpen(false);
    setIsCheckoutSummaryOpen(true);
  };

  // Prepare categories for horizontal scroll
  const categoryList = categories.map((cat) => ({
    name: cat,
    count: menuItems.filter((item) => item.course === cat).length,
  }));

  // Add "All Items" category
  const allCategories = [
    { name: '', count: menuItems.length },
    ...categoryList,
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Mobile Header */}
      <MobileHeader
        onMenuClick={() => {
          // TODO: Open menu drawer
          console.log('Menu clicked');
        }}
        onSearchClick={() => {
          // TODO: Open search
          console.log('Search clicked');
        }}
        onUserClick={() => {
          // TODO: Open user menu
          console.log('User menu clicked');
        }}
      />

      {/* Category Horizontal Scroll */}
      <CategoryHorizontalScroll
        categories={allCategories}
        selectedCategory={selectedCategory}
        onCategorySelect={setSelectedCategory}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-24">
        {menuLoading ? (
          <div className="flex items-center justify-center h-full">
            <Spinner message="Loading menu..." />
          </div>
        ) : (
          <MobileMenuGrid
            items={filteredItems}
            onItemClick={handleItemClick}
            onItemLongPress={handleItemLongPress}
            disabled={false}
          />
        )}
      </main>

      {/* Floating Cart Button */}
      <FloatingCartButton
        itemCount={cartItemCount}
        total={cartTotal}
        onClick={() => setIsCartOpen(true)}
      />

      {/* Order Type Selection Bottom Sheet */}
      <MobileConfigBottomSheet
        isOpen={isOrderTypeSelectionOpen}
        onClose={() => {
          setIsOrderTypeSelectionOpen(false);
          // Don't clear pendingItem here - let onConfigured handle it
        }}
        onConfigured={(orderType) => {
          setIsOrderTypeSelectionOpen(false);

          // If Dine In, show table selection dialog
          if (orderType === 'Dine In') {
            setTimeout(() => {
              setShowTableDialog(true);
            }, 300);
          } else {
            // For other order types, add item immediately
            if (pendingItem) {
              addToOrder({ ...pendingItem, quantity: 1 });
              setPendingItem(null);
              // Open cart
              setTimeout(() => setIsCartOpen(true), 100);
            }
          }
        }}
      />

      {/* Cart Bottom Sheet */}
      <CartBottomSheet
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onCheckout={handleCheckoutClick}
        onItemEdit={(item) => {
          setSelectedItem(item);
          setItemToEdit(item);
          setIsProductDialogOpen(true);
        }}
        disabled={false}
      />

      {/* Table Selection Dialog for Dine In */}
      {showTableDialog && (
        <TableSelectionDialog
          onClose={() => {
            console.error('[MobilePOSLayout] ========== TABLE DIALOG onClose CALLED!');
            console.error('[MobilePOSLayout] pendingItem:', pendingItem);
            setShowTableDialog(false);
            // After table selection, add the pending item
            if (pendingItem) {
              console.error('[MobilePOSLayout] Adding item to order');
              const itemToAdd = { ...pendingItem, quantity: 1 };
              console.error('[MobilePOSLayout] Item to add:', itemToAdd);
              const itemRef = pendingItem;
              setPendingItem(null);
              // AWAIT addToOrder before opening cart
              addToOrder(itemToAdd).then(() => {
                console.error('[MobilePOSLayout] ✅ Item added successfully');
                // Get fresh store state
                const freshOrders = getStoreState().activeOrders;
                console.error('[MobilePOSLayout] Fresh activeOrders from store:', freshOrders);
                console.error('[MobilePOSLayout] Fresh activeOrders length:', freshOrders.length);

                // Use flushSync to force a synchronous re-render
                // This ensures React updates with the new Zustand state before we open the cart
                flushSync(() => {
                  console.error('[MobilePOSLayout] Forcing synchronous re-render');
                  setForceRender(prev => prev + 1);
                });

                console.error('[MobilePOSLayout] After flushSync, opening cart now');
                const finalCheck = getStoreState().activeOrders;
                console.error('[MobilePOSLayout] Final activeOrders check:', finalCheck);
                console.error('[MobilePOSLayout] Final length:', finalCheck.length);

                // Open cart immediately after forced synchronous render
                setIsCartOpen(true);
              }).catch((error) => {
                console.error('[MobilePOSLayout] ❌ ERROR in addToOrder:', error);
              });
            } else {
              console.error('[MobilePOSLayout] NO PENDING ITEM!!!');
            }
          }}
        />
      )}

      {/* Product Customization Dialog */}
      {isProductDialogOpen && setSelectedItem && (
        <ProductDialog
          onClose={() => {
            setIsProductDialogOpen(false);
            setItemToEdit(null);
          }}
          editMode={!!itemToEdit}
          itemToReplace={itemToEdit || undefined}
        />
      )}

      {/* Checkout Summary Sheet */}
      <CheckoutSummarySheet
        isOpen={isCheckoutSummaryOpen}
        onClose={() => setIsCheckoutSummaryOpen(false)}
        onProceedToPayment={handleProceedToPayment}
      />

      {/* Payment Method Sheet */}
      <PaymentMethodSheet
        isOpen={isPaymentMethodOpen}
        onClose={() => setIsPaymentMethodOpen(false)}
        onBack={() => {
          setIsPaymentMethodOpen(false);
          setIsCheckoutSummaryOpen(true);
        }}
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
        errorMessage={error || 'Payment failed'}
        onRetry={handleRetryPayment}
        onCancel={handleCancelPayment}
      />

      {/* Loading Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50">
          <Spinner message={__("Processing payment...")} />
        </div>
      )}

      {/* Mobile Footer Navigation */}
      <MobileFooter />
    </div>
  );
}
