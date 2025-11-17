import { useState, useEffect } from 'react';
import { __, _, __n, getCurrentLanguage, areTranslationsLoaded } from '../lib/i18n';

/**
 * React hook for translations
 * Provides translation functions and reactive language updates
 *
 * @returns Translation utilities
 *
 * @example
 * const { t, tn, lang, translationsLoaded } = useTranslation();
 *
 * <h1>{t('Welcome')}</h1>
 * <p>{t('Hello {name}', undefined, { name: user.name })}</p>
 * <span>{tn(count, 'item')}</span>
 */
export function useTranslation() {
  const [lang, setLang] = useState(getCurrentLanguage());
  const [translationsLoaded, setTranslationsLoaded] = useState(areTranslationsLoaded());

  useEffect(() => {
    // Check if translations are loaded on mount
    const checkTranslations = () => {
      const loaded = areTranslationsLoaded();
      setTranslationsLoaded(loaded);
      if (loaded) {
        setLang(getCurrentLanguage());
      }
    };

    // Initial check
    checkTranslations();

    // Set up interval to check for language changes
    // This allows react

ing to Frappe's language changes
    const interval = setInterval(() => {
      const currentLang = getCurrentLanguage();
      if (currentLang !== lang) {
        setLang(currentLang);
        checkTranslations();
      }
    }, 1000);

    // Listen for custom language change events (if implemented)
    const handleLanguageChange = () => {
      checkTranslations();
    };

    window.addEventListener('languagechange', handleLanguageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('languagechange', handleLanguageChange);
    };
  }, [lang]);

  return {
    // Short alias for translation
    t: __,
    // Translation with args/replace
    translate: _,
    // Pluralization
    tn: __n,
    // Current language
    lang,
    // Whether translations are loaded
    translationsLoaded,
  };
}
