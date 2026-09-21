import { DATA_URLS } from '@/shared/config'
import type { Question } from '../model/types'

export async function fetchQuestions(): Promise<Question[]> {
  const res = await fetch(DATA_URLS.questions)
  if (!res.ok) throw new Error(`Failed to load questions (${res.status})`)
  return res.json()
}
