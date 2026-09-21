import { Clock } from 'lucide-react'
import { TIMER_DANGER_MS, TIMER_WARN_MS } from '@/shared/config'
import { cn } from '@/shared/lib'

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${`${s}`.padStart(2, '0')}`
}

export function TimerDisplay({ remainingMs }: { remainingMs: number }) {
  const danger = remainingMs <= TIMER_DANGER_MS
  const warn = !danger && remainingMs <= TIMER_WARN_MS

  return (
    <div
      role="timer"
      aria-live={danger ? 'assertive' : 'off'}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold tabular-nums transition-colors',
        danger && 'bg-destructive/10 text-destructive',
        warn && 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
        !danger && !warn && 'text-muted-foreground',
      )}
    >
      <Clock className={cn('size-4', danger && 'animate-pulse')} />
      {formatClock(remainingMs)}
    </div>
  )
}
