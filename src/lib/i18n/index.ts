import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';

// Supported UI languages. Keep `en` first — it's the fallback and default.
export const SUPPORTED_LANGUAGES = ['en', 'zh-CN'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      'zh-CN': { translation: zhCN },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    nonExplicitSupportedLngs: false,
    interpolation: {
      // React already escapes by default; disable i18next's escaping to
      // avoid double-escaping interpolated values.
      escapeValue: false,
    },
    detection: {
      // Order: explicit localStorage pick → browser language → 'en'.
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    returnObjects: false,
    debug: false,
  });

export default i18n;
