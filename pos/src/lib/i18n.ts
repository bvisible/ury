/**
 * Translation helper function
 * In a real implementation, this would connect to Frappe's translation system
 * For now, returns the text as-is
 */
export function __(text: string): string {
  return text;
}

/**
 * Translation helper with placeholders
 * Example: _('Hello {0}', ['World']) => 'Hello World'
 */
export function _(text: string, args?: any[]): string {
  if (!args || args.length === 0) {
    return text;
  }

  let result = text;
  args.forEach((arg, index) => {
    result = result.replace(`{${index}}`, String(arg));
  });

  return result;
}
