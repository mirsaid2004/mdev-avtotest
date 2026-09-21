/**
 * Image host. Falls back to e-avtomaktab's own server so the app runs before
 * R2 is wired up; set VITE_IMG_BASE to the R2 domain to switch over.
 */
const IMG_BASE = (
  import.meta.env.VITE_IMG_BASE ?? 'https://e-avtomaktab.uz/storage/tests'
).replace(/\/$/, '')

/** Questions store a bare filename; this is the only place a URL is built. */
export function imageUrl(media: string | null | undefined): string | null {
  if (!media) return null
  return `${IMG_BASE}/${media.split('/').pop()}`
}

export const DATA_URLS = {
  questions: '/data/questions.json',
  tests: '/data/tests.json',
} as const
