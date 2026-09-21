import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'

const svg = readFileSync('public/icons/mark.svg', 'utf8')
const browser = await chromium.launch()

// maskable icons need the art inside a safe circle - pad it and fill the corners
const maskable = svg
  .replace('<rect width="512" height="512" rx="114" fill="url(#bg)"/>',
           '<rect width="512" height="512" fill="url(#bg)"/><g transform="translate(256 256) scale(0.78) translate(-256 -256)">')
  .replace('</svg>', '</g></svg>')

const targets = [
  { file: 'public/icons/icon-192.png', size: 192, src: svg },
  { file: 'public/icons/icon-512.png', size: 512, src: svg },
  { file: 'public/icons/maskable-512.png', size: 512, src: maskable },
  { file: 'public/icons/apple-touch-icon.png', size: 180, src: svg },
  { file: 'public/favicon-32.png', size: 32, src: svg },
  { file: 'public/favicon-16.png', size: 16, src: svg },
]

for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.size, height: t.size }, deviceScaleFactor: 1 })
  await page.setContent(
    `<style>html,body{margin:0;padding:0}svg{display:block;width:${t.size}px;height:${t.size}px}</style>${t.src}`,
  )
  const buf = await page.screenshot({ omitBackground: true })
  writeFileSync(t.file, buf)
  await page.close()
  console.log(`  ${t.file.padEnd(38)} ${t.size}x${t.size}  ${(buf.length / 1024).toFixed(1)} KB`)
}
await browser.close()
