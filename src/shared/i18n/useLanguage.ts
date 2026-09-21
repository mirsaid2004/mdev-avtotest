import { useTranslation } from 'react-i18next'
import { DEFAULT_LANGUAGE, LANGUAGE_CODES, type LanguageCode } from '@/shared/config'

/**
 * Bridges the UI language to the question bank's language keys. Components read
 * question text as `q.text[language]`, so this must always return a valid key.
 */
export function useLanguage() {
  const { i18n } = useTranslation()
  const raw = i18n.resolvedLanguage ?? i18n.language
  const language = (LANGUAGE_CODES.includes(raw as LanguageCode)
    ? raw
    : DEFAULT_LANGUAGE) as LanguageCode

  return {
    language,
    setLanguage: (code: LanguageCode) => void i18n.changeLanguage(code),
  }
}
