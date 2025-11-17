import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRootStore } from '../../store/root-store';
import { MobileHeader } from '../../components/mobile/MobileHeader';
import { MobileFooter } from '../../components/mobile/MobileFooter';
import { MobileOrderDetailsSheet } from '../../components/mobile/MobileOrderDetailsSheet';
import { Spinner } from '../../components/ui/spinner';
import { formatCurrency } from '../../lib/utils';
import { cn } from '../../lib/utils';
import { __ } from '../../lib/i18n';

type OrderStatus = 'Draft' | 'Unbilled' | 'Recently Paid' | 'Paid' | 'Consolidated' | 'Return';

const statusTabs: { label: string; value: OrderStatus }[] = [
  { label: 'Draft', value: 'Draft' },
  { label: 'Unbilled', value: 'Unbilled' },
  { label: 'Paid', value: 'Paid' },
  { label: 'Consolidated', value: 'Consolidated' },
  { label: 'Return', value: 'Return' },
];

export function MobileOrders() {
  const navigate = useNavigate();
  const {
    orders,
    selectedOrder,
    orderLoading,
    selectedStatus: storeSelectedStatus,
    fetchOrders,
    selectOrder,
    clearSelectedOrder,
    setSelectedStatus,
  } = useRootStore();

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    // Fetch orders on mount
    fetchOrders();
  }, [fetchOrders]);

  const handleOrderClick = async (order: any) => {
    await selectOrder(order);
    setIsDetailsOpen(true);
  };

  const handleCloseDetails = () => {
    setIsDetailsOpen(false);
    clearSelectedOrder();
  };

  const handleRefreshOrders = () => {
    fetchOrders();
  };

  // No need to filter client-side since backend already filters by status
  // The backend handles special cases like "Unbilled" (Draft + invoice_printed=0 + table)
  const filteredOrders = orders;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Mobile Header */}
      <MobileHeader
        onMenuClick={() => {
          console.log('Menu clicked');
        }}
        onSearchClick={() => {
          console.log('Search clicked');
        }}
        onUserClick={() => {
          console.log('User menu clicked');
        }}
      />

      {/* Status Tabs */}
      <div className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex px-4 py-2 gap-2 min-w-max">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setSelectedStatus(tab.value)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                storeSelectedStatus === tab.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <main className="flex-1 overflow-y-auto pb-20">
        {orderLoading ? (
          <div className="flex items-center justify-center h-full">
            <Spinner message="Loading orders..." />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-lg font-medium">No {storeSelectedStatus.toLowerCase()} orders</p>
            <p className="text-sm mt-1">{__('Orders will appear here')}</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {filteredOrders.map((order) => (
              <div
                key={order.name}
                onClick={() => handleOrderClick(order)}
                className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm active:bg-gray-50 transition-colors"
              >
                {/* Order Header */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{order.name}</h3>
                    <p className="text-sm text-gray-500">
                      {order.restaurant_table || order.order_type || 'No table'}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'px-2 py-1 rounded text-xs font-medium',
                      order.status === 'Draft'
                        ? 'bg-gray-100 text-gray-700'
                        : order.status === 'Paid'
                        ? 'bg-green-100 text-green-700'
                        : order.status === 'Return'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                    )}
                  >
                    {order.status}
                  </span>
                </div>

                {/* Order Info */}
                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-600">
                    <p>{order.customer_name || order.customer}</p>
                    <p className="text-xs mt-0.5">
                      {order.posting_date} {order.posting_time}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary-600">
                      {formatCurrency(order.rounded_total || order.grand_total)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Mobile Footer Navigation */}
      <MobileFooter />

      {/* Order Details Sheet */}
      <MobileOrderDetailsSheet
        isOpen={isDetailsOpen}
        onClose={handleCloseDetails}
        order={selectedOrder}
        onRefresh={handleRefreshOrders}
      />
    </div>
  );
}
