import { useState, useEffect } from 'react';

/**
 * Hook to detect media query matches
 * @param query - Media query string (e.g., "(max-width: 768px)")
 * @returns boolean indicating if the query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);

    // Set initial value
    setMatches(media.matches);

    // Create listener for changes
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add listener (modern browsers)
    if (media.addEventListener) {
      media.addEventListener('change', listener);
    } else {
      // Fallback for older browsers
      media.addListener(listener);
    }

    // Cleanup
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', listener);
      } else {
        media.removeListener(listener);
      }
    };
  }, [query]);

  return matches;
}

// Predefined breakpoints
export const breakpoints = {
  mobile: '(max-width: 768px)',
  tablet: '(min-width: 769px) and (max-width: 1023px)',
  desktop: '(min-width: 1024px)',

  // Utility breakpoints
  isTouchDevice: '(hover: none) and (pointer: coarse)',
  prefersReducedMotion: '(prefers-reduced-motion: reduce)',
} as const;

// Convenience hooks
export const useIsMobile = () => useMediaQuery(breakpoints.mobile);
export const useIsTablet = () => useMediaQuery(breakpoints.tablet);
export const useIsDesktop = () => useMediaQuery(breakpoints.desktop);
export const useIsTouchDevice = () => useMediaQuery(breakpoints.isTouchDevice);
export const usePrefersReducedMotion = () => useMediaQuery(breakpoints.prefersReducedMotion);
