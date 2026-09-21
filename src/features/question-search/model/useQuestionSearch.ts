import { useDeferredValue, useMemo, useState } from 'react'
import { MASTERY_STREAK } from '@/shared/config'
import type { LanguageCode } from '@/shared/config'
import type { Question } from '@/entities/question'
import type { QuestionStat } from '@/entities/progress'

export type BankFilter = 'all' | 'weak' | 'mastered' | 'unseen' | 'image'

/** Strips diacritics and apostrophe variants so "to'g'ri" matches "togri". */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[''`‘’ʻʼ]/g, '')
}

/**
 * Search and filter over the whole 1353-question bank.
 *
 * The normalised haystack is built once per language rather than per keystroke -
 * rebuilding 1353 lowercased strings on every character is what makes naive
 * search feel laggy on a phone.
 */
export function useQuestionSearch(
  questions: Question[] | undefined,
  stats: Record<number, QuestionStat>,
  language: LanguageCode,
) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<BankFilter>('all')

  // keeps typing responsive: the list re-renders at a lower priority
  const deferredQuery = useDeferredValue(query)

  const haystack = useMemo(() => {
    const map = new Map<number, string>()
    for (const q of questions ?? []) {
      const answers = q.answers.map((a) => a.text[language]).join(' ')
      map.set(q.id, normalize(`${q.text[language]} ${answers}`))
    }
    return map
  }, [questions, language])

  const results = useMemo(() => {
    if (!questions) return []
    const needle = normalize(deferredQuery.trim())

    return questions.filter((q) => {
      const stat = stats[q.id]

      switch (filter) {
        case 'weak':
          if (!stat || stat.streak >= MASTERY_STREAK || stat.seen <= stat.correct) return false
          break
        case 'mastered':
          if (!stat || stat.streak < MASTERY_STREAK) return false
          break
        case 'unseen':
          if (stat) return false
          break
        case 'image':
          if (!q.media) return false
          break
      }

      if (!needle) return true
      return haystack.get(q.id)?.includes(needle) ?? false
    })
  }, [questions, stats, filter, deferredQuery, haystack])

  return {
    query,
    setQuery,
    filter,
    setFilter,
    results,
    /** true while the deferred list is catching up with the input */
    isStale: query !== deferredQuery,
  }
}
