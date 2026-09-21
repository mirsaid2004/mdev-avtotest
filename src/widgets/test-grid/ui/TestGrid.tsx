import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { cn } from '@/shared/lib'
import { Skeleton } from '@/shared/ui/skeleton'
import { useTests, type TestSize } from '@/entities/test'
import { useProgress } from '@/entities/progress'
import { ROUTES } from '@/app/router/routes'

/**
 * Grid of test templates. Each tile carries its best score so you can see at a
 * glance which ones you've cleared and which still need work.
 */
export function TestGrid({ size }: { size: TestSize }) {
  const { data, isPending } = useTests(size)
  const { attempts } = useProgress()

  const best = new Map<string, number>()
  for (const a of attempts) {
    const pct = a.correct / a.total
    if (!best.has(a.testId) || pct > best.get(a.testId)!) best.set(a.testId, pct)
  }

  if (isPending) {
    return (
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
        {Array.from({ length: 24 }, (_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
      {data?.map((test) => {
        const score = best.get(test.id)
        const perfect = score === 1
        const attempted = score !== undefined

        return (
          <Link
            key={test.id}
            to={ROUTES.test(test.id)}
            className={cn(
              'relative flex aspect-square flex-col items-center justify-center rounded-lg border transition',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              !attempted && 'border-border bg-card hover:border-ring/50 hover:bg-accent',
              attempted && !perfect && 'border-primary/40 bg-primary/5 hover:bg-primary/10',
              perfect && 'border-correct bg-correct-muted',
            )}
          >
            <span className="text-sm font-semibold tabular-nums">{test.number}</span>
            {attempted && (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {Math.round(score * 100)}%
              </span>
            )}
            {perfect && (
              <Check className="absolute top-1 right-1 size-3 text-correct" strokeWidth={3} />
            )}
          </Link>
        )
      })}
    </div>
  )
}
