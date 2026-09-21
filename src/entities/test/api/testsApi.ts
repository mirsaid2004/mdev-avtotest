import { DATA_URLS } from '@/shared/config'
import type { TestTemplate } from '../model/types'

export async function fetchTests(): Promise<TestTemplate[]> {
  const res = await fetch(DATA_URLS.tests)
  if (!res.ok) throw new Error(`Failed to load tests (${res.status})`)
  return res.json()
}
