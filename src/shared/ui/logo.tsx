import { useId } from 'react'
import { cn } from '@/shared/lib'

/**
 * App mark: a road in perspective.
 *
 * The gradient id is generated per instance. Several Logos render at once (nav,
 * dashboard, install card) and a hardcoded id would collide - url(#id) then
 * resolves to whichever element happens to be first in the document, which
 * breaks when that one lives in a `display:none` subtree.
 */
export function Logo({ className, badge = true }: { className?: string; badge?: boolean }) {
  const gradientId = useId()

  return (
    <svg
      viewBox="0 0 512 512"
      className={cn('size-8', className)}
      role="img"
      aria-label="MDEV-Avtotest"
    >
      {badge ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#4f8ef7" />
              <stop offset="1" stopColor="#2050c8" />
            </linearGradient>
          </defs>
          <rect width="512" height="512" rx="114" fill={`url(#${gradientId})`} />
          <path d="M150 400 L214 150 L298 150 L362 400 Z" fill="#fff" opacity="0.97" />
          <g fill="#2050c8">
            <rect x="244" y="163" width="24" height="34" rx="12" />
            <rect x="240" y="223" width="32" height="46" rx="16" />
            <rect x="234" y="296" width="44" height="62" rx="22" />
          </g>
        </>
      ) : (
        <>
          {/* flat variant: road in the current text colour, dashes knocked out */}
          <path d="M150 400 L214 150 L298 150 L362 400 Z" fill="currentColor" />
          <g fill="var(--background)">
            <rect x="244" y="163" width="24" height="34" rx="12" />
            <rect x="240" y="223" width="32" height="46" rx="16" />
            <rect x="234" y="296" width="44" height="62" rx="22" />
          </g>
        </>
      )}
    </svg>
  )
}
