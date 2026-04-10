/**
 * Property 6: Guarded action concurrent rejection
 *
 * For any async function wrapped by useGuardedAction, calling execute while
 * loading is true SHALL return undefined immediately without invoking the
 * wrapped function. Loading SHALL be set to true synchronously before the
 * wrapped function begins and reset to false after it completes (success or
 * failure). Errors from the wrapped function SHALL be re-thrown after loading
 * is reset.
 *
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
 */
import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import fc from 'fast-check'

// Stub Nuxt auto-import so the composable can use ref() globally
vi.stubGlobal('ref', ref)

// eslint-disable-next-line import/first
import { useGuardedAction } from '~/app/composables/useGuardedAction'

describe('Property 6: Guarded action concurrent rejection', () => {
  it('loading starts as false', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        () => {
          const fn = async () => 42
          const { loading } = useGuardedAction(fn)
          expect(loading.value).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('execute sets loading to true synchronously before fn runs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 50 }),
        async (returnValue) => {
          let loadingDuringFn = false
          let resolveFn: () => void

          const fn = async () => {
            loadingDuringFn = loading.value
            return new Promise<number>((resolve) => {
              resolveFn = () => resolve(returnValue)
            })
          }

          const { execute, loading } = useGuardedAction(fn)

          const promise = execute()

          // loading must be true synchronously after calling execute
          expect(loading.value).toBe(true)
          // fn observed loading as true while running
          expect(loadingDuringFn).toBe(true)

          resolveFn!()
          await promise
        },
      ),
      { numRuns: 100 },
    )
  })

  it('loading is reset to false after fn completes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 1000 }),
        async (returnValue) => {
          const fn = async () => returnValue
          const { execute, loading } = useGuardedAction(fn)

          const result = await execute()

          expect(loading.value).toBe(false)
          expect(result).toBe(returnValue)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('concurrent execute calls while loading return undefined without invoking fn', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 10 }),
        async (concurrentCalls) => {
          let invocationCount = 0
          let resolveFn: () => void

          const fn = async () => {
            invocationCount++
            return new Promise<string>((resolve) => {
              resolveFn = () => resolve('done')
            })
          }

          const { execute } = useGuardedAction(fn)

          // First call starts the action
          const firstPromise = execute()

          // Concurrent calls while loading is true
          const concurrentResults: (string | undefined)[] = []
          for (let i = 1; i < concurrentCalls; i++) {
            concurrentResults.push(await execute())
          }

          // All concurrent calls should return undefined
          for (const result of concurrentResults) {
            expect(result).toBeUndefined()
          }

          // fn should have been invoked exactly once
          expect(invocationCount).toBe(1)

          resolveFn!()
          const firstResult = await firstPromise
          expect(firstResult).toBe('done')
        },
      ),
      { numRuns: 100 },
    )
  })

  it('errors from fn are re-thrown after loading is reset', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (errorMessage) => {
          const fn = async () => {
            throw new Error(errorMessage)
          }

          const { execute, loading } = useGuardedAction(fn)

          let caughtError: Error | null = null
          try {
            await execute()
          } catch (e) {
            caughtError = e as Error
          }

          // Error should have been re-thrown
          expect(caughtError).not.toBeNull()
          expect(caughtError!.message).toBe(errorMessage)

          // Loading should be reset to false after error
          expect(loading.value).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })
})
