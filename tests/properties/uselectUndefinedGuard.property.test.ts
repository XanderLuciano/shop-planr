/**
 * Guard: USelect safety rules across the entire codebase.
 *
 * Reka UI's SelectRoot (used by Nuxt UI's USelect) does not handle
 * undefined, null, or empty string as model values — it causes runtime
 * errors or broken placeholder rendering.
 *
 * These tests scan ALL .vue files in app/ for:
 *
 * 1. Ref type declarations — no USelect-bound ref may include `undefined`
 *    or `null` in its type union
 * 2. Ref initial values — no USelect-bound ref may be initialized with
 *    `undefined`, `null`, or empty string `''`/`""`
 * 3. Ref assignments — no USelect-bound ref may be assigned `undefined`
 *    or `null` anywhere in the script block
 * 4. Sentinel consistency — all USelect sentinel values must use the
 *    shared SELECT_NONE constant, not raw '__none__' string literals
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

function collectVueFiles(dir: string): string[] {
  const results: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      results.push(...collectVueFiles(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.vue')) {
      results.push(fullPath)
    }
  }
  return results
}

function rel(filePath: string): string {
  return path.relative(process.cwd(), filePath)
}

/** Extract script block content from a .vue file */
function extractScript(content: string): string {
  const match = content.match(/<script[^>]*>([\s\S]*?)<\/script>/)
  return match ? match[1]! : ''
}

/** Extract template block content from a .vue file */
function extractTemplate(content: string): string {
  const match = content.match(/<template>([\s\S]*?)<\/template>/)
  return match ? match[1]! : ''
}

/**
 * Extract all v-model and :model-value binding variable names from
 * USelect components (NOT USelectMenu — that component handles null
 * differently). Handles multi-line tags by first extracting full tag
 * strings, then parsing v-model from them.
 */
function extractUSelectBindings(template: string): string[] {
  const bindings: string[] = []

  // Match full USelect tags only (NOT USelectMenu) — multi-line safe
  // Negative lookahead ensures we don't match USelectMenu
  const tagRegex = /<USelect(?!Menu)\b([\s\S]*?)>/g
  let tagMatch
  while ((tagMatch = tagRegex.exec(template)) !== null) {
    const attrs = tagMatch[1]!

    // Check for v-model="varName"
    const vmodelMatch = attrs.match(/v-model="([^"]+)"/)
    if (vmodelMatch) {
      bindings.push(vmodelMatch[1]!)
    }

    // Check for :model-value="expr" — extract the variable name
    const modelValueMatch = attrs.match(/:model-value="([^"]+)"/)
    if (modelValueMatch) {
      const expr = modelValueMatch[1]!
      const simpleVar = expr.match(/^(\w+(?:\.\w+)*)/)
      if (simpleVar) {
        bindings.push(simpleVar[1]!)
      }
    }
  }

  return bindings
}

const appDir = path.resolve(process.cwd(), 'app')
const vueFiles = collectVueFiles(appDir)

describe('USelect safety guard', () => {
  it('should detect all USelect usages in the codebase', () => {
    // Sanity check: we know there are 20+ USelect usages across the codebase
    let totalBindings = 0
    for (const filePath of vueFiles) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const template = extractTemplate(content)
      const bindings = extractUSelectBindings(template)
      totalBindings += bindings.length
    }
    // If this fails, the regex is broken and not finding USelect tags
    expect(totalBindings).toBeGreaterThanOrEqual(12)
  })

  it('no USelect-bound ref should be typed with undefined or null', () => {
    const violations: string[] = []

    for (const filePath of vueFiles) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const template = extractTemplate(content)
      const bindings = extractUSelectBindings(template)
      const script = extractScript(content)

      for (const binding of bindings) {
        // Extract just the variable name (strip .value, object paths, etc.)
        const varName = binding.split('.')[0]!.split('[')[0]!
        const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const refDecl = new RegExp(`const\\s+${escaped}\\s*=\\s*ref<([^>]+)>`, 'm')
        const match = refDecl.exec(script)
        if (!match) continue

        const typeUnion = match[1]!
        if (/\bundefined\b/.test(typeUnion) || /\bnull\b/.test(typeUnion)) {
          violations.push(
            `${rel(filePath)}: USelect v-model="${binding}" ref type includes undefined/null: ref<${typeUnion}>`
          )
        }
      }
    }

    expect(violations, formatMessage('ref type', violations)).toHaveLength(0)
  })

  it('no USelect-bound ref should be initialized with undefined, null, or empty string', () => {
    const violations: string[] = []

    for (const filePath of vueFiles) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const template = extractTemplate(content)
      const bindings = extractUSelectBindings(template)
      const script = extractScript(content)

      for (const binding of bindings) {
        const varName = binding.split('.')[0]!.split('[')[0]!
        const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

        // Check for ref(undefined), ref(null)
        const unsafeInit = new RegExp(
          `const\\s+${escaped}\\s*=\\s*ref(?:<[^>]*>)?\\((undefined|null)\\)`,
          'm'
        )
        const match = unsafeInit.exec(script)
        if (match) {
          violations.push(
            `${rel(filePath)}: USelect v-model="${binding}" initialized with ${match[1]}`
          )
        }

        // Check for ref('') or ref("") — empty string is reserved by Reka UI
        const emptyStringInit = new RegExp(
          `const\\s+${escaped}\\s*=\\s*ref(?:<[^>]*>)?\\((['"]){2}\\)`,
          'm'
        )
        // Simpler: match ref('') or ref("")
        const emptyInit2 = new RegExp(
          `const\\s+${escaped}\\s*=\\s*ref(?:<[^>]*>)?\\(''\\)`,
          'm'
        )
        const emptyInit3 = new RegExp(
          `const\\s+${escaped}\\s*=\\s*ref(?:<[^>]*>)?\\(""\\)`,
          'm'
        )
        if (emptyInit2.test(script) || emptyInit3.test(script)) {
          violations.push(
            `${rel(filePath)}: USelect v-model="${binding}" initialized with empty string '' — use SELECT_NONE instead`
          )
        }
      }
    }

    expect(violations, formatMessage('initial value', violations)).toHaveLength(0)
  })

  it('no USelect-bound ref should be assigned undefined or null', () => {
    const violations: string[] = []

    for (const filePath of vueFiles) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const template = extractTemplate(content)
      const bindings = extractUSelectBindings(template)
      const script = extractScript(content)

      for (const binding of bindings) {
        const varName = binding.split('.')[0]!.split('[')[0]!
        const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const assignPattern = new RegExp(`${escaped}\\.value\\s*=\\s*(undefined|null)\\b`, 'gm')
        let match
        while ((match = assignPattern.exec(script)) !== null) {
          violations.push(
            `${rel(filePath)}: USelect v-model="${binding}" assigned ${match[1]}`
          )
        }
      }
    }

    expect(violations, formatMessage('assignment', violations)).toHaveLength(0)
  })

  it('USelect sentinel values should use SELECT_NONE, not raw string literals', () => {
    const violations: string[] = []

    for (const filePath of vueFiles) {
      // Skip the selectSentinel utility itself
      if (filePath.includes('selectSentinel')) continue

      const content = fs.readFileSync(filePath, 'utf-8')
      const template = extractTemplate(content)
      const hasUSelect = /<USelect(?!Menu)\b/.test(template)
      if (!hasUSelect) continue

      const script = extractScript(content)

      // Check for raw '__none__' string literals in script (should use SELECT_NONE)
      const rawLiteralPattern = /['"]__none__['"]/g
      let match
      while ((match = rawLiteralPattern.exec(script)) !== null) {
        violations.push(
          `${rel(filePath)}: raw '__none__' literal in script — use SELECT_NONE constant instead`
        )
      }

      // Also check template for raw '__none__' (except in :items arrays where SELECT_NONE is used)
      const templateRawPattern = /['"]__none__['"]/g
      while ((match = templateRawPattern.exec(template)) !== null) {
        violations.push(
          `${rel(filePath)}: raw '__none__' literal in template — use SELECT_NONE constant instead`
        )
      }
    }

    expect(violations, formatMessage('sentinel consistency', violations)).toHaveLength(0)
  })
})

function formatMessage(check: string, violations: string[]): string {
  return (
    `USelect ${check} violations found. ` +
    `Reka UI's SelectRoot does not support undefined/null/empty-string model values. ` +
    `Use SELECT_NONE from app/utils/selectSentinel.ts.\n\n` +
    violations.join('\n')
  )
}
