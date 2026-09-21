/** Single source of truth for paths - nothing should hardcode a URL string. */
export const ROUTES = {
  home: '/',
  tests: (size: 10 | 20 | ':size' = ':size') => `/tests/${size}`,
  test: (id = ':testId') => `/test/${id}`,
  results: (id = ':attemptId') => `/results/${id}`,
  bank: '/bank',
  stats: '/stats',
  settings: '/settings',
} as const
