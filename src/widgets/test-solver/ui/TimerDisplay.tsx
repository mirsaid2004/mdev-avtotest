import { useTranslation } from 'react-i18next'
import { Clock, Pause, Play } from 'lucide-react'
import { TIMER_DANGER_MS, TIMER_WARN_MS } from '@/shared/config'
import { cn } from '@/shared/lib'

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${`${s}`.padStart(2, '0')}`
}

interface Props {
  remainingMs: number
  paused?: boolean
  /** false in exam mode - pausing there would make the limit meaningless */
  canPause?: boolean
  onTogglePause?: () => void
}

/**
 * The countdown. Where pausing is allowed the whole thing is a button, so
 * tapping the clock is what stops and restarts it.
 */
export function TimerDisplay({ remainingMs, paused = false, canPause = false, onTogglePause }: Props) {
  const { t } = useTranslation()
  const danger = !paused && remainingMs <= TIMER_DANGER_MS
  const warn = !paused && !danger && remainingMs <= TIMER_WARN_MS

  const body = (
    <>
      {canPause ? (
        paused ? (
          <Play className="size-4 fill-current" />
        ) : (
          <Pause className="size-4" />
        )
      ) : (
        <Clock className={cn('size-4', danger && 'animate-pulse')} />
      )}
      {formatClock(remainingMs)}
    </>
  )

  const className = cn(
    'flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold tabular-nums transition-colors',
    paused && 'bg-secondary text-secondary-foreground',
    danger && 'bg-destructive/10 text-destructive',
    warn && 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
    !paused && !danger && !warn && 'text-muted-foreground',
    canPause && 'hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
  )

  if (!canPause) {
    return (
      <div role="timer" aria-live={danger ? 'assertive' : 'off'} className={className}>
        {body}
      </div>
    )
  }

  return (
    <button
      type="button"
      role="timer"
      aria-live={danger ? 'assertive' : 'off'}
      aria-pressed={paused}
      data-testid="timer"
      data-paused={paused}
      aria-label={paused ? t('test.resume') : t('test.pause')}
      title={paused ? t('test.resume') : t('test.pause')}
      onClick={onTogglePause}
      className={className}
    >
      {body}
    </button>
  )
}
