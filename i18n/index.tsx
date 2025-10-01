import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { translations } from './translations';

type Language = 'en' | 'de' | 'es';

interface TranslationContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, options?: { [key: string]: string | number }) => string;
}

export const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

const getNestedTranslation = (language: Language, key: string): string | object => {
  const langTranslations = translations[language] as any;
  return key.split('.').reduce((obj, k) => (obj && obj[k] !== 'undefined') ? obj[k] : key, langTranslations);
}

export const TranslationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const savedLang = localStorage.getItem('fahrtenbuch_language') as Language;
    if (savedLang && translations[savedLang]) {
      return savedLang;
    }
    const browserLang = navigator.language.split('-')[0] as Language;
    return translations[browserLang] ? browserLang : 'en';
  });

  useEffect(() => {
    localStorage.setItem('fahrtenbuch_language', language);
  }, [language]);

  const t = (key: string, options?: { [key: string]: string | number }): string => {
    let translation = getNestedTranslation(language, key);

    if (typeof translation !== 'string') {
      // Fallback to English if key not found in current language
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

  return (
    <TranslationContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </TranslationContext.Provider>
  );
};
