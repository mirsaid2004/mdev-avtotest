import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Share, SquarePlus, X } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Logo } from '@/shared/ui/logo'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { useInstallPrompt } from '../model/useInstallPrompt'

/**
 * Invitation to install. Renders nothing when the app is already installed,
 * when the platform can't install it, or once dismissed.
 */
export function InstallCard() {
  const { t } = useTranslation()
  const [showIOS, setShowIOS] = useState(false)
  const { visible, canPrompt, needsIOSInstructions, install, dismiss } = useInstallPrompt()

  if (!visible) return null

  return (
    <>
      <Card className="mb-4 border-primary/40 bg-primary/5" data-testid="install-card">
        <CardContent className="flex items-center gap-3 p-4">
          <Logo className="size-10 shrink-0" />

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t('install.title')}</p>
            <p className="text-xs text-muted-foreground">{t('install.body')}</p>
          </div>

          <Button
            size="sm"
            onClick={() => (canPrompt ? void install() : setShowIOS(true))}
            className="shrink-0"
          >
            <Download className="size-4" />
            {t('install.action')}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={dismiss}
            aria-label={t('action.close')}
            className="size-8 shrink-0"
          >
            <X className="size-4" />
          </Button>
        </CardContent>
      </Card>

      {/* iOS can install, but only through the share sheet - there is no API */}
      <Dialog open={showIOS && needsIOSInstructions} onOpenChange={setShowIOS}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('install.iosTitle')}</DialogTitle>
            <DialogDescription>{t('install.iosBody')}</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                1
              </span>
              <Share className="size-4 shrink-0 text-primary" />
              {t('install.iosStep1')}
            </li>
            <li className="flex items-center gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                2
              </span>
              <SquarePlus className="size-4 shrink-0 text-primary" />
              {t('install.iosStep2')}
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  )
}
