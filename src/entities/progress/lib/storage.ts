import {
  emptyProgress,
  PROGRESS_VERSION,
  type ProgressState,
} from '../model/types'

const KEY = 'eavtomaktab:progress'

/**
 * Progress lives in localStorage, not IndexedDB: a fully-worked bank plus a
 * year of daily activity and 500 attempts is well under 250 KB, inside the
 * ~5 MB budget. It's read once at startup and written on answer.
 *
 * Every access is guarded - private mode, blocked site data and quota errors
 * must degrade to "no saved progress", never crash the app mid-test.
 */

function migrate(raw: unknown): ProgressState {
  if (!raw || typeof raw !== 'object') return emptyProgress()
  const state = raw as Partial<ProgressState> & { version?: number }

  // v1 had no daily activity or active session. Keep the stats and attempts -
  // wiping a classmate's progress because the shape changed is unforgivable.
  if (state.version === 1) {
    return {
      version: PROGRESS_VERSION,
      stats: state.stats ?? {},
      attempts: (state.attempts ?? []).map((a) => ({
        ...a,
        id: a.id ?? `legacy-${a.startedAt}`,
        mode: a.mode ?? 'training',
        durationMs: a.durationMs ?? Math.max(0, a.finishedAt - a.startedAt),
        questionIds: a.questionIds ?? a.wrongQuestionIds ?? [],
        given: a.given ?? {},
        passed: a.passed ?? null,
      })),
      daily: {},
      activeSession: null,
    }
  }

  if (state.version !== PROGRESS_VERSION) return emptyProgress()

  return {
    version: PROGRESS_VERSION,
    stats: state.stats ?? {},
    attempts: state.attempts ?? [],
    daily: state.daily ?? {},
    activeSession: state.activeSession ?? null,
  }
}

export function loadProgress(): ProgressState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyProgress()
    return migrate(JSON.parse(raw))
  } catch {
    return emptyProgress()
  }
}

export function saveProgress(state: ProgressState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
    return true
  } catch {
    // quota exceeded or storage blocked - the session still works, it just
    // won't survive a reload
    return false
  }
}

export function clearProgress(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing useful to do */
  }
}

export function isStorageAvailable(): boolean {
  try {
    const probe = '__probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}
