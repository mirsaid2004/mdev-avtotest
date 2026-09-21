import { Check, X } from 'lucide-react'
import { cn } from '@/shared/lib'

interface Props {
  label: string
  text: string
  selected: boolean
  /** null while feedback is withheld (exam mode, or not yet answered) */
  state: 'correct' | 'incorrect' | null
  disabled: boolean
  onSelect: () => void
}

export function AnswerOption({ label, text, selected, state, disabled, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      data-testid="answer-option"
      data-state={state ?? (selected ? 'selected' : 'idle')}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        // generous hit area - this is tapped with a thumb on a moving bus
        'min-h-14 sm:min-h-12',
        !state && !selected && 'border-border bg-card hover:border-ring/50 hover:bg-accent',
        !state && selected && 'border-primary bg-primary/5 ring-1 ring-primary',
        state === 'correct' && 'border-correct bg-correct-muted',
        state === 'incorrect' && 'border-incorrect bg-incorrect-muted',
        disabled && !state && 'cursor-default opacity-70',
      )}
    >
      <span
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-md border text-xs font-semibold',
          !state && selected && 'border-primary bg-primary text-primary-foreground',
          !state && !selected && 'border-border text-muted-foreground',
          state === 'correct' && 'border-correct bg-correct text-correct-foreground',
          state === 'incorrect' && 'border-incorrect bg-incorrect text-incorrect-foreground',
        )}
      >
        {state === 'correct' ? (
          <Check className="size-4" />
        ) : state === 'incorrect' ? (
          <X className="size-4" />
        ) : (
          label
        )}
      </span>
      {/* min-w-0 so long answers wrap instead of forcing horizontal overflow */}
      <span className="min-w-0 flex-1 text-sm leading-snug break-words sm:text-[0.95rem]">
        {text}
      </span>
    </button>
  )
}
