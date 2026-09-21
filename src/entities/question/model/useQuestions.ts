import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchQuestions } from '../api/questionsApi'
import type { Question } from './types'

export const questionsQueryKey = ['questions'] as const

/**
 * The bank is static and versioned with the deploy, so it never goes stale
 * within a session - hence Infinity rather than a refetch policy.
 */
export function useQuestions() {
  return useQuery({
    queryKey: questionsQueryKey,
    queryFn: fetchQuestions,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

const EMPTY = new Map<number, Question>()

/**
 * id -> Question, for the many places that resolve a test's questionIds.
 *
 * Memoised on the query data: an unstable map identity propagates into every
 * consumer's useMemo and re-fires effects on each render.
 */
export function useQuestionMap() {
  const query = useQuestions()
  const data = query.data

  const map = useMemo(() => {
    if (!data) return EMPTY
    const m = new Map<number, Question>()
    for (const q of data) m.set(q.id, q)
    return m
  }, [data])

  return { ...query, map }
}
