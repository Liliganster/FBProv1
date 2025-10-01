import React from 'react';
import useTranslation from '../hooks/useTranslation';

type Language = 'en' | 'de' | 'es';

const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage, t } = useTranslation();

  const languages: { code: Language; nameKey: string }[] = [
    { code: 'es', nameKey: 'lang_es' },
    { code: 'en', nameKey: 'lang_en' },
    { code: 'de', nameKey: 'lang_de' },
  ];

  return (
    <div className="space-y-2 mt-4">
      {languages.map(lang => (
        <button
          key={lang.code}
          onClick={() => setLanguage(lang.code)}
          className={`w-full text-left px-4 py-3 rounded-lg transition-colors font-medium ${
            language === lang.code
              ? 'bg-brand-primary text-white'
              : 'bg-background-dark hover:bg-gray-800/60'
          }`}
          aria-label={`Switch to ${t(lang.nameKey)}`}
        >
          {t(lang.nameKey)}
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitcher;
