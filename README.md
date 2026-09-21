# MDEV-Avtotest

Driving theory exam prep for the Uzbek road rules test. 1353 questions in three
languages with the answer key, 68 twenty-question tests, 134 ten-question tests,
and a timed examination mode.

Works offline, installs to a phone home screen, and keeps your progress on the
device. No account, no server, no backend.

---

## Quick start

```sh
npm install
npm run dev          # also serves on your LAN IP, so you can open it on a phone
```

The question bank is generated from the scrapes on every build, so there is no
extra setup step.

```sh
npm run build        # generate data -> typecheck -> bundle
npm run preview      # serve the production build
npm test             # 115 e2e tests x 3 devices
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server, exposed on the LAN |
| `npm run build` | Regenerates `public/data`, typechecks, bundles to `dist/` |
| `npm run preview` | Serves `dist/` locally |
| `npm test` | Playwright suite (builds first) |
| `npm run test:ui` | Playwright UI mode |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run lint` | oxlint |
| `npm run data` | Rebuild `public/data` from the scrapes |
| `npm run images` | Download the 801 question images (Python, one-off) |

---

## The data

Everything comes from scrapes of e-avtomaktab.uz, captured with a browser
extension and stored in `scrapes/`:

- `scrapes/tests-10/` — 134 files, one per 10-question test (August capture)
- `scrapes/tests-20/` — one composed file holding all 68 twenty-question tests
  (September capture, newer and authoritative)

`npm run data` normalises both into the two files the app fetches:

```
public/data/questions.json   1353 questions, deduped, 3 languages   1603 KB
public/data/tests.json       202 templates referencing question ids    25 KB
```

Questions are stored once and referenced by id, so a question appearing in both
a 10- and a 20-question test is not duplicated on the wire. The generator fails
the build if any question's `answerId` is missing from its own answers, or if a
template references a question that does not exist.

**`public/data/` is gitignored** — it is generated, and `npm run build` makes it.
That matters for deploys: a host cloning the repo has no data directory until the
build creates one.

### Languages

`uzb` (Latin), `uzc` (Cyrillic) and `ru`, all complete for every question and
answer. The source also carries Karakalpak, but it is 24% untranslated (322
questions and 1047 answers blank), so it is excluded — see `LANGS` in
`scripts/build_data.mjs`.

The UI language and the question language are the same setting: `useLanguage()`
guarantees a valid key, so `question.text[language]` can never be undefined.

### Numbering

The 10-question tests carry e-avtomaktab's internal URL ids (5…356, with gaps).
"Test #356" means nothing to a student, so they are renumbered 1…134 for display
while `id` stays tied to the source id, keeping URLs stable and traceable.

### Images

801 questions have a picture. They are **not** in this repo — 156 MB of
1920×1080 originals, deliberately uncompressed because a speed-limit number or
an indicator lamp has to stay readable.

```sh
npm run images                                  # download originals to scrapes/images/
./scripts/upload_r2.sh <bucket>                 # push to Cloudflare R2
```

See `scripts/README_R2.md` for the R2 setup. Image URLs resolve through a single
helper, so switching hosts is one environment variable:

```sh
# .env.local
VITE_IMG_BASE=https://img.yourdomain.uz/tests
```

Unset, it falls back to e-avtomaktab's own server, so the app runs before R2 is
wired up. Their server sends no `Cache-Control`, so every view re-requests the
image; self-hosting with `max-age=31536000, immutable` makes each one a
once-ever download per device.

---

## Architecture

Feature-Sliced Design, with MVVM inside each slice — `model/types.ts` is the
Model, `model/use*.ts` the ViewModel, components the View.

```
src/
├── app/          providers (theme, query, i18n, progress), router, styles
├── pages/        home · tests · test · results · bank · stats · settings
├── widgets/      app-layout · test-solver · test-grid · question-list · activity-heatmap
├── features/     test-session · question-search · install-app · sw-update
├── entities/     question · test · progress
└── shared/       ui (shadcn) · lib · config · i18n
```

Two rules worth keeping:

- Nothing outside `entities/progress` touches storage.
- Nothing outside `shared/config/env.ts` builds an image URL.

### Rules live in one file

`shared/config/rules.ts` holds every exam constant: 20 questions in 25 minutes
with 2 mistakes allowed, 12 minutes for a 10-question test, mastery at 3 correct
in a row.

### Offline data fetching

TanStack Query's default `networkMode: 'online'` pauses a query indefinitely
once the browser has fired an `offline` event this session - useful for a
live API, wrong for us: every fetch here is answered by the service worker's
own cache regardless of connectivity, so nothing should ever be gated on
`navigator.onLine`. `networkMode: 'always'` is set globally instead, so a
route opened for the first time while offline still reaches the cache instead
of sitting in `fetchStatus: 'paused'` forever with the skeleton on screen.

### Progress storage

`localStorage`, not IndexedDB. A fully-worked bank plus a year of daily activity
and 500 attempts is under 250 KB against a ~5 MB budget, read once at startup and
written on answer. Every access is guarded so private mode or blocked site data
degrades to "no saved progress" rather than crashing mid-test.

Writes are debounced 250 ms and flushed on `pagehide`/`visibilitychange`. The
in-memory mirror updates synchronously inside the state updater, not during
render — a render can be preempted by navigation, which would drop the answer
given just before the tab closed.

The blob is versioned; v1 migrates to v2 rather than being discarded.

---

## Behaviour worth knowing

- **Answers lock once given.** Every mode reveals the correct answer immediately,
  exam included. Being able to change your mind after seeing it would make every
  statistic meaningless.
- **A correct answer advances on its own** after 700 ms, long enough to register
  the green. A wrong one stays put — that is the moment worth reading.
- **The resolved question set is pinned once per test**, not recomputed on every
  render. `exam` and `practice` pick their questions with `sample()`, and one of
  their dependencies (`weakIds`) legitimately changes after every answer — so
  without pinning, giving any answer would silently re-randomise the whole test
  out from under whatever was on screen. Caught because it looked exactly like
  clicks "doing nothing": the answer registered, then the question array was
  replaced a moment later.
- **The question strip is a Swiper**: swipe on touch, mouse wheel on desktop
  (released to the page at either end), plus scroll buttons when it overflows.
- **Finishing every question opens a summary** with the tally and a choice of
  replaying the same test or submitting. It does not submit by itself, so the
  test stays open for review if dismissed.
- **Training and practice can pause the clock** by tapping the timer. Paused time
  is not deducted. Exam cannot — a pausable limit is not a limit.
- **Pages are one bundle, not code-split.** `React.lazy()`'s dynamic `import()`
  has to be served from the service worker's cache the moment a route is first
  opened, and WebKit can fail that ("Importing a module script failed"),
  crashing to a raw error screen for anyone offline who taps into a page they
  haven't opened yet this session. The whole app is ~265 KB gzip, small enough
  that bundling it as one chunk removes the failure mode entirely, on every
  browser, rather than working around it.
- **No blanket "ready for offline" toast.** Only the shell and question bank are
  precached; images cache as they're actually viewed. Claiming full offline
  readiness on install would oversell exactly the gap a user hits first.
- **An uncached image says so** instead of vanishing — a placeholder with a
  retry button, not a blank space that reads as a bug.
- **The clock pauses while you are away.** Remaining time is persisted and the
  deadline rebuilt on resume, so a phone call does not fail your exam.
- **Unanswered counts as wrong**, and the submit dialog says so.
- **The solver renders outside the app layout** — no tab bar during a timed exam.
- **Images open fullscreen** with native pinch-zoom. That is where the
  uncompressed originals pay off.

---

## PWA

Installable, and fully usable offline once installed.

- The question bank is **precached** — without it there is nothing to study.
- Question images are **runtime-cached**, CacheFirst with a 180-day expiry.
  Precaching 156 MB would be absurd; they cache as actually seen.
- Updates **prompt** rather than auto-applying. `skipWaiting` is off so a new
  version cannot swap the app out mid-exam.
- `clientsClaim` is on, so the very first visit is already offline-capable.
- iOS gets install instructions instead of a button — Safari can install but
  exposes no API for it.

Icons are generated from one SVG:

```sh
node scripts/render_icons.mjs
```

---

## Deploying

`netlify.toml` is committed and configured. Connect the repo and it builds.

```toml
command = "npm run build"
publish = "dist"
```

The SPA rewrite sends unknown paths to `index.html` so deep links work. Netlify
serves real files first, so `/data/*.json` and `/assets/*` are unaffected.

**One trap to be aware of:** because `public/data/` is gitignored, a build that
does not generate it produces a `dist/` with no data directory. Requests then
fall through the SPA rewrite and come back as HTML, which surfaces as a JSON
parse error rather than a missing file. `e2e/deploy.spec.ts` fails the suite if
`dist/data` is absent, and the build script exits non-zero on an empty bank.

---

## Tests

115 tests, each run against Desktop Chrome, Pixel 7 and iPhone 13. A handful
are skipped on WebKit specifically where headless WebKit's own offline
emulation breaks service worker cache lookups - a documented Playwright/WebKit
harness limitation, not something demonstrated on a real device; offline is
verified on Chromium and Android Chrome.

| File | Covers |
| --- | --- |
| `smoke.spec.ts` | Shell, data integrity, navigation, console errors |
| `solver.spec.ts` | Running a test, instant feedback, locking, resume, persistence |
| `actions.spec.ts` | Exit/continue/save/discard, prev/next, slider, flag, submit — in all four modes |
| `bank.spec.ts` | Virtualisation, search, filters, i18n across all languages |
| `heatmap.spec.ts` | Today's cell, intensity scale, scroll position, streaks |
| `pwa.spec.ts` | Manifest, service worker, offline, install card, logo |
| `interactions.spec.ts` | Auto-advance, Swiper strip, completion summary, timer pause |
| `deploy.spec.ts` | `dist/` contents, Netlify config, graceful failure when the bank is missing |
| `theme.spec.ts` | Light/dark, stored preference, no flash before paint |
| `responsive.spec.ts` | No horizontal overflow at 320/390/768/1440px |

Some are regression guards for bugs that actually shipped — `actions.spec.ts`
asserts idle writes stay under 10 in 2 seconds, after a `persist()` feedback loop
once fired thousands of times a second and silently starved every save.

---

## Known gaps

- **No topic categories.** The scraped data has no category field, so "you are
  weak on road signs" is not derivable. The weakest-questions list is the
  substitute. Their API may expose categories on an endpoint not yet captured.
- **Progress is per-device.** No sync. Adding Supabase later would be a bolt-on,
  since everything reads through `entities/progress`.
- **The bank drifts.** Two questions had their images re-uploaded between the
  August and September scrapes. Re-scraping closer to an exam is cheap insurance.
