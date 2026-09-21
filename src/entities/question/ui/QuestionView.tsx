import { useLanguage } from '@/shared/i18n/useLanguage'
import type { Question } from '../model/types'
import { QuestionMedia } from './QuestionMedia'
import { AnswerOption } from './AnswerOption'

const LABELS = ['A', 'B', 'C', 'D', 'E']

interface Props {
  question: Question
  selectedAnswerId: number | undefined
  /** false in exam mode until submit */
  reveal: boolean
  disabled?: boolean
  onSelect: (answerId: number) => void
}

/**
 * One question with its answers. Purely presentational - all session logic
 * lives in useTestSession.
 */
export function QuestionView({
  question,
  selectedAnswerId,
  reveal,
  disabled = false,
  onSelect,
}: Props) {
  const { language } = useLanguage()
  const answered = selectedAnswerId !== undefined
  const showFeedback = reveal && answered

  return (
    <div className="space-y-4">
      <QuestionMedia media={question.media} alt={question.text[language]} />

      <h2 className="text-base leading-snug font-medium text-balance sm:text-lg">
        {question.text[language]}
      </h2>

      <div className="space-y-2">
        {question.answers.map((answer, i) => {
          const isSelected = answer.id === selectedAnswerId
          const isRight = answer.id === question.answerId

          // once answered, show which one was right - not just that you were wrong
          const state = showFeedback
            ? isRight
              ? 'correct'
              : isSelected
                ? 'incorrect'
                : null
            : null

          return (
            <AnswerOption
              key={answer.id}
              label={LABELS[i] ?? String(i + 1)}
              text={answer.text[language]}
              selected={isSelected}
              state={state}
              disabled={disabled || (reveal && answered)}
              onSelect={() => onSelect(answer.id)}
            />
          )
        })}
      </div>
    </div>
  )
}
