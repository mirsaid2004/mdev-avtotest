import { useEffect, useRef } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { FreeMode, Mousewheel, Navigation } from 'swiper/modules'
import type { Swiper as SwiperClass } from 'swiper'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/shared/lib'
import type { Question } from '@/entities/question'

import 'swiper/css'
import 'swiper/css/free-mode'
import 'swiper/css/navigation'

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
 * The question navigator: a swipeable strip of numbers.
 *
 * Free mode rather than snapping, because these are small tokens and snapping
 * each one to the edge feels wrong.
 */
export function QuestionSlider({
  questions,
  index,
  answers,
  flagged,
  reveal,
  onSelect,
}: Props) {
  const swiperRef = useRef<SwiperClass | null>(null)

  // keep the current question in view when it changes from outside the strip
  // (next/prev buttons, or the auto-advance after a correct answer)
  useEffect(() => {
    const swiper = swiperRef.current
    if (!swiper || swiper.destroyed) return
    swiper.slideTo(Math.max(0, index - 2), 300)
  }, [index])

  return (
    /* aligned with the rest of the shell; full-bleed it would stretch the
       numbers edge to edge while every other element sits at max-w-3xl */
    <div className="relative mx-auto w-full max-w-3xl px-4 py-2">
      <Swiper
        onSwiper={(s) => (swiperRef.current = s)}
        modules={[FreeMode, Mousewheel, Navigation]}
        slidesPerView="auto"
        spaceBetween={6}
        freeMode={{ enabled: true, momentumBounce: false }}
        mousewheel={{
          // a plain vertical wheel scrolls the strip sideways, which is the
          // point; releaseOnEdges hands scrolling back to the page once the
          // strip is at either end, so it never traps the viewport
          forceToAxis: false,
          releaseOnEdges: true,
          sensitivity: 1,
        }}
        navigation={{ prevEl: '.slider-prev', nextEl: '.slider-next' }}
        // vertical padding so the focus ring on the current tab isn't clipped
        className="!py-1"
        role="tablist"
        aria-label="Questions"
      >
        {questions.map((q, i) => {
          const answer = answers[q.id]
          const answered = answer !== undefined
          const correct = answered && answer === q.answerId
          const isCurrent = i === index

          return (
            <SwiperSlide key={q.id} className="!w-9">
              <button
                data-i={i}
                role="tab"
                aria-selected={isCurrent}
                aria-label={`Question ${i + 1}${answered ? ', answered' : ''}`}
                onClick={() => onSelect(i)}
                className={cn(
                  'size-9 rounded-md border text-xs font-semibold tabular-nums transition',
                  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  'relative',
                  !answered && 'border-border bg-card text-muted-foreground hover:bg-accent',
                  answered && !reveal && 'border-primary bg-primary/10 text-primary',
                  answered &&
                    reveal &&
                    correct &&
                    'border-correct bg-correct text-correct-foreground',
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
            </SwiperSlide>
          )
        })}
      </Swiper>

      {/* scroll buttons - hidden on touch, where swiping is the obvious gesture */}
      <ScrollButton side="prev" />
      <ScrollButton side="next" />
    </div>
  )
}

function ScrollButton({ side }: { side: 'prev' | 'next' }) {
  const Icon = side === 'prev' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      aria-label={side === 'prev' ? 'Scroll left' : 'Scroll right'}
      data-testid={`slider-${side}`}
      className={cn(
        `slider-${side}`,
        'absolute top-1/2 z-10 hidden size-7 -translate-y-1/2 items-center justify-center',
        'rounded-full border bg-background/95 text-muted-foreground shadow-sm backdrop-blur',
        'transition hover:text-foreground sm:flex',
        // Swiper adds this class at the ends of the strip
        '[&.swiper-button-disabled]:pointer-events-none [&.swiper-button-disabled]:opacity-0',
        side === 'prev' ? 'left-1' : 'right-1',
      )}
    >
      <Icon className="size-4" />
    </button>
  )
}
