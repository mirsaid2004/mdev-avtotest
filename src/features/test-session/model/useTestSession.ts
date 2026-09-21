import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EXAM, isExamPass, type TestMode } from '@/shared/config'
import { useProgress, type ActiveSession, type AttemptRecord } from '@/entities/progress'
import type { Question } from '@/entities/question'

export interface TestSessionConfig {
  testId: string
  mode: TestMode
  questions: Question[]
  /** 0 means untimed */
  durationMs: number
  /** restored from a previous visit, if any */
  resume?: ActiveSession | null
}

export interface TestSessionState {
  index: number
  question: Question | undefined
  total: number
  answers: Record<number, number>
  flagged: Set<number>
  answeredCount: number
  wrongCount: number
  remainingMs: number
  expired: boolean
  submitted: boolean
  result: AttemptRecord | null
  /** training reveals right/wrong as you go; exam stays silent until submit */
  revealAnswers: boolean
}

/**
 * Drives one test from start to result.
 *
 * The clock is timestamp-based rather than tick-counted, so a backgrounded tab
 * doesn't drift. It pauses while the app is closed: the remaining time is
 * persisted and the deadline rebuilt on resume, so stepping away for a phone
 * call doesn't silently fail your test.
 */
export function useTestSession({
  testId,
  mode,
  questions,
  durationMs,
  resume,
}: TestSessionConfig) {
  const { recordAnswer, recordAttempt, setActiveSession } = useProgress()

  /**
   * Every mode reveals the correct answer the moment one is chosen - exam
   * included. It costs the exam some realism (the real thing tells you nothing
   * until the end) but seeing the right answer at the point you got it wrong is
   * what actually teaches it. The pass/fail verdict still lands at the end.
   */
  const revealAnswers = true

  const [index, setIndex] = useState(resume?.index ?? 0)
  const [answers, setAnswers] = useState<Record<number, number>>(resume?.answers ?? {})
  const [flagged, setFlagged] = useState<Set<number>>(new Set(resume?.flagged ?? []))
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState<AttemptRecord | null>(null)

  const startedAt = useRef(resume?.startedAt ?? Date.now())
  const deadline = useRef(
    durationMs > 0 ? Date.now() + (resume?.remainingMs || durationMs) : 0,
  )
  const [remainingMs, setRemainingMs] = useState(
    durationMs > 0 ? resume?.remainingMs || durationMs : 0,
  )
  const questionShownAt = useRef(Date.now())

  // persist() needs current values without being re-created on every change
  const answersRef = useRef(answers)
  answersRef.current = answers
  const flaggedRef = useRef(flagged)
  flaggedRef.current = flagged
  const indexRef = useRef(index)
  indexRef.current = index
  const remainingRef = useRef(remainingMs)
  remainingRef.current = remainingMs

  const questionIds = useMemo(() => questions.map((q) => q.id), [questions])
  const question = questions[index]

  const wrongCount = useMemo(
    () =>
      questions.reduce(
        (n, q) => (answers[q.id] !== undefined && answers[q.id] !== q.answerId ? n + 1 : n),
        0,
      ),
    [questions, answers],
  )
  const answeredCount = Object.keys(answers).length

  // --- submit -------------------------------------------------------------

  const submit = useCallback(() => {
    if (submitted) return null
    setSubmitted(true)

    const wrongIds = questions
      .filter((q) => answers[q.id] !== q.answerId)
      .map((q) => q.id)
    const correct = questions.length - wrongIds.length
    const finishedAt = Date.now()

    const attempt = recordAttempt({
      testId,
      mode,
      startedAt: startedAt.current,
      finishedAt,
      durationMs: finishedAt - startedAt.current,
      total: questions.length,
      correct,
      questionIds: questions.map((q) => q.id),
      given: answers,
      wrongQuestionIds: wrongIds,
      passed: mode === 'exam' ? isExamPass(wrongIds.length) : null,
    })

    setResult(attempt)
    return attempt
  }, [submitted, questions, answers, recordAttempt, testId, mode])

  // --- clock --------------------------------------------------------------

  useEffect(() => {
    if (durationMs <= 0 || submitted) return
    const tick = () => {
      const left = Math.max(0, deadline.current - Date.now())
      setRemainingMs(left)
      if (left === 0) submit()
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [durationMs, submitted, submit])

  // --- persistence --------------------------------------------------------

  /**
   * Mirrors the session into the progress store.
   *
   * Called with explicit values rather than reading state, and invoked in the
   * same event handler as the change itself. Doing this in an effect instead
   * would persist one render late, so an answer given immediately before the
   * tab closed would be lost - the exact case the pagehide flush exists for.
   *
   * remainingMs is read from a ref, not state: it changes 4x/second and would
   * otherwise make this a new value on every tick.
   */
  const persist = useCallback(
    (patch: Partial<Pick<ActiveSession, 'answers' | 'flagged' | 'index'>> = {}) => {
      setActiveSession({
        testId,
        mode,
        questionIds,
        answers: patch.answers ?? answersRef.current,
        flagged: patch.flagged ?? [...flaggedRef.current],
        index: patch.index ?? indexRef.current,
        startedAt: startedAt.current,
        remainingMs: remainingRef.current,
      })
    },
    [testId, mode, questionIds, setActiveSession],
  )

  // establish the session on first mount so a resume exists even before the
  // first answer
  useEffect(() => {
    if (!submitted) persist()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist])

  // --- actions ------------------------------------------------------------

  const select = useCallback(
    (answerId: number) => {
      if (!question || submitted) return
      // an answer locks once given - being able to "correct" yourself after
      // seeing the right one would make every statistic meaningless
      if (answers[question.id] !== undefined) return

      const correct = answerId === question.answerId
      const seconds = (Date.now() - questionShownAt.current) / 1000

      const nextAnswers = { ...answersRef.current, [question.id]: answerId }
      setAnswers(nextAnswers)
      recordAnswer(question.id, correct, seconds)
      persist({ answers: nextAnswers })
    },
    [question, submitted, revealAnswers, answers, recordAnswer, persist],
  )

  const goto = useCallback(
    (next: number) => {
      if (next < 0 || next >= questions.length) return
      questionShownAt.current = Date.now()
      setIndex(next)
      persist({ index: next })
    },
    [questions.length, persist],
  )

  const next = useCallback(() => goto(index + 1), [goto, index])
  const prev = useCallback(() => goto(index - 1), [goto, index])

  const toggleFlag = useCallback(() => {
    if (!question) return
    const copy = new Set(flaggedRef.current)
    if (copy.has(question.id)) copy.delete(question.id)
    else copy.add(question.id)
    setFlagged(copy)
    persist({ flagged: [...copy] })
  }, [question, persist])

  const abandon = useCallback(() => setActiveSession(null), [setActiveSession])

  const state: TestSessionState = {
    index,
    question,
    total: questions.length,
    answers,
    flagged,
    answeredCount,
    wrongCount,
    remainingMs,
    expired: durationMs > 0 && remainingMs === 0,
    submitted,
    result,
    revealAnswers,
  }

  return {
    ...state,
    /** exam only: already failed, even before submitting */
    examFailed: mode === 'exam' && wrongCount > EXAM.maxMistakes,
    select,
    goto,
    next,
    prev,
    toggleFlag,
    submit,
    abandon,
  }
}
