/**
 * Property 6: Navigation tree ordering
 *
 * For any set of navigation items at any nesting level, items are sorted
 * ascending by `navigation.order`. Category index files have unique, ascending
 * order values, and within each category subdirectory endpoint files have
 * unique, ascending order values when sorted.
 *
 * **Validates: Requirement 6.5**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { readdirSync, readFileSync, existsSync, statSync } from 'fs'
import { join, resolve } from 'path'

const CONTENT_DIR = resolve(__dirname, '../../content/api-docs')

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
        currentKey = key
      } else {
        currentKey = null
        const num = Number(rawVal)
        result[key] = isNaN(num) ? rawVal : num
      }
    }
  }

  for (const [key, val] of Object.entries(nested)) {
    result[key] = val
  }

  return result
}

/** Get all subdirectories in content/api-docs/ */
function getCategories(): string[] {
  if (!existsSync(CONTENT_DIR)) return []
  return readdirSync(CONTENT_DIR).filter((entry) => {
    const fullPath = join(CONTENT_DIR, entry)
    return statSync(fullPath).isDirectory()
  })
}

/** Read navigation.order from a markdown file's frontmatter */
function getNavOrder(filePath: string): number | undefined {
  if (!existsSync(filePath)) return undefined
  const content = readFileSync(filePath, 'utf-8')
  const fm = parseFrontmatter(content)
  const nav = fm.navigation as Record<string, unknown> | undefined
  return nav?.order as number | undefined
}

/** Get non-index .md files in a category directory */
function getEndpointFiles(category: string): string[] {
  const dir = join(CONTENT_DIR, category)
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'index.md')
}

describe('Property 6: Navigation tree ordering', () => {
  const categories = getCategories()

  it('category index files have unique navigation.order values', () => {
    const orders: number[] = []
    for (const cat of categories) {
      const order = getNavOrder(join(CONTENT_DIR, cat, 'index.md'))
      expect(order, `${cat}/index.md must have a navigation.order`).toBeDefined()
      orders.push(order!)
    }

    // All order values must be unique
    const uniqueOrders = new Set(orders)
    expect(
      uniqueOrders.size,
      `Category navigation.order values must be unique, got: [${orders.join(', ')}]`
    ).toBe(orders.length)
  })

  it('category index files are sorted ascending by navigation.order', () => {
    const categoryOrders = categories
      .map((cat) => ({
        category: cat,
        order: getNavOrder(join(CONTENT_DIR, cat, 'index.md'))!,
      }))
      .filter((c) => c.order !== undefined)

    const sorted = [...categoryOrders].sort((a, b) => a.order - b.order)

    // Verify ascending: each order is strictly less than the next
    for (let i = 1; i < sorted.length; i++) {
      expect(
        sorted[i].order,
        `Category "${sorted[i].category}" (order ${sorted[i].order}) must be > "${sorted[i - 1].category}" (order ${sorted[i - 1].order})`
      ).toBeGreaterThan(sorted[i - 1].order)
    }
  })

  it('within each category, endpoint files have unique ascending navigation.order values', () => {
    // Use fast-check to pick random subsets of categories and verify ordering
    const arbCategory = fc.constantFrom(...categories)

    fc.assert(
      fc.property(arbCategory, (category) => {
        const endpointFiles = getEndpointFiles(category)
        if (endpointFiles.length === 0) return // skip empty categories

        const endpointOrders = endpointFiles.map((file) => ({
          file,
          order: getNavOrder(join(CONTENT_DIR, category, file)),
        }))

        // Every endpoint must have a navigation.order
        for (const ep of endpointOrders) {
          expect(ep.order, `${category}/${ep.file} must have a navigation.order`).toBeDefined()
        }

        // Sort by order and verify uniqueness + ascending
        const sorted = [...endpointOrders].sort((a, b) => a.order! - b.order!)
        const orders = sorted.map((e) => e.order!)
        const uniqueOrders = new Set(orders)

        expect(
          uniqueOrders.size,
          `${category}: endpoint navigation.order values must be unique, got: [${orders.join(', ')}]`
        ).toBe(orders.length)

        for (let i = 1; i < sorted.length; i++) {
          expect(
            sorted[i].order!,
            `${category}/${sorted[i].file} (order ${sorted[i].order}) must be > ${category}/${sorted[i - 1].file} (order ${sorted[i - 1].order})`
          ).toBeGreaterThan(sorted[i - 1].order!)
        }
      }),
      { numRuns: categories.length * 3 }
    )
  })
})
