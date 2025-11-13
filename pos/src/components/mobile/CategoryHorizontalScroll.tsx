import React, { useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface Category {
  name: string;
  count?: number;
}

interface CategoryHorizontalScrollProps {
  categories: Category[];
  selectedCategory: string;
  onCategorySelect: (category: string) => void;
  className?: string;
}

export function CategoryHorizontalScroll({
  categories,
  selectedCategory,
  onCategorySelect,
  className,
}: CategoryHorizontalScrollProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selectedButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll to selected category on change
  useEffect(() => {
    if (selectedButtonRef.current && scrollContainerRef.current) {
      const button = selectedButtonRef.current;
      const container = scrollContainerRef.current;

      const buttonLeft = button.offsetLeft;
      const buttonWidth = button.offsetWidth;
      const containerWidth = container.offsetWidth;
      const scrollLeft = container.scrollLeft;

      // Check if button is not fully visible
      if (buttonLeft < scrollLeft || buttonLeft + buttonWidth > scrollLeft + containerWidth) {
        // Scroll to center the button
        container.scrollTo({
          left: buttonLeft - containerWidth / 2 + buttonWidth / 2,
          behavior: 'smooth',
        });
      }
    }
  }, [selectedCategory]);

  return (
    <div
      className={cn(
        'bg-white border-b border-gray-200',
        'overflow-x-auto scrollbar-hide',
        className
      )}
    >
      <div
        ref={scrollContainerRef}
        className="flex gap-2 px-4 py-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {categories.map((category) => {
          const isSelected = selectedCategory === category.name;

          return (
            <button
              key={category.name}
              ref={isSelected ? selectedButtonRef : null}
              onClick={() => onCategorySelect(category.name)}
              className={cn(
                'flex-shrink-0 snap-start',
                'px-4 py-2 rounded-full text-sm font-medium',
                'transition-all duration-200',
                'min-w-fit whitespace-nowrap',
                'active:scale-95',
                isSelected
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {category.name}
              {category.count !== undefined && (
                <span
                  className={cn(
                    'ml-1.5 text-xs',
                    isSelected ? 'text-primary-100' : 'text-gray-500'
                  )}
                >
                  {category.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Gradient fade on edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent" />
    </div>
  );
}
