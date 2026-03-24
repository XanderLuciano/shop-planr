/**
 * ID generation utilities for SHOP_ERP.
 *
 * - `generateId(prefix)` — creates unique IDs like "job_V1StGXR8_Z5j"
 * - `createSequentialSnGenerator()` — produces sequential serial numbers like "SN-00001"
 *
 * The sequential SN generator accepts get/set callbacks for the counter,
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

export interface SnGeneratorOptions {
  /** Read the current counter value from persistence. */
  getCounter: () => number
  /** Write the updated counter value to persistence. */
  setCounter: (value: number) => void
  /** Prefix before the zero-padded number. Default: "SN-" */
  prefix?: string
  /** Number of digits to zero-pad. Default: 5 */
  padLength?: number
}

/**
 * Create a sequential serial number generator backed by a persistent counter.
 *
 * @example
 * const gen = createSequentialSnGenerator({
 *   getCounter: () => db.prepare('SELECT value FROM counters WHERE name = ?').get('sn')?.value ?? 0,
 *   setCounter: (v) => db.prepare('INSERT OR REPLACE INTO counters (name, value) VALUES (?, ?)').run('sn', v),
 * })
 * gen.next()  // "SN-00001"
 * gen.next()  // "SN-00002"
 * gen.nextBatch(3)  // ["SN-00003", "SN-00004", "SN-00005"]
 */
export function createSequentialSnGenerator(options: SnGeneratorOptions) {
  const prefix = options.prefix ?? 'SN-'
  const padLength = options.padLength ?? 5

  function format(n: number): string {
    return `${prefix}${String(n).padStart(padLength, '0')}`
  }

  return {
    /** Generate the next sequential serial number. */
    next(): string {
      const current = options.getCounter()
      const next = current + 1
      options.setCounter(next)
      return format(next)
    },

    /** Generate a batch of sequential serial numbers. */
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
