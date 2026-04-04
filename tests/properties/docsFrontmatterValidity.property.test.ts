/**
 * Property 3: Endpoint frontmatter validity
 *
 * For any Endpoint_Doc in the Content_Directory, the frontmatter must contain
 * all required fields (title, method, endpoint, service, category) and the method
 * field must be one of GET, POST, PUT, PATCH, or DELETE.
 *
 * **Validates: Requirements 2.1, 2.2**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, resolve } from 'path'

const CONTENT_DIR = resolve(__dirname, '../../content/api-docs')

const VALID_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

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

/**
 * Discover all endpoint .md files in content/api-docs/ subdirectories,
 * excluding index.md files (those are category indexes, not endpoint docs).
 */
function getEndpointFiles(): string[] {
  const files: string[] = []

  const subdirs = readdirSync(CONTENT_DIR).filter((entry) => {
    const fullPath = join(CONTENT_DIR, entry)
    return statSync(fullPath).isDirectory()
  })

  for (const subdir of subdirs) {
    const dirPath = join(CONTENT_DIR, subdir)
    const mdFiles = readdirSync(dirPath).filter(
      f => f.endsWith('.md') && f !== 'index.md',
    )
    for (const file of mdFiles) {
      files.push(join(subdir, file))
    }
  }

  return files
}

describe('Property 3: Endpoint frontmatter validity', () => {
  const endpointFiles = getEndpointFiles()

  // Arbitrary that picks from actual endpoint files on disk
  const arbEndpointFile = fc.constantFrom(...endpointFiles)

  it('discovers at least one endpoint file', () => {
    expect(endpointFiles.length).toBeGreaterThan(0)
  })

  it('every endpoint doc has all required frontmatter fields with valid values', () => {
    fc.assert(
      fc.property(arbEndpointFile, (relPath) => {
        const fullPath = join(CONTENT_DIR, relPath)
        const content = readFileSync(fullPath, 'utf-8')
        const fm = parseFrontmatter(content)

        // title: non-empty string
        expect(typeof fm.title, `${relPath}: title must be a string`).toBe('string')
        expect((fm.title as string).length, `${relPath}: title must be non-empty`).toBeGreaterThan(0)

        // method: one of GET, POST, PUT, PATCH, DELETE
        expect(typeof fm.method, `${relPath}: method must be a string`).toBe('string')
        expect(
          VALID_METHODS,
          `${relPath}: method "${fm.method}" must be one of ${VALID_METHODS.join(', ')}`,
        ).toContain(fm.method)

        // endpoint: non-empty string starting with /api/
        expect(typeof fm.endpoint, `${relPath}: endpoint must be a string`).toBe('string')
        expect((fm.endpoint as string).length, `${relPath}: endpoint must be non-empty`).toBeGreaterThan(0)
        expect(
          (fm.endpoint as string).startsWith('/api/'),
          `${relPath}: endpoint "${fm.endpoint}" must start with /api/`,
        ).toBe(true)

        // service: non-empty string
        expect(typeof fm.service, `${relPath}: service must be a string`).toBe('string')
        expect((fm.service as string).length, `${relPath}: service must be non-empty`).toBeGreaterThan(0)

        // category: non-empty string
        expect(typeof fm.category, `${relPath}: category must be a string`).toBe('string')
        expect((fm.category as string).length, `${relPath}: category must be non-empty`).toBeGreaterThan(0)
      }),
      { numRuns: endpointFiles.length * 3 },
    )
  })
})
