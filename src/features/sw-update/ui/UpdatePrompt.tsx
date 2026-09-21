import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Offers a reload when a new version has been precached.
 *
 * registerType is 'prompt', not 'autoUpdate': swapping the app out from under
 * someone mid-exam would lose their session. They choose when.
 */
export function UpdatePrompt() {
  const { t } = useTranslation()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (!offlineReady) return
    toast.success(t('install.offlineReady'), { duration: 4000 })
    setOfflineReady(false)
  }, [offlineReady, setOfflineReady, t])

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
