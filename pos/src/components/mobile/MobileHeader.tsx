import React, { useState } from 'react';
import { Menu, Search, User } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { __ } from '../../lib/i18n';

interface MobileHeaderProps {
  onMenuClick?: () => void;
  onSearchClick?: () => void;
  onUserClick?: () => void;
  className?: string;
}

export function MobileHeader({
  onMenuClick,
  onSearchClick,
  onUserClick,
  className,
}: MobileHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 bg-white border-b border-gray-200',
        'h-14 px-4 flex items-center justify-between',
        'shadow-sm',
        className
      )}
    >
      {/* Left: Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        className="h-10 w-10"
        aria-label={__('Open menu')}
      >
        <Menu className="w-5 h-5 text-gray-700" />
      </Button>

      {/* Center: Logo */}
      <div className="flex-1 flex justify-center">
        <img
          src="/assets/ury/pos/ury_pos.png"
          alt={__('URY POS')}
          className="h-8 object-contain"
        />
      </div>

      {/* Right: Search & User */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onSearchClick}
          className="h-10 w-10"
          aria-label={__('Search')}
        >
          <Search className="w-5 h-5 text-gray-700" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onUserClick}
          className="h-10 w-10"
          aria-label={__('User menu')}
        >
          <User className="w-5 h-5 text-gray-700" />
        </Button>
      </div>
    </header>
  );
}
