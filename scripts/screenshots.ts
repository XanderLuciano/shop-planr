/**
 * Automated screenshot generator for Shop Planr.
 *
 * Captures every static route in the app at three viewports
 * (desktop, tablet, mobile) so UI changes can be diffed visually.
 *
 * Usage:
 *   1. Start the dev server:  npm run dev
 *   2. Run this script:       npm run screenshots
 *
 * Env vars:
 *   BASE_URL     defaults to http://localhost:3000
 *   VIEWPORTS    comma-separated subset of {desktop,tablet,mobile} to limit output
 *
 * Output: docs/screenshots/<viewport>/<name>.png
 */
import puppeteer, { type Viewport } from 'puppeteer'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const OUTPUT_DIR = resolve(import.meta.dirname, '..', 'docs', 'screenshots')

interface ScreenshotSpec {
  name: string
  path: string
  /** Optional delay (ms) after navigation to let async data load */
  waitMs?: number
}

interface ViewportSpec {
  name: string
  viewport: Viewport
}

const viewports: ViewportSpec[] = [
  { name: 'desktop', viewport: { width: 1440, height: 900, deviceScaleFactor: 1 } },
  { name: 'tablet', viewport: { width: 820, height: 1180, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  { name: 'mobile', viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
]

const pages: ScreenshotSpec[] = [
  { name: 'dashboard', path: '/' },
  { name: 'jobs-list', path: '/jobs' },
  { name: 'jobs-new', path: '/jobs/new' },
  { name: 'parts', path: '/parts' },
  { name: 'parts-browser', path: '/parts-browser' },
  { name: 'queue', path: '/queue' },
  { name: 'templates', path: '/templates' },
  { name: 'bom', path: '/bom' },
  { name: 'audit', path: '/audit' },
  { name: 'certs', path: '/certs' },
  { name: 'jira', path: '/jira' },
  { name: 'settings', path: '/settings' },
]

function selectedViewports(): ViewportSpec[] {
  const filter = process.env.VIEWPORTS?.split(',').map(s => s.trim()).filter(Boolean)
  if (!filter?.length) return viewports
  const allowed = new Set(filter)
  const chosen = viewports.filter(v => allowed.has(v.name))
  if (!chosen.length) {
    throw new Error(`VIEWPORTS="${process.env.VIEWPORTS}" matched none of: ${viewports.map(v => v.name).join(', ')}`)
  }
  return chosen
}

async function main() {
  const targets = selectedViewports()
  const browser = await puppeteer.launch({ headless: true })

  try {
    for (const vp of targets) {
      const vpDir = resolve(OUTPUT_DIR, vp.name)
      await mkdir(vpDir, { recursive: true })

      const page = await browser.newPage()
      await page.setViewport(vp.viewport)

      for (const spec of pages) {
        const url = `${BASE_URL}${spec.path}`
        console.log(`📸  [${vp.name}] ${spec.name} → ${url}`)

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 })

        if (spec.waitMs) {
          await new Promise(r => setTimeout(r, spec.waitMs))
        }

        const file = resolve(vpDir, `${spec.name}.png`)
        await page.screenshot({ path: file, fullPage: true })
      }

      await page.close()
    }
  } finally {
    await browser.close()
  }

  const total = targets.length * pages.length
  console.log(`\n✅  ${total} screenshots saved to docs/screenshots/ (${targets.map(v => v.name).join(', ')})`)
}

main().catch((err) => {
  console.error('Screenshot generation failed:', err)
  process.exit(1)
})
