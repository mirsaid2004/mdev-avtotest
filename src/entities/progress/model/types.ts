import type { TestMode } from '@/shared/config'

export interface QuestionStat {
  /** times shown */
  seen: number
  /** times answered correctly */
  correct: number
  /** consecutive correct answers - drives "mastered" */
  streak: number
  /** epoch ms of the last answer */
  lastAt: number
}

/** One day's activity, keyed 'YYYY-MM-DD' in local time. Feeds the heatmap. */
export interface DayActivity {
  answered: number
  correct: number
  /** seconds spent, for total study time */
  seconds: number
}

export interface AttemptRecord {
  id: string
  /** TestTemplate id, 'exam', or 'practice' */
  testId: string
  mode: TestMode
  startedAt: number
  finishedAt: number
  durationMs: number
  total: number
  correct: number
  /** every question in the attempt, in order - lets results review all of them */
  questionIds: number[]
  /** questionId -> the answer actually chosen (absent = left blank) */
  given: Record<number, number>
  wrongQuestionIds: number[]
  /** exam only - null for training and practice, which aren't graded */
  passed: boolean | null
}

/** A test left unfinished, so closing the tab doesn't lose it. */
export interface ActiveSession {
  testId: string
  mode: TestMode
  questionIds: number[]
  /** questionId -> chosen answerId */
  answers: Record<number, number>
  flagged: number[]
  index: number
  startedAt: number
  /** ms remaining when the session was last persisted; 0 means untimed */
  remainingMs: number
}

export interface ProgressState {
  /** bumped when the shape changes, so migrate() can fix old blobs */
  version: number
  stats: Record<number, QuestionStat>
  attempts: AttemptRecord[]
  daily: Record<string, DayActivity>
  activeSession: ActiveSession | null
}

export const PROGRESS_VERSION = 2

export const emptyProgress = (): ProgressState => ({
  version: PROGRESS_VERSION,
  stats: {},
  attempts: [],
  daily: {},
  activeSession: null,
})

/** Local-time day key. Must be local, or the heatmap shifts for late-night study. */
export function dayKey(at: number | Date = Date.now()): string {
  const d = at instanceof Date ? at : new Date(at)
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
