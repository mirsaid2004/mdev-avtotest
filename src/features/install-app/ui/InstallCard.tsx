import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Compass, Copy, Download, Share, SquarePlus, ToggleRight, X } from 'lucide-react'
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

function Step({ n, icon, children }: { n: number; icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
        {n}
      </span>
      {icon}
      <span>{children}</span>
    </li>
  )
}

/**
 * Invitation to install. Renders nothing when the app is already installed,
 * when the platform can't install it, or once dismissed.
 */
export function InstallCard() {
  const { t } = useTranslation()
  const [showIOS, setShowIOS] = useState(false)
  const { visible, canPrompt, needsIOSInstructions, iosBrowser, install, dismiss } =
    useInstallPrompt()

  if (!visible) return null

  // the way out of a browser that can't install: paste the link into Safari
  const copyLink = async () => {
    const url = `${window.location.origin}/`
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('install.linkCopied'))
    } catch {
      toast(url)
    }
  }

  const iconClass = 'size-4 shrink-0 text-primary'
  const inapp = iosBrowser === 'inapp'

  return (
    <>
      <Card className="mb-4 border-primary/40 bg-primary/5" data-testid="install-card">
        <CardContent className="flex items-center gap-3 p-4">
          <Logo className="size-10 shrink-0" />

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t('install.title')}</p>
            <p className="text-xs text-muted-foreground">{t('install.body')}</p>
          </div>

          {/* iOS can't be installed from a button, so don't promise a download */}
          <Button
            size="sm"
            onClick={() => (canPrompt ? void install() : setShowIOS(true))}
            className="shrink-0"
          >
            {canPrompt ? <Download className="size-4" /> : <SquarePlus className="size-4" />}
            {canPrompt ? t('install.action') : t('install.howTo')}
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
        <DialogContent data-testid="install-ios-dialog" data-browser={iosBrowser ?? undefined}>
          <DialogHeader>
            <DialogTitle>{inapp ? t('install.inappTitle') : t('install.iosTitle')}</DialogTitle>
            <DialogDescription>
              {inapp
                ? t('install.inappBody')
                : iosBrowser === 'browser'
                  ? t('install.iosBodyBrowser')
                  : t('install.iosBody')}
            </DialogDescription>
          </DialogHeader>

          {inapp ? (
            <ol className="space-y-3 text-sm">
              <Step n={1} icon={<Compass className={iconClass} />}>
                {t('install.inappStep1')}
              </Step>
              <Step n={2} icon={<SquarePlus className={iconClass} />}>
                {t('install.inappStep2')}
              </Step>
            </ol>
          ) : (
            <ol className="space-y-3 text-sm">
              <Step n={1} icon={<Share className={iconClass} />}>
                {iosBrowser === 'browser' ? t('install.iosStep1Browser') : t('install.iosStep1')}
              </Step>
              <Step n={2} icon={<SquarePlus className={iconClass} />}>
                {t('install.iosStep2')}
              </Step>
              <Step n={3} icon={<ToggleRight className={iconClass} />}>
                {t('install.iosStep3')}
              </Step>
            </ol>
          )}

          <div className="space-y-2 border-t pt-3">
            {/* Telegram's in-app Safari looks like Safari but can't install */}
            {!inapp && <p className="text-xs text-muted-foreground">{t('install.iosFallback')}</p>}
            <Button variant="outline" size="sm" onClick={() => void copyLink()} className="w-full">
              <Copy className="size-4" />
              {t('install.copyLink')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
