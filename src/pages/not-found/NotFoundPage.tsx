import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/ui/button'
import { ROUTES } from '@/app/router/routes'

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto flex min-h-[60dvh] w-full max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-5xl font-semibold text-muted-foreground">404</p>
      <p className="mt-2 mb-6 text-muted-foreground">{t('state.empty')}</p>
      <Button asChild>
        <Link to={ROUTES.home}>{t('nav.home')}</Link>
      </Button>
    </div>
  )
}
