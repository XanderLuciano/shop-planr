/**
 * Guard: USelect safety rules across the entire codebase.
 *
 * Reka UI's SelectRoot (used by Nuxt UI's USelect) does not handle
 * undefined/null as model values — it causes runtime errors or broken
 * placeholder rendering.
 *
 * These tests scan ALL .vue files in app/ for:
 *
 * 1. Ref type declarations — no USelect-bound ref may include `undefined`
 *    or `null` in its type union
 * 2. Ref assignments — no USelect-bound ref may be assigned `undefined`
 *    or `null` anywhere in the script block
 * 3. Ref initial values — no USelect-bound ref may be initialized with
 *    `undefined` or `null`
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

/** Extract all v-model binding variable names from USelect components */
function extractUSelectBindings(content: string): string[] {
  const bindings: string[] = []
  const regex = /<USelect[^>]*v-model="([^"]+)"[^>]*>/g
  let match
  while ((match = regex.exec(content)) !== null) {
    bindings.push(match[1]!)
  }
  return bindings
}

const appDir = path.resolve(process.cwd(), 'app')
const vueFiles = collectVueFiles(appDir)

describe('USelect safety guard', () => {
  it('no USelect-bound ref should be typed with undefined or null', () => {
    const violations: string[] = []

    for (const filePath of vueFiles) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const bindings = extractUSelectBindings(content)
      const script = extractScript(content)

      for (const binding of bindings) {
        const escaped = binding.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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

  it('no USelect-bound ref should be initialized with undefined or null', () => {
    const violations: string[] = []

    for (const filePath of vueFiles) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const bindings = extractUSelectBindings(content)
      const script = extractScript(content)

      for (const binding of bindings) {
        const escaped = binding.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        // Match: const binding = ref<...>(undefined) or ref<...>(null) or ref(undefined) or ref(null)
        const initPattern = new RegExp(`const\\s+${escaped}\\s*=\\s*ref(?:<[^>]*>)?\\((undefined|null)\\)`, 'm')
        const match = initPattern.exec(script)
        if (match) {
          violations.push(
            `${rel(filePath)}: USelect v-model="${binding}" initialized with ${match[1]}`
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
      const bindings = extractUSelectBindings(content)
      const script = extractScript(content)

      for (const binding of bindings) {
        const escaped = binding.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        // Match: binding.value = undefined or binding.value = null
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
      const content = fs.readFileSync(filePath, 'utf-8')
      // Skip the selectSentinel utility itself
      if (filePath.includes('selectSentinel')) continue

      const hasUSelect = /<USelect\b/.test(content)
      if (!hasUSelect) continue

      const script = extractScript(content)

      // Check for raw '__none__' string literals in script (should use SELECT_NONE)
      const rawLiteralPattern = /['"]__none__['"]/g
      let match
      while ((match = rawLiteralPattern.exec(script)) !== null) {
        violations.push(
          `${rel(filePath)}: raw '__none__' literal found — use SELECT_NONE constant instead`
        )
      }
    }

    expect(violations, formatMessage('sentinel consistency', violations)).toHaveLength(0)
  })
})

function formatMessage(check: string, violations: string[]): string {
  return (
    `USelect ${check} violations found. ` +
    `Reka UI's SelectRoot does not support undefined/null model values. ` +
    `Use SELECT_NONE from app/utils/selectSentinel.ts.\n\n` +
    violations.join('\n')
  )
}
