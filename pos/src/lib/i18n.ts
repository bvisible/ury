/**
 * Translation system integrated with Frappe's native translation infrastructure
 * Uses Frappe boot messages loaded from .po/.mo files
 */

// Declare global types for Frappe
declare global {
  interface Window {
    frappe?: {
      boot?: {
        __messages?: Record<string, string>;
        lang?: string;
      };
      _?: (text: string, args?: any[]) => string;
      __?: (text: string) => string;
    };
  }
}

/**
 * Main translation function
 * Connects to Frappe's translation system via window.frappe.boot.__messages
 * Falls back to original text if translation not found
 *
 * @param text - The text to translate
 * @returns Translated text or original text if no translation found
 *
 * @example
 * __('Cancel Order') // => 'Annuler la commande' (if French)
 */
export function __(text: string): string {
  // Try to use Frappe's translation if available
  if (typeof window !== 'undefined' && window.frappe?.boot?.__messages) {
    const translation = window.frappe.boot.__messages[text];
    if (translation) {
      return translation;
    }
  }

  // Fallback to original text
  return text;
}

/**
 * Translation function with placeholder replacement
 * Supports both numeric {0}, {1} and named {name}, {count} placeholders
 *
 * @param text - The text to translate with placeholders
 * @param args - Array of values to replace placeholders (for {0}, {1}, etc.)
 * @param replace - Object with named replacements (for {name}, {count}, etc.)
 * @returns Translated text with placeholders replaced
 *
 * @example
 * _('Pay {0}', [formatCurrency(100)]) // => 'Payer 100.00 CHF'
 * _('Hello {name}', undefined, { name: 'John' }) // => 'Bonjour John'
 * _('Found {count} items', undefined, { count: 5 }) // => 'Trouvé 5 articles'
 */
export function _(
  text: string,
  args?: any[],
  replace?: Record<string, any>
): string {
  // First translate the text
  let result = __(text);

  // Replace numeric placeholders {0}, {1}, etc.
  if (args && args.length > 0) {
    args.forEach((arg, index) => {
      result = result.replace(`{${index}}`, String(arg));
    });
  }

  // Replace named placeholders {name}, {count}, etc.
  if (replace) {
    Object.keys(replace).forEach((key) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, String(replace[key]));
    });
  }

  return result;
}

/**
 * Pluralization helper
 * Returns singular or plural form based on count
 *
 * @param count - The count to determine singular/plural
 * @param singular - Singular form text
 * @param plural - Plural form text (optional, will add 's' if not provided)
 * @returns Translated singular or plural form
 *
 * @example
 * __n(1, 'item') // => 'article' (if French)
 * __n(5, 'item') // => 'articles' (if French)
 * __n(1, 'child', 'children') // => 'enfant' (if French)
 */
export function __n(
  count: number,
  singular: string,
  plural?: string
): string {
  const form = count === 1 ? singular : (plural || `${singular}s`);
  return __(form);
}

/**
 * Get current language code
 * @returns Language code (e.g., 'fr', 'en', 'de')
 */
export function getCurrentLanguage(): string {
  if (typeof window !== 'undefined' && window.frappe?.boot?.lang) {
    return window.frappe.boot.lang;
  }
  return 'en'; // Default to English
}

/**
 * Check if translations are loaded
 * @returns True if Frappe translations are available
 */
export function areTranslationsLoaded(): boolean {
  return !!(
    typeof window !== 'undefined' &&
    window.frappe?.boot?.__messages &&
    Object.keys(window.frappe.boot.__messages).length > 0
  );
}
