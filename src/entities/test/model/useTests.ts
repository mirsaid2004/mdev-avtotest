import { useQuery } from '@tanstack/react-query'
import { fetchTests } from '../api/testsApi'
import type { TestSize } from './types'

export const testsQueryKey = ['tests'] as const

export function useTests(size?: TestSize) {
  return useQuery({
    queryKey: [...testsQueryKey, size ?? 'all'],
    queryFn: fetchTests,
    staleTime: Infinity,
    gcTime: Infinity,
    select: size ? (tests) => tests.filter((t) => t.size === size) : undefined,
  })
}
