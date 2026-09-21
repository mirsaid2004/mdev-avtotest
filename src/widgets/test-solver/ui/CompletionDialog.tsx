import { useTranslation } from 'react-i18next'
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react'
import { EXAM } from '@/shared/config'
import { cn } from '@/shared/lib'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  total: number
  correct: number
  wrong: number
  isExam: boolean
  onReplay: () => void
  onComplete: () => void
}

/**
 * Shown once every question has an answer. It reports the tally and offers the
 * two things worth doing next, without submitting on its own - dismissing it
 * leaves the test open so answers can still be reviewed.
 */
export function CompletionDialog({
  open,
  onOpenChange,
  total,
  correct,
  wrong,
  isExam,
  onReplay,
  onComplete,
}: Props) {
  const { t } = useTranslation()
  const passed = wrong <= EXAM.maxMistakes

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="completion-dialog">
        <DialogHeader>
          <DialogTitle>{t('test.completeTitle')}</DialogTitle>
          <DialogDescription>
            {isExam
              ? passed
                ? t('test.completeExamPass', { max: EXAM.maxMistakes })
                : t('test.completeExamFail', { max: EXAM.maxMistakes })
              : t('test.completeBody')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="rounded-lg border border-correct bg-correct-muted p-4 text-center">
            <CheckCircle2 className="mx-auto mb-1 size-5 text-correct" />
            <p className="text-3xl font-semibold tabular-nums text-correct">{correct}</p>
            <p className="text-xs text-muted-foreground">{t('test.correctCount')}</p>
          </div>
          <div
            className={cn(
              'rounded-lg border p-4 text-center',
              wrong > 0 ? 'border-incorrect bg-incorrect-muted' : 'border-border bg-muted/40',
            )}
          >
            <XCircle
              className={cn(
                'mx-auto mb-1 size-5',
                wrong > 0 ? 'text-incorrect' : 'text-muted-foreground',
              )}
            />
            <p
              className={cn(
                'text-3xl font-semibold tabular-nums',
                wrong > 0 ? 'text-incorrect' : 'text-muted-foreground',
              )}
            >
              {wrong}
            </p>
            <p className="text-xs text-muted-foreground">{t('test.wrongCount')}</p>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground tabular-nums">
          {correct} / {total} · {Math.round((correct / total) * 100)}%
        </p>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onReplay} data-testid="replay">
            <RotateCcw className="size-4" />
            {t('test.replay')}
          </Button>
          <Button onClick={onComplete} data-testid="complete">
            {t('action.finish')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
