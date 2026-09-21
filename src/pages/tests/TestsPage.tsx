import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { TestGrid } from '@/widgets/test-grid'
import { TEST_DURATION_MS } from '@/shared/config'
import type { TestSize } from '@/entities/test'

export function TestsPage() {
  const { size } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const active: TestSize = size === '10' ? 10 : 20
  const minutes = TEST_DURATION_MS[active] / 60000

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t('nav.tests')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('tests.meta', { count: active, minutes })}
        </p>
      </header>

      <Tabs
        value={String(active)}
        onValueChange={(v) => navigate(`/tests/${v}`)}
        className="mb-5"
      >
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="20" className="flex-1 sm:flex-none">
            {t('tests.tab20')}
          </TabsTrigger>
          <TabsTrigger value="10" className="flex-1 sm:flex-none">
            {t('tests.tab10')}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <TestGrid size={active} />
    </div>
  )
}
