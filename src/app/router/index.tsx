import { lazy } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AppLayout } from '@/widgets/app-layout'
import { ROUTES } from './routes'

const HomePage = lazy(() => import('@/pages/home'))
const TestsPage = lazy(() => import('@/pages/tests'))
const TestPage = lazy(() => import('@/pages/test'))
const ResultsPage = lazy(() => import('@/pages/results'))
const BankPage = lazy(() => import('@/pages/bank'))
const StatsPage = lazy(() => import('@/pages/stats'))
const SettingsPage = lazy(() => import('@/pages/settings'))
const NotFoundPage = lazy(() => import('@/pages/not-found'))

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
