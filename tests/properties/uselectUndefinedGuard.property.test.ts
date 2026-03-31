/**
 * Guard: USelect must never be bound to a ref that can be undefined or null.
 *
 * Reka UI's SelectRoot (used by Nuxt UI's USelect) does not handle
 * undefined/null as model values — it can cause runtime errors or
 * the placeholder to not render correctly.
 *
 * This test scans all .vue files for USelect v-model bindings, then
 * checks the corresponding ref declarations to ensure they never use
 * `undefined` or `null` in their type union.
 *
 * Safe pattern:   ref<string>('_none')  or  ref<MyEnum | '_none'>('_none')
 * Unsafe pattern: ref<string | undefined>(undefined)  or  ref<string | null>(null)
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

/** Extract all v-model binding names from USelect components */
function extractUSelectBindings(content: string): string[] {
  const bindings: string[] = []
  // Match <USelect ... v-model="varName" ...> patterns
  const uselectRegex = /<USelect[^>]*v-model="([^"]+)"[^>]*>/g
  let match
  while ((match = uselectRegex.exec(content)) !== null) {
    bindings.push(match[1]!)
  }
  return bindings
}

/** Check if a ref declaration for a given variable uses undefined or null */
function hasUnsafeRefType(content: string, varName: string): { unsafe: boolean; line: string } | null {
  // Match: const varName = ref<...>(...)
  // The varName might be nested (e.g., "selectedReason" from v-model="selectedReason")
  const escapedVar = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const refPattern = new RegExp(`const\\s+${escapedVar}\\s*=\\s*ref<([^>]+)>`, 'm')
  const match = refPattern.exec(content)
  if (!match) return null

  const typeUnion = match[1]!
  const hasUndefined = /\bundefined\b/.test(typeUnion)
  const hasNull = /\bnull\b/.test(typeUnion)

  return {
    unsafe: hasUndefined || hasNull,
    line: match[0],
  }
}

describe('USelect undefined/null guard', () => {
  const appDir = path.resolve(process.cwd(), 'app')
  const vueFiles = collectVueFiles(appDir)

  it('no USelect should be bound to a ref typed with undefined or null', () => {
    const violations: string[] = []

    for (const filePath of vueFiles) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const bindings = extractUSelectBindings(content)

      for (const binding of bindings) {
        const result = hasUnsafeRefType(content, binding)
        if (result && result.unsafe) {
          const rel = path.relative(process.cwd(), filePath)
          violations.push(
            `${rel}: USelect v-model="${binding}" is bound to a ref with undefined/null type: ${result.line}`
          )
        }
      }
    }

    expect(
      violations,
      `Found USelect components bound to refs with undefined/null types. ` +
      `Reka UI's SelectRoot does not support undefined/null model values. ` +
      `Use a sentinel string like '_none' instead.\n\nViolations:\n${violations.join('\n')}`
    ).toHaveLength(0)
  })
})
