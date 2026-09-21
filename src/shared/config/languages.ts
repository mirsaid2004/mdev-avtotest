export const LANGUAGES = [
  { code: 'uzb', label: "O'zbekcha", nativeLabel: "O'zbekcha" },
  { code: 'uzc', label: 'Ўзбекча', nativeLabel: 'Ўзбекча' },
  { code: 'ru', label: 'Русский', nativeLabel: 'Русский' },
] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']

export const DEFAULT_LANGUAGE: LanguageCode = 'uzb'
export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as LanguageCode[]
