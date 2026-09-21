import { useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, ImageIcon } from 'lucide-react'
import { MASTERY_STREAK } from '@/shared/config'
import { cn } from '@/shared/lib'
import { useLanguage } from '@/shared/i18n/useLanguage'
import { QuestionMedia, type Question } from '@/entities/question'
import type { QuestionStat } from '@/entities/progress'

interface Props {
  questions: Question[]
  stats: Record<number, QuestionStat>
}

/**
 * Virtualised list over the full bank.
 *
 * 1353 rows, each with an image and up to five answers, is far too much to put
 * in the DOM at once - on a mid-range Android it janks badly. The virtualizer
 * keeps only the visible window mounted. Rows expand in place, so the measured
 * height has to be dynamic rather than a fixed estimate.
 */
export function QuestionList({ questions, stats }: Props) {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const parentRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const virtualizer = useVirtualizer({
    count: questions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 84,
    overscan: 6,
    // rows grow when expanded; measureElement reports the real height back
    measureElement: (el) => el.getBoundingClientRect().height,
  })

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (questions.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        {t('state.empty')}
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className="h-[calc(100dvh-16rem)] overflow-y-auto overscroll-contain rounded-lg border sm:h-[calc(100dvh-14rem)]"
    >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          const q = questions[row.index]
          const stat = stats[q.id]
          const isOpen = expanded.has(q.id)
          const mastered = stat && stat.streak >= MASTERY_STREAK
          const weak = stat && stat.streak < MASTERY_STREAK && stat.seen > stat.correct

          return (
            <div
              key={q.id}
              data-index={row.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full"
              style={{ transform: `translateY(${row.start}px)` }}
            >
              <div className="border-b px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => toggle(q.id)}
                  aria-expanded={isOpen}
                  data-testid="bank-row"
                  className="flex w-full items-start gap-3 text-left"
                >
                  <span
                    className={cn(
                      'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border text-[10px] font-semibold',
                      mastered && 'border-correct bg-correct text-correct-foreground',
                      weak && 'border-incorrect bg-incorrect-muted text-incorrect',
                      !stat && 'border-border text-muted-foreground',
                    )}
                  >
                    {mastered ? <Check className="size-3.5" /> : stat ? `${stat.correct}/${stat.seen}` : '–'}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm leading-snug', !isOpen && 'line-clamp-2')}>
                      {q.text[language]}
                    </span>
                    {q.media && !isOpen && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <ImageIcon className="size-3" />
                        {t('bank.hasImage')}
                      </span>
                    )}
                  </span>

                  <ChevronDown
                    className={cn(
                      'mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform',
                      isOpen && 'rotate-180',
                    )}
                  />
                </button>

                {isOpen && (
                  <div className="mt-3 space-y-2 pl-9">
                    {q.media && (
                      <div className="max-w-sm">
                        <QuestionMedia media={q.media} alt={q.text[language]} />
                      </div>
                    )}
                    {q.answers.map((a) => {
                      const right = a.id === q.answerId
                      return (
                        <div
                          key={a.id}
                          className={cn(
                            'rounded-md border p-2 text-sm',
                            right
                              ? 'border-correct bg-correct-muted font-medium'
                              : 'border-border text-muted-foreground',
                          )}
                        >
                          {a.text[language]}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
