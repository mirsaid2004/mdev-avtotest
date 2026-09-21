import { useEffect, useState } from 'react'

/**
 * Reactive navigator.onLine - a plain read is only a snapshot at render time,
 * so anything that needs to react to connectivity changing while mounted
 * (an image placeholder deciding what to say, a retry button deciding whether
 * to bother) needs the live browser events instead.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}
