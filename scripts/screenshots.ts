/**
 * Automated screenshot generator for Shop Planr README.
 *
 * Usage:
 *   1. Start the dev server:  npm run dev
 *   2. Run this script:       npm run screenshots
 *
 * Screenshots are saved to docs/screenshots/ and referenced in README.md.
 */
import puppeteer from 'puppeteer'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const OUTPUT_DIR = resolve(import.meta.dirname, '..', 'docs', 'screenshots')
const VIEWPORT = { width: 1440, height: 900 }

interface ScreenshotSpec {
  name: string
  path: string
  /** Optional delay (ms) after navigation to let async data load */
  waitMs?: number
}

const pages: ScreenshotSpec[] = [
  { name: 'dashboard', path: '/' },
  { name: 'jobs-list', path: '/jobs' },
  { name: 'parts-view', path: '/parts' },
  { name: 'work-queue', path: '/queue' },
  { name: 'templates', path: '/templates' },
  { name: 'bom', path: '/bom' },
  { name: 'audit', path: '/audit' },
  { name: 'serials', path: '/serials' },
  { name: 'settings', path: '/settings' },
]

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true })

  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  await page.setViewport(VIEWPORT)

  for (const spec of pages) {
    const url = `${BASE_URL}${spec.path}`
    console.log(`📸  ${spec.name} → ${url}`)

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 })

    if (spec.waitMs) {
      await new Promise(r => setTimeout(r, spec.waitMs))
    }

    const file = resolve(OUTPUT_DIR, `${spec.name}.png`)
    await page.screenshot({ path: file, fullPage: false })
  }

  await browser.close()
  console.log(`\n✅  ${pages.length} screenshots saved to docs/screenshots/`)
}

main().catch((err) => {
  console.error('Screenshot generation failed:', err)
  process.exit(1)
})
