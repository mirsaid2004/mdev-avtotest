import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/shared/i18n'
import { Toaster } from '@/shared/ui/sonner'
import { TooltipProvider } from '@/shared/ui/tooltip'
import { UpdatePrompt } from '@/features/sw-update'
import { ProgressProvider } from '@/entities/progress'
import { ThemeProvider } from './ThemeProvider'
import { QueryProvider } from './QueryProvider'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <QueryProvider>
          <ProgressProvider>
            <TooltipProvider delayDuration={200}>
              <Suspense fallback={null}>{children}</Suspense>
              <Toaster richColors position="top-center" />
              <UpdatePrompt />
            </TooltipProvider>
          </ProgressProvider>
        </QueryProvider>
      </ThemeProvider>
    </I18nextProvider>
  )
}

export { useTheme } from './ThemeProvider'
export type { Theme } from './ThemeProvider'
