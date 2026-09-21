import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Offers a reload when a new version has been precached.
 *
 * registerType is 'prompt', not 'autoUpdate': swapping the app out from under
 * someone mid-exam would lose their session. They choose when.
 *
 * There is no "ready to work offline" toast here on purpose. Only the app
 * shell, bundle and question bank are precached - images are cached only as
 * they're actually viewed, so "ready for offline" would overclaim exactly the
 * gap users hit first: a test page or an uncached image before it's ever been
 * seen online. Silence is more honest than a banner that oversells it.
 */
export function UpdatePrompt() {
  const { t } = useTranslation()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (!needRefresh) return
    toast(t('install.updateTitle'), {
      description: t('install.updateBody'),
      duration: Infinity,
      action: {
        label: t('install.updateAction'),
        onClick: () => void updateServiceWorker(true),
      },
      onDismiss: () => setNeedRefresh(false),
    })
  }, [needRefresh, setNeedRefresh, updateServiceWorker, t])

  return null
}
