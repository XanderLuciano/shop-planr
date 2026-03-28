/**
 * Property 5: Slug resolution correctness
 *
 * For any valid content file path in `content/api-docs/`, the URL slug
 * `/api-docs/{slug}` resolves to that file and no two files map to the same slug.
 *
 * This property test verifies the slug resolution mapping at the filesystem level:
 * 1. Collect all `.md` files in `content/api-docs/` recursively
 * 2. For each file, compute the expected URL slug
 * 3. Verify the reverse mapping: given a slug, the corresponding file exists on disk
 * 4. Verify no two files map to the same slug (uniqueness)
 * 5. Use fast-check to generate random subsets and verify the property
 *
 * **Validates: Requirements 4.1, 4.3**
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
 *      `api-docs/index.md`      → `/api-docs`
 */
function filePathToSlug(relativePath: string): string {
  let slug = relativePath
    .replace(/\.md$/, '')
    .replace(/\\/g, '/') // normalise Windows separators

  // index files resolve to the parent path
  if (slug.endsWith('/index')) {
    slug = slug.slice(0, -'/index'.length)
  }
  if (slug === 'index') {
    slug = ''
  }

  return `/${slug}`
}

/**
 * Given a slug, compute the possible file paths that could resolve to it.
 * e.g. `/api-docs/jobs/create` → `api-docs/jobs/create.md`
 *      `/api-docs/jobs`        → `api-docs/jobs/index.md` or `api-docs/jobs.md`
 *      `/api-docs`             → `api-docs/index.md`
 */
function slugToFileCandidates(slug: string): string[] {
  // Remove leading slash
  const stripped = slug.replace(/^\//, '')
  if (stripped === '') return ['index.md']

  return [
    `${stripped}.md`,
    `${stripped}/index.md`
  ]
}

describe('Property 5: Slug resolution correctness', () => {
  // Collect all markdown files relative to content/ root (so paths start with `api-docs/...`)
  const apiDocsFiles = collectMarkdownFiles(API_DOCS_DIR, CONTENT_ROOT)

  it('content/api-docs/ contains at least one markdown file', () => {
    expect(apiDocsFiles.length).toBeGreaterThan(0)
  })

  it('every content file resolves to a slug starting with /api-docs', () => {
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

  it('for any content file, the reverse slug-to-file mapping resolves to an existing file', () => {
    const arbFile = fc.constantFrom(...apiDocsFiles)

    fc.assert(
      fc.property(arbFile, (filePath) => {
        const slug = filePathToSlug(filePath)
        const candidates = slugToFileCandidates(slug)

        // At least one candidate must match the original file path
        const matchesOriginal = candidates.some(
          (candidate) => candidate.replace(/\\/g, '/') === filePath.replace(/\\/g, '/')
        )
        expect(
          matchesOriginal,
          `Slug "${slug}" from file "${filePath}" does not reverse-map to any candidate: [${candidates.join(', ')}]`
        ).toBe(true)

        // The resolved file must exist on disk
        const existsOnDisk = candidates.some((candidate) =>
          existsSync(join(CONTENT_ROOT, candidate))
        )
        expect(
          existsOnDisk,
          `Slug "${slug}" does not resolve to any existing file on disk. Candidates: [${candidates.join(', ')}]`
        ).toBe(true)
      }),
      { numRuns: Math.min(apiDocsFiles.length * 5, 200) }
    )
  })

  it('no two content files map to the same slug (uniqueness)', () => {
    const slugMap = new Map<string, string>()

    for (const filePath of apiDocsFiles) {
      const slug = filePathToSlug(filePath)
      const existing = slugMap.get(slug)
      expect(
        existing,
        `Slug collision: "${slug}" is mapped by both "${existing}" and "${filePath}"`
      ).toBeUndefined()
      slugMap.set(slug, filePath)
    }
  })

  it('random subsets of files all have unique, reversible slug mappings', () => {
    const arbSubset = fc.subarray(apiDocsFiles, { minLength: 1 })

    fc.assert(
      fc.property(arbSubset, (subset) => {
        const slugs = new Set<string>()

        for (const filePath of subset) {
          const slug = filePathToSlug(filePath)

          // Slug must start with /api-docs
          expect(slug.startsWith('/api-docs')).toBe(true)

          // Slug must be unique within the subset
          expect(
            slugs.has(slug),
            `Duplicate slug "${slug}" in random subset`
          ).toBe(false)
          slugs.add(slug)

          // Reverse mapping must resolve to an existing file
          const candidates = slugToFileCandidates(slug)
          const existsOnDisk = candidates.some((candidate) =>
            existsSync(join(CONTENT_ROOT, candidate))
          )
          expect(existsOnDisk).toBe(true)
        }
      }),
      { numRuns: 50 }
    )
  })
})
