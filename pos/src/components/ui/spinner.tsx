import { cn } from '../../lib/utils';
import { __ } from '../../lib/i18n';

interface SpinnerProps {
  className?: string;
  message?: string;
  hideMessage?: boolean;
}

export function Spinner({ className, message, hideMessage = false}: SpinnerProps) {
  return (
    <div className="flex items-center justify-center min-h-[inherit]">
      <div className="text-center">
        <div className={cn(
          "animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600 mx-auto",
          className
        )} />
        {!hideMessage && <p className="mt-4 text-gray-600">{message || __("Loading...")}</p>}
      </div>
    </div>
  );
} 