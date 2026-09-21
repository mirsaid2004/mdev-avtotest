import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { eachDayOfInterval, format, startOfWeek, subDays } from 'date-fns'
import { cn } from '@/shared/lib'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { dayKey, type DayActivity } from '@/entities/progress'

const WEEKS = 53
const LEVELS = 4

/** Thresholds are on questions answered, not tests taken - practice counts. */
function levelFor(answered: number): number {
  if (answered === 0) return 0
  if (answered < 10) return 1
  if (answered < 25) return 2
  if (answered < 50) return 3
  return 4
}

/**
 * GitHub-style contribution grid: 53 weeks of columns, Sunday-first rows.
 * Scrolls horizontally on a phone rather than shrinking cells to invisibility.
 */
export function ActivityHeatmap({ daily }: { daily: Record<string, DayActivity> }) {
  const { t } = useTranslation()
  const { weeks, months, total } = useMemo(() => {
    const today = new Date()
    const start = startOfWeek(subDays(today, WEEKS * 7 - 1), { weekStartsOn: 0 })
    const days = eachDayOfInterval({ start, end: today })

    const cols: { date: Date; key: string; activity: DayActivity | undefined }[][] = []
    for (const date of days) {
      const key = dayKey(date)
      if (date.getDay() === 0 || cols.length === 0) cols.push([])
      cols[cols.length - 1].push({ date, key, activity: daily[key] })
    }

    // one label per month, positioned at the column where that month starts
    const labels: { col: number; label: string }[] = []
    let lastMonth = -1
    cols.forEach((col, i) => {
      const m = col[0]?.date.getMonth()
      if (m !== undefined && m !== lastMonth) {
        labels.push({ col: i, label: format(col[0].date, 'MMM') })
        lastMonth = m
      }
    })

    const sum = Object.values(daily).reduce((n, d) => n + d.answered, 0)
    return { weeks: cols, months: labels, total: sum }
  }, [daily])

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{total}</span>{' '}
          {t('stats.answeredLastYear')}
        </p>
      </div>

      <div className="overflow-x-auto pb-1 [scrollbar-width:thin]">
        <div className="inline-block min-w-full">
          {/* month labels */}
          <div className="relative mb-1 h-4" style={{ width: weeks.length * 14 }}>
            {months.map(({ col, label }) => (
              <span
                key={`${col}-${label}`}
                className="absolute text-[10px] text-muted-foreground"
                style={{ left: col * 14 }}
              >
                {label}
              </span>
            ))}
          </div>

          <div className="flex gap-[3px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {Array.from({ length: 7 }, (_, di) => {
                  const cell = week.find((c) => c.date.getDay() === di)
                  if (!cell) return <div key={di} className="size-[11px]" />

                  const answered = cell.activity?.answered ?? 0
                  const level = levelFor(answered)

                  return (
                    <Tooltip key={di}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            'size-[11px] rounded-[2px] transition-colors',
                            level === 0 && 'bg-muted',
                            level === 1 && 'bg-primary/25',
                            level === 2 && 'bg-primary/50',
                            level === 3 && 'bg-primary/75',
                            level === 4 && 'bg-primary',
                          )}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">
                          {answered === 0
                            ? t('stats.noActivity')
                            : t('stats.dayDetail', {
                                count: answered,
                                percent: Math.round(
                                  ((cell.activity?.correct ?? 0) / answered) * 100,
                                ),
                              })}
                          <br />
                          <span className="text-muted-foreground">
                            {format(cell.date, 'd MMM yyyy')}
                          </span>
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        <span>{t('stats.less')}</span>
        {Array.from({ length: LEVELS + 1 }, (_, i) => (
          <div
            key={i}
            className={cn(
              'size-[11px] rounded-[2px]',
              i === 0 && 'bg-muted',
              i === 1 && 'bg-primary/25',
              i === 2 && 'bg-primary/50',
              i === 3 && 'bg-primary/75',
              i === 4 && 'bg-primary',
            )}
          />
        ))}
        <span>{t('stats.more')}</span>
      </div>
    </div>
  )
}
