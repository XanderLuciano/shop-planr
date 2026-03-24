import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('useUsers', () => {
  let localStorageMock: Record<string, string>

  beforeEach(() => {
    // Reset modules to get fresh module-level state each test
    vi.resetModules()

    // Mock localStorage
    localStorageMock = {}
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { localStorageMock[key] = value }),
      removeItem: vi.fn((key: string) => { delete localStorageMock[key] })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  async function loadUseUsers() {
    const mod = await import('~/app/composables/useUsers')
    return mod.useUsers()
  }

  it('starts with empty users and no selected user', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([]))
    const { users, selectedUser } = await loadUseUsers()
    expect(users.value).toEqual([])
    expect(selectedUser.value).toBeNull()
  })

  it('fetchUsers populates users from API', async () => {
    const mockUsers = [
      { id: 'u1', name: 'Alice', active: true, createdAt: '2024-01-01' },
      { id: 'u2', name: 'Bob', active: true, createdAt: '2024-01-02' }
    ]
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(mockUsers))

    const { users, fetchUsers } = await loadUseUsers()
    await fetchUsers()

    expect(users.value).toEqual(mockUsers)
  })

  it('fetchUsers sets empty array on API error', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const { users, fetchUsers } = await loadUseUsers()
    await fetchUsers()

    expect(users.value).toEqual([])
  })

  it('selectUser sets selectedUser and persists to localStorage', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([]))
    const user = { id: 'u1', name: 'Alice', active: true, createdAt: '2024-01-01' }

    const { selectedUser, selectUser } = await loadUseUsers()
    selectUser(user as any)

    expect(selectedUser.value).toEqual(user)
    expect(localStorage.setItem).toHaveBeenCalledWith('shop_erp_selected_user', 'u1')
  })

  it('clearUser removes selectedUser and clears localStorage', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([]))
    const user = { id: 'u1', name: 'Alice', active: true, createdAt: '2024-01-01' }

    const { selectedUser, selectUser, clearUser } = await loadUseUsers()
    selectUser(user as any)
    clearUser()

    expect(selectedUser.value).toBeNull()
    expect(localStorage.removeItem).toHaveBeenCalledWith('shop_erp_selected_user')
  })

  it('requireUser throws when no user is selected', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([]))

    const { requireUser } = await loadUseUsers()
    expect(() => requireUser()).toThrow('No user selected')
  })

  it('requireUser returns selected user when one is set', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([]))
    const user = { id: 'u1', name: 'Alice', active: true, createdAt: '2024-01-01' }

    const { requireUser, selectUser } = await loadUseUsers()
    selectUser(user as any)

    expect(requireUser()).toEqual(user)
  })

  it('init restores user from localStorage when valid', async () => {
    const mockUsers = [
      { id: 'u1', name: 'Alice', active: true, createdAt: '2024-01-01' },
      { id: 'u2', name: 'Bob', active: true, createdAt: '2024-01-02' }
    ]
    localStorageMock['shop_erp_selected_user'] = 'u1'
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(mockUsers))

    const { selectedUser, init } = await loadUseUsers()
    await init()

    expect(selectedUser.value).toEqual(mockUsers[0])
  })

  it('init clears localStorage when stored user no longer exists', async () => {
    const mockUsers = [
      { id: 'u2', name: 'Bob', active: true, createdAt: '2024-01-02' }
    ]
    localStorageMock['shop_erp_selected_user'] = 'u_deleted'
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(mockUsers))

    const { selectedUser, init } = await loadUseUsers()
    await init()

    expect(selectedUser.value).toBeNull()
    expect(localStorage.removeItem).toHaveBeenCalledWith('shop_erp_selected_user')
  })
})
