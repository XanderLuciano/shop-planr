/**
 * Shared fast-check arbitraries for page toggle property tests.
 */
import fc from 'fast-check'
import type { PageToggles } from '~/server/types/domain'

/** Arbitrary that produces a full PageToggles object with random booleans. */
export const arbPageToggles: fc.Arbitrary<PageToggles> = fc.record({
  jobs: fc.boolean(),
  partsBrowser: fc.boolean(),
  parts: fc.boolean(),
  queue: fc.boolean(),
  templates: fc.boolean(),
  bom: fc.boolean(),
  certs: fc.boolean(),
  jira: fc.boolean(),
  audit: fc.boolean(),
  webhooks: fc.boolean(),
})
