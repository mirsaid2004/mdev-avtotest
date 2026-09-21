import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Monitor, Moon, Sun, Trash2 } from 'lucide-react'
import { LANGUAGES } from '@/shared/config'
import { useLanguage } from '@/shared/i18n/useLanguage'
import { useTheme, type Theme } from '@/app/providers'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { Label } from '@/shared/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { cn } from '@/shared/lib'
import { isStorageAvailable, useProgress } from '@/entities/progress'

const THEMES: { value: Theme; icon: React.ReactNode; key: string }[] = [
  { value: 'light', icon: <Sun className="size-4" />, key: 'theme.light' },
  { value: 'dark', icon: <Moon className="size-4" />, key: 'theme.dark' },
  { value: 'system', icon: <Monitor className="size-4" />, key: 'theme.system' },
]

export function SettingsPage() {
  const { t } = useTranslation()
  const { language, setLanguage } = useLanguage()
  const { theme, setTheme } = useTheme()
  const { reset, attempts } = useProgress()
  const [confirmReset, setConfirmReset] = useState(false)

  const storageOk = isStorageAvailable()

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t('nav.settings')}</h1>

      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('language.label')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          {LANGUAGES.map((l) => (
            <Button
              key={l.code}
              variant={language === l.code ? 'default' : 'outline'}
              onClick={() => setLanguage(l.code)}
              className="justify-start"
            >
              {l.nativeLabel}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('theme.label')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-2">
          {THEMES.map((x) => (
            <Button
              key={x.value}
              variant={theme === x.value ? 'default' : 'outline'}
              onClick={() => setTheme(x.value)}
              className="flex-col gap-1 py-4 h-auto"
            >
              {x.icon}
              <span className="text-xs">{t(x.key)}</span>
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('settings.data')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Label className="text-sm">{t('settings.savedLocally')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('settings.attemptsOnDevice', { count: attempts.length })}
              </p>
            </div>
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                storageOk ? 'bg-correct-muted text-correct' : 'bg-incorrect-muted text-incorrect',
              )}
            >
              {storageOk ? t('settings.storageOk') : t('settings.storageUnavailable')}
            </span>
          </div>

          {!storageOk && (
            <p className="rounded-lg bg-incorrect-muted p-3 text-xs text-incorrect">
              {t('settings.storageBlocked')}
            </p>
          )}

          <Button variant="destructive" className="w-full" onClick={() => setConfirmReset(true)}>
            <Trash2 className="size-4" />
            {t('settings.reset')}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.resetTitle')}</DialogTitle>
            <DialogDescription>{t('settings.resetBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmReset(false)}>
              {t('action.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                reset()
                setConfirmReset(false)
                toast.success(t('settings.resetDone'))
              }}
            >
              {t('settings.reset')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
