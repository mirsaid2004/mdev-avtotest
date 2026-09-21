import { useTranslation } from 'react-i18next'
import { Search, X } from 'lucide-react'
import { cn } from '@/shared/lib'
import { useLanguage } from '@/shared/i18n/useLanguage'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { useQuestions } from '@/entities/question'
import { useProgress } from '@/entities/progress'
import { useQuestionSearch, type BankFilter } from '@/features/question-search'
import { QuestionList } from '@/widgets/question-list'

const FILTERS: { value: BankFilter; key: string }[] = [
  { value: 'all', key: 'bank.filter.all' },
  { value: 'weak', key: 'bank.filter.weak' },
  { value: 'mastered', key: 'bank.filter.mastered' },
  { value: 'unseen', key: 'bank.filter.unseen' },
  { value: 'image', key: 'bank.filter.image' },
]

export function BankPage() {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const { data, isPending, isError } = useQuestions()
  const { stats } = useProgress()

  const search = useQuestionSearch(data, stats, language)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t('nav.bank')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('bank.count', { count: search.results.length })}
        </p>
      </header>

      {/* search */}
      <div className="relative mb-3">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={search.query}
          onChange={(e) => search.setQuery(e.target.value)}
          placeholder={t('bank.searchPlaceholder')}
          aria-label={t('bank.searchPlaceholder')}
          className={cn(
            'h-11 w-full rounded-lg border bg-card pr-10 pl-9 text-sm',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          )}
        />
        {search.query && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => search.setQuery('')}
            aria-label={t('action.cancel')}
            className="absolute top-1/2 right-1 size-8 -translate-y-1/2"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {/* filters */}
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => search.setFilter(f.value)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition',
              search.filter === f.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:bg-accent',
            )}
          >
            {t(f.key)}
          </button>
        ))}
      </div>

      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('state.error')}</AlertTitle>
          <AlertDescription>{t('state.errorBank')}</AlertDescription>
        </Alert>
      ) : isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className={cn('transition-opacity', search.isStale && 'opacity-60')}>
          <QuestionList questions={search.results} stats={stats} />
        </div>
      )}
    </div>
  )
}
