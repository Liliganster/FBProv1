import { useMemo } from 'react';
import { translations } from '../i18n/translations';

type Language = 'en' | 'de' | 'es';

const getNestedTranslation = (language: Language, key: string): string | object => {
  const langTranslations = translations[language] as any;
  return key.split('.').reduce((obj, k) => (obj && obj[k] !== 'undefined') ? obj[k] : key, langTranslations);
}

/**
 * Hook de traducción específico para la pantalla de login
 * Siempre usa el idioma del navegador del usuario, ignorando configuraciones guardadas
 */
const useLoginTranslation = () => {
  const browserLanguage = useMemo(() => {
    // Detectar idioma del navegador
    const browserLang = navigator.language.split('-')[0] as Language;
    // Verificar si tenemos traducciones para ese idioma
    return translations[browserLang] ? browserLang : 'en';
  }, []);

  const t = (key: string, options?: { [key: string]: string | number }): string => {
    let translation = getNestedTranslation(browserLanguage, key);

    if (typeof translation !== 'string') {
      // Fallback to English if key not found in browser language
      translation = getNestedTranslation('en', key);
      if (typeof translation !== 'string') {
        return key; // Return key if not found in English either
      }
    }

    if (options) {
      Object.keys(options).forEach(optKey => {
        translation = (translation as string).replace(`{{${optKey}}}`, String(options[optKey]));
      });
    }

    return translation;
  };

  return { t, language: browserLanguage };
};

export default useLoginTranslation;