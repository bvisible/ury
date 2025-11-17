import React from 'react';
import { Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn, formatCurrency } from '../../lib/utils';
import type { MenuItem } from '../../store/pos-store';
import { __ } from '../../lib/i18n';

interface MobileMenuGridProps {
  items: MenuItem[];
  onItemClick: (item: MenuItem) => void;
  onItemLongPress?: (item: MenuItem) => void;
  disabled?: boolean;
  className?: string;
}

export function MobileMenuGrid({
  items,
  onItemClick,
  onItemLongPress,
  disabled = false,
  className,
}: MobileMenuGridProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <p className="text-lg font-medium">{__('No items found')}</p>
        <p className="text-sm mt-1">{__('Try selecting a different category')}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 p-4',
        disabled && 'opacity-50 pointer-events-none',
        className
      )}
    >
      {items.map((item) => (
        <MobileMenuCard
          key={item.id}
          item={item}
          onClick={() => onItemClick(item)}
          onLongPress={() => onItemLongPress?.(item)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

interface MobileMenuCardProps {
  item: MenuItem;
  onClick: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
}

function MobileMenuCard({ item, onClick, onLongPress, disabled }: MobileMenuCardProps) {
  const lastClickRef = React.useRef<number>(0);

  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    // Debounce to prevent onClick + onTap double trigger
    const now = Date.now();
    if (now - lastClickRef.current < 100) {
      return;
    }
    lastClickRef.current = now;

    onClick();
  };

  return (
    <motion.button
      onClick={handleClick}
      onTap={handleClick}
      onLongPress={onLongPress}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      disabled={disabled}
      className={cn(
        'relative flex flex-col bg-white rounded-lg border border-gray-200',
        'shadow-sm overflow-hidden',
        'h-44 p-3',
        'active:shadow-md transition-shadow',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {/* Image Section */}
      <div className="relative flex-shrink-0 h-24 mb-2 bg-gray-100 rounded-md overflow-hidden">
        {item.item_image ? (
          <img
            src={item.item_image}
            alt={item.item_name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <span className="text-3xl font-bold">
              {item.item_name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Special Badge */}
        {item.special_dish === 1 && (
          <div className="absolute top-1 right-1 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded">
            ⭐
          </div>
        )}

        {/* Quick Add Button */}
        <motion.div
          whileTap={{ scale: 0.9 }}
          className="absolute bottom-1 right-1 bg-primary-600 text-white rounded-full p-1.5 shadow-lg"
        >
          <Plus className="w-4 h-4" />
        </motion.div>
      </div>

      {/* Item Info */}
      <div className="flex-1 flex flex-col min-h-0">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-auto">
          {item.item_name}
        </h3>

        {/* Price */}
        <p className="text-base font-bold text-primary-600 mt-1">
          {formatCurrency(item.price)}
        </p>
      </div>
    </motion.button>
  );
}
