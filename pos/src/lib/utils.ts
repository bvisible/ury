import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { storage } from './storage';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  const symbol = storage.getItem('currencySymbol');
  // Round to 2 decimal places and format
  const formatted = Number(amount).toFixed(2);
  return `${symbol} ${formatted}`;
} 