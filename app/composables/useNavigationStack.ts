export interface NavigationEntry {
  path: string
  label: string
}

export interface BackNavigation {
  to: string
  label: string
}

const STACK_KEY = 'nav-stack'
const MAX_ENTRIES = 20

function isValidEntry(entry: unknown): entry is NavigationEntry {
  return (
    typeof entry === 'object'
    && entry !== null
    && 'path' in entry
    && typeof (entry as NavigationEntry).path === 'string'
    && (entry as NavigationEntry).path.length > 0
    && (entry as NavigationEntry).path.startsWith('/')
    && 'label' in entry
    && typeof (entry as NavigationEntry).label === 'string'
    && (entry as NavigationEntry).label.length > 0
  )
}

function readFromStorage(): NavigationEntry[] {
  try {
    const raw = sessionStorage.getItem(STACK_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidEntry)
  } catch {
    return []
  }
}

function writeToStorage(entries: NavigationEntry[]): void {
  try {
    sessionStorage.setItem(STACK_KEY, JSON.stringify(entries))
  } catch {
    // sessionStorage unavailable — in-memory only
  }
}

export function useNavigationStack() {
  const stack = useState<NavigationEntry[]>(STACK_KEY, () => [])

  // Hydrate from sessionStorage on client init
  if (import.meta.client && stack.value.length === 0) {
    const stored = readFromStorage()
    if (stored.length > 0) {
      stack.value = stored
    }
  }

  function push(entry: NavigationEntry): void {
    if (!isValidEntry(entry)) return
    const next = [...stack.value]
    if (next.length >= MAX_ENTRIES) {
      next.shift()
    }
    next.push(entry)
    stack.value = next
    if (import.meta.client) writeToStorage(next)
  }

  function pop(): NavigationEntry | undefined {
    if (stack.value.length === 0) return undefined
    const next = [...stack.value]
    const popped = next.pop()
    stack.value = next
    if (import.meta.client) writeToStorage(next)
    return popped
  }

  function replaceTop(entry: NavigationEntry): void {
    if (!isValidEntry(entry)) return
    const next = [...stack.value]
    if (next.length > 0) {
      next[next.length - 1] = entry
    } else {
      next.push(entry)
    }
    stack.value = next
    if (import.meta.client) writeToStorage(next)
  }

  const route = useRoute()

  const backNavigation = computed<BackNavigation>(() => {
    // Find first valid entry from top of stack
    for (let i = stack.value.length - 1; i >= 0; i--) {
      const entry = stack.value[i]
      if (isValidEntry(entry)) {
        return { to: entry.path, label: `Back to ${entry.label}` }
      }
    }
    // Fallback when stack is empty
    const fallbackPath = resolveFallbackRoute(route.path)
    const fallbackLabel = resolveLabel(fallbackPath)
    return { to: fallbackPath, label: `Back to ${fallbackLabel}` }
  })

  function goBack(): void {
    const entry = pop()
    if (entry) {
      navigateTo(entry.path)
    } else {
      const fallbackPath = resolveFallbackRoute(route.path)
      navigateTo(fallbackPath)
    }
  }

  const entries = computed<readonly NavigationEntry[]>(() => stack.value)

  return { push, pop, replaceTop, backNavigation, goBack, entries }
}
