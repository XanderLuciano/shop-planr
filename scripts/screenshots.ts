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
 *   BASE_URL        defaults to http://localhost:3000
 *   VIEWPORTS       comma-separated subset of {desktop,tablet,mobile} to limit output
 *   SCREENSHOT_PIN  PIN for an existing user (default: 0000; auto-set on first run)
 *
 * Output: docs/screenshots/<viewport>/<name>.png
 */
import puppeteer, { type Viewport } from 'puppeteer'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const OUTPUT_DIR = resolve(import.meta.dirname, '..', 'docs', 'screenshots')
const DEFAULT_PIN = process.env.SCREENSHOT_PIN || '0000'
const AUTH_COOKIE = 'shop-planr-auth-token'

interface PublicUser {
  id: string
  username: string
  displayName: string
  isAdmin: boolean
  hasPin: boolean
}

/**
 * Authenticate against the running dev server and return a JWT.
 *
 * Strategy:
 *   1. GET /api/users → pick the first admin (or first user)
 *   2. If the user has no PIN yet → POST /api/auth/setup-pin (sets DEFAULT_PIN)
 *   3. If the user already has a PIN → POST /api/auth/login with DEFAULT_PIN
 */
async function authenticate(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/users`)
  if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`)
  const users: PublicUser[] = await res.json()
  if (!users.length) throw new Error('No users found — run `npm run seed` first')

  const user = users.find(u => u.isAdmin) ?? users[0]!
  console.log(`🔑  Authenticating as ${user.displayName} (${user.username})`)

  let authRes: Response
  if (!user.hasPin) {
    authRes = await fetch(`${BASE_URL}/api/auth/setup-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, pin: DEFAULT_PIN }),
    })
  } else {
    authRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, pin: DEFAULT_PIN }),
    })
  }

  if (!authRes.ok) {
    const body = await authRes.text()
    throw new Error(`Auth failed (${authRes.status}): ${body}`)
  }

  const { token } = await authRes.json() as { token: string }
  return token
}

interface ScreenshotSpec {
  name: string
  path: string
  /** Label shown in the README screenshot grid */
  label: string
  /** Short description for the README caption */
  description?: string
  /** Whether to include in the README screenshot grid (default: true) */
  readme?: boolean
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
  { name: 'dashboard', path: '/', label: 'Dashboard', description: 'Summary cards, job progress, bottleneck alerts' },
  { name: 'jobs-list', path: '/jobs', label: 'Jobs List', description: 'Expandable table with paths and steps' },
  { name: 'jobs-new', path: '/jobs/new', label: 'New Job', description: 'Job creation form', readme: false },
  { name: 'parts', path: '/parts', label: 'Parts View', description: 'Active parts grouped by job/step' },
  { name: 'parts-browser', path: '/parts-browser', label: 'Parts Browser', description: 'Searchable/filterable part list' },
  { name: 'queue', path: '/queue', label: 'Work Queue', description: 'Grouped by operator/assignee' },
  { name: 'templates', path: '/templates', label: 'Templates', description: 'Reusable route template CRUD' },
  { name: 'bom', path: '/bom', label: 'BOM', description: 'Bill of materials roll-ups', readme: false },
  { name: 'audit', path: '/audit', label: 'Audit Trail', description: 'Filterable event log' },
  { name: 'certs', path: '/certs', label: 'Certificates', description: 'Certificate management', readme: false },
  { name: 'jira', path: '/jira', label: 'Jira', description: 'Jira ticket dashboard', readme: false },
  { name: 'settings', path: '/settings', label: 'Settings', description: 'Users, Jira, libraries' },
]

function selectedViewports(): ViewportSpec[] {
  const filter = process.env.VIEWPORTS?.split(',').map(s => s.trim()).filter(Boolean)
  if (!filter?.length) return viewports

  const knownNames = new Set(viewports.map(v => v.name))
  const unknown = filter.filter(f => !knownNames.has(f))
  if (unknown.length) {
    throw new Error(`VIEWPORTS contains unknown viewport(s): ${unknown.join(', ')}. Valid: ${viewports.map(v => v.name).join(', ')}`)
  }

  return viewports.filter(v => new Set(filter).has(v.name))
}

const README_START = '<!-- SCREENSHOTS:START -->'
const README_END = '<!-- SCREENSHOTS:END -->'

/**
 * Regenerate the screenshot grid in README.md between marker comments.
 * Uses the `pages` array as the single source of truth — no manual sync needed.
 */
async function updateReadmeScreenshots() {
  const readmePath = resolve(import.meta.dirname, '..', 'README.md')
  const content = await readFile(readmePath, 'utf-8')

  const startIdx = content.indexOf(README_START)
  const endIdx = content.indexOf(README_END)
  if (startIdx === -1 || endIdx === -1) {
    console.warn('⚠️  README.md missing screenshot markers, skipping update')
    return
  }

  const readmePages = pages.filter(p => p.readme !== false)
  const rows: string[] = []

  // Build 2-column grid
  for (let i = 0; i < readmePages.length; i += 2) {
    const left = readmePages[i]!
    const right = readmePages[i + 1]

    const leftImg = `![${left.label}](docs/screenshots/desktop/${left.name}.png)`
    const leftCap = `${left.label} — ${left.description}`

    if (right) {
      const rightImg = `![${right.label}](docs/screenshots/desktop/${right.name}.png)`
      const rightCap = `${right.label} — ${right.description}`
      rows.push(`| ${leftImg} | ${rightImg} |`)
      rows.push(`| ${leftCap} | ${rightCap} |`)
    } else {
      rows.push(`| ${leftImg} | |`)
      rows.push(`| ${leftCap} | |`)
    }
  }

  const table = [
    '| | |',
    '|---|---|',
    ...rows,
  ].join('\n')

  const generated = `${README_START}\n${table}\n${README_END}`
  const updated = content.slice(0, startIdx) + generated + content.slice(endIdx + README_END.length)

  await writeFile(readmePath, updated, 'utf-8')
  console.log(`📝  Updated README.md screenshot grid (${readmePages.length} pages)`)
}

async function main() {
  const targets = selectedViewports()
  const token = await authenticate()
  const browser = await puppeteer.launch({ headless: true })

  // Build the cookie object once — reused for every page
  const baseUrl = new URL(BASE_URL)
  const authCookie = {
    name: AUTH_COOKIE,
    value: token,
    domain: baseUrl.hostname,
    path: '/',
    httpOnly: false,
    secure: baseUrl.protocol === 'https:',
    sameSite: 'Lax' as const,
  }

  try {
    for (const vp of targets) {
      const vpDir = resolve(OUTPUT_DIR, vp.name)
      await mkdir(vpDir, { recursive: true })

      const page = await browser.newPage()
      await page.setViewport(vp.viewport)
      await page.setCookie(authCookie)

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

  await updateReadmeScreenshots()
}

main().catch((err) => {
  console.error('Screenshot generation failed:', err)
  process.exit(1)
})
