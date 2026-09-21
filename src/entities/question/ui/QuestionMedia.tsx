import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Expand, ImageOff, X } from 'lucide-react'
import { imageUrl } from '@/shared/config'
import { cn, useOnlineStatus } from '@/shared/lib'

/**
 * Question image, tappable to fullscreen.
 *
 * The source images are 1920x1080 originals, kept uncompressed precisely so a
 * speed-limit number or an indicator lamp stays readable. In a card they render
 * ~380px wide, so the fullscreen view is where that detail actually pays off.
 */
export function QuestionMedia({ media, alt }: { media: string | null; alt: string }) {
  const { t } = useTranslation()
  const online = useOnlineStatus()
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  // bumped on retry to force a fresh network attempt rather than whatever the
  // browser remembers about the last failed request for this exact URL
  const [attempt, setAttempt] = useState(0)

  const src = imageUrl(media)
  if (!src) return null

  const retry = () => {
    setFailed(false)
    setLoaded(false)
    setAttempt((a) => a + 1)
  }

  /*
   * 801 of 1353 questions have an image, and only images already viewed while
   * online are cached for offline use (the full set is 156 MB - too much to
   * ship in the precache). A failed load used to just make this component
   * return null, which reads as "the app is broken" rather than "this
   * particular image isn't available right now" - so it gets an honest
   * placeholder instead, matching the space the image would have used.
   */
  if (failed) {
    return (
      <div
        data-testid="question-media-unavailable"
        className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted text-center text-muted-foreground"
      >
        <ImageOff className="size-6" />
        <p className="max-w-[80%] text-xs">
          {online ? t('media.failed') : t('media.offlineUnavailable')}
        </p>
        <button
          type="button"
          onClick={retry}
          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          {t('action.retry')}
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'group relative block w-full overflow-hidden rounded-lg bg-muted',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        )}
        aria-label={t('media.enlarge')}
        data-testid="question-media"
      >
        <div className="aspect-video w-full">
          <img
            key={attempt}
            src={attempt ? `${src}?retry=${attempt}` : src}
            alt={alt}
            loading="eager"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={cn(
              'h-full w-full object-contain transition-opacity duration-200',
              loaded ? 'opacity-100' : 'opacity-0',
            )}
          />
        </div>
        <span
          className={cn(
            'absolute right-2 bottom-2 rounded-md bg-background/85 p-1.5 backdrop-blur',
            'text-muted-foreground shadow-sm transition group-hover:text-foreground',
          )}
        >
          <Expand className="size-4" />
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 animate-in fade-in"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t('action.close')}
            className="absolute top-3 right-3 z-10 rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20"
            style={{ top: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
          >
            <X className="size-5" />
          </button>
          {/* native pinch-zoom: the browser does this better than any JS */}
          <div
            className="max-h-full max-w-full overflow-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={src} alt={alt} className="max-w-none" style={{ maxHeight: '90dvh' }} />
          </div>
        </div>
      )}
    </>
  )
}
