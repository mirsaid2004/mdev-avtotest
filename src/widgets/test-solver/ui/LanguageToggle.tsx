import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '@/shared/config'
import { cn } from '@/shared/lib'
import { useLanguage } from '@/shared/i18n/useLanguage'

/**
 * One-tap question language, right in the test header - so a question that
 * reads oddly can be checked in another language without leaving the test.
 * It switches the whole app language; answers and the timer are untouched.
 */
export function LanguageToggle() {
  const { t } = useTranslation()
  const { language, setLanguage } = useLanguage()

  return (
    <div
      role="radiogroup"
      aria-label={t('language.switch')}
      data-testid="language-toggle"
      className="flex shrink-0 rounded-md border bg-muted/40 p-0.5"
    >
      {LANGUAGES.map((l) => {
        const active = language === l.code
        return (
          <button
            key={l.code}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={l.nativeLabel}
            title={l.nativeLabel}
            onClick={() => setLanguage(l.code)}
            className={cn(
              'h-7 min-w-8 rounded-sm px-1.5 text-xs font-semibold transition',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {l.short}
          </button>
        )
      })}
    </div>
  )
}
