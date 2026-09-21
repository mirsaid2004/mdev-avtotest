import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { MASTERY_STREAK } from '@/shared/config'
import { clearProgress, loadProgress, saveProgress } from '../lib/storage'
import {
  dayKey,
  emptyProgress,
  type ActiveSession,
  type AttemptRecord,
  type ProgressState,
} from './types'

interface ProgressContextValue extends ProgressState {
  /** ids that need work: answered wrong at some point, not yet mastered */
  weakIds: number[]
  mastered: number
  seen: number
  accuracy: number
  currentStreak: number
  longestStreak: number
  activeDays: number
  recordAnswer: (questionId: number, correct: boolean, seconds?: number) => void
  recordAttempt: (attempt: Omit<AttemptRecord, 'id'>) => AttemptRecord
  setActiveSession: (session: ActiveSession | null) => void
  reset: () => void
}

const ProgressContext = createContext<ProgressContextValue | null>(null)

/** Walks back from today counting consecutive active days. */
function streaksFrom(daily: Record<string, unknown>) {
  const days = Object.keys(daily).sort()
  if (days.length === 0) return { current: 0, longest: 0 }

  const has = new Set(days)
  const dayMs = 86_400_000

  let current = 0
  const probe = new Date()
  // today not being active doesn't break a streak until tomorrow
  if (!has.has(dayKey(probe))) probe.setTime(probe.getTime() - dayMs)
  while (has.has(dayKey(probe))) {
    current += 1
    probe.setTime(probe.getTime() - dayMs)
  }

  let longest = 0
  let run = 0
  let prev: number | null = null
  for (const key of days) {
    const [y, m, d] = key.split('-').map(Number)
    const t = new Date(y, m - 1, d).getTime()
    run = prev !== null && t - prev === dayMs ? run + 1 : 1
    longest = Math.max(longest, run)
    prev = t
  }

  return { current, longest }
}

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProgressState>(() => loadProgress())

  /**
   * Mirror of the latest state, updated synchronously inside apply() rather
   * than during render. A render can be preempted by navigation, so a ref
   * assigned at render time is stale exactly when the pagehide flush needs it -
   * which would drop the answer given just before the tab closed.
   */
  const latest = useRef(state)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const apply = useCallback((fn: (prev: ProgressState) => ProgressState) => {
    const next = fn(latest.current)
    latest.current = next
    setState(next)
  }, [])

  // debounced write - a fast tap-through shouldn't serialise on every answer
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => saveProgress(state), 250)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [state])

  // flush immediately if the tab is hidden or closed mid-test
  useEffect(() => {
    const flush = () => saveProgress(latest.current)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', flush)
    }
  }, [])

  const recordAnswer = useCallback(
    (questionId: number, correct: boolean, seconds = 0) => {
      apply((prev) => {
        const cur = prev.stats[questionId] ?? { seen: 0, correct: 0, streak: 0, lastAt: 0 }
        const key = dayKey()
        const day = prev.daily[key] ?? { answered: 0, correct: 0, seconds: 0 }
        return {
          ...prev,
          stats: {
            ...prev.stats,
            [questionId]: {
              seen: cur.seen + 1,
              correct: cur.correct + (correct ? 1 : 0),
              streak: correct ? cur.streak + 1 : 0,
              lastAt: Date.now(),
            },
          },
          daily: {
            ...prev.daily,
            [key]: {
              answered: day.answered + 1,
              correct: day.correct + (correct ? 1 : 0),
              seconds: day.seconds + Math.max(0, Math.round(seconds)),
            },
          },
        }
      })
    },
    [apply],
  )

  const recordAttempt = useCallback((attempt: Omit<AttemptRecord, 'id'>) => {
    const full: AttemptRecord = {
      ...attempt,
      id: `${attempt.startedAt}-${Math.random().toString(36).slice(2, 8)}`,
    }
    apply((prev) => ({
      ...prev,
      attempts: [full, ...prev.attempts].slice(0, 500),
      activeSession: null,
    }))
    return full
  }, [apply])

  const setActiveSession = useCallback(
    (session: ActiveSession | null) => {
      apply((prev) => ({ ...prev, activeSession: session }))
    },
    [apply],
  )

  const reset = useCallback(() => {
    clearProgress()
    const fresh = emptyProgress()
    latest.current = fresh
    setState(fresh)
  }, [])

  const derived = useMemo(() => {
    const entries = Object.entries(state.stats)
    const weakIds = entries
      .filter(([, s]) => s.streak < MASTERY_STREAK && s.seen > s.correct)
      .sort((a, b) => {
        // worst first: lowest accuracy, then least recently practised
        const accA = a[1].correct / a[1].seen
        const accB = b[1].correct / b[1].seen
        return accA - accB || a[1].lastAt - b[1].lastAt
      })
      .map(([id]) => Number(id))

    const totalAnswers = entries.reduce((n, [, s]) => n + s.seen, 0)
    const totalCorrect = entries.reduce((n, [, s]) => n + s.correct, 0)
    const { current, longest } = streaksFrom(state.daily)

    return {
      weakIds,
      mastered: entries.filter(([, s]) => s.streak >= MASTERY_STREAK).length,
      seen: entries.length,
      accuracy: totalAnswers ? totalCorrect / totalAnswers : 0,
      currentStreak: current,
      longestStreak: longest,
      activeDays: Object.keys(state.daily).length,
    }
  }, [state.stats, state.daily])

  const value = useMemo(
    () => ({ ...state, ...derived, recordAnswer, recordAttempt, setActiveSession, reset }),
    [state, derived, recordAnswer, recordAttempt, setActiveSession, reset],
  )

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}

export function useProgress() {
  const ctx = useContext(ProgressContext)
  if (!ctx) throw new Error('useProgress must be used inside <ProgressProvider>')
  return ctx
}
