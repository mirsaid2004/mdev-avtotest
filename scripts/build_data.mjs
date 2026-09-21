#!/usr/bin/env node
/**
 * Turn the raw scrapes into the two files the app fetches at runtime.
 *
 *   public/data/questions.json  - every question, deduped, all 4 languages
 *   public/data/tests.json      - test templates, referencing question ids
 *
 * Node rather than Python because this runs in CI: a deploy host is guaranteed
 * to have Node (it just installed the app with it) but not a usable Python.
 *
 *   node scripts/build_data.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SCRAPES = join(ROOT, 'scrapes')
const OUT = join(ROOT, 'public', 'data')

const LANGS = ['uzb', 'uzc', 'ru']

const jsonFiles = (dir) => {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => join(dir, f))
      .sort()
  } catch {
    return []
  }
}

const baseName = (url) => {
  const name = (url ?? '').split('/').pop()?.split('?')[0]
  return name || null
}

const pickLangs = (obj) =>
  Object.fromEntries(LANGS.map((l) => [l, (obj ?? {})[l] ?? '']))

/** Flatten a scraped question into the app's shape. */
const normQuestion = (q) => ({
  id: q.id,
  text: pickLangs(q.question),
  media: baseName(q.media),
  answerId: q.answerId,
  answers: (q.answers ?? []).map((a) => ({
    id: a.id,
    text: pickLangs(a.answer),
    media: baseName(a.media),
  })),
  sort: q.sort ?? null,
})

function main() {
  const questions = new Map()
  const tests = []

  // --- tests-20: the composed file, newest scrape, authoritative ---
  for (const path of jsonFiles(join(SCRAPES, 'tests-20'))) {
    const data = JSON.parse(readFileSync(path, 'utf8'))
    for (const test of Object.values(data)) {
      const questionIds = []
      for (const q of test.questions ?? []) {
        questions.set(q.id, normQuestion(q)) // overwrite: newest wins
        questionIds.push(q.id)
      }
      tests.push({
        id: `t20-${test.templateNumber}`,
        size: 20,
        number: test.templateNumber,
        questionIds,
      })
    }
  }

  // --- tests-10: older, only fills questions the newer scrape lacks ---
  for (const path of jsonFiles(join(SCRAPES, 'tests-10'))) {
    const m = basename(path).match(/solvetest-(\d+)-/)
    const number = m ? Number(m[1]) : tests.length
    const body = JSON.parse(JSON.parse(readFileSync(path, 'utf8')).body)
    const questionIds = []
    for (const q of body.questions ?? []) {
      if (!questions.has(q.id)) questions.set(q.id, normQuestion(q))
      questionIds.push(q.id)
    }
    if (questionIds.length) {
      tests.push({ id: `t10-${number}`, size: 10, number, questionIds })
    }
  }

  // The 10-question sets carry e-avtomaktab's internal URL ids (5..356, with
  // gaps). "Test #356" means nothing to a student, so renumber them 1..N for
  // display while keeping `id` tied to the source id so URLs stay stable.
  tests.sort((a, b) => b.size - a.size || a.number - b.number)
  for (const size of [20, 10]) {
    tests
      .filter((t) => t.size === size)
      .forEach((t, i) => {
        t.sourceNumber = t.number
        t.number = i + 1
      })
  }

  const ordered = [...questions.keys()].sort((a, b) => a - b).map((k) => questions.get(k))

  mkdirSync(OUT, { recursive: true })
  const qp = join(OUT, 'questions.json')
  const tp = join(OUT, 'tests.json')
  writeFileSync(qp, JSON.stringify(ordered))
  writeFileSync(tp, JSON.stringify(tests))

  // --- integrity, loudly: a silent bad build is worse than a failed one ---
  const badAnswer = ordered.filter((q) => !q.answers.some((a) => a.id === q.answerId))
  const blankText = ordered.filter((q) => !q.text.uzb.trim())
  const known = new Set(questions.keys())
  const dangling = [...new Set(tests.flatMap((t) => t.questionIds).filter((id) => !known.has(id)))]

  const kb = (p) => (statSync(p).size / 1024).toFixed(0)
  console.log(`questions.json  ${String(ordered.length).padStart(5)} questions   ${kb(qp).padStart(7)} KB`)
  console.log(`tests.json      ${String(tests.length).padStart(5)} templates   ${kb(tp).padStart(7)} KB`)
  console.log(`  20-question tests: ${tests.filter((t) => t.size === 20).length}`)
  console.log(`  10-question tests: ${tests.filter((t) => t.size === 10).length}`)
  console.log(`  with image:        ${ordered.filter((q) => q.media).length}`)
  console.log()
  console.log(`  answerId not among answers: ${badAnswer.length}`)
  console.log(`  blank uzb text:             ${blankText.length}`)
  console.log(`  tests referencing unknown q:${dangling.length}`)

  // the source bank is not fully translated - surface the gaps rather than
  // shipping blank questions to whoever picks that language
  console.log()
  for (const lang of LANGS) {
    const q = ordered.filter((x) => !x.text[lang].trim()).length
    const a = ordered.flatMap((x) => x.answers).filter((x) => !x.text[lang].trim()).length
    const flag = q || a ? '  <- falls back to uzb at render time' : ''
    console.log(`  ${lang}: ${String(q).padStart(4)} questions, ${String(a).padStart(4)} answers untranslated${flag}`)
  }

  if (ordered.length === 0 || tests.length === 0) {
    console.error('\nERROR: produced an empty bank - are the scrapes present?')
    process.exit(1)
  }
  if (badAnswer.length || dangling.length) {
    console.error('\nERROR: integrity check failed')
    process.exit(1)
  }
}

main()
