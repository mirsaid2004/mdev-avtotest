import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // created in state so StrictMode's double-render doesn't make two clients
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // the bank ships with the deploy; nothing to revalidate against
            staleTime: Infinity,
            gcTime: Infinity,
            refetchOnWindowFocus: false,
            retry: 1,
            /**
             * Default 'online' networkMode means: if the browser has already
             * fired an 'offline' event this session, a query that has never
             * fetched before refuses to even try - it sits in fetchStatus
             * 'paused' until the browser reports online again, never even
             * reaching the service worker that actually has the answer.
             *
             * 'offlineFirst' fixes the common case (first attempt always
             * fires) but still pauses a failed RETRY while offline - so a
             * genuine cache miss (corrupted install, evicted storage) hangs
             * the same way, just less often. Every fetch here goes through
             * the service worker regardless of navigator.onLine, so nothing
             * should ever be gated on it: 'always' runs every attempt,
             * succeeding from cache when the SW has it, or failing fast and
             * landing on isError when it genuinely doesn't.
             */
            networkMode: 'always',
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={client}>
      {children}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
