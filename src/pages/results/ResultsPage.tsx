import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, RotateCcw, XCircle, Home } from 'lucide-react'
import { EXAM } from '@/shared/config'
import { cn } from '@/shared/lib'
import { useLanguage } from '@/shared/i18n/useLanguage'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { Card, CardContent } from '@/shared/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { QuestionMedia, useQuestionMap } from '@/entities/question'
import { useProgress } from '@/entities/progress'
import { formatClock } from '@/widgets/test-solver'
import { ROUTES } from '@/app/router/routes'

export function ResultsPage() {
  const { attemptId = '' } = useParams()
  const { t } = useTranslation()
  const { language } = useLanguage()
  const { attempts } = useProgress()
  const { map } = useQuestionMap()
  const [filter, setFilter] = useState<'wrong' | 'all'>('wrong')

  const attempt = useMemo(() => attempts.find((a) => a.id === attemptId), [attempts, attemptId])

  if (!attempt) return <Navigate to={ROUTES.home} replace />

  const wrong = new Set(attempt.wrongQuestionIds)
  const percent = Math.round((attempt.correct / attempt.total) * 100)
  const isExam = attempt.mode === 'exam'
  const passed = attempt.passed

  const reviewIds = filter === 'wrong' ? attempt.wrongQuestionIds : attempt.questionIds

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      {/* verdict */}
      <Card
        className={cn(
          'mb-6 overflow-hidden border-2',
          isExam && passed && 'border-correct',
          isExam && !passed && 'border-incorrect',
          !isExam && 'border-border',
        )}
      >
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          {isExam ? (
            passed ? (
              <CheckCircle2 className="size-12 text-correct" />
            ) : (
              <XCircle className="size-12 text-incorrect" />
            )
          ) : null}

          <div>
            <p className="text-4xl font-semibold tabular-nums">
              {attempt.correct}
              <span className="text-2xl text-muted-foreground">/{attempt.total}</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{percent}%</p>
          </div>

          {isExam && (
            <Badge variant={passed ? 'default' : 'destructive'} className="text-sm">
              {passed ? t('results.passed') : t('results.failed')}
            </Badge>
          )}

          <p className="text-xs text-muted-foreground">
            {t('results.meta', {
              wrong: attempt.wrongQuestionIds.length,
              time: formatClock(attempt.durationMs),
            })}
            {isExam && ` · ${t('results.maxAllowed', { count: EXAM.maxMistakes })}`}
          </p>
        </CardContent>
      </Card>

      {/* actions */}
      <div className="mb-8 flex gap-2">
        <Button asChild variant="outline" className="flex-1">
          <Link to={ROUTES.home}>
            <Home className="size-4" />
            {t('nav.home')}
          </Link>
        </Button>
        {attempt.wrongQuestionIds.length > 0 && (
          <Button asChild className="flex-1">
            <Link to={ROUTES.test('practice')}>
              <RotateCcw className="size-4" />
              {t('results.drillMistakes')}
            </Link>
          </Button>
        )}
      </div>

      {/* review */}
      {attempt.questionIds.length > 0 && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('results.review')}</h2>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as 'wrong' | 'all')}>
              <TabsList>
                <TabsTrigger value="wrong">
                  {t('results.tabWrong', { count: attempt.wrongQuestionIds.length })}
                </TabsTrigger>
                <TabsTrigger value="all">
                  {t('results.tabAll', { count: attempt.total })}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-4">
            {reviewIds.map((qid) => {
              const q = map.get(qid)
              if (!q) return null
              const right = q.answers.find((a) => a.id === q.answerId)
              const givenId = attempt.given[qid]
              const given = q.answers.find((a) => a.id === givenId)
              const wasWrong = wrong.has(qid)
              return (
                <Card key={qid} className={cn(wasWrong && 'border-incorrect/40')}>
                  <CardContent className="space-y-3 p-4">
                    <QuestionMedia media={q.media} alt={q.text[language]} />
                    <p className="text-sm leading-snug font-medium">{q.text[language]}</p>

                    {wasWrong && (
                      <div className="rounded-lg border border-incorrect bg-incorrect-muted p-3">
                        <p className="mb-0.5 text-xs font-medium text-muted-foreground">
                          {given ? t('test.incorrect') : t('results.leftBlank')}
                        </p>
                        {given && <p className="text-sm">{given.text[language]}</p>}
                      </div>
                    )}

                    <div className="rounded-lg border border-correct bg-correct-muted p-3">
                      <p className="mb-0.5 text-xs font-medium text-muted-foreground">
                        {t('test.correct')}
                      </p>
                      <p className="text-sm">{right?.text[language]}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
