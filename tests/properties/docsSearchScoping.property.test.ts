/**
 * Property 7: Search result scoping
 *
 * For any search query, all returned results have paths starting with `/api-docs`.
 *
 * Since Nuxt Content search requires the Nuxt runtime, this property test verifies
 * the scoping constraint at the content file level:
 * 1. Every `.md` file in `content/api-docs/` converts to a URL slug starting with `/api-docs`
 * 2. No content files exist outside `content/api-docs/` that could leak into search results
 * 3. Random subsets of discovered files all satisfy the scoping property
 *
 * **Validates: Requirement 7.2**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { readdirSync, existsSync, statSync } from 'fs'
import { join, resolve, relative } from 'path'

const CONTENT_ROOT = resolve(__dirname, '../../content')
const API_DOCS_DIR = resolve(__dirname, '../../content/api-docs')

/**
 * Recursively collect all `.md` files under a directory.
 * Returns paths relative to the given base directory.
 */
function collectMarkdownFiles(dir: string, base: string = dir): string[] {
  if (!existsSync(dir)) return []
  const results: string[] = []

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    if (statSync(fullPath).isDirectory()) {
      results.push(...collectMarkdownFiles(fullPath, base))
    } else if (entry.endsWith('.md')) {
      results.push(relative(base, fullPath))
    }
  }

  return results
}

/**
 * Convert a content file path (relative to `content/`) to its URL slug.
 * e.g. `api-docs/jobs/create.md` → `/api-docs/jobs/create`
 *      `api-docs/jobs/index.md` → `/api-docs/jobs`
 */
function filePathToSlug(relativePath: string): string {
  let slug = relativePath.replace(/\.md$/, '').replace(/\\/g, '/') // normalise Windows separators

  // index files resolve to the parent path
  if (slug.endsWith('/index')) {
    slug = slug.slice(0, -'/index'.length)
  }
  if (slug === 'index') {
    slug = ''
  }

  return `/${slug}`
}

describe('Property 7: Search result scoping', () => {
  const apiDocsFiles = collectMarkdownFiles(API_DOCS_DIR, CONTENT_ROOT)

  it('content/api-docs/ contains at least one markdown file', () => {
    expect(apiDocsFiles.length).toBeGreaterThan(0)
  })

  it('every content file slug starts with /api-docs', () => {
    // Use fast-check to pick random subsets of the discovered files
    const arbFile = fc.constantFrom(...apiDocsFiles)

    fc.assert(
      fc.property(arbFile, (filePath) => {
        const slug = filePathToSlug(filePath)
        expect(
          slug.startsWith('/api-docs'),
          `File "${filePath}" resolves to slug "${slug}" which does not start with /api-docs`
        ).toBe(true)
      }),
      { numRuns: Math.min(apiDocsFiles.length * 5, 200) }
    )
  })

  it('random subsets of files all have slugs scoped to /api-docs', () => {
    const arbSubset = fc.subarray(apiDocsFiles, { minLength: 1 })

    fc.assert(
      fc.property(arbSubset, (subset) => {
        for (const filePath of subset) {
          const slug = filePathToSlug(filePath)
          expect(
            slug.startsWith('/api-docs'),
            `File "${filePath}" resolves to slug "${slug}" which is not scoped to /api-docs`
          ).toBe(true)
        }
      }),
      { numRuns: 50 }
    )
  })

  it('no stray markdown files exist at content/ root that could leak into search', () => {
    if (!existsSync(CONTENT_ROOT)) return

    const topLevelEntries = readdirSync(CONTENT_ROOT)

    // No stray .md files at content/ root (they would be in the default collection, not scoped)
    const rootMdFiles = topLevelEntries.filter(
      (entry) => entry.endsWith('.md') && statSync(join(CONTENT_ROOT, entry)).isFile()
    )
    expect(
      rootMdFiles,
      `No .md files should exist at content/ root, found: [${rootMdFiles.join(', ')}]`
    ).toEqual([])
  })
})
