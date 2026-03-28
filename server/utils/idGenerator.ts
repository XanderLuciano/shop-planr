/**
 * ID generation utilities for SHOP_ERP.
 *
 * - `generateId(prefix)` — creates unique IDs like "job_V1StGXR8_Z5j"
 * - `createSequentialPartIdGenerator()` — produces sequential part IDs like "part_00001"
 *
 * The sequential part ID generator accepts get/set callbacks for the counter,
 * allowing the counter to be persisted in the database via a counters table.
 */

import { nanoid } from 'nanoid'

/**
 * Generate a unique ID with a prefix.
 * @example generateId('job') => "job_V1StGXR8_Z5j"
 */
export function generateId(prefix: string): string {
  return `${prefix}_${nanoid(12)}`
}

export interface SequentialIdGeneratorOptions {
  /** Read the current counter value from persistence. */
  getCounter: () => number
  /** Write the updated counter value to persistence. */
  setCounter: (value: number) => void
  /** Prefix before the zero-padded number. Default: "part_" */
  prefix?: string
  /** Number of digits to zero-pad. Default: 5 */
  padLength?: number
}

/**
 * Create a sequential part ID generator backed by a persistent counter.
 *
 * @example
 * const gen = createSequentialPartIdGenerator({
 *   getCounter: () => db.prepare('SELECT value FROM counters WHERE name = ?').get('part')?.value ?? 0,
 *   setCounter: (v) => db.prepare('INSERT OR REPLACE INTO counters (name, value) VALUES (?, ?)').run('part', v),
 * })
 * gen.next()  // "part_00001"
 * gen.next()  // "part_00002"
 * gen.nextBatch(3)  // ["part_00003", "part_00004", "part_00005"]
 */
export function createSequentialPartIdGenerator(options: SequentialIdGeneratorOptions) {
  const prefix = options.prefix ?? 'part_'
  const padLength = options.padLength ?? 5

  function format(n: number): string {
    return `${prefix}${String(n).padStart(padLength, '0')}`
  }

  return {
    /** Generate the next sequential part ID. */
    next(): string {
      const current = options.getCounter()
      const next = current + 1
      options.setCounter(next)
      return format(next)
    },

    /** Generate a batch of sequential part IDs. */
    nextBatch(count: number): string[] {
      if (count <= 0) return []
      const current = options.getCounter()
      const ids: string[] = []
      for (let i = 1; i <= count; i++) {
        ids.push(format(current + i))
      }
      options.setCounter(current + count)
      return ids
    }
  }
}

/**
 * @deprecated Use createSequentialPartIdGenerator instead. Alias kept for backward compatibility during migration.
 */
export const createSequentialSnGenerator = createSequentialPartIdGenerator
