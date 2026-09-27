export const LANGUAGES = [
  { code: 'uzb', label: "O'zbekcha", nativeLabel: "O'zbekcha", short: 'UZ' },
  { code: 'uzc', label: 'Ўзбекча', nativeLabel: 'Ўзбекча', short: 'ЎЗ' },
  { code: 'ru', label: 'Русский', nativeLabel: 'Русский', short: 'RU' },
] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']

export const DEFAULT_LANGUAGE: LanguageCode = 'uzb'
export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as LanguageCode[]
