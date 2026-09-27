import { useCallback, useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window {
    /** stashed by the inline script in index.html - see the comment there */
    __installPrompt: BeforeInstallPromptEvent | null
  }
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari predates the standard and uses its own flag
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports itself as a Mac, but a Mac has no touch points
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  )
}

/**
 * Which kind of iOS browser we're in - it decides what the install dialog says.
 *
 * - `safari`: Share -> "Add to Home Screen".
 * - `browser`: Chrome, Firefox, Edge... Since iOS 16.4 they can add to the
 *   home screen too, but their Share button lives in the address bar.
 * - `inapp`: a webview inside Telegram, Instagram, the Google app etc. These
 *   have no "Add to Home Screen" at all - the page has to be opened in Safari.
 *
 * Telegram's default "In-App Safari" is an SFSafariViewController, whose user
 * agent is identical to Safari's, so it reads as `safari` here. It can't add
 * to the home screen either, which is why the Safari instructions end with an
 * "open it in Safari" fallback rather than trusting this.
 */
export type IOSBrowser = 'safari' | 'browser' | 'inapp'

function detectIOSBrowser(): IOSBrowser {
  const ua = navigator.userAgent
  if (/FBAN|FBAV|Instagram|Telegram|Line\/|TikTok|musical_ly|Snapchat|GSA\//.test(ua)) return 'inapp'
  if (/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|DuckDuckGo/.test(ua)) return 'browser'
  // an embedded WKWebView drops the trailing "Safari/xxx" token real browsers send
  if (!/Safari\//.test(ua)) return 'inapp'
  return 'safari'
}

/**
 * Drives the install card.
 *
 * Chromium fires `beforeinstallprompt` and lets us trigger the native dialog.
 * iOS Safari does neither - it can install, but only through the share sheet -
 * so there we detect the platform and show instructions instead. Anything
 * already installed, or dismissed, shows nothing - dismissal only lasts for
 * the current page load and resets on refresh.
 */
export function useInstallPrompt() {
  // the event may already have fired before React mounted, in which case the
  // inline script in index.html holds it
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    () => (typeof window === 'undefined' ? null : window.__installPrompt),
  )
  const [installed, setInstalled] = useState(isStandalone)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      // stop Chrome's own mini-infobar; we render the invitation ourselves
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
      window.__installPrompt = null
    }

    // the inline script re-announces a prompt it caught before we mounted
    const onReady = () => setDeferred(window.__installPrompt)

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('installpromptready', onReady)
    window.addEventListener('appinstalled', onInstalled)

    // close the gap between reading the stash in useState and attaching the
    // listeners here: an event landing in between would otherwise be lost
    if (window.__installPrompt) setDeferred(window.__installPrompt)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('installpromptready', onReady)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!deferred) return false
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    setDeferred(null)
    window.__installPrompt = null
    return outcome === 'accepted'
  }, [deferred])

  const dismiss = useCallback(() => {
    setDismissed(true)
  }, [])

  const ios = isIOS()
  const iosBrowser = ios ? detectIOSBrowser() : null

  return {
    /** the native dialog is available */
    canPrompt: Boolean(deferred),
    /** iOS can install, but only via the share sheet - show instructions */
    needsIOSInstructions: ios && !installed,
    /** which iOS instructions to show; null off iOS */
    iosBrowser,
    installed,
    dismissed,
    visible: !installed && !dismissed && (Boolean(deferred) || (ios && !installed)),
    install,
    dismiss,
  }
}
