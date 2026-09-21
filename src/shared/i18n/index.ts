import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { DEFAULT_LANGUAGE, LANGUAGE_CODES } from '@/shared/config'

import uzb from './locales/uzb/common.json'
import uzc from './locales/uzc/common.json'
import ru from './locales/ru/common.json'
import kaa from './locales/kaa/common.json'

export const LANGUAGE_STORAGE_KEY = 'eavtomaktab:lang'

/**
 * The UI language doubles as the language the question bank renders in, so it
 * has to be one of the four the data actually carries - hence supportedLngs and
 * a non-negotiable fallback.
 */
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      uzb: { common: uzb },
      uzc: { common: uzc },
      ru: { common: ru },
      kaa: { common: kaa },
    },
    defaultNS: 'common',
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: LANGUAGE_CODES,
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
  })

export default i18n
