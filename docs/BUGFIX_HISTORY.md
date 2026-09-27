# Bugfix History

Every bug found and fixed during MDEV-Avtotest's development, in the order it
happened. Each entry gives the symptom as it first appeared, the actual root
cause once traced, the fix, and how it was verified. Where a bug was caught by
diagnosis rather than by a report, that's noted too — several of these were
found while investigating a *different*, unrelated complaint.

This is a history of real defects that shipped or nearly shipped, not a
changelog of features. Deliberate behaviour changes (e.g. "make exam mode
reveal answers immediately") are noted only where they intersect with a bug
fix.

---

## 1. Image downloader accepted HTML as a JPEG

**Symptom:** Two of 803 downloaded "images" were actually 8 KB HTML files
saved with a `.jpg` extension.

**Root cause:** e-avtomaktab.uz's server is a SPA host — when an image URL
doesn't exist, its catch-all rewrite returns `index.html` with **HTTP 200**,
not a 404. The original download script only checked the status code and
whether the response body was non-empty, so it happily saved the HTML as if
it were a valid image.

**Fix:** `scripts/download_images.py`'s `fetch()` now validates magic bytes
(JPEG/PNG/GIF/WebP signatures) regardless of the HTTP status, and rejects
anything that doesn't match with a descriptive error showing the first 60
bytes of what it actually got. The skip-on-resume check does the same
validation on files already on disk, so a corrupted previous run gets
repaired rather than silently trusted.

**Verified:** Re-running the script against the two known-bad files
(`e-avtomaktab280.jpg`, `e-avtomaktab289.jpg`) correctly flagged and
re-fetched them.

---

## 2. Those same two "bad" images were actually stale URLs

**Symptom:** After fix #1, the two files were reported as permanently
unfetchable — the URL returned HTML every time, even directly via `curl`.

**Root cause:** Not a bug in the downloader. The school had re-uploaded those
two images under new UUID filenames between the August scrape (`tests-10`)
and the September scrape (`tests-20`). The old URLs were simply gone. This
was confirmed by diffing each question's `media` field across both scrapes —
exactly 2 of 1353 had changed, both to a UUID filename.

**Fix:** `collect_urls()` in `download_images.py` now prefers the newer
scrape's media URL for a question when it appears in both `tests-20` and
`tests-10`, falling back to the older one only if the question is exclusive
to `tests-10`.

**Verified:** Both images downloaded successfully once the script pulled the
current URL instead of the August one.

---

## 3. R2 verification instructions told the user to run a command their own token would reject

**Symptom:** `rclone lsd r2:` returned `AccessDenied` even though the R2
credentials were entered correctly.

**Root cause:** Documentation bug, not a config bug. `rclone lsd r2:` (no
bucket name) calls `ListBuckets`, an **account-level** S3 operation. The
setup instructions had the user create a token scoped to a single bucket
(the safer, recommended choice) — which is *correctly* denied that
operation. The fix instructions were internally inconsistent: they told the
user to scope the token narrowly, then to verify with a command that
requires broad access.

**Fix:** `scripts/README_R2.md` now verifies with `rclone lsd
r2:<bucket-name> --s3-no-check-bucket` instead, and explicitly calls out that
`rclone lsd r2:` will *always* fail with a bucket-scoped token by design —
that's not something to "fix" by widening the token.

**Verified:** `rclone lsd r2:avtomaktab-images --s3-no-check-bucket` returned
successfully against the same credentials that had just failed the broad
command.

---

## 4. `useQuestionMap` returned a new `Map` identity on every render

**Symptom:** Discovered while investigating a resume-related feedback loop
(see #6). Not independently reported, but a prerequisite cause.

**Root cause:**

```ts
// before
export function useQuestionMap() {
  const query = useQuestions()
  const map = new Map<number, Question>()   // new object every call
  query.data?.forEach((q) => map.set(q.id, q))
  return { ...query, map }
}
```

A brand-new `Map` was constructed on every render regardless of whether
`query.data` had actually changed. Every consumer that put `map` in a
`useMemo`/`useEffect` dependency array therefore saw a "changed" dependency
on every single render of the app, cascading unstable references into
anything downstream.

**Fix:** Memoised on `query.data`'s identity:

```ts
const map = useMemo(() => {
  if (!data) return EMPTY
  const m = new Map<number, Question>()
  for (const q of data) m.set(q.id, q)
  return m
}, [data])
```

**Verified:** Confirmed via a direct instrumentation test that counted
`setState` calls before and after — see #6, which this fix was a prerequisite
for but did not fully resolve on its own.

---

## 5. An answer given immediately before navigating away could be lost

**Symptom:** Regression test written proactively for the persistence layer:
answer a question, then navigate away with **zero wait**, like closing the
tab. `activeSession.answers` sometimes had one fewer entry than `stats`.

**Root cause:** `ProgressContext`'s `latest` ref (used by the `pagehide`
flush handler to write the most current state even after unmount) was being
assigned **during render**:

```ts
// before
const [state, setState] = useState(...)
const latest = useRef(state)
latest.current = state   // assigned at render time
```

A React render can be *preempted* by navigation before it commits. If that
happened right after an answer's `setState` call but before the render
committed, `latest.current` was still pointing at the previous state when
`pagehide` fired, and the flush wrote stale data.

**Fix:** Replaced the render-time assignment with a single `apply()` helper
that updates `latest.current` **synchronously inside the state updater**,
not as a side effect of rendering:

```ts
const apply = useCallback((fn: (prev: ProgressState) => ProgressState) => {
  const next = fn(latest.current)
  latest.current = next   // synchronous, not render-dependent
  setState(next)
}, [])
```

Every mutator (`recordAnswer`, `recordAttempt`, `setActiveSession`, `reset`)
now goes through `apply()`.

**Verified:** `e2e/solver.spec.ts` → *"an answer given immediately before
leaving is not lost"* — answers, clicks next, answers again, navigates home
with no wait, and asserts both `stats` and `activeSession.answers` have
exactly 2 entries.

---

## 6. Persisting the session caused an infinite render loop that froze every button

**Reported as:** *"exit button not working while in examination mode"*

**Symptom:** All buttons in the solver felt dead or laggy. Nothing ever
saved — `localStorage` held only the empty state written at mount, even
after answering several questions.

**Root cause:** A feedback loop across two files:

1. `TestPage` derived the resumable session reactively:
   `activeSession?.testId === testId ? activeSession : null` on every render.
2. `useTestSession`'s `persist()` wrote to `activeSession` on every answer.
3. Writing to `activeSession` gave it a new object identity.
4. `TestPage`'s `resume` value (derived from `activeSession`) changed
   identity too.
5. `resume` sat inside `useMemo`'s dependency array that computed `questions`
   for the solver.
6. That recomputation produced a new `questions` array, which the solver
   received as a new prop.
7. The solver's persistence effect depended (transitively) on `questions`,
   so it fired `persist()` again.
8. Back to step 3.

This ran **thousands of times per second**, starving the 250 ms debounced
`saveProgress()` write of ever getting a quiet moment to actually fire, and
consuming enough of the main thread that click handlers felt unresponsive.

**Diagnosis method:** DOM-mutation counting via `MutationObserver` showed
**zero** mutations during the "stuck" period — because every render produced
*identical output*, the loop was invisible to anything watching the DOM. It
was only found by instrumenting `apply()` directly and counting calls, which
showed thousands of invocations in under two seconds.

**Fix:** Two independent pins, using the same pattern:

- `TestPage` now captures `resume` **once per `testId`** in a `useRef`,
  re-deriving only when `testId` itself changes — not reactively from
  `activeSession` on every render.
- `useTestSession`'s "establish the session" effect runs exactly once per
  mount via a `useRef` guard flag, rather than re-firing whenever `persist`'s
  identity changed.

**Verified:** `e2e/actions.spec.ts` → a whole `describe('no runaway writes')`
block, run against all four test modes, asserting idle writes to storage stay
under 10 in 2 seconds. This is the regression guard for the exact bug: it
would have failed loudly instead of silently eating everyone's progress.

---

## 7. Netlify deploy served HTML instead of the question bank

**Reported as:** *screenshot showing `questions.json`/`tests.json` requests
returning 404 with `Content-Type: text/html`*

**Root cause:** `public/data/` is gitignored (it's generated, not source),
and the generator was a **Python** script that wasn't part of `npm run
build`. Netlify clones the repo fresh and runs the build command — with no
Python step in that pipeline, `dist/` came out with no `data/` directory at
all. Requests for `/data/tests.json` then fell through the SPA rewrite rule
and got `index.html` back, with a 200-that-Netlify's-CDN-reported-as-404 for
reasons unrelated to the app itself.

**Fix:**
- Ported `scripts/build_data.py` to `scripts/build_data.mjs` (Node), since
  every deploy host already has Node — it just installed the app with it —
  but not a usable Python.
- Wired it into the build: `"build": "node scripts/build_data.mjs && tsc -b
  && vite build"`.
- Added `netlify.toml` with the SPA rewrite and cache headers.
- Added `e2e/deploy.spec.ts`, which fails the suite if `dist/data/` is
  missing or if the generated bank fails its own integrity checks.

**Side effect found during the port:** Python's `json.load` preserved `null`
for a missing translation; the naive Node port coerced it to `''`. Diffing
the two outputs surfaced that **Karakalpak (`kaa`) was 24% untranslated**
(322 of 1353 questions, 1047 of 4427 answers) — later removed from the app
entirely at the user's request (see #21).

**Verified:** `rm -rf dist public/data && npm run build` (simulating a fresh
clone) followed by the full Playwright suite, including `deploy.spec.ts`'s
assertions that `dist/data/questions.json` and `dist/data/tests.json` exist
and are non-trivial in size.

---

## 8. Netlify's own "Powered by Netlify" badge — not a code bug

Not a defect in this codebase. Documented here because it consumed real
diagnostic effort and the trail is worth keeping.

**What happened:** A floating "Powered by Netlify" pill appeared, overlapping
the mobile tab bar. Investigation traced it to a `<script
src="/.netlify/scripts/hud?...">` tag injected by Netlify's edge/post-
processing layer at request time — not present in the app's own
`dist/index.html`. This is a real, deliberate Netlify feature (their "HUD"),
automatically enabled for Free-plan projects created on or after **19 Aug
2026**.

**Resolution:** Netlify dashboard → Project configuration → General →
"Powered by Netlify badge" → off. Confirmed via direct `curl` that the
script tag disappeared from the server response immediately, with no
redeploy needed.

**A follow-up "the toggle isn't working" report** turned out to be the
user's **service worker** serving a precached copy of `index.html` from
*before* the toggle was flipped — `Cache Storage` isn't touched by a normal
browser "clear cache and hard reload" (deliberately, so offline support
survives a cache clear). Resolved via DevTools → Application → Clear site
data.

**Explicitly declined:** A request to script-inject a fade-out for the
badge's `#nl-badge` element was declined — the badge renders inside a
sandboxed `srcdoc` iframe specifically so page scripts can't reach it, and
the dashboard toggle is the sanctioned, free, instant off-switch. No code
change was made for this.

---

## 9. Service worker didn't control the very first visit

**Symptom:** Found while building offline support, before user-facing
report. A fresh install required a page reload before the app worked
offline at all.

**Root cause:** `vite-plugin-pwa`'s Workbox config didn't set
`clientsClaim`. By spec default, a newly-installed service worker does not
take control of the page that registered it until that page is reloaded —
so the tab that just installed the worker was still being served by the
network, not the cache.

**Fix:** `clientsClaim: true` in `vite.config.ts`'s Workbox options.
`skipWaiting` was deliberately left `false` — that one governs *updates*
replacing an already-running app mid-session (which could lose an in-progress
exam), a different concern from first-install control.

**Verified:** `e2e/pwa.spec.ts` → *"registers a service worker and precaches
the question bank"* — asserts `navigator.serviceWorker.controller` is
non-null without requiring a second navigation.

---

## 10. The install prompt could be missed entirely

**Symptom:** `beforeinstallprompt` sometimes never reached the React
component that was supposed to show the install card.

**Root cause:** Chrome can fire `beforeinstallprompt` **before React has
mounted and attached its listener** — the event is offered to the page only
once; miss it and there's no second chance.

**Fix:** An inline `<script>` in `index.html`'s `<head>` — which runs before
any module script, including React — attaches its own listener immediately,
calls `preventDefault()`, and stashes the event on `window.__installPrompt`.
`useInstallPrompt()` reads that stash as its initial state.

**A second, narrower race was found while testing this fix:** even with the
stash, an event landing in the gap between React's `useState` initializer
reading `window.__installPrompt` and the `useEffect` attaching its own
listeners would still be lost. Fixed by re-checking the stash again inside
the effect body itself, closing that specific window.

**Verified:** `e2e/pwa.spec.ts` → *"is hidden until the browser says the app
is installable"* (dispatches a synthetic `beforeinstallprompt` after mount)
and a manual repro dispatching the event pre-mount, run three times
consecutively to rule out a lucky pass.

---

## 11. The logo was invisible in light mode

**Symptom:** The app's logo rendered as three floating dots — no visible
road badge, no background — specifically on the dashboard, specifically in
light mode.

**Root cause:** `<Logo>`'s SVG gradient used a **hardcoded id**,
`#logo-bg`. Multiple `<Logo>` instances render simultaneously on the
dashboard (desktop nav header, install card, page header). Since SVG `id`
values are global to the document, `url(#logo-bg)` in each instance resolved
to whichever `<linearGradient id="logo-bg">` happened to be *first* in the
DOM — which, depending on layout, could be the one living inside the
`hidden sm:block` desktop header. On a mobile viewport that element is
`display: none`, and a gradient definition inside a display-none subtree
doesn't paint, leaving every instance of the badge with an unresolved fill:
a white road on nothing.

**Fix:** `useId()` generates a unique gradient id per component instance,
so `url(#${gradientId})` always resolves within its own SVG regardless of
how many other `<Logo>`s are on the page or which one renders first.

**Verified:** `e2e/pwa.spec.ts` → *"multiple logos on one page each resolve
their own gradient"* — walks every `<Logo>` on the dashboard and asserts each
one's gradient `id` exists as a real element within that same SVG.

---

## 12. Activity heatmap colours were nearly invisible

**Symptom (reported):** *"faollik github active tracker not showing my
todays activeness"* — the day's activity appeared blank despite having
answered questions.

**Root cause (part one — thresholds):** The bucket boundaries assumed 50
questions/day was a typical study session:

```
before: <10 -> level 1, <25 -> level 2, <50 -> level 3, 50+ -> level 4
```

A full 20-question test only reached **level 2**, and answering 5 questions
landed on the faintest possible shade, `bg-primary/25` — visually almost
identical to an empty cell.

**Fix (part one):** Recalibrated to match real usage — a 10-question test is
a solid day (level 3), a 20-question test is a strong day (level 4) — and
raised the minimum visible opacity to `bg-primary/40`.

**Root cause (part two — scroll position, the actual complaint):** Even
after recalibrating colour, today's cell still wasn't visible. The heatmap
is a horizontally-scrollable 53-week grid that renders oldest-week-first,
left-aligned. On first render it opened on last September — today's cell,
correctly rendered and correctly coloured, sat **past the right edge of the
visible scroll container**. Confirmed by measuring the cell's bounding box
(`x: 1039`) against the container's clipped width (`~1040`).

**Fix (part two):** The heatmap scrolls itself to `scrollWidth` (the current
week) on mount, matching how GitHub's own contribution graph opens. A ring
outline was also added around today's cell so it's findable at a glance in a
371-square grid.

**Verified:** `e2e/heatmap.spec.ts` — 10 tests including one that explicitly
asserts today's cell's bounding box falls within the scroll container's
visible bounds, on both desktop and 390px phone width, plus intensity
scaling, tooltip accuracy, and streak counting.

---

## 13. Completion dialog mislabelled its own count tiles

**Symptom:** Found during a design review of the new completion summary
dialog, not user-reported. The red "wrong answers" tile was labelled
"Sizning javobingiz" ("Your answer") — a string meant for labelling a
*specific chosen answer* on the results page, reused by mistake for a
*count*.

**Root cause:** Copy-paste of an existing i18n key (`test.incorrect`) into a
context it wasn't written for.

**Fix:** Added dedicated `test.correctCount` / `test.wrongCount` keys in all
three shipped languages, used only by the count tiles.

**Verified:** Visual check via a full-page screenshot after the fix,
alongside the existing `e2e/interactions.spec.ts` completion-summary suite.

---

## 14. Question slider full-bleed layout mismatch

**Symptom:** Found while wiring up the Swiper-based question slider. On a
20-question test, the scroll buttons never appeared even though the strip
visually looked like it should scroll; on closer inspection Swiper reported
`isLocked: true`.

**Root cause:** The slider rendered at the header's full width (1248px in
the test viewport) while every other element on the page — including the
question card directly below it — was constrained to `max-w-3xl` (768px).
At 1248px, all 20 question tabs fit without overflowing, so Swiper correctly
determined there was nothing to scroll and locked itself, hiding the
navigation buttons.

**Fix:** Wrapped the slider in the same `mx-auto w-full max-w-3xl` container
as the rest of the shell, so its available width — and therefore whether it
overflows — matches what the user actually sees the content constrained to.

**Verified:** `e2e/interactions.spec.ts` → *"has scroll buttons on desktop
when the strip overflows"* (20-question test) and *"hides the scroll buttons
when everything already fits"* (10-question test) — both assert the correct
Swiper lock state for their respective widths.

---

## 15. Mouse wheel over the slider did nothing

**Reported as part of:** *"react swiper to the questions slider with mouse
scrolling and scroll buttons"*

**Root cause:** The first implementation set `mousewheel: { forceToAxis:
true }`, which makes Swiper ignore a plain vertical wheel gesture entirely —
the opposite of "mouse scrolling" as requested. This was a self-introduced
bug, caught immediately by the corresponding test rather than shipped.

**Fix:** `forceToAxis: false` (a vertical wheel scrolls the horizontal strip)
with `releaseOnEdges: true` (scrolling hands back to the page once the strip
reaches either end, so it never traps the viewport when a user is scrolling
past it).

**Verified:** `e2e/interactions.spec.ts` → *"responds to the mouse wheel"* —
hovers the tablist and dispatches a wheel event, asserting the first tab's
bounding box moves.

---

## 16. Slider's own CSS override broke its scrolling

**Symptom:** Found in the same pass as #14/#15. An earlier draft added
`className="!overflow-visible"` to the `<Swiper>` element (originally meant
to let the round scroll buttons overhang the strip's edges), which defeats
the clip-based mechanism Swiper's horizontal scrolling depends on entirely.

**Fix:** Removed the override; the scroll buttons are absolutely positioned
outside the clipped area instead, so nothing needs the strip itself to allow
overflow.

**Verified:** Same test suite as #14/#15 — scrolling and buttons both work
correctly with the override removed.

---

## 17. TestGrid had no error state at all

**Found while diagnosing:** the offline "stuck loading" report (#19), as a
secondary gap in the same component.

**Root cause:** `TestGrid` only branched on `isPending` (show skeletons) or
fell through to rendering `data`. If the underlying query ever entered
`isError`, there was no matching branch — the component rendered an empty
grid with zero explanation, indistinguishable from "this size genuinely has
no tests."

**Fix:** Added an explicit `isError` branch with a translated error message
and a retry button wired to `refetch()`.

**Verified:** `e2e/pwa.spec.ts` → *"a genuinely uncached route shows a retry,
not an empty grid forever"* — deletes the precache entry for
`data/tests.json`, forces the fetch offline, and asserts the error message
and retry button both appear.

---

## 18. `QuestionMedia` silently vanished on a failed image load

**Reported as:** *"when i go to questions it just shows the options correct
and wrong one no any kinda image"*

**Root cause:**

```ts
// before
if (!src || failed) return null
```

An image that failed to load — almost always because it was never viewed
online and so was never cached, which is expected and correct behaviour for
59% of an app that intentionally doesn't precache 156 MB of images — caused
the whole component to render `null`. No placeholder, no message, no space
reserved. This is indistinguishable from "the app is broken" to a user who
has no way to know images are cached selectively.

**Fix:** A `failed` state now renders an honest placeholder — an "image
unavailable offline" (or "failed to load", if genuinely online) message in
the same `aspect-video` footprint the image would have occupied, with a
retry button that forces a fresh fetch attempt (via a `?retry=n` cache-buster
and a remounted `<img>` keyed on the attempt count).

**Verified:** `e2e/pwa.spec.ts` → three tests: the placeholder appears with
correct copy when offline, retry succeeds once connectivity returns, and an
image that loads fine never shows the placeholder at all.

---

## 19. TanStack Query's default `networkMode` made offline navigation hang forever

**Reported as:** *"went offline and went to tests page and it just shows
loading"*

**Root cause — found in two layers:**

**Layer one:** TanStack Query's default `networkMode: 'online'` pauses any
query that has never fetched before if the browser has already fired an
`offline` event during the current session — it sits in `fetchStatus:
'paused'` indefinitely, **never even calling the query function**, until
`navigator.onLine` flips back to `true`. Sequence that triggered it: the
Home page's query fetches while online (establishing that the app is
"tracking" online status); the user goes offline; they tap into the Tests
page for the first time this session — a query that's never fetched before —
and it never even reaches the service worker that has the answer cached.
Confirmed by reproducing the exact sequence in Playwright (a fresh full
reload while offline worked fine; a soft in-app navigation to a not-yet-
visited route after having been online first reproduced the hang reliably).

Changed to `networkMode: 'offlineFirst'`, which always fires the *first*
attempt regardless of online status.

**Layer two (found while writing the regression test for layer one):**
`offlineFirst` still pauses a failed **retry** while offline. So a
*genuinely* uncached resource (corrupted install, evicted storage — not the
common case, but a real one) would fail its first attempt and then hang on
the retry the same way, just less often.

**Fix (final):** `networkMode: 'always'` — every fetch here is answered by
the service worker's own cache regardless of connectivity, so nothing should
ever be gated on `navigator.onLine` at any stage, first attempt or retry.

**Verified:** `e2e/pwa.spec.ts` → *"a query never fetched this session still
resolves offline, not stuck loading"* (the common case) and *"a genuinely
uncached route shows a retry, not an empty grid forever"* (the retry-pause
edge case, reproduced by deleting the precache entry directly via the Cache
API before going offline).

---

## 20. Exam and practice question sets silently re-randomised after every single answer

**Found while diagnosing:** bug #19's regression tests, as an unrelated
failure that appeared only in exam mode — clicking an answer appeared to do
nothing (`data-state` stayed `"idle"`, `disabled` stayed `false`) on some
questions but not others.

**Root cause:** `TestPage`'s `useMemo` that resolves a `testId` into a
concrete question array depended on `weakIds` — a value from
`useProgress()` that legitimately, and correctly, changes after **every
single answer given anywhere in the app** (it tracks what still needs
practice). For `training` templates this dependency change was harmless
(the resolved content is deterministic regardless of `weakIds`), but for
`exam` and `practice`, question resolution calls `sample()` — genuine
`Math.random()`-based selection. So: answer any question → `weakIds`
changes identity → the memo recomputes → `sample()` runs again → the
**entire 20-question array is silently replaced with a different random
set**, one render after the answer that triggered it. The click had
registered correctly; the question array underneath it was simply swapped
out a moment later, so the next interaction landed on a completely
different question than what was on screen.

**Diagnosis method:** Instrumented the memo directly to log a counter on
each recomputation — it fired 3 times on mount (benign: query loading state
transitions) and again immediately after the first click (not benign).
Cross-checked against `ProgressContext`'s own `derived` memo to confirm
`weakIds` was the specific value changing at that exact moment.

**Fix:** Same pattern as bugs #4 and #6 — pin the resolved value once per
session rather than re-deriving it reactively:

```ts
const resolvedRef = useRef<{ testId: string; result: {...} } | null>(null)
// ...
if (resolvedRef.current?.testId === testId) return resolvedRef.current.result
// ...compute fresh result...
resolvedRef.current = { testId, result }
```

The question set is now derived exactly once per `testId` and stays stable
for the rest of that session regardless of how many times `weakIds` changes
afterward — which also, as a side effect, makes "replay this test" replay
the *same* questions rather than a fresh random draw.

**Verified:** Direct reproduction test that answers 5 exam questions in a
row and asserts the tab count stays at 20 and the mistake counter increments
monotonically throughout — this would have failed hard before the fix (the
array kept getting replaced, sometimes shrinking below 20 momentarily during
the resample). Also covered indirectly by the full `interactions.spec.ts`
and `actions.spec.ts` exam-mode suites now passing reliably instead of
intermittently.

---

## 21. Lazy-loaded routes crashed on WebKit when navigated to offline

**Found while investigating:** WebKit-only test failures in the same offline
regression pass as #19 and #20.

**Symptom:** On simulated offline WebKit specifically, navigating in-app to
a page not yet opened this session produced React Router's raw
`ErrorBoundary` screen: **"Importing a module script failed."**

**Root cause:** Every page was `React.lazy(() => import('@/pages/x'))`. A
dynamic `import()` for a route visited for the first time has to be served
entirely from the service worker's cache when offline — and WebKit's
handling of ES module `import()` interacting with service-worker-intercepted
fetches is less reliable than Chromium's, causing the module fetch to fail
outright rather than resolve from cache. This is a real, user-facing crash
path: an iPhone user offline, tapping into (for example) the Bank tab for
the first time that session, would see a broken error screen instead of the
app.

**Fix:** Removed `React.lazy()` code-splitting for pages entirely — every
page is now a plain static import, bundled into one chunk. Measured total
size: **255.7 KB gzip** for the whole app, small enough that the marginal
cost to first paint is negligible, especially since the whole bundle is
precached anyway before offline use matters. This eliminates the entire
class of "dynamic import fails under simulated/real offline" bug, on every
browser, permanently — rather than working around WebKit's specific
behaviour today.

**Verified:** `e2e/deploy.spec.ts`'s bundle-output check plus re-running the
full `pwa.spec.ts` suite on `mobile-safari` — the specific test that had
been crashing with the module-import error now passes cleanly.

---

## 22. Install-card test's premise was wrong for iOS

**Found while:** cleaning up the mobile-safari test run after fix #21.

**Root cause:** Not an app bug — a test-authoring gap. The test asserted the
install card is `hidden` until a synthetic `beforeinstallprompt` fires. On
iOS there is no such event at all; `useInstallPrompt()` correctly shows the
card unconditionally there, with install-via-share-sheet instructions
instead, because that's the only way iOS can offer installation. The test's
assumption (`hidden until installable-event fires`) only holds for the
Chromium/Android install-prompt path.

**Fix:** The test now skips on `webkit` with a comment explaining iOS's
separate, unconditional card path is covered by its own dedicated test.

**Verified:** `e2e/pwa.spec.ts` — the iOS-specific card behaviour has its own
test (`needsIOSInstructions` path), unaffected by this change.

---

## 23. Two offline tests failed only under headless WebKit's own automation limitations

**Found while:** finishing the mobile-safari cleanup after fixes #19–#22.

**Root cause:** Not an app bug. Two tests — one exercising a genuine cache
miss, one exercising the image-retry flow — failed specifically and only
under Playwright's headless WebKit build, with either `"WebKit encountered
an internal error"` during `page.goto()` while offline, or a real fetch
error for a resource that was demonstrably precached (confirmed by
inspecting Cache Storage directly). This matches a pre-existing, already-
documented limitation in the same file: headless WebKit's `context.
setOffline()` emulation does not interact reliably with service worker cache
lookups — a known gap between Playwright's minimal automation-oriented
WebKit build and real Safari's networking stack, not something demonstrated
on an actual device.

**Resolution:** Both tests are skipped on `webkit` with comments naming the
specific limitation and pointing to the architectural fixes (#19, #21) as
verified working on Chromium and Android Chrome, which is where offline
behaviour is actually exercised for this browser engine.

**Not resolved by:** trying to "fix" application code for a failure mode
only reproducible inside the test harness itself, with no corroborating
evidence it reflects real Safari behaviour.

---

## Summary table

| # | Symptom | Root cause category | Fix pattern |
|---|---|---|---|
| 1 | Corrupted downloaded images | Server 200s on missing resource | Validate content, not status |
| 2 | "Permanently" broken image URLs | Source data changed between scrapes | Prefer newer source |
| 3 | R2 access denied | Wrong verification command in docs | Match command scope to token scope |
| 4 | (prerequisite for #6) | Unstable object identity | Memoise on real dependency |
| 5 | Answer lost on instant navigation | Ref updated during render, not atomically | Update ref inside the state updater |
| 6 | Exit button "not working" | Reactive value → persist → reactive value loop | Pin value once per session (`useRef`) |
| 7 | Netlify served HTML for `.json` | Build pipeline missing a step | Port generator, wire into `build` |
| 8 | "Powered by Netlify" badge | Not a bug — a platform feature | Dashboard toggle; declined a script workaround |
| 9 | Offline broken on first visit | Missing `clientsClaim` | Enable it explicitly |
| 10 | Install prompt missed | Event fired before React mounted | Inline script stashes it early |
| 11 | Invisible logo in light mode | Duplicate hardcoded SVG id | `useId()` per instance |
| 12 | Heatmap looked empty | Miscalibrated colour + wrong scroll position | Recalibrate + auto-scroll to today |
| 13 | Wrong dialog label | Copy-pasted i18n key | Dedicated keys per context |
| 14 | Slider scroll buttons missing | Full-bleed width mismatch | Match container width to layout |
| 15 | Mouse wheel did nothing | `forceToAxis: true` (self-introduced) | `forceToAxis: false` |
| 16 | Slider didn't scroll at all | `overflow-visible` override | Remove it |
| 17 | Silent empty test grid | No `isError` branch | Add error state + retry |
| 18 | Images vanish instead of showing unavailable | `return null` on failure | Honest placeholder + retry |
| 19 | Offline navigation hangs forever | `networkMode` gates fetch on `navigator.onLine` | `networkMode: 'always'` |
| 20 | Exam/practice answers "do nothing" | Unrelated reactive value reshuffles `sample()` result | Pin resolved question set per session |
| 21 | WebKit crashes navigating offline | Dynamic `import()` unreliable under SW + offline | Remove code-splitting |
| 22 | Flaky install-card test | Test assumption wrong for iOS | Skip with documented reason |
| 23 | Flaky WebKit offline tests | Harness limitation, not app bug | Skip with documented reason |
