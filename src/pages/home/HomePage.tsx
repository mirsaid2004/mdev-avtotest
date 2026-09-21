import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Flame, GraduationCap, PlayCircle, RotateCcw } from 'lucide-react'
import { EXAM } from '@/shared/config'
import { cn } from '@/shared/lib'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Progress } from '@/shared/ui/progress'
import { InstallCard } from '@/features/install-app'
import { Logo } from '@/shared/ui/logo'
import { useQuestions } from '@/entities/question'
import { useProgress, dayKey } from '@/entities/progress'
import { ROUTES } from '@/app/router/routes'

export function HomePage() {
  const { t } = useTranslation()
  const questions = useQuestions()
  const progress = useProgress()

  const bankSize = questions.data?.length ?? 1353
  const today = progress.daily[dayKey()]
  const resume = progress.activeSession

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <header className="mb-6 flex items-center gap-3">
        <Logo className="size-11 shrink-0 sm:size-12" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('app.name')}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t('app.tagline')}</p>
        </div>
      </header>

      <InstallCard />

      {/* resume banner - the most useful thing on the page when it applies */}
      {resume && (
        <Card className="mb-4 border-primary bg-primary/5">
          <CardContent className="flex items-center gap-3 p-4">
            <PlayCircle className="size-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t('home.unfinished')}</p>
              <p className="text-xs text-muted-foreground">
                {t('home.answeredOf', {
                  count: Object.keys(resume.answers).length,
                  total: resume.questionIds.length,
                })}
              </p>
            </div>
            <Button asChild size="sm">
              <Link to={ROUTES.test(resume.testId)}>{t('action.continue')}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* today + streak */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('home.today')}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{today?.answered ?? 0}</p>
            <p className="text-xs text-muted-foreground">{t('home.questionsAnswered')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Flame
                className={cn('size-3', progress.currentStreak > 0 && 'text-orange-500')}
              />
              {t('home.streak')}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{progress.currentStreak}</p>
            <p className="text-xs text-muted-foreground">
              {t('home.daysInRow', { count: progress.currentStreak })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* primary actions */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <ActionCard
          to={ROUTES.tests(20)}
          title={t('home.tests20')}
          subtitle={t('home.testsMeta', { count: 68, minutes: 25 })}
        />
        <ActionCard
          to={ROUTES.tests(10)}
          title={t('home.tests10')}
          subtitle={t('home.testsMeta', { count: 134, minutes: 12 })}
        />
      </div>

      <Card className="mb-4 overflow-hidden">
        <Link to={ROUTES.test('exam')} className="block transition hover:bg-accent">
          <CardContent className="flex items-center gap-4 p-5">
            <GraduationCap className="size-8 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{t('home.exam')}</p>
              <p className="text-sm text-muted-foreground">
                {t('home.examMeta', {
                  count: EXAM.questionCount,
                  minutes: EXAM.durationMs / 60000,
                  mistakes: EXAM.maxMistakes,
                })}
              </p>
            </div>
            <ArrowRight className="size-5 shrink-0 text-muted-foreground" />
          </CardContent>
        </Link>
      </Card>

      {progress.weakIds.length > 0 && (
        <Card className="mb-4 overflow-hidden">
          <Link to={ROUTES.test('practice')} className="block transition hover:bg-accent">
            <CardContent className="flex items-center gap-4 p-5">
              <RotateCcw className="size-7 shrink-0 text-amber-500" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{t('home.practice')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('home.practiceMeta', { count: progress.weakIds.length })}
                </p>
              </div>
              <ArrowRight className="size-5 shrink-0 text-muted-foreground" />
            </CardContent>
          </Link>
        </Card>
      )}

      {/* coverage */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-sm font-medium">{t('home.coverage')}</p>
            <p className="text-sm text-muted-foreground tabular-nums">
              {progress.mastered} / {bankSize}
            </p>
          </div>
          <Progress value={(progress.mastered / bankSize) * 100} className="h-2" />
        </CardContent>
      </Card>
    </div>
  )
}

function ActionCard({ to, title, subtitle }: { to: string; title: string; subtitle: string }) {
  return (
    <Card className="overflow-hidden">
      <Link to={to} className="block transition hover:bg-accent">
        <CardContent className="flex items-center gap-3 p-5">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{title}</p>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </CardContent>
      </Link>
    </Card>
  )
}
