import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('useMobileBreakpoint', () => {
  let mountedCb: (() => void) | null = null
  let unmountedCb: (() => void) | null = null
  let changeHandler: ((e: MediaQueryListEvent) => void) | null = null

  function createMockMql(matches: boolean) {
    return {
      matches,
      addEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
        if (event === 'change') changeHandler = handler
      }),
      removeEventListener: vi.fn(),
    }
  }

  beforeEach(() => {
    vi.resetAllMocks()
    vi.resetModules()
    mountedCb = null
    unmountedCb = null
    changeHandler = null

    // Stub Nuxt auto-imports
    vi.stubGlobal('ref', (val: unknown) => ({ value: val }))
    vi.stubGlobal('onMounted', (cb: () => void) => { mountedCb = cb })
    vi.stubGlobal('onUnmounted', (cb: () => void) => { unmountedCb = cb })
  })

  it('returns false when viewport >= 768px', async () => {
    const mockMql = createMockMql(false)
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mockMql))

    const { useMobileBreakpoint } = await import('~/app/composables/useMobileBreakpoint')
    const { isMobile } = useMobileBreakpoint()

    // Before mount: defaults to false (SSR-safe)
    expect(isMobile.value).toBe(false)

    // After mount: reads matchMedia
    mountedCb!()
    expect(isMobile.value).toBe(false)
    expect(matchMedia).toHaveBeenCalledWith('(max-width: 767.9px)')
  })

  it('returns true when viewport < 768px', async () => {
    const mockMql = createMockMql(true)
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mockMql))

    const { useMobileBreakpoint } = await import('~/app/composables/useMobileBreakpoint')
    const { isMobile } = useMobileBreakpoint()

    // Before mount: defaults to false
    expect(isMobile.value).toBe(false)

    // After mount: picks up mobile viewport
    mountedCb!()
    expect(isMobile.value).toBe(true)
  })

  it('reactively updates on media query change', async () => {
    const mockMql = createMockMql(false)
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mockMql))

    const { useMobileBreakpoint } = await import('~/app/composables/useMobileBreakpoint')
    const { isMobile } = useMobileBreakpoint()

    expect(isMobile.value).toBe(false)

    // Simulate onMounted to register the listener
    expect(mountedCb).not.toBeNull()
    mountedCb!()
    expect(mockMql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))

    // Simulate viewport shrinking below 768px
    changeHandler!({ matches: true } as MediaQueryListEvent)
    expect(isMobile.value).toBe(true)

    // Simulate viewport expanding back above 768px
    changeHandler!({ matches: false } as MediaQueryListEvent)
    expect(isMobile.value).toBe(false)
  })

  it('cleans up listener on unmount', async () => {
    const mockMql = createMockMql(false)
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mockMql))

    const { useMobileBreakpoint } = await import('~/app/composables/useMobileBreakpoint')
    useMobileBreakpoint()

    // Trigger mount then unmount
    mountedCb!()
    expect(unmountedCb).not.toBeNull()
    unmountedCb!()
    expect(mockMql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })
})
