import { useEffect, useRef } from 'react'
import { cn } from '@/shared/lib'
import type { Question } from '@/entities/question'

interface Props {
  questions: Question[]
  index: number
  answers: Record<number, number>
  flagged: Set<number>
  /** training shows right/wrong per dot; exam shows only answered/unanswered */
  reveal: boolean
  onSelect: (index: number) => void
}

/**
 * Horizontal strip of question numbers - the navigator. Keeps the current
 * question scrolled into view so it never drifts off-screen on a phone.
 */
export function QuestionSlider({
  questions,
  index,
  answers,
  flagged,
  reveal,
  onSelect,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-i="${index}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [index])

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label="Questions"
      className="flex gap-1.5 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {questions.map((q, i) => {
        const answer = answers[q.id]
        const answered = answer !== undefined
        const correct = answered && answer === q.answerId
        const isCurrent = i === index

        return (
          <button
            key={q.id}
            data-i={i}
            role="tab"
            aria-selected={isCurrent}
            aria-label={`Question ${i + 1}${answered ? ', answered' : ''}`}
            onClick={() => onSelect(i)}
            className={cn(
              'relative size-9 shrink-0 rounded-md border text-xs font-semibold tabular-nums transition',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              !answered && 'border-border bg-card text-muted-foreground hover:bg-accent',
              answered && !reveal && 'border-primary bg-primary/10 text-primary',
              answered && reveal && correct && 'border-correct bg-correct text-correct-foreground',
              answered &&
                reveal &&
                !correct &&
                'border-incorrect bg-incorrect text-incorrect-foreground',
              isCurrent && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
            )}
          >
            {i + 1}
            {flagged.has(q.id) && (
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-amber-500" />
            )}
          </button>
        )
      })}
    </div>
  )
}
