import { ReactNode } from 'react';

interface ScreenSizeProviderProps {
  children: ReactNode;
}

/**
 * ScreenSizeProvider - Previously blocked small screens, now allows all sizes
 * Mobile support is now handled via responsive design in components
 */
const ScreenSizeProvider = ({ children }: ScreenSizeProviderProps) => {
  // Mobile support is now enabled - no blocking dialog
  // Responsive layout switching is handled by useMediaQuery hook in components
  return <>{children}</>;
};

export default ScreenSizeProvider; 