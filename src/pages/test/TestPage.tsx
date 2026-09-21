import { useMemo, useRef } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { durationForMode, EXAM, PRACTICE_SIZE, type TestMode } from '@/shared/config'
import { sample } from '@/shared/lib'
import { Skeleton } from '@/shared/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { useQuestionMap, type Question } from '@/entities/question'
import { useTests } from '@/entities/test'
import { useProgress, type ActiveSession } from '@/entities/progress'
import { TestSolver } from '@/widgets/test-solver'
import { ROUTES } from '@/app/router/routes'

/**
 * Resolves a testId into a concrete question set.
 *
 *   t20-14 / t10-7  -> that template, in order
 *   exam            -> 20 random questions from the whole bank
 *   practice        -> your weakest questions first
 */
export function TestPage() {
  const { testId = '' } = useParams()
  const { t } = useTranslation()
  const questionsQuery = useQuestionMap()
  const testsQuery = useTests()
  const { activeSession, weakIds } = useProgress()

  const mode: TestMode = testId === 'exam' ? 'exam' : testId === 'practice' ? 'practice' : 'training'

  /**
   * The session to resume from, captured once per testId.
   *
   * Deriving this straight from activeSession each render is a feedback loop:
   * the solver persists -> activeSession gets a new identity -> `questions`
   * recomputes -> the solver persists again, forever. Only the value at entry
   * matters, so pin it and let the solver own the session from there.
   */
  const resumeRef = useRef<{ id: string; session: ActiveSession | null } | null>(null)
  if (resumeRef.current?.id !== testId) {
    resumeRef.current = {
      id: testId,
      session: activeSession?.testId === testId ? activeSession : null,
    }
  }
  const resume = resumeRef.current.session

  /**
   * The resolved question set, pinned once per testId.
   *
   * `weakIds` legitimately changes after every single answer - that's the
   * point, it tracks what still needs work. But `exam` and `practice` call
   * sample() during resolution, so recomputing on every answer silently
   * re-randomises the whole question set out from under whichever question
   * is on screen: an answer would register, the array would be replaced a
   * moment later, and the next click would land on a different question than
   * the one just rendered - which looked exactly like clicks doing nothing.
   * Same fix as `resume` above: derive once per testId, not on every render.
   */
  const resolvedRef = useRef<{
    testId: string
    result: { questions: Question[]; title: string; size: 10 | 20 }
  } | null>(null)

  const { questions, title, size } = useMemo(() => {
    const map = questionsQuery.map
    if (map.size === 0) return { questions: [] as Question[], title: '', size: 20 as const }

    if (resolvedRef.current?.testId === testId) return resolvedRef.current.result

    const resolve = (ids: number[]) =>
      ids.map((id) => map.get(id)).filter((q): q is Question => Boolean(q))

    const pin = (result: { questions: Question[]; title: string; size: 10 | 20 }) => {
      resolvedRef.current = { testId, result }
      return result
    }

    // resuming keeps the exact question set, so a random exam stays the same exam
    if (resume) {
      return pin({
        questions: resolve(resume.questionIds),
        title: titleFor(testId, resume.questionIds.length),
        size: resume.questionIds.length > 10 ? 20 : 10,
      })
    }

    if (testId === 'exam') {
      const all = [...map.values()]
      return pin({
        questions: sample(all, EXAM.questionCount),
        title: 'Examination',
        size: 20,
      })
    }

    if (testId === 'practice') {
      const weak = resolve(weakIds).slice(0, PRACTICE_SIZE)
      // nothing wrong yet - drill what's been seen least
      const filler =
        weak.length < PRACTICE_SIZE
          ? sample(
              [...map.values()].filter((q) => !weak.some((w) => w.id === q.id)),
              PRACTICE_SIZE - weak.length,
            )
          : []
      return pin({ questions: [...weak, ...filler], title: 'Practice', size: 20 })
    }

    const template = testsQuery.data?.find((x) => x.id === testId)
    // not pinned: the template list may still be arriving, so keep retrying
    // until it either resolves or genuinely doesn't exist
    if (!template) return { questions: [] as Question[], title: '', size: 20 as const }
    return pin({
      questions: resolve(template.questionIds),
      title: `${template.size}-question test #${template.number}`,
      size: template.size,
    })
  }, [questionsQuery.map, testsQuery.data, testId, resume, weakIds])

  if (questionsQuery.isPending || testsQuery.isPending) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="aspect-video w-full" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    )
  }

  if (questionsQuery.isError || testsQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-md p-4">
        <Alert variant="destructive">
          <AlertTitle>{t('state.error')}</AlertTitle>
          <AlertDescription>{t('state.errorBank')}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (questions.length === 0) return <Navigate to={ROUTES.home} replace />

  return (
    <TestSolver
      testId={testId}
      title={title}
      mode={mode}
      questions={questions}
      durationMs={durationForMode(mode, size)}
      resume={resume}
    />
  )
}

function titleFor(testId: string, count: number) {
  if (testId === 'exam') return 'Examination'
  if (testId === 'practice') return 'Practice'
  const n = testId.split('-')[1]
  return `${count}-question test #${n}`
}
