import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Expand, X } from 'lucide-react'
import { imageUrl } from '@/shared/config'
import { cn } from '@/shared/lib'

/**
 * Question image, tappable to fullscreen.
 *
 * The source images are 1920x1080 originals, kept uncompressed precisely so a
 * speed-limit number or an indicator lamp stays readable. In a card they render
 * ~380px wide, so the fullscreen view is where that detail actually pays off.
 */
export function QuestionMedia({ media, alt }: { media: string | null; alt: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  const src = imageUrl(media)
  if (!src || failed) return null

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
            src={src}
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
