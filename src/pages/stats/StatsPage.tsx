import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Flame, Target, CalendarDays, Timer } from 'lucide-react'
import { MASTERY_STREAK } from '@/shared/config'
import { cn } from '@/shared/lib'
import { useLanguage } from '@/shared/i18n/useLanguage'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Progress } from '@/shared/ui/progress'
import { Button } from '@/shared/ui/button'
import { useQuestionMap } from '@/entities/question'
import { useProgress } from '@/entities/progress'
import { ActivityHeatmap } from '@/widgets/activity-heatmap'
import { ROUTES } from '@/app/router/routes'

export function StatsPage() {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const progress = useProgress()
  const { map } = useQuestionMap()

  const bankSize = map.size || 1353
  const learning = progress.seen - progress.mastered
  const unseen = Math.max(0, bankSize - progress.seen)

  const totalSeconds = useMemo(
    () => Object.values(progress.daily).reduce((n, d) => n + d.seconds, 0),
    [progress.daily],
  )

  const recent = useMemo(() => progress.attempts.slice(0, 20).reverse(), [progress.attempts])

  const worst = useMemo(
    () =>
      progress.weakIds
        .slice(0, 10)
        .map((id) => ({ q: map.get(id), stat: progress.stats[id] }))
        .filter((x) => x.q),
    [progress.weakIds, map, progress.stats],
  )

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t('nav.stats')}</h1>

      {/* headline numbers */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          icon={<Flame className="size-4" />}
          label={t('stats.currentStreak')}
          value={progress.currentStreak}
          suffix={t('stats.days', { count: progress.currentStreak })}
        />
        <StatTile
          icon={<CalendarDays className="size-4" />}
          label={t('stats.longestStreak')}
          value={progress.longestStreak}
          suffix={t('stats.days', { count: progress.longestStreak })}
        />
        <StatTile
          icon={<Target className="size-4" />}
          label={t('stats.accuracy')}
          value={`${Math.round(progress.accuracy * 100)}%`}
        />
        <StatTile
          icon={<Timer className="size-4" />}
          label={t('stats.timeStudied')}
          value={formatDuration(totalSeconds)}
        />
      </div>

      {/* heatmap */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('stats.activity')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityHeatmap daily={progress.daily} />
        </CardContent>
      </Card>

      {/* mastery */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('stats.coverage')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={(progress.mastered / bankSize) * 100} className="h-2" />
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Legend color="bg-primary" label={t('stats.mastered')} value={progress.mastered} />
            <Legend color="bg-primary/40" label={t('stats.learning')} value={learning} />
            <Legend color="bg-muted" label={t('stats.unseen')} value={unseen} />
          </div>
          <p className="text-xs text-muted-foreground">
            {t('stats.masteryNote', { count: MASTERY_STREAK })}
          </p>
        </CardContent>
      </Card>

      {/* accuracy trend */}
      {recent.length > 1 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('stats.recentAttempts')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-24 items-end gap-1">
              {recent.map((a) => {
                const pct = (a.correct / a.total) * 100
                return (
                  <div
                    key={a.id}
                    title={`${a.correct}/${a.total}`}
                    className={cn(
                      'flex-1 rounded-t-sm transition-all',
                      pct === 100 ? 'bg-correct' : pct >= 90 ? 'bg-primary' : 'bg-primary/40',
                    )}
                    style={{ height: `${Math.max(4, pct)}%` }}
                  />
                )
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('stats.recentNote', { count: recent.length })}
            </p>
          </CardContent>
        </Card>
      )}

      {/* weakest */}
      {worst.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">{t('stats.needsWork')}</CardTitle>
            <Button asChild size="sm">
              <Link to={ROUTES.test('practice')}>{t('action.drill')}</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {worst.map(({ q, stat }) => (
              <div key={q!.id} className="flex items-start gap-3 rounded-lg border p-2.5">
                <span className="mt-0.5 shrink-0 rounded bg-incorrect-muted px-1.5 py-0.5 text-xs font-semibold text-incorrect tabular-nums">
                  {stat.correct}/{stat.seen}
                </span>
                <p className="min-w-0 flex-1 truncate text-sm">{q!.text[language]}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatTile({
  icon,
  label,
  value,
  suffix,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  suffix?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <p className="text-2xl font-semibold tabular-nums">
          {value}
          {suffix && <span className="ml-1 text-sm font-normal text-muted-foreground">{suffix}</span>}
        </p>
      </CardContent>
    </Card>
  )
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('size-2.5 rounded-sm', color)} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  )
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}
