/**
 * Property 12: Malformed JSON Error Reporting
 *
 * Malformed JSON (missing fields, wrong types, invalid structure) returns
 * descriptive error identifying the problematic field.
 *
 * **Validates: Requirements 12.4**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { serialize, deserialize } from '../../server/utils/serialization'
import type { DomainType } from '../../server/utils/serialization'
import { ValidationError } from '../../server/utils/errors'

/** Generate a valid Job object */
const arbJob = () =>
  fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }).map(s => `job_${s.replace(/[^a-zA-Z0-9]/g, 'x')}`),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    goalQuantity: fc.integer({ min: 1, max: 10000 }),
    createdAt: fc.constant(new Date().toISOString()),
    updatedAt: fc.constant(new Date().toISOString()),
  })

/** Generate a valid Certificate object */
const arbCert = () =>
  fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }).map(s => `cert_${s.replace(/[^a-zA-Z0-9]/g, 'x')}`),
    type: fc.constantFrom('material' as const, 'process' as const),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    createdAt: fc.constant(new Date().toISOString()),
  })

/** Generate a valid ShopUser object */
const arbUser = () =>
  fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }).map(s => `user_${s.replace(/[^a-zA-Z0-9]/g, 'x')}`),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    active: fc.boolean(),
    createdAt: fc.constant(new Date().toISOString()),
  })

/** Generate a valid Part object */
const arbPart = () =>
  fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }).map(s => `part_${s.replace(/[^a-zA-Z0-9]/g, 'x')}`),
    jobId: fc.constant('job_1'),
    pathId: fc.constant('path_1'),
    currentStepId: fc.oneof(fc.constant(null as string | null), fc.constant('step_1')),
    status: fc.constantFrom('in_progress' as const, 'completed' as const),
    forceCompleted: fc.constant(false),
    createdAt: fc.constant(new Date().toISOString()),
    updatedAt: fc.constant(new Date().toISOString()),
  })

describe('Property 12: Malformed JSON Error Reporting', () => {
  it('removing a required string field from a Job produces error mentioning the field', () => {
    fc.assert(
      fc.property(
        arbJob(),
        fc.constantFrom('id', 'name', 'createdAt', 'updatedAt'),
        (job, fieldToRemove) => {
          const json = serialize(job)
          const parsed = JSON.parse(json)
          delete parsed[fieldToRemove]
          const corrupted = JSON.stringify(parsed)

          expect(() => deserialize(corrupted, 'Job')).toThrow(ValidationError)
          try {
            deserialize(corrupted, 'Job')
          } catch (e: any) {
            expect(e.message).toContain(fieldToRemove)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('changing goalQuantity to a string in a Job produces error mentioning the field', () => {
    fc.assert(
      fc.property(
        arbJob(),
        fc.string({ minLength: 1, maxLength: 10 }),
        (job, badValue) => {
          const json = serialize(job)
          const parsed = JSON.parse(json)
          parsed.goalQuantity = badValue
          const corrupted = JSON.stringify(parsed)

          expect(() => deserialize(corrupted, 'Job')).toThrow(ValidationError)
          try {
            deserialize(corrupted, 'Job')
          } catch (e: any) {
            expect(e.message).toContain('goalQuantity')
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('removing a required field from a Certificate produces error mentioning the field', () => {
    fc.assert(
      fc.property(
        arbCert(),
        fc.constantFrom('id', 'type', 'name', 'createdAt'),
        (cert, fieldToRemove) => {
          const json = serialize(cert)
          const parsed = JSON.parse(json)
          delete parsed[fieldToRemove]
          const corrupted = JSON.stringify(parsed)

          expect(() => deserialize(corrupted, 'Certificate')).toThrow(ValidationError)
          try {
            deserialize(corrupted, 'Certificate')
          } catch (e: any) {
            expect(e.message).toContain(fieldToRemove)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('setting Certificate.type to an invalid value produces error mentioning the field', () => {
    fc.assert(
      fc.property(
        arbCert(),
        fc.string({ minLength: 1, maxLength: 10 }).filter(s => s !== 'material' && s !== 'process'),
        (cert, badType) => {
          const json = serialize(cert)
          const parsed = JSON.parse(json)
          parsed.type = badType
          const corrupted = JSON.stringify(parsed)

          expect(() => deserialize(corrupted, 'Certificate')).toThrow(ValidationError)
          try {
            deserialize(corrupted, 'Certificate')
          } catch (e: any) {
            expect(e.message).toContain('type')
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('changing a boolean field to a number in ShopUser produces error mentioning the field', () => {
    fc.assert(
      fc.property(
        arbUser(),
        fc.integer({ min: 0, max: 100 }),
        (user, badValue) => {
          const json = serialize(user)
          const parsed = JSON.parse(json)
          parsed.active = badValue
          const corrupted = JSON.stringify(parsed)

          expect(() => deserialize(corrupted, 'ShopUser')).toThrow(ValidationError)
          try {
            deserialize(corrupted, 'ShopUser')
          } catch (e: any) {
            expect(e.message).toContain('active')
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('removing a required field from a Part produces error mentioning the field', () => {
    fc.assert(
      fc.property(
        arbPart(),
        fc.constantFrom('id', 'jobId', 'pathId', 'createdAt', 'updatedAt'),
        (part, fieldToRemove) => {
          const json = serialize(part)
          const parsed = JSON.parse(json)
          delete parsed[fieldToRemove]
          const corrupted = JSON.stringify(parsed)

          expect(() => deserialize(corrupted, 'Part')).toThrow(ValidationError)
          try {
            deserialize(corrupted, 'Part')
          } catch (e: any) {
            expect(e.message).toContain(fieldToRemove)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('passing non-JSON string produces descriptive error', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => {
          try {
            JSON.parse(s)
            return false
          } catch {
            return true
          }
        }),
        fc.constantFrom('Job', 'Certificate', 'ShopUser', 'Part') as fc.Arbitrary<DomainType>,
        (badJson, domainType) => {
          expect(() => deserialize(badJson, domainType)).toThrow(ValidationError)
          try {
            deserialize(badJson, domainType)
          } catch (e: any) {
            expect(e.message).toContain('invalid JSON')
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('passing an array instead of an object produces descriptive error', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer()),
        fc.constantFrom('Job', 'Certificate', 'ShopUser', 'Part') as fc.Arbitrary<DomainType>,
        (arr, domainType) => {
          const json = JSON.stringify(arr)
          expect(() => deserialize(json, domainType)).toThrow(ValidationError)
          try {
            deserialize(json, domainType)
          } catch (e: any) {
            expect(e.message).toContain('expected an object')
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
