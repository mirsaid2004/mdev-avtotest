import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Flag, X } from 'lucide-react'
import { EXAM, type TestMode } from '@/shared/config'
import { cn } from '@/shared/lib'
import { Button } from '@/shared/ui/button'
import { Progress } from '@/shared/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { QuestionView, type Question } from '@/entities/question'
import { useTestSession } from '@/features/test-session'
import type { ActiveSession } from '@/entities/progress'
import { ROUTES } from '@/app/router/routes'
import { TimerDisplay } from './TimerDisplay'
import { CompletionDialog } from './CompletionDialog'
import { QuestionSlider } from './QuestionSlider'

interface Props {
  testId: string
  title: string
  mode: TestMode
  questions: Question[]
  durationMs: number
  resume?: ActiveSession | null
}

export function TestSolver({ testId, title, mode, questions, durationMs, resume }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [confirmExit, setConfirmExit] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [showCompletion, setShowCompletion] = useState(false)
  // so dismissing the summary doesn't make it pop straight back
  const completionSeen = useRef(false)

  const session = useTestSession({ testId, mode, questions, durationMs, resume })
  const { question, index, total, answers, flagged } = session

  // the clock running out submits from inside the timer effect, so the redirect
  // has to happen in an effect too - navigating during render is a React error
  const resultId = session.result?.id
  useEffect(() => {
    if (resultId) navigate(ROUTES.results(resultId), { replace: true })
  }, [resultId, navigate])

  // every question answered: offer the summary once, without submitting - the
  // user may still want to scroll back through what they got wrong
  const allAnswered = session.answeredCount === total
  useEffect(() => {
    if (allAnswered && !completionSeen.current && !session.submitted) {
      completionSeen.current = true
      const id = setTimeout(() => setShowCompletion(true), 500)
      return () => clearTimeout(id)
    }
  }, [allAnswered, session.submitted])

  if (!question) return null

  const isLast = index === total - 1
  const unanswered = total - session.answeredCount

  // submit() sets result, and the effect above handles the redirect
  const finish = () => {
    setConfirmSubmit(false)
    session.submit()
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      {/* header */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfirmExit(true)}
            aria-label={t('action.close')}
          >
            <X className="size-5" />
          </Button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {index + 1} / {total}
              {mode === 'exam' && (
                <span
                  className={cn(
                    'ml-2',
                    session.examFailed ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  · {t('test.mistakes', { count: session.wrongCount, max: EXAM.maxMistakes })}
                </span>
              )}
            </p>
          </div>

          {durationMs > 0 && (
            <TimerDisplay
              remainingMs={session.remainingMs}
              paused={session.paused}
              canPause={session.canPause}
              onTogglePause={session.togglePause}
            />
          )}
        </div>

        <Progress value={((index + 1) / total) * 100} className="h-0.5 rounded-none" />

        <QuestionSlider
          questions={questions}
          index={index}
          answers={answers}
          flagged={flagged}
          reveal={session.revealAnswers}
          onSelect={session.goto}
        />
      </header>

      {/* question */}
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-5 pb-28">
          <QuestionView
            question={question}
            selectedAnswerId={answers[question.id]}
            reveal={session.revealAnswers}
            onSelect={session.select}
          />
        </div>
      </main>

      {/* bottom bar - fixed so the primary action is always thumb-reachable */}
      <footer
        className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-3">
          <Button
            variant="outline"
            size="icon"
            onClick={session.prev}
            disabled={index === 0}
            aria-label={t('action.prev')}
          >
            <ChevronLeft className="size-5" />
          </Button>

          <Button
            variant={flagged.has(question.id) ? 'default' : 'outline'}
            size="icon"
            onClick={session.toggleFlag}
            aria-label={t('test.flag')}
            aria-pressed={flagged.has(question.id)}
          >
            <Flag className="size-4" />
          </Button>

          {isLast || allAnswered ? (
            <Button className="flex-1" onClick={() => setConfirmSubmit(true)}>
              {t('action.finish')}
            </Button>
          ) : (
            <Button className="flex-1" onClick={session.next}>
              {t('action.next')}
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </footer>

      <CompletionDialog
        open={showCompletion}
        onOpenChange={setShowCompletion}
        total={total}
        correct={total - session.wrongCount}
        wrong={session.wrongCount}
        isExam={mode === 'exam'}
        onReplay={() => {
          setShowCompletion(false)
          completionSeen.current = false
          session.restart()
        }}
        onComplete={() => {
          setShowCompletion(false)
          session.submit()
        }}
      />

      {/* leaving mid-test */}
      <Dialog open={confirmExit} onOpenChange={setConfirmExit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('test.leaveTitle')}</DialogTitle>
            <DialogDescription>{t('test.leaveBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmExit(false)}>
              {t('action.continue')}
            </Button>
            <Button variant="secondary" onClick={() => navigate(ROUTES.home)}>
              {t('action.save')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                session.abandon()
                navigate(ROUTES.home)
              }}
            >
              {t('action.discard')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* submitting */}
      <Dialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('test.submitTitle')}</DialogTitle>
            <DialogDescription>
              {unanswered > 0
                ? t('test.submitUnanswered', { count: unanswered })
                : t('test.submitAllAnswered')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmSubmit(false)}>
              {t('action.cancel')}
            </Button>
            <Button onClick={finish}>{t('action.finish')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
