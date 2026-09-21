import type { LanguageCode } from '@/shared/config'

/** Every human-readable string in the bank exists in all four languages. */
export type Localized = Record<LanguageCode, string>

export interface Answer {
  id: number
  text: Localized
  /** bare filename, resolved through imageUrl() - almost always null */
  media: string | null
}

export interface Question {
  id: number
  text: Localized
  /** bare filename, resolved through imageUrl() */
  media: string | null
  /** id of the correct answer - guaranteed present in `answers` */
  answerId: number
  answers: Answer[]
  sort: number | null
}
