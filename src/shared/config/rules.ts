import type { TestSize } from '@/entities/test/model/types'

export type TestMode = 'training' | 'exam' | 'practice'

/**
 * Real exam conditions: 20 questions, 25 minutes, 2 mistakes tolerated.
 * A third wrong answer is a fail. These apply to exam mode ONLY - training
 * tests are for learning and have no mistake limit.
 */
export const EXAM = {
  questionCount: 20,
  durationMs: 25 * 60 * 1000,
  maxMistakes: 2,
} as const

/** Training tests keep a clock for realism, scaled to length. */
export const TEST_DURATION_MS: Record<TestSize, number> = {
  20: 25 * 60 * 1000,
  10: 12 * 60 * 1000,
}

/** Timer crosses these thresholds to warn the user. */
export const TIMER_WARN_MS = 5 * 60 * 1000
export const TIMER_DANGER_MS = 60 * 1000

/** Consecutive correct answers before a question is considered mastered. */
export const MASTERY_STREAK = 3

/**
 * How long a correct answer stays on screen before the next question slides in.
 * Long enough to register the green, short enough not to feel like waiting.
 */
export const AUTO_ADVANCE_MS = 700

/** Questions per practice drill. */
export const PRACTICE_SIZE = 20

export function durationForMode(mode: TestMode, size: TestSize): number {
  if (mode === 'exam') return EXAM.durationMs
  if (mode === 'practice') return 0 // untimed - drilling shouldn't be stressful
  return TEST_DURATION_MS[size]
}

/** Exam verdict. Training modes always "pass" - they're not graded. */
export function isExamPass(wrongCount: number): boolean {
  return wrongCount <= EXAM.maxMistakes
}
