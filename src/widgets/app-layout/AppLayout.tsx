import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BarChart3, BookOpen, Home, ListChecks, Settings } from 'lucide-react'
import { cn } from '@/shared/lib'
import { Logo } from '@/shared/ui/logo'
import { ROUTES } from '@/app/router/routes'

const NAV = [
  { to: ROUTES.home, icon: Home, key: 'nav.home', exact: true },
  { to: ROUTES.tests(20), icon: ListChecks, key: 'nav.tests', match: '/tests' },
  { to: ROUTES.bank, icon: BookOpen, key: 'nav.bank' },
  { to: ROUTES.stats, icon: BarChart3, key: 'nav.stats' },
  { to: ROUTES.settings, icon: Settings, key: 'nav.settings' },
]

/**
 * Shell every page renders inside: bottom tab bar on phones, top bar on
 * desktop. The solver renders outside this - it needs the full screen.
 */
export function AppLayout() {
  const { t } = useTranslation()
  const { pathname } = useLocation()

  const isActive = (item: (typeof NAV)[number]) =>
    item.exact ? pathname === item.to : pathname.startsWith(item.match ?? item.to)

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {/* desktop nav */}
      <header className="sticky top-0 z-30 hidden border-b bg-background/95 backdrop-blur sm:block">
        <nav className="mx-auto flex w-full max-w-3xl items-center gap-1 px-4 py-2">
          <NavLink to={ROUTES.home} className="mr-3 flex items-center gap-2 font-semibold">
            <Logo className="size-6" />
            {t('app.name')}
          </NavLink>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition',
                isActive(item)
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {t(item.key)}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1 pb-20 sm:pb-0">
        <Outlet />
      </main>

      {/* mobile tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur sm:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = isActive(item)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className={cn('size-5', active && 'fill-primary/10')} />
                {t(item.key)}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
