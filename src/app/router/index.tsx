import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AppLayout } from '@/widgets/app-layout'
import { HomePage } from '@/pages/home'
import { TestsPage } from '@/pages/tests'
import { TestPage } from '@/pages/test'
import { ResultsPage } from '@/pages/results'
import { BankPage } from '@/pages/bank'
import { StatsPage } from '@/pages/stats'
import { SettingsPage } from '@/pages/settings'
import { NotFoundPage } from '@/pages/not-found'
import { ROUTES } from './routes'

/**
 * Pages are statically imported, not React.lazy(). This is a small app
 * (~265 KB gzip for everything), and the whole point of the PWA is reliable
 * offline use - React.lazy()'s dynamic import() has to be served from the
 * service worker's cache at the exact moment a route is first visited, and
 * WebKit specifically can fail that ("Importing a module script failed"),
 * crashing to React Router's default error screen for anyone offline who
 * taps into a page they haven't opened yet this session. Bundling everything
 * up front costs a little on first load - which is precached anyway - and
 * removes that failure mode completely, on every browser, permanently.
 */
const router = createBrowserRouter([
  // the solver sits outside AppLayout: it owns the whole screen, and a tab bar
  // during a timed exam is an invitation to lose your progress
  { path: ROUTES.test(), element: <TestPage /> },
  {
    element: <AppLayout />,
    children: [
      { path: ROUTES.home, element: <HomePage /> },
      { path: '/tests', element: <Navigate to={ROUTES.tests(20)} replace /> },
      { path: ROUTES.tests(), element: <TestsPage /> },
      { path: ROUTES.results(), element: <ResultsPage /> },
      { path: ROUTES.bank, element: <BankPage /> },
      { path: ROUTES.stats, element: <StatsPage /> },
      { path: ROUTES.settings, element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}

export { ROUTES }
