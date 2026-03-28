/**
 * Property 2: Content directory structure completeness
 *
 * For any service domain subdirectory in `content/api-docs/`, that subdirectory
 * must contain an `index.md` Category_Index file with title, description, icon,
 * and navigation order frontmatter fields.
 *
 * **Validates: Requirements 1.2, 2.5**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { readdirSync, readFileSync, existsSync, statSync } from 'fs'
import { join, resolve } from 'path'

const CONTENT_DIR = resolve(__dirname, '../../content/api-docs')

const EXPECTED_DOMAINS = [
  'jobs', 'paths', 'serials', 'certs', 'templates', 'bom',
  'audit', 'jira', 'settings', 'users', 'notes', 'operator',
  'steps', 'library'
] as const

/**
 * Parse YAML frontmatter from a markdown file.
 * Extracts content between opening and closing `---` delimiters
 * and parses key-value pairs including nested `navigation.order`.
 */
function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}

  const yaml = match[1]
  const result: Record<string, unknown> = {}
  const lines = yaml.split(/\r?\n/)

  let currentKey: string | null = null
  const nested: Record<string, Record<string, unknown>> = {}

  for (const line of lines) {
    // Nested value (indented under a parent key)
    const nestedMatch = line.match(/^\s{2,}(\w+):\s*(.+)$/)
    if (nestedMatch && currentKey) {
      if (!nested[currentKey]) nested[currentKey] = {}
      const val = nestedMatch[2].trim().replace(/^["']|["']$/g, '')
      const num = Number(val)
      nested[currentKey][nestedMatch[1]] = isNaN(num) ? val : num
      continue
    }

    // Top-level key
    const topMatch = line.match(/^(\w+):\s*(.*)$/)
    if (topMatch) {
      const key = topMatch[1]
      const rawVal = topMatch[2].trim().replace(/^["']|["']$/g, '')
      if (rawVal === '') {
        // Parent key for nested block
        currentKey = key
      } else {
        currentKey = null
        const num = Number(rawVal)
        result[key] = isNaN(num) ? rawVal : num
      }
    }
  }

  // Merge nested objects
  for (const [key, val] of Object.entries(nested)) {
    result[key] = val
  }

  return result
}

/** Get all subdirectories in content/api-docs/ */
function getSubdirectories(): string[] {
  if (!existsSync(CONTENT_DIR)) return []
  return readdirSync(CONTENT_DIR).filter(entry => {
    const fullPath = join(CONTENT_DIR, entry)
    return statSync(fullPath).isDirectory()
  })
}

describe('Property 2: Content directory structure completeness', () => {
  const subdirectories = getSubdirectories()

  // Arbitrary that picks from actual subdirectories found on disk
  const arbSubdirectory = fc.constantFrom(...subdirectories)

  it('all 14 expected service domains have subdirectories', () => {
    for (const domain of EXPECTED_DOMAINS) {
      expect(
        subdirectories,
        `Missing subdirectory for service domain: ${domain}`
      ).toContain(domain)
    }
  })

  it('every subdirectory contains an index.md with required frontmatter', () => {
    fc.assert(
      fc.property(arbSubdirectory, (subdir) => {
        const indexPath = join(CONTENT_DIR, subdir, 'index.md')

        // index.md must exist
        expect(existsSync(indexPath), `${subdir}/index.md must exist`).toBe(true)

        const content = readFileSync(indexPath, 'utf-8')
        const fm = parseFrontmatter(content)

        // title: non-empty string
        expect(typeof fm.title, `${subdir}/index.md: title must be a string`).toBe('string')
        expect((fm.title as string).length, `${subdir}/index.md: title must be non-empty`).toBeGreaterThan(0)

        // description: non-empty string
        expect(typeof fm.description, `${subdir}/index.md: description must be a string`).toBe('string')
        expect((fm.description as string).length, `${subdir}/index.md: description must be non-empty`).toBeGreaterThan(0)

        // icon: non-empty string
        expect(typeof fm.icon, `${subdir}/index.md: icon must be a string`).toBe('string')
        expect((fm.icon as string).length, `${subdir}/index.md: icon must be non-empty`).toBeGreaterThan(0)

        // navigation.order: number
        const nav = fm.navigation as Record<string, unknown> | undefined
        expect(nav, `${subdir}/index.md: navigation must exist`).toBeDefined()
        expect(typeof nav!.order, `${subdir}/index.md: navigation.order must be a number`).toBe('number')
      }),
      { numRuns: subdirectories.length * 3 }
    )
  })
})
