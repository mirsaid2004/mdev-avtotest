# Codebase Reference

Complete reference for every source file in MDEV-Avtotest: what it exports,
what each function/component does, its parameters and return value, and any
non-obvious behaviour worth knowing before touching it. Organised by
Feature-Sliced Design layer, outermost (`app`) to innermost (`shared`), then
`entities` → `features` → `widgets` → `pages`, then build scripts and config.

Two rules the whole codebase follows, referenced repeatedly below instead of
re-explained each time:

- **Nothing outside `entities/progress` touches `localStorage`.**
- **Nothing outside `shared/config/env.ts` builds an image URL.**

---

## Entry point

### `index.html`

The HTML shell. Notable pieces:

- An inline `<script>` in `<head>`, running before any module script,
  that catches `beforeinstallprompt` early and stashes it on
  `window.__installPrompt` — see [Bugfix #10](./BUGFIX_HISTORY.md#10-the-install-prompt-could-be-missed-entirely).
- A second inline `<script>` that applies the stored theme
  (`localStorage['eavtomaktab:theme']`) to `<html class="dark">` **before
  first paint**, so there's no light-mode flash when the stored preference is
  dark.
- PWA meta tags: icons, `apple-mobile-web-app-*`, `theme-color` for both
  colour schemes.

### `src/main.tsx`

```ts
createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>,
)
```

Throws synchronously if `#root` is missing from the DOM — a deliberate loud
failure rather than a silent no-op. Imports the global stylesheet
(`@/app/styles/index.css`).

---

## `app/` — composition root

### `app/providers/index.tsx`

**`AppProviders({ children })`** — the single provider tree every route
renders inside, nested in this exact order (outer → inner):

```
I18nextProvider → ThemeProvider → QueryProvider → ProgressProvider
  → TooltipProvider → Suspense → children, Toaster, UpdatePrompt
```

Order matters: `ProgressProvider` reads/writes storage independent of theme
or query state, so it can sit anywhere relative to those two, but
`TooltipProvider` must wrap anything using shadcn's `Tooltip` (used by the
activity heatmap). `UpdatePrompt` and `Toaster` are rendered as siblings of
`children` (not wrapping them) since they're both invisible-until-triggered
overlays.

Also re-exports `useTheme` and the `Theme` type from `./ThemeProvider`, so
consumers only ever need to import from `@/app/providers`.

### `app/providers/ThemeProvider.tsx`

**`type Theme = 'light' | 'dark' | 'system'`**

**`ThemeProvider({ children })`** — owns the theme state machine.

- `readStored()`: reads `localStorage['eavtomaktab:theme']`, guarded by
  try/catch, falling back to `'system'` if storage is blocked or the value is
  invalid.
- `prefersDark()`: reads `matchMedia('(prefers-color-scheme: dark)').matches`.
- Tracks `theme` (the user's explicit choice) and `systemDark` (the live OS
  preference, updated via a `matchMedia` change listener) separately, then
  derives `resolvedTheme = theme === 'system' ? (systemDark ? 'dark' :
  'light') : theme` — this is "what's actually on screen."
- An effect toggles the `dark` class on `document.documentElement` and sets
  `style.colorScheme` whenever `resolvedTheme` changes.
- `setTheme(next)` updates state and persists to `localStorage`, swallowing
  write failures (theme just won't survive a reload if storage is blocked).

**`useTheme()`** — reads the context; throws if called outside
`<ThemeProvider>`, by design (fail loud on a wiring mistake rather than
silently defaulting).

### `app/providers/QueryProvider.tsx`

**`QueryProvider({ children })`** — wraps the app in a single `QueryClient`,
created once via `useState(() => new QueryClient(...))` (not a module-level
singleton, and not re-created on every render — the lazy initializer avoids
both problems, including React StrictMode's double-invoke).

Global `defaultOptions.queries`:

| Option | Value | Why |
|---|---|---|
| `staleTime` | `Infinity` | The bank ships with the deploy; nothing to revalidate against. |
| `gcTime` | `Infinity` | Never garbage-collect the cached bank while the tab is open. |
| `refetchOnWindowFocus` | `false` | Same reason as `staleTime`. |
| `retry` | `1` | One retry on failure, not the default 3. |
| `networkMode` | `'always'` | See [Bugfix #19](./BUGFIX_HISTORY.md#19-tanstack-querys-default-networkmode-made-offline-navigation-hang-forever) — every fetch here is answered by the service worker regardless of `navigator.onLine`, so nothing should ever be gated on that flag. |

Renders `<ReactQueryDevtools>` only when `import.meta.env.DEV`.

### `app/router/index.tsx`

**`AppRouter()`** — renders `<RouterProvider router={router}>` for a
`createBrowserRouter` tree.

Route tree:

```
/test/:testId              -> <TestPage />            (outside AppLayout)
/                (AppLayout)
  /                         -> <HomePage />
  /tests                    -> redirect to /tests/20
  /tests/:size               -> <TestsPage />
  /results/:attemptId        -> <ResultsPage />
  /bank                      -> <BankPage />
  /stats                     -> <StatsPage />
  /settings                  -> <SettingsPage />
  *                          -> <NotFoundPage />
```

`/test/:testId` deliberately sits **outside** `<AppLayout>` — the solver
owns the full screen; a persistent tab bar during a timed exam risks an
accidental navigation losing progress.

All pages are **statically imported**, not `React.lazy()`'d — see
[Bugfix #21](./BUGFIX_HISTORY.md#21-lazy-loaded-routes-crashed-on-webkit-when-navigated-to-offline)
for why: dynamic `import()` for a route visited for the first time has to be
served from the service worker cache, and WebKit can fail that specific
operation while offline. The whole app is ~265 KB gzip as one bundle, cheap
enough that static imports eliminate the failure class entirely.

### `app/router/routes.ts`

**`ROUTES`** — the single source of truth for every path in the app; nothing
elsewhere should hardcode a URL string.

```ts
ROUTES.home                          // '/'
ROUTES.tests(20 | 10 | ':size')      // '/tests/20', '/tests/10', or the route pattern
ROUTES.test(id?)                     // '/test/:testId' or '/test/t20-5' etc.
ROUTES.results(id?)                  // same pattern for '/results/:attemptId'
ROUTES.bank                          // '/bank'
ROUTES.stats                         // '/stats'
ROUTES.settings                      // '/settings'
```

`tests`, `test`, and `results` are functions rather than plain strings so the
same helper produces both the route's **pattern** (for `createBrowserRouter`,
called with no argument) and a **concrete link** (called with a real id).

---

## `shared/` — no dependency on any other layer

### `shared/config/languages.ts`

```ts
LANGUAGES: { code, label, nativeLabel }[]   // uzb, uzc, ru
type LanguageCode = 'uzb' | 'uzc' | 'ru'
DEFAULT_LANGUAGE: LanguageCode = 'uzb'
LANGUAGE_CODES: LanguageCode[]
```

The canonical list of languages the *question bank* and the *UI* both
support. Karakalpak (`kaa`) was deliberately removed — see
[Bugfix History §7](./BUGFIX_HISTORY.md#7-netlify-deploy-served-html-instead-of-the-question-bank)
(24% untranslated in the source data) — so adding a language back here means
adding it to every locale JSON file too, not just this list.

### `shared/config/env.ts`

**`imageUrl(media: string | null | undefined): string | null`** — the
**only** place in the app that builds a question-image URL. Takes a bare
filename (or a full URL, from which it extracts the filename) and resolves
it against `IMG_BASE`.

`IMG_BASE` reads `import.meta.env.VITE_IMG_BASE`, falling back to
`https://e-avtomaktab.uz/storage/tests` if unset — so the app runs correctly
before a CDN (e.g. Cloudflare R2) is provisioned, and switches over with a
single environment variable once one is.

**`DATA_URLS`** — `{ questions: '/data/questions.json', tests:
'/data/tests.json' }`, the two static files the app fetches at runtime.

### `shared/config/rules.ts`

All exam/timing constants live here — the single file to change if the
actual exam rules change.

```ts
type TestMode = 'training' | 'exam' | 'practice'

EXAM = { questionCount: 20, durationMs: 25min, maxMistakes: 2 }
TEST_DURATION_MS = { 20: 25min, 10: 12min }
TIMER_WARN_MS = 5min      // timer turns amber
TIMER_DANGER_MS = 1min    // timer turns red
MASTERY_STREAK = 3        // consecutive correct answers to count as "mastered"
AUTO_ADVANCE_MS = 700     // delay before a correct answer advances to the next question
PRACTICE_SIZE = 20        // questions per practice drill
```

**`durationForMode(mode, size): number`** — exam is always 25 min regardless
of `size`; practice is `0` (untimed — drilling shouldn't be stressful);
training uses `TEST_DURATION_MS[size]`.

**`isExamPass(wrongCount): boolean`** — `wrongCount <= EXAM.maxMistakes`.
Training modes are never graded (their `AttemptRecord.passed` is always
`null`), so this is only ever called for exam attempts.

### `shared/config/index.ts`

Barrel: re-exports everything from `languages.ts`, `env.ts`, `rules.ts`.
Everything else imports from `@/shared/config`, never from the individual
files directly.

### `shared/i18n/index.ts`

Initialises `i18next` with `react-i18next` and
`i18next-browser-languagedetector`. Loads all three locale bundles
(`uzb/common.json`, `uzc/common.json`, `ru/common.json`) as static imports —
they're small JSON files, no lazy-loading needed.

Key config: `fallbackLng: DEFAULT_LANGUAGE`, `supportedLngs:
LANGUAGE_CODES`, `nonExplicitSupportedLngs: true` (so `en-US` etc. don't
break detection), language detection order `['localStorage', 'navigator']`
with the storage key `eavtomaktab:lang` (exported as
`LANGUAGE_STORAGE_KEY`).

The UI language and the *question bank's* language are the same setting —
this file's comment states the constraint explicitly: it "has to be one of
the four \[now three] the data actually carries."

### `shared/i18n/useLanguage.ts`

**`useLanguage(): { language: LanguageCode, setLanguage: (code) => void }`**

Bridges `react-i18next`'s resolved language to a guaranteed-valid
`LanguageCode`. Components read question text as `q.text[language]` —
this hook's entire purpose is making sure that lookup can never be
`undefined`, by falling back to `DEFAULT_LANGUAGE` if i18next's resolved
language isn't one of the three the bank actually has.

### `shared/lib/cn.ts`

**`cn(...inputs: ClassValue[]): string`** — `twMerge(clsx(inputs))`. Standard
shadcn utility: combines conditional class logic (`clsx`) with Tailwind
class conflict resolution (`tailwind-merge`, so e.g. a later `p-4` correctly
overrides an earlier `p-2` instead of both applying).

### `shared/lib/shuffle.ts`

**`shuffle<T>(items: readonly T[]): T[]`** — Fisher-Yates shuffle, returns a
new array, does not mutate the input.

**`sample<T>(items: readonly T[], count: number): T[]`** — `shuffle(items).
slice(0, count)`. Used for exam's random 20-question draw and practice's
filler questions. **Not memoised or seeded** — every call produces a
different result, which is why callers that need a *stable* result across
re-renders must pin it themselves (see
[Bugfix #20](./BUGFIX_HISTORY.md#20-exam-and-practice-question-sets-silently-re-randomised-after-every-single-answer)).

### `shared/lib/useOnlineStatus.ts`

**`useOnlineStatus(): boolean`** — reactive `navigator.onLine`. A plain read
of `navigator.onLine` is only a snapshot at render time; this hook subscribes
to the browser's `online`/`offline` events so a component can react to
connectivity changing while mounted (used by `QuestionMedia` to decide which
placeholder message to show, and whether retrying is likely to help).

### `shared/lib/index.ts`

Barrel: `cn`, `shuffle`, `sample`, `useOnlineStatus`.

### `shared/ui/logo.tsx`

**`Logo({ className?, badge? = true }): JSX.Element`** — the app mark, an
SVG road-in-perspective icon.

- `badge = true` (default): full gradient-filled rounded-square badge (used
  in the header, install card, dashboard).
- `badge = false`: flat variant using `currentColor` for the road and
  `var(--background)` for the dashes, for contexts that want the mark without
  its own background (e.g. inline with text in a themed color).

The SVG's `<linearGradient>` id is generated per-instance via `useId()` —
**not hardcoded** — because multiple `<Logo>`s can render on one page
simultaneously (nav header + install card + dashboard heading), and a shared
hardcoded id would have every instance's `url(#id)` resolve to whichever
`<linearGradient>` happens to be first in the DOM, breaking every other
instance if that first one lives in a hidden subtree. See
[Bugfix #11](./BUGFIX_HISTORY.md#11-the-logo-was-invisible-in-light-mode).

### `shared/ui/*.tsx` — shadcn/Radix primitives

`alert.tsx`, `badge.tsx`, `button.tsx`, `card.tsx`, `dialog.tsx`,
`dropdown-menu.tsx`, `label.tsx`, `progress.tsx`, `radio-group.tsx`,
`scroll-area.tsx`, `select.tsx`, `separator.tsx`, `sheet.tsx`,
`skeleton.tsx`, `sonner.tsx`, `switch.tsx`, `tabs.tsx`, `tooltip.tsx`.

These are the standard **shadcn-generated wrappers around Radix UI
primitives** (`components.json` at the repo root configures them to install
into `src/shared/ui` rather than the default `src/components`). Each file
exports a small family of composable parts (e.g. `dialog.tsx` exports
`Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`,
`DialogDescription`, `DialogFooter`), styled via `cva` (class-variance-
authority) variants and Tailwind, themed by the CSS custom properties
defined in `app/styles/index.css` (`--primary`, `--destructive`,
`--correct`, `--incorrect`, etc.).

They are treated as **library code, not application code** — generated by
`npx shadcn add <name>`, not hand-authored — so this reference doesn't
enumerate every prop; consult
[ui.shadcn.com](https://ui.shadcn.com) and Radix's own docs for the full
API. The only local customisation beyond shadcn's defaults is the theme
token wiring in `app/styles/index.css`, plus two app-specific semantic
colour pairs not part of stock shadcn: `--correct`/`--correct-foreground`/
`--correct-muted` and `--incorrect`/`--incorrect-foreground`/
`--incorrect-muted`, used throughout the solver, results, and stats pages
for answer feedback.

---

## `entities/` — depends only on `shared/`

### `entities/progress/model/types.ts`

The full shape of everything saved to `localStorage`.

```ts
interface QuestionStat {
  seen: number       // times shown
  correct: number    // times answered correctly
  streak: number      // consecutive correct answers - drives "mastered"
  lastAt: number       // epoch ms of the last answer
}

interface DayActivity {          // one calendar day, local time, keyed 'YYYY-MM-DD'
  answered: number
  correct: number
  seconds: number               // time spent, feeds "time studied"
}

interface AttemptRecord {
  id: string
  testId: string                 // TestTemplate id, 'exam', or 'practice'
  mode: TestMode
  startedAt: number
  finishedAt: number
  durationMs: number
  total: number
  correct: number
  questionIds: number[]          // every question in the attempt, in order
  given: Record<number, number>  // questionId -> the answer actually chosen
  wrongQuestionIds: number[]
  passed: boolean | null         // exam only; null for training/practice
}

interface ActiveSession {         // a test left unfinished
  testId: string
  mode: TestMode
  questionIds: number[]
  answers: Record<number, number>
  flagged: number[]
  index: number
  startedAt: number
  remainingMs: number             // 0 means untimed
}

interface ProgressState {
  version: number                 // currently 2
  stats: Record<number, QuestionStat>
  attempts: AttemptRecord[]
  daily: Record<string, DayActivity>
  activeSession: ActiveSession | null
}
```

**`PROGRESS_VERSION = 2`**

**`emptyProgress(): ProgressState`** — the zero-value state, used on first
load and after a reset.

**`dayKey(at?: number | Date): string`** — formats a timestamp as
`'YYYY-MM-DD'` **in local time** (not UTC) — this matters: using UTC would
shift the heatmap for anyone studying late at night relative to UTC
midnight.

### `entities/progress/lib/storage.ts`

The **only** module in the app that calls `localStorage` directly.

**`loadProgress(): ProgressState`** — reads the `eavtomaktab:progress` key,
`JSON.parse`s it, and passes it through `migrate()`. Wrapped in try/catch:
any failure (private browsing, corrupted JSON, blocked storage) returns
`emptyProgress()` rather than throwing.

**`migrate(raw: unknown): ProgressState`** *(internal)* — version-aware
upgrade path. `version === 1` blobs (which predate `daily` and
`activeSession`) are upgraded in place, filling in the new fields with
sensible defaults while **preserving existing `stats` and `attempts`** —
the comment is explicit that wiping a user's progress because the schema
changed is unacceptable. Any other unrecognised version falls back to
`emptyProgress()`.

**`saveProgress(state): boolean`** — `JSON.stringify` + `setItem`, guarded;
returns `false` (rather than throwing) if the write fails, e.g. quota
exceeded.

**`clearProgress(): void`** — removes the key, guarded.

**`isStorageAvailable(): boolean`** — probes by writing and immediately
removing a throwaway key; used by the Settings page to show a "storage
unavailable" warning.

### `entities/progress/model/ProgressContext.tsx`

**`ProgressProvider({ children })`** — the single global store for
everything progress-related. See
[Bugfix #5](./BUGFIX_HISTORY.md#5-an-answer-given-immediately-before-navigating-away-could-be-lost)
and
[#6](./BUGFIX_HISTORY.md#6-persisting-the-session-caused-an-infinite-render-loop-that-froze-every-button)
for the two bugs found in this file's state-update mechanics.

Internal design:

- `state` (React state) holds the current `ProgressState`.
- `latest` (a `useRef`) mirrors `state`, but is updated **synchronously
  inside `apply()`**, not during render — critical, because a render can be
  preempted by navigation, and the `pagehide` flush handler below needs the
  truly-current value at that exact moment, not whatever the last committed
  render happened to be.
- **`apply(fn: (prev) => next)`** *(internal)* — the single choke point every
  mutator goes through: computes `next`, assigns `latest.current = next`
  synchronously, then calls `setState(next)`.

Two persistence effects:

- A debounced write (250ms `setTimeout`) fires `saveProgress(state)` whenever
  `state` changes — so a fast tap-through doesn't serialise the whole blob on
  every single answer.
- A `pagehide`/`visibilitychange` listener flushes `saveProgress(latest.
  current)` immediately, bypassing the debounce, so closing the tab
  mid-answer doesn't lose that answer.

**`streaksFrom(daily)`** *(internal)* — walks the sorted day keys, counting
the current consecutive-day streak backward from today (today not yet being
active doesn't break the streak until tomorrow) and the longest streak ever
seen in the data.

Public mutators (all go through `apply`):

- **`recordAnswer(questionId, correct, seconds = 0)`** — updates that
  question's `QuestionStat` (increments `seen`, `correct` if applicable,
  resets or increments `streak`) and today's `DayActivity` in one atomic
  update.
- **`recordAttempt(attempt: Omit<AttemptRecord, 'id'>): AttemptRecord`** —
  generates an id (`${startedAt}-${random}`), prepends to `attempts`
  (capped at 500, oldest dropped), clears `activeSession`, and returns the
  full record (the caller — `useTestSession.submit()` — needs the id to
  redirect to the results page).
- **`setActiveSession(session: ActiveSession | null)`** — replaces the
  in-progress test snapshot.
- **`reset()`** — clears storage and resets to `emptyProgress()`, updating
  both `latest.current` and `state` immediately (not via `apply`, since
  there's no previous state to fold in).

Derived values (`useMemo`'d on `[state.stats, state.daily]` only — **not**
on the whole `state` object, so `setActiveSession` calls don't trigger a
recompute):

- `weakIds: number[]` — question ids answered wrong at some point and not
  yet at `MASTERY_STREAK`, sorted worst-accuracy-first, then
  least-recently-practised. This is the value at the center of
  [Bugfix #20](./BUGFIX_HISTORY.md#20-exam-and-practice-question-sets-silently-re-randomised-after-every-single-answer) —
  it legitimately changes after every answer, and consumers must pin their
  own derived state rather than reacting to it directly for anything that
  must stay stable mid-session.
- `mastered`, `seen`, `accuracy`, `currentStreak`, `longestStreak`,
  `activeDays`.

**`useProgress()`** — reads the context; throws if called outside
`<ProgressProvider>`.

### `entities/progress/index.ts`

Barrel: re-exports the types, `dayKey`, `emptyProgress`, `ProgressProvider`,
`useProgress`, and the raw storage functions (`loadProgress`,
`saveProgress`, `clearProgress`, `isStorageAvailable` — exposed mainly for
the Settings page's storage-health check).

### `entities/question/model/types.ts`

```ts
type Localized = Record<LanguageCode, string>   // every string exists in all 3 languages

interface Answer {
  id: number
  text: Localized
  media: string | null    // bare filename; almost always null for answers
}

interface Question {
  id: number
  text: Localized
  media: string | null    // bare filename, resolved via imageUrl()
  answerId: number         // guaranteed to match one of `answers[].id`
  answers: Answer[]
  sort: number | null
}
```

### `entities/question/api/questionsApi.ts`

**`fetchQuestions(): Promise<Question[]>`** — `fetch('/data/questions.json')`,
throws with the HTTP status on a non-ok response. That's the entirety of the
function; all caching/retry policy lives in the React Query layer that calls
it.

### `entities/question/model/useQuestions.ts`

**`questionsQueryKey = ['questions']`**

**`useQuestions()`** — a `useQuery` wrapping `fetchQuestions`, `staleTime:
Infinity`, `gcTime: Infinity` (the bank is static for the life of the
deploy).

**`useQuestionMap()`** — returns `{ ...query, map: Map<number, Question> }`.
The `Map` is built via `useMemo` keyed on `query.data`'s identity (**not**
rebuilt on every render — see
[Bugfix #4](./BUGFIX_HISTORY.md#4-usequestionmap-returned-a-new-map-identity-on-every-render)
for why that distinction matters), falling back to a module-level `EMPTY`
constant `Map` while data hasn't loaded yet, so `map.size === 0` is a stable
way to check "not ready" without allocating a new empty map every render.

### `entities/question/ui/AnswerOption.tsx`

**`AnswerOption({ label, text, selected, state, disabled, onSelect })`** —
one answer button. Purely presentational; no logic.

- `state: 'correct' | 'incorrect' | null` — `null` means feedback is
  withheld (unanswered, or exam-before-reveal in an earlier design — now
  always revealed once answered, see `useTestSession`).
- Renders the option's letter label (A/B/C/D/E) normally, swapping to a
  check/X icon once `state` is set.
- Exposes `data-testid="answer-option"` and `data-state` (mirroring `state`,
  or `"selected"`/`"idle"`) as stable e2e test hooks.
- `min-h-14 sm:min-h-12` — deliberately generous tap target ("tapped with a
  thumb on a moving bus").

### `entities/question/ui/QuestionMedia.tsx`

**`QuestionMedia({ media, alt })`** — the question image: a tappable
`aspect-video` box that opens a fullscreen pinch-zoomable overlay, with a
dedicated offline-aware failure state. See
[Bugfix #18](./BUGFIX_HISTORY.md#18-questionmedia-silently-vanished-on-a-failed-image-load).

Behaviour:

- `src = imageUrl(media)`; returns `null` outright only if there's no media
  at all (not on a load failure — that's the important distinction from the
  pre-fix behaviour).
- **Loading state:** the `<img>` fades in via `opacity` once `onLoad` fires,
  so there's no layout-shift flash of a broken image icon.
- **Failure state:** if `onError` fires, renders a dashed-border placeholder
  in the same `aspect-video` footprint, with:
  - `useOnlineStatus()`-driven copy: *"image failed to load"* if currently
    online (a genuine, unexpected failure), or *"hasn't been saved for
    offline use yet"* if offline (the expected, common case — 59% of
    questions have images and only those already viewed online are cached).
  - A retry button that resets `failed`/`loaded` and bumps an `attempt`
    counter, which both remounts the `<img>` (via `key={attempt}`) and
    appends `?retry=${attempt}` to the URL to force a genuinely fresh
    network attempt rather than whatever the browser remembers about the
    last failed request for that exact URL.
- **Fullscreen overlay:** a `role="dialog"` full-viewport black backdrop with
  a close button and an `overflow-auto` container around the full-resolution
  `<img>` — pinch-zoom is entirely native browser behaviour, deliberately
  not reimplemented in JS.

`data-testid="question-media"` (the normal tappable image) and
`data-testid="question-media-unavailable"` (the failure placeholder) are
stable e2e hooks.

### `entities/question/ui/QuestionView.tsx`

**`QuestionView({ question, selectedAnswerId, reveal, disabled?, onSelect
})`** — renders one question's media, text, and answer list. Purely
presentational; owns no state.

- `LABELS = ['A', 'B', 'C', 'D', 'E']` — questions have 2–5 answers.
- For each answer, computes its `AnswerOption` `state`: only shown
  (`showFeedback = reveal && answered`) once an answer has actually been
  given, and only if `reveal` is true; then `'correct'` if it's the right
  answer, `'incorrect'` if it's the (wrong) one the user picked, `null`
  otherwise (so only two of up to five options ever show colour).
- Disables every option once `reveal && answered` is true — an answer, once
  revealed, cannot be changed.

### `entities/question/index.ts`

Barrel: `Question`, `Answer`, `Localized` types; `useQuestions`,
`useQuestionMap`, `questionsQueryKey`; `fetchQuestions`; `QuestionView`,
`QuestionMedia`, `AnswerOption`.

### `entities/test/model/types.ts`

```ts
type TestSize = 10 | 20

interface TestTemplate {
  id: string           // e.g. "t20-14" - stable across rebuilds, URL-safe
  size: TestSize
  number: number         // display number, 1..N within its size group
  sourceNumber: number   // e-avtomaktab's own id, kept for traceability
  questionIds: number[]
}
```

`number` vs `sourceNumber`: the 10-question templates carry e-avtomaktab's
internal URL ids (5, 6, …, 356, with gaps) — meaningless to show a student
as "test #356." `scripts/build_data.mjs` renumbers them 1..134 for display
(`number`) while keeping the original id (`sourceNumber`) for traceability
back to the source scrape.

### `entities/test/api/testsApi.ts`

**`fetchTests(): Promise<TestTemplate[]>`** — same shape as
`fetchQuestions`: `fetch('/data/tests.json')`, throws on non-ok.

### `entities/test/model/useTests.ts`

**`testsQueryKey = ['tests']`**

**`useTests(size?: TestSize)`** — `useQuery` with key `[...testsQueryKey,
size ?? 'all']` (so filtering by size doesn't collide with the unfiltered
query in the cache), `select: size ? tests => tests.filter(t => t.size ===
size) : undefined` to filter client-side after a single shared fetch.

### `entities/test/index.ts`

Barrel: `TestTemplate`, `TestSize` types; `useTests`, `testsQueryKey`;
`fetchTests`.

---

## `features/` — one user-facing capability each, depends on `entities/` + `shared/`

### `features/test-session/model/useTestSession.ts`

The single largest and most important hook in the app — drives one test
attempt from start to submitted result. Three real bugs were found and
fixed inside this file's mechanics; see
[#5](./BUGFIX_HISTORY.md#5-an-answer-given-immediately-before-navigating-away-could-be-lost),
[#6](./BUGFIX_HISTORY.md#6-persisting-the-session-caused-an-infinite-render-loop-that-froze-every-button).

**`useTestSession({ testId, mode, questions, durationMs, resume? }):
TestSessionState & actions`**

State it owns:

| Field | Type | Notes |
|---|---|---|
| `index` | `number` | current question position |
| `answers` | `Record<number, number>` | questionId → chosen answerId |
| `flagged` | `Set<number>` | questionIds flagged for review |
| `submitted` | `boolean` | |
| `result` | `AttemptRecord \| null` | set once `submit()` runs |
| `remainingMs` | `number` | 0 if `durationMs <= 0` (practice mode) |
| `paused` | `boolean` | training/practice only |

Derived: `question = questions[index]`, `wrongCount` (recomputed from
`answers` vs `question.answerId` for every question, memoised on
`[questions, answers]`), `answeredCount = Object.keys(answers).length`,
`examFailed = mode === 'exam' && wrongCount > EXAM.maxMistakes`.

**`revealAnswers`** is hardcoded `true` for every mode, including exam — a
deliberate product decision (not a bug): seeing the right answer at the
moment you got one wrong teaches more than exam-realistic silence, and the
pass/fail verdict still only lands at submission.

**Clock mechanics:**

- **Timestamp-based, not tick-counted** — `deadline` (a ref) is an absolute
  `Date.now() + remaining` target; the interval just recomputes `remaining =
  deadline - Date.now()` every 250ms. This means a backgrounded tab (where
  `setInterval` throttles) doesn't drift the perceived remaining time once
  it resumes ticking — the deadline itself never moved.
- **`togglePause()`** — only effective if `canPause` (`mode !== 'exam' &&
  durationMs > 0`). Pausing simply stops the interval effect (guarded by the
  `paused` dependency); resuming rebuilds `deadline.current = Date.now() +
  remainingRef.current`, so paused time is never counted against the clock.
- Hitting zero (`left === 0` inside the tick) calls `submit()` automatically.
- **On resume** (from a persisted `ActiveSession`): `deadline` is rebuilt
  from `resume.remainingMs`, not from `durationMs` fresh — so stepping away
  for a phone call and coming back doesn't reset the clock.

**Persistence (`persist()`):** mirrors the live session into
`useProgress().setActiveSession()`. Two important design choices, both
documented in the source and both the subject of bugfixes:

1. Called with **explicit values** (`persist({ answers: nextAnswers })`)
   from inside the same event handler as the change itself, not from a
   `useEffect` reacting to state — a `useEffect` would persist one render
   late, which is exactly when the `pagehide` flush needs the current value
   (see Bugfix #5's cousin issue).
2. `remainingMs` is read from a ref (`remainingRef`), not from the `state`
   value, because it changes 4×/second and including it as a dependency
   would make `persist`'s identity — and therefore anything depending on
   it — unstable on every tick.
3. The "establish session on mount" effect uses a `useRef` guard
   (`established`) rather than depending on `persist`'s own identity, so it
   truly fires exactly once regardless of how often `persist` is recreated
   (see Bugfix #6).

**`select(answerId)`** — the core answer-handling logic:

- No-ops if there's no current question, the test is submitted, or this
  question already has an answer (an answer locks once given).
- Computes `correct`, records the answer to both local state and
  `useProgress().recordAnswer()`, persists the session.
- **Auto-advance:** if the answer was correct and this isn't the last
  question, schedules a `setTimeout` (`AUTO_ADVANCE_MS` = 700ms) that moves
  to the next index and persists that too. A wrong answer does **not**
  auto-advance — that's the moment worth reading. The timer is tracked in a
  ref (`advanceTimer`) and cancelled by `cancelAutoAdvance()` whenever the
  user navigates manually before it fires, and on unmount.

**`goto(next)` / `next()` / `prev()`** — bounds-checked index navigation;
each cancels any pending auto-advance first (manual navigation should win
over a queued automatic one).

**`toggleFlag()`** — adds/removes the current question from `flagged`,
persists.

**`submit()`** — no-ops if already submitted. Computes `wrongIds`/`correct`
across the whole question set, calls `recordAttempt()` (which returns the
full `AttemptRecord` with its generated id), stores it as `result`. The
caller (`TestSolver`) reacts to `result` changing via an effect to navigate
to the results page — **not** by navigating directly inside `submit()`,
because navigating during a render-triggered call is a React error (the
clock's auto-submit-at-zero path calls `submit()` from inside a `tick()`
that runs inside a `useEffect`, which is a render-adjacent context).

**`restart()`** — wipes the attempt (answers, flags, index, submitted,
result) and starts the *same* question array over — critically, it does not
re-derive a new random set, because `TestPage`'s pinning fix (Bugfix #20)
means `questions` itself never changes mid-session. Rebuilds the clock
deadline from `durationMs` fresh (not from any prior remaining time) and
un-pauses.

**`abandon()`** — cancels any pending auto-advance and clears
`activeSession` entirely (used by "discard" on the exit-confirmation
dialog).

### `features/test-session/index.ts`

Barrel: `useTestSession`.

### `features/question-search/model/useQuestionSearch.ts`

**`type BankFilter = 'all' | 'weak' | 'mastered' | 'unseen' | 'image'`**

**`normalize(value: string): string`** *(internal)* — lowercases, applies
Unicode NFD normalisation and strips combining diacritics, then strips a
handful of apostrophe-like characters (`'`, `'`, `` ` ``, `'`, `'`, `ʻ`,
`ʼ`) that all appear in the source Uzbek text for the same sound (e.g.
`to'g'ri`), so a plain-ASCII-apostrophe or no-apostrophe search still
matches.

**`useQuestionSearch(questions, stats, language)`** —

- `query`/`setQuery`, `filter`/`setFilter` — controlled input state.
- `deferredQuery = useDeferredValue(query)` — search re-renders at *lower
  priority* than the keystroke itself, so typing stays responsive on a
  1353-question haystack even while filtering is in flight.
- `haystack: Map<number, string>` — built once per `[questions, language]`
  via `useMemo`, **not per keystroke**: each question's normalised
  question+answers text, precomputed. Rebuilding 1353 lowercased/
  normalised strings on every character is explicitly called out as "what
  makes naive search feel laggy on a phone."
- `results` — filters `questions` by both the selected `BankFilter`
  (weak/mastered/unseen/has-image, using the same `QuestionStat`/
  `MASTERY_STREAK` logic as elsewhere) and, if there's a query, a substring
  match against the precomputed `haystack`.
- `isStale = query !== deferredQuery` — true while the (lower-priority)
  results are still catching up to what's actually typed; consumers use
  this to dim the list slightly during that gap.

### `features/question-search/index.ts`

Barrel: `useQuestionSearch`, `BankFilter` type.

### `features/install-app/model/useInstallPrompt.ts`

**`isStandalone(): boolean`** *(internal)* — `matchMedia('(display-mode:
standalone)').matches`, or iOS's own `navigator.standalone` flag (which
predates the standard API).

**`isIOS(): boolean`** *(internal)* — user-agent sniffs `iPad|iPhone|iPod`,
plus a special case: iPadOS 13+ reports itself as `Macintosh` in the UA
string, so also checks `navigator.maxTouchPoints > 1` (a real Mac has none)
to distinguish an iPad from an actual Mac.

**`detectIOSBrowser(): IOSBrowser`** *(internal)* — classifies the iOS
browser from the user agent, because each needs different instructions:
`inapp` (Telegram/Instagram/Facebook/Google-app webviews, or any UA missing
the `Safari/` token — these can't add to the home screen at all), `browser`
(`CriOS`, `FxiOS`, `EdgiOS`… — Share button is in the address bar), or
`safari`. Telegram's default "In-App Safari" is indistinguishable from Safari
by UA, which is why the Safari instructions carry an "open in Safari"
fallback.

**`useInstallPrompt()`** — drives everything the install card needs:

- Seeds its `deferred` (the captured `BeforeInstallPromptEvent`) state from
  `window.__installPrompt` — the stash written by `index.html`'s inline
  script — rather than starting `null` and waiting for the event, closing
  the "event fired before React mounted" gap (Bugfix #10).
- Inside the mount effect, **re-checks the stash again** after attaching
  listeners, closing a second, narrower race between the `useState`
  initializer reading it and the effect's listeners actually being attached
  (the second half of Bugfix #10).
- Listens for `beforeinstallprompt` (calls `preventDefault()` to suppress
  Chrome's own mini-infobar — the app renders its own invitation instead),
  a custom `installpromptready` event (dispatched by the inline script when
  it catches the prompt), and `appinstalled` (clears everything and marks
  `installed`).
- **`install(): Promise<boolean>`** — calls the native `.prompt()`, awaits
  `.userChoice`, clears `deferred` and the stash either way, returns whether
  the user accepted.
- **`dismiss()`** — sets `dismissed` for the current page load only; a
  refresh shows the card again.

Returns `{ canPrompt, needsIOSInstructions, iosBrowser, installed, dismissed, visible,
install, dismiss }`. `visible = !installed && !dismissed && (canPrompt ||
needsIOSInstructions)` — the single flag the UI actually checks.

### `features/install-app/ui/InstallCard.tsx`

**`InstallCard()`** — renders nothing (`if (!visible) return null`) unless
there's something to invite the user to do.

- On Chromium/Android: a card with a "Install" button that calls
  `install()` directly.
- On iOS: there is no programmatic install API, so the button reads "How to
  install" (not "Install") and opens a `Dialog` whose content follows
  `iosBrowser`: Share → "Add to Home Screen" → keep "Open as Web App" on
  (Safari, or other browsers with the Share button in the address bar), or
  "open this in Safari" for in-app webviews. Every variant has a "Copy link"
  button for pasting into Safari. `data-testid="install-ios-dialog"` carries
  `data-browser` for e2e.
- A close (✕) button calls `dismiss()`.

`data-testid="install-card"` is the stable e2e hook.

### `features/install-app/index.ts`

Barrel: `InstallCard`, `useInstallPrompt`.

### `features/sw-update/ui/UpdatePrompt.tsx`

**`UpdatePrompt()`** — renders nothing itself; it's a side-effect-only
component mounted once near the root. Uses `useRegisterSW()` from
`virtual:pwa-register/react` (the `vite-plugin-pwa` runtime helper).

When `needRefresh` flips true (a new service worker has finished precaching
and is waiting), shows an infinite-duration `sonner` toast with an
"Yangilash" (Update) action button that calls `updateServiceWorker(true)` —
which triggers the waiting worker to activate and reloads the page.

**Deliberately does not** show an "offline ready" toast — the file's own
comment explains why: only the shell, bundle, and question bank are
precached; images cache only as viewed, so claiming full offline readiness
on install would overclaim exactly the gap users hit first. See
[Bugfix History, "toast removed"](./BUGFIX_HISTORY.md#19-tanstack-querys-default-networkmode-made-offline-navigation-hang-forever)
context around the offline-support fixes.

`registerType: 'prompt'` (set in `vite.config.ts`, not this file) is what
makes `needRefresh` a manual choice rather than auto-applying — swapping the
app out from under someone mid-exam would lose their session.

### `features/sw-update/index.ts`

Barrel: `UpdatePrompt`.

---

## `widgets/` — composed UI blocks, depend on `entities/` + `features/` + `shared/`

### `widgets/test-solver/ui/TestSolver.tsx`

**`TestSolver({ testId, title, mode, questions, durationMs, resume? })`** —
the full-screen test-taking UI. Owns only *presentation* state (which
dialog is open); all session logic comes from `useTestSession`.

Structure: sticky header (exit button, title + position + exam mistake
count, timer) → progress bar → `QuestionSlider` → scrollable `QuestionView`
→ fixed bottom bar (prev / flag / next-or-finish).

Local state: `confirmExit`, `confirmSubmit`, `showCompletion` dialogs, plus
a `completionSeen` ref so dismissing the completion summary doesn't
immediately reopen it.

Two effects worth noting:

- **Result → navigate:** watches `session.result?.id`; when it becomes
  non-null, navigates to `/results/:id` with `replace: true`. This is an
  effect rather than inline navigation specifically because the clock's
  auto-submit-at-zero calls `submit()` from inside a `useEffect`-driven
  `tick()`, and navigating during that render-adjacent call would be a
  React error — see the `useTestSession.submit()` entry above.
- **All-answered → completion summary:** when `answeredCount === total` and
  the summary hasn't been shown yet this attempt, waits 500ms (long enough
  to not feel like it interrupted the last answer's own feedback) then opens
  `CompletionDialog`.

The bottom-bar "Finish" button appears once `isLast || allAnswered` — not
only on the literal last card, so a user who's answered everything out of
order (via the slider) doesn't have to scroll all the way to the end first.

Two confirmation dialogs, both plain shadcn `Dialog`s (not extracted to
their own components, unlike `CompletionDialog`):

- **Exit** — three choices: Continue (closes), Save & leave (navigates home,
  session stays persisted), Discard (calls `session.abandon()` then
  navigates home).
- **Submit** — shows an unanswered-count warning if applicable ("counts as
  wrong"), Cancel or Finish (`finish()` closes the dialog and calls
  `session.submit()` — the navigate-on-result effect above handles getting
  to the results page).

### `widgets/test-solver/ui/CompletionDialog.tsx`

**`CompletionDialog({ open, onOpenChange, total, correct, wrong, isExam,
onReplay, onComplete })`** — the "you've answered everything" summary.
Purely presentational, driven entirely by props.

- Title/description varies by exam-vs-training and, for exam, by whether
  `wrong <= EXAM.maxMistakes` (pass) or not (fail) — computed locally as
  `passed` for display purposes only; the *authoritative* pass/fail lives on
  the `AttemptRecord` once actually submitted.
- Two count tiles (correct in green, wrong in red-if-nonzero-else-neutral),
  each labelled via dedicated `test.correctCount`/`test.wrongCount` i18n
  keys — see [Bugfix #13](./BUGFIX_HISTORY.md#13-completion-dialog-mislabelled-its-own-count-tiles)
  for why those exist separately from `test.correct`/`test.incorrect`.
- **Does not submit by itself.** Explicitly documented: dismissing it (or
  choosing neither button) leaves the test open, so answers can still be
  reviewed via the slider before actually finishing.
- `onReplay`/`onComplete` are passed in by `TestSolver`, which wires them to
  `session.restart()` and `session.submit()` respectively.

`data-testid="completion-dialog"`, `"replay"`, `"complete"` are the stable
e2e hooks.

### `widgets/test-solver/ui/QuestionSlider.tsx`

**`QuestionSlider({ questions, index, answers, flagged, reveal, onSelect
})`** — the horizontal question navigator, built on `swiper/react`. See
Bugfixes
[#14](./BUGFIX_HISTORY.md#14-question-slider-full-bleed-layout-mismatch),
[#15](./BUGFIX_HISTORY.md#15-mouse-wheel-over-the-slider-did-nothing),
[#16](./BUGFIX_HISTORY.md#16-sliders-own-css-override-broke-its-scrolling).

- Wrapped in the same `mx-auto max-w-3xl` container as the rest of the
  page shell, so its overflow/lock behaviour matches what's actually visible
  (not the header's full width).
- `Swiper` config: `slidesPerView="auto"`, `freeMode` (no snap-to-slide —
  these are small number tokens, snapping each one to an edge felt wrong),
  `mousewheel: { forceToAxis: false, releaseOnEdges: true }` (a plain
  vertical wheel scrolls the strip sideways; scrolling hands back to page
  scroll once the strip hits either end), `navigation` wired to two
  external `.slider-prev`/`.slider-next` buttons rendered outside the
  `<Swiper>` itself.
- An effect calls `swiper.slideTo(index - 2, 300)` whenever `index` changes
  from *outside* the strip (prev/next buttons, or the auto-advance timer) —
  keeps the current tab a couple positions from the left edge rather than
  jammed against it.
- Each tab is coloured: unanswered (neutral), answered-not-revealed
  (primary tint — not currently reachable in practice since `reveal` is
  always true, but kept for API completeness), answered-correct (green),
  answered-incorrect (red), with a small amber dot overlay if flagged.
- `role="tablist"`/`role="tab"` for accessibility and as e2e selectors
  (`getByRole('tab')`).

**`ScrollButton({ side })`** *(internal)* — the prev/next chevron buttons.
`hidden sm:flex` (touch devices swipe instead). Swiper itself adds a
`swiper-button-disabled` class to the bound elements at either end of the
strip, styled here to fade out and stop intercepting clicks.

### `widgets/test-solver/ui/TimerDisplay.tsx`

**`formatClock(ms: number): string`** — `M:SS`, floor-safe, always
non-negative (`Math.max(0, ...)`), rounds **up** (`Math.ceil`) so it never
displays `0:00` a moment before the clock has actually hit zero.

**`TimerDisplay({ remainingMs, paused?, canPause?, onTogglePause? })`** —

- `danger` (red, pulsing icon) once `remainingMs <= TIMER_DANGER_MS`
  (1 min); `warn` (amber) once `<= TIMER_WARN_MS` (5 min) and not yet
  `danger`. Both suppressed while `paused`.
- If `canPause` is false (exam mode), renders a plain non-interactive
  `role="timer"` readout with a clock icon.
- If `canPause` is true, renders the **entire timer as a button** —
  tapping it calls `onTogglePause`, and the icon swaps between pause/play
  depending on `paused`. `data-testid="timer"`, `data-paused` are the
  stable e2e hooks (used to distinguish "pausable" from "not" across
  exam vs. training in tests).
- `aria-live="assertive"` only while `danger`, so screen readers announce
  the last minute without being spammed every tick before that.

### `widgets/test-grid/ui/TestGrid.tsx`

**`TestGrid({ size })`** — the grid of test template tiles shown on the
Tests page. See
[Bugfix #17](./BUGFIX_HISTORY.md#17-testgrid-had-no-error-state-at-all)
for the error-state gap this file used to have.

- `useTests(size)` for the template list; `useProgress().attempts` to
  compute each template's **best-ever score** (`best: Map<testId, pct>`,
  the highest `correct/total` ratio across every attempt on that specific
  template).
- **`isPending`** → 24 skeleton tiles.
- **`isError`** → an `Alert` with a translated message and a `refetch()`-
  wired retry button (`isRefetching` disables it mid-retry).
- Otherwise: one tile per template, linking to `/test/:id`, coloured by
  attempt status — plain (never attempted), primary-tinted (attempted, not
  perfect), green with a check badge (100%).

### `widgets/activity-heatmap/ui/ActivityHeatmap.tsx`

**`ActivityHeatmap({ daily })`** — the GitHub-style 53-week contribution
grid. See
[Bugfix #12](./BUGFIX_HISTORY.md#12-activity-heatmap-colours-were-nearly-invisible)
for both halves of the bug this component originally had.

**`levelFor(answered: number): 0 | 1 | 2 | 3 | 4`** *(internal, module-
level)* — bucket thresholds calibrated to real sessions: `<5 → 1, <10 → 2,
<20 → 3, else → 4`. A 10-question test lands at level 3, a full
20-question test at level 4.

**`LEVEL_CLASS`** *(internal, module-level)* — `['bg-muted', 'bg-primary/
40', 'bg-primary/60', 'bg-primary/80', 'bg-primary']`, indexed by
`levelFor()`'s return value. The minimum non-zero opacity (40%) was raised
from an original 25% specifically because the fainter value was
indistinguishable from empty at a glance.

Layout computation (`useMemo` on `[daily]`):

- Builds 53 weeks of `{ date, key, activity }` columns, Sunday-first,
  starting from `subDays(today, 53*7 - 1)`.
- Derives one month label per column where the month actually changes,
  positioned absolutely at `col * 14` px.
- Sums `total` answered across the whole visible range for the header line.

**Auto-scroll on mount:** an effect sets `scrollRef.current.scrollLeft =
scrollWidth` immediately after render — without this, the grid (which
renders oldest-week-first, left-aligned, and is wider than its container)
opens showing last year's early months with the *current* week scrolled
off the right edge entirely invisible. This was the actual root cause
behind the "my activity isn't showing" report, once the colour-opacity fix
alone didn't resolve it.

Each day cell: `data-level` (the bucket, used directly by e2e tests rather
than parsing computed styles) and, for today specifically, `data-
testid="heatmap-today"` plus a ring outline, so it's findable at a glance
(and by tests) in a 371-cell grid. Wrapped in a `Tooltip` showing the exact
count and accuracy for that day.

### `widgets/app-layout/AppLayout.tsx`

**`NAV`** *(internal, module-level)* — the five top-level destinations
(Home, Tests, Bank, Stats, Settings), each with a route, icon, i18n key, and
either `exact: true` (Home only matches `pathname === '/'`) or a `match`
prefix (Tests matches any `/tests/*` path, not just the redirect target).

**`AppLayout()`** — the shell every page renders inside via `<Outlet />`
(except the solver, which sits outside this layout entirely — see
`app/router/index.tsx`).

- **Desktop** (`hidden sm:block`): a sticky top bar with the logo/app name
  (linking home) and the five nav links as pill buttons, active-state
  highlighted via `isActive()`.
- **Mobile** (`sm:hidden`): a fixed bottom tab bar with icon + label per
  item, `padding-bottom: env(safe-area-inset-bottom)` for notch/home-
  indicator clearance.
- `<main>` gets `pb-20 sm:pb-0` so content isn't hidden behind the fixed
  mobile tab bar.

### `widgets/question-list/ui/QuestionList.tsx`

**`QuestionList({ questions, stats })`** — the virtualised, expandable list
behind the Bank page's search results. Built on `@tanstack/react-virtual`.

- `useVirtualizer({ count, getScrollElement, estimateSize: () => 84,
  overscan: 6, measureElement })` — only the visible window of rows is ever
  mounted in the DOM; 1353 rows × up to 5 answers each would otherwise jank
  badly on a mid-range Android. `measureElement` reports each row's *real*
  height back to the virtualizer, which matters because rows grow when
  expanded (a fixed `estimateSize` alone wouldn't account for that).
- Each row: a summary line (mastery badge, 2-line-clamped question text, a
  small "has image" hint) that expands in place on tap to show the full
  image (if any) and every answer, with the correct one highlighted green.
- `expanded: Set<number>` tracks which rows are open; `toggle(id)` flips
  membership.
- Empty state (`questions.length === 0`) shows a translated "nothing found"
  message rather than an empty scroll container.
- `data-testid="bank-row"` is the stable e2e hook for each row's toggle
  button.

### Barrels

- `widgets/test-solver/index.ts` — `TestSolver`, `TimerDisplay`,
  `formatClock`, `QuestionSlider`, `CompletionDialog`.
- `widgets/test-grid/index.ts` — `TestGrid`.
- `widgets/activity-heatmap/index.ts` — `ActivityHeatmap`.
- `widgets/app-layout/index.ts` — `AppLayout`.
- `widgets/question-list/index.ts` — `QuestionList`.

---

## `pages/` — one per route, compose widgets/features/entities

### `pages/home/HomePage.tsx`

**`HomePage()`** — the dashboard.

- Header: `Logo` + app name/tagline, then `<InstallCard />` immediately
  below (most visible spot for the install invitation without being the
  very first thing on the page).
- **Resume banner:** shown only if `progress.activeSession` exists — the
  single most useful thing on the page when it applies, per its own
  comment — with the answered-count and a "Continue" link straight into
  that test.
- Today's answered count + current streak, side by side.
- Two `ActionCard`s (20-question tests, 10-question tests) linking into
  `/tests/20` and `/tests/10`.
- Exam entry card (rules stated inline: count, minutes, max mistakes).
- Practice entry card — **only rendered if `progress.weakIds.length > 0`**;
  there's nothing to drill otherwise.
- Bank coverage progress bar (`mastered / bankSize`).

**`ActionCard({ to, title, subtitle })`** *(internal)* — a small reusable
link-card used for the two test-size entries.

### `pages/tests/TestsPage.tsx`

**`TestsPage()`** — thin wrapper: reads `:size` from the URL (`'10'` maps
to `10`, anything else defaults to `20`), renders the `Tabs` switcher
(navigating between `/tests/20` and `/tests/10`) and delegates the actual
grid to `<TestGrid size={active} />`.

### `pages/test/TestPage.tsx`

**`TestPage()`** — the single most logic-heavy page in the app: resolves a
`:testId` URL param into everything `<TestSolver>` needs. See Bugfixes
[#6](./BUGFIX_HISTORY.md#6-persisting-the-session-caused-an-infinite-render-loop-that-froze-every-button)
and
[#20](./BUGFIX_HISTORY.md#20-exam-and-practice-question-sets-silently-re-randomised-after-every-single-answer)
— both of this file's two `useRef`-pinning patterns exist specifically
because of bugs found here.

`mode` is derived directly from `testId`: `'exam'`, `'practice'`, or
`'training'` for anything else (a template id like `t20-5`).

**Two independent pin-once-per-`testId` patterns**, both using the same
shape (`useRef` holding `{ id/testId, value }`, re-derived only when the id
changes):

1. **`resume`** — the `ActiveSession` to restore, captured once so that
   the solver's own writes back to `activeSession` (a different object
   every time) don't trigger a re-derivation loop.
2. **`{ questions, title, size }`** (`resolvedRef`) — the concrete question
   array, similarly pinned, specifically because `exam`/`practice`
   resolution calls `sample()` and would otherwise re-randomise on every
   answer (since `weakIds`, one of the `useMemo`'s dependencies, correctly
   changes after every answer).

Resolution branches inside the memo, in priority order:

1. If resuming, resolve `resume.questionIds` against the question map —
   keeps a random exam exactly the same exam across a reload.
2. `testId === 'exam'` → `sample(all questions, EXAM.questionCount)`.
3. `testId === 'practice'` → the worst `PRACTICE_SIZE` entries from
   `weakIds`, backfilled with a random sample of not-yet-weak questions if
   there aren't enough weak ones yet.
4. Otherwise, look up the matching `TestTemplate` by id and resolve its
   `questionIds` in order. **Not pinned** if the template list hasn't
   loaded yet (`!template`) — that's a genuinely retriable "still loading"
   state, not a resolved result to cache.

**`titleFor(testId, count)`** *(internal)* — builds the human-readable
title ("Examination", "Practice", or "`{count}`-question test #`{n}`").

Loading/error/empty states: full-page skeletons while either query is
pending, a translated `Alert` if either query errored, and a redirect home
(`<Navigate replace>`) if resolution genuinely produced zero questions
(e.g. a `testId` that matches nothing).

### `pages/results/ResultsPage.tsx`

**`ResultsPage()`** — shown after `submit()`, reads `:attemptId` and looks
it up in `useProgress().attempts` (redirects home if not found — e.g. a
stale/bookmarked link after a progress reset).

- Verdict card: score fraction + percentage; for exam attempts only, a
  pass/fail badge and icon (green check / red X), plus the wrong-count and
  time-taken summary line.
- Two actions: Home, and (only if there were any wrong answers) "Drill
  mistakes" linking straight into `/test/practice`.
- Review section with a Wrong/All tab switcher (`filter` local state),
  listing each reviewed question's media, text, the user's own wrong pick
  (or "left blank" if none) in red, and the correct answer in green.

### `pages/bank/BankPage.tsx`

**`FILTERS`** *(internal, module-level)* — the five `BankFilter` values
paired with their i18n keys, in display order.

**`BankPage()`** — search + filter + browse over the whole question bank.
Wires `useQuestions()` and `useProgress().stats` into
`useQuestionSearch()`, and renders:

- A search input with a clear (✕) button shown only when there's a query.
- A horizontally-scrollable filter pill row.
- **`isError`** → translated error alert (bank genuinely failed to load —
  see [Bugfix #18/#19 context](./BUGFIX_HISTORY.md#19-tanstack-querys-default-networkmode-made-offline-navigation-hang-forever)).
- **`isPending`** → 8 skeleton rows.
- Otherwise `<QuestionList questions={search.results} stats={stats} />`,
  dimmed (`opacity-60`) while `search.isStale` (the deferred results are
  still catching up to the latest keystroke).

### `pages/stats/StatsPage.tsx`

**`StatsPage()`** — the statistics dashboard.

- Four `StatTile`s: current streak, longest streak, accuracy percentage,
  total time studied.
- `<ActivityHeatmap daily={progress.daily} />` in its own card.
- Bank coverage: a progress bar plus a three-way legend (mastered /
  learning / not-seen), computed as `learning = seen - mastered`, `unseen =
  bankSize - seen`.
- Recent-attempts bar chart (only if `recent.length > 1`) — the last 20
  attempts, oldest-first, each bar's height proportional to that attempt's
  score percentage, coloured green at 100%, primary at ≥90%, muted
  otherwise.
- "Needs work" list (only if any `weakIds` exist) — the 10 worst questions
  by accuracy, each linking (via a single "Drill" button, not per-row) into
  `/test/practice`.

**`StatTile({ icon, label, value, suffix? })`** *(internal)* — the small
reusable stat card used for the four headline numbers.

**`Legend({ color, label, value })`** *(internal)* — a coloured-swatch +
label + count, used for the mastery breakdown.

**`formatDuration(seconds): string`** *(internal)* — `<60 → "Ns"`, `<3600 →
"Nm"`, else `"Hh Mm"`.

### `pages/settings/SettingsPage.tsx`

**`THEMES`** *(internal, module-level)* — the three `Theme` values paired
with an icon and i18n key.

**`SettingsPage()`** —

- Language switcher: one button per `LANGUAGES` entry (native-script
  label), calling `useLanguage().setLanguage`.
- Theme switcher: one button per `THEMES` entry, calling
  `useTheme().setTheme`.
- Data section: shows attempt count, a storage-health badge
  (`isStorageAvailable()`, checked fresh on every render — cheap, and
  storage availability can theoretically change mid-session if e.g. private
  browsing settings change), a warning banner if storage is unavailable,
  and a "Reset all progress" button.
- Reset is behind a confirmation `Dialog`; confirming calls
  `useProgress().reset()` and shows a success toast.

### `pages/not-found/NotFoundPage.tsx`

**`NotFoundPage()`** — plain 404: large "404", a translated message, a
button back to Home. No logic.

### Barrels

Every page directory has a one-line `index.ts` re-exporting its component,
e.g. `export { HomePage as default, HomePage } from './HomePage'` (the
`default` export exists only as a holdover convention; the app's router
imports the named export exclusively, per `app/router/index.tsx`'s static
imports).

---

## Build & data scripts

### `scripts/build_data.mjs`

The **production data pipeline** — runs as the first step of `npm run
build`, and must succeed (non-zero exit on failure) or the build itself
fails. Node, not Python — see
[Bugfix #7](./BUGFIX_HISTORY.md#7-netlify-deploy-served-html-instead-of-the-question-bank)
for why a Python version of this exists separately but isn't what runs in
CI/deploy.

**`LANGS = ['uzb', 'uzc', 'ru']`** — the three languages actually shipped
(not `kaa`).

**`jsonFiles(dir)`** *(internal)* — lists `*.json` files in a directory,
sorted, returning `[]` if the directory doesn't exist (rather than
throwing).

**`baseName(url)`** *(internal)* — extracts the bare filename from a full
image URL, stripping any query string.

**`pickLangs(obj)`** *(internal)* — builds a `Localized`-shaped object from
a raw scraped object, defaulting any missing language to `''`.

**`normQuestion(q)`** *(internal)* — flattens one raw scraped question into
the app's `Question` shape (localized text, bare-filename media, answers
array similarly normalised).

**`main()`** —

1. Reads every file under `scrapes/tests-20/` (the composed, newer,
   authoritative September scrape) first, building the master `questions`
   map (keyed by question id) and a `t20-N` test template per entry.
2. Reads every file under `scrapes/tests-10/` (the older August scrape,
   per-file), filling in any question ids **not already present** from the
   newer scrape (so a question re-uploaded under a new image URL between
   scrapes uses the current one — see
   [Bugfix #2](./BUGFIX_HISTORY.md#2-those-same-two-bad-images-were-actually-stale-urls)),
   and a `t10-N` template per file (N parsed from the filename).
3. **Renumbers for display:** sorts by size then original number, then
   within each size group reassigns `number = 1..N` sequentially while
   preserving the original as `sourceNumber` — this is what turns
   e-avtomaktab's internal ids (5, 6, …, 356) into a clean 1–134 range a
   student actually sees.
4. Writes `public/data/questions.json` (id-sorted, array) and
   `public/data/tests.json` (minified, no pretty-printing — this is a
   production asset, not something meant to be read by a human).
5. **Integrity checks, printed and enforced:**
   - Any question whose `answerId` doesn't match one of its own `answers[]`
     ids.
   - Any question with blank `uzb` text.
   - Any test template referencing a question id that doesn't exist in the
     bank.
   - Per-language untranslated counts (questions/answers), printed as
     informational output even when zero.
   - **Exits with code 1** (failing the build) if the bank came out empty,
     or if any `answerId`/dangling-reference check failed — a bad data
     build should never silently ship.

### `scripts/build_data.py`

Python equivalent of `build_data.mjs`, kept as a local convenience (doesn't
require Node to inspect the pipeline logic) but **not** part of the CI/
Netlify build path — see Bugfix #7 for exactly why that distinction matters.
Same algorithm; the only behavioural difference found was `null`-vs-`''`
handling for missing translations (Python preserved `null`, which is how
Karakalpak's incompleteness was originally discovered when the two outputs
were diffed).

### `scripts/download_images.py`

Downloads the ~801 question images referenced by the scrapes from
e-avtomaktab.uz, resumable and integrity-checked.

**`collect_urls()`** — walks `tests-20/` and `tests-10/` scrapes exactly
like `build_data`'s question-merging logic, but collects `media` URLs
(question **and** answer-level) into `{ url: [questionIds using it] }`,
preferring the newer scrape's URL for any question present in both (the
same fix as Bugfix #2, implemented independently here since this script
predates the JS data pipeline).

**`remote_size(url)`** — a `HEAD` request to get `Content-Length`, used to
decide whether an existing local file can be trusted as-is (size matches)
or needs re-fetching.

**`fetch(url)`** — downloads one image with retries (`RETRIES = 3`,
exponential-ish backoff), validating the response is actually image data by
magic bytes (JPEG/PNG/GIF/WebP signatures) — **not** by HTTP status alone,
since e-avtomaktab.uz returns `200` with an HTML body for a missing image
rather than a `404` (see
[Bugfix #1](./BUGFIX_HISTORY.md#1-image-downloader-accepted-html-as-a-jpeg)).
Writes to a `.part` temp file and atomically renames on success, so a
Ctrl-C mid-download never leaves a half-written file mistaken for a
complete one on the next run.

**`main()`** — orchestrates the above across a thread pool (`WORKERS = 6` —
deliberately modest, "it's a small nginx box, no need to hammer it"),
writes a `scrapes/images-manifest.json` recording each downloaded file's
source URL and the question ids using it, and prints a summary (downloaded
/ already-had / failed counts, total size). Exits non-zero if any download
ultimately failed after retries. Supports `--check` (report what's missing
without downloading anything).

### `scripts/render_icons.mjs`

One-off tool: renders the app's single hand-authored SVG mark
(`public/icons/mark.svg`) into every PNG size the PWA manifest and
`<link rel="icon">` tags need — `icon-192.png`, `icon-512.png`,
`maskable-512.png` (art scaled into a safe circle with padding, per the
maskable-icon spec), `apple-touch-icon.png` (180px), and both favicon
sizes (32px, 16px) — using a headless Chromium instance (via
`@playwright/test`'s `chromium.launch()`) to screenshot the SVG at each
target size rather than depending on a system image library.

### `scripts/upload_r2.sh`

Uploads `scrapes/images/` to a Cloudflare R2 bucket via `rclone`. Sets
`Cache-Control: public, max-age=31536000, immutable` on every uploaded
object — the header e-avtomaktab.uz's own server omits, and the entire
reason self-hosting the images beats hotlinking them: each image becomes a
once-ever download per visiting device rather than being re-fetched (or at
least revalidated) on every view. Verifies the upload with `rclone check
--size-only --one-way` afterward. Idempotent — safe to re-run; only
transfers what's missing or changed.

### `scripts/README_R2.md`

Setup walkthrough for provisioning the R2 bucket and API token, including
the corrected verification command from
[Bugfix #3](./BUGFIX_HISTORY.md#3-r2-verification-instructions-told-the-user-to-run-a-command-their-own-token-would-reject).

---

## Configuration files

### `vite.config.ts`

Plugins: `@vitejs/plugin-react`, `@tailwindcss/vite` (Tailwind v4's native
Vite integration, no separate PostCSS config needed), `vite-plugin-pwa`.

The PWA plugin config (manifest + Workbox options) is documented inline in
detail — see the `shared/lib`/`features/sw-update` entries above for what
`clientsClaim`, `skipWaiting: false`, `registerType: 'prompt'`, the
`data/*.json` precache glob, and the cross-origin image `runtimeCaching`
rule each accomplish; all four were the direct subject of bugfixes (#9,
#18, #19) or exist specifically to avoid a fifth (the "offline ready"
overclaim, addressed at the `UpdatePrompt` level rather than here).

`resolve.alias['@']` points at `src/`. `server.host: true` exposes the dev
server on the LAN, so the app can be opened on a phone during development.

### `netlify.toml`

- `build.command = "npm run build"`, `publish = "dist"`.
- SPA rewrite (`/* → /index.html`, status 200) so client-side routes like
  `/tests/20` don't 404 on a hard reload/direct link.
- Cache headers: hashed `/assets/*` get a one-year immutable cache;
  `/data/*`, `/sw.js`, and `/index.html` all get `max-age=0, must-
  revalidate` — none of those three should ever be served stale, since
  they're exactly the files a new deploy changes.

The comment block above the SPA rewrite documents the failure mode from
Bugfix #7 directly in the config file itself, and names
`e2e/deploy.spec.ts` as the actual guard against a repeat.

### `playwright.config.ts`

Three projects: `desktop-chrome`, `mobile-android` (Pixel 7 device
profile), `mobile-safari` (iPhone 13 device profile) — mobile matters as
much as desktop here, since most classmates will be on phones. `webServer`
runs `npm run build && npm run preview` before the suite, on port 4173.

### `package.json` scripts

| Script | Command | Purpose |
|---|---|---|
| `dev` | `vite` | Dev server |
| `build` | `node scripts/build_data.mjs && tsc -b && vite build` | Full production build — data generation is step one, not optional |
| `preview` | `vite preview` | Serve the production build locally |
| `test` | `playwright test` | Full e2e suite (builds first, via `webServer`) |
| `test:ui` | `playwright test --ui` | Playwright's interactive UI mode |
| `test:report` | `playwright show-report` | Open the last HTML report |
| `typecheck` | `tsc -b --noEmit` | Type-only check |
| `lint` | `oxlint` | Linting |
| `data` | `node scripts/build_data.mjs` | Regenerate `public/data/` without a full build |
| `images` | `python3 scripts/download_images.py` | Download/refresh the local image cache |
