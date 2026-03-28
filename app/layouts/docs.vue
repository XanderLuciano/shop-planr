<script setup lang="ts">
const route = useRoute()
const { navigation: rawNavigation, isActive } = useDocsNavigation()

/**
 * Unwrap the navigation tree: queryCollectionNavigation returns a root node
 * for `/api-docs` with categories as children. We want the categories directly.
 */
const navigation = computed(() => {
  const raw = rawNavigation.value
  if (!raw || raw.length === 0) return []
  // If the first item has children and its path is /api-docs, unwrap it
  const root = raw.find(n => n.path === '/api-docs')
  if (root?.children?.length) return root.children
  return raw
})

/** Mobile sidebar toggle state. */
const sidebarOpen = ref(false)

/** Close mobile sidebar on route change. */
watch(() => route.path, () => {
  sidebarOpen.value = false
})

/**
 * Build breadcrumb items from the current URL slug.
 * e.g. /api-docs/jobs/create → [{ label: 'API Docs', to: '/api-docs' }, { label: 'Jobs', to: '/api-docs/jobs' }, { label: 'Create', to: '/api-docs/jobs/create' }]
 */
const breadcrumbs = computed(() => {
  const segments = route.path
    .replace(/^\/api-docs\/?/, '')
    .split('/')
    .filter(Boolean)

  const items: { label: string; to: string; icon?: string }[] = [
    { label: 'API Docs', to: '/api-docs', icon: 'i-lucide-book-open' }
  ]

  let currentPath = '/api-docs'
  for (const segment of segments) {
    currentPath += `/${segment}`
    // Capitalize and humanize the segment: "force-complete" → "Force Complete"
    const label = segment
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    items.push({ label, to: currentPath })
  }

  return items
})
</script>

<template>
  <div class="flex h-screen flex-col bg-(--ui-bg)">
    <!-- Header -->
    <header class="flex items-center gap-3 border-b border-(--ui-border) px-4 py-2.5 shrink-0">
      <!-- Mobile sidebar toggle -->
      <button
        class="md:hidden flex items-center justify-center rounded-md p-1.5 text-(--ui-text-muted) hover:bg-(--ui-bg-elevated) transition-colors cursor-pointer"
        aria-label="Toggle sidebar"
        @click="sidebarOpen = !sidebarOpen"
      >
        <UIcon :name="sidebarOpen ? 'i-lucide-x' : 'i-lucide-menu'" class="size-5" />
      </button>

      <!-- Back to App link -->
      <NuxtLink
        to="/"
        class="flex items-center gap-1.5 text-sm text-(--ui-text-muted) hover:text-(--ui-text) transition-colors shrink-0"
      >
        <UIcon name="i-lucide-arrow-left" class="size-4" />
        <span class="hidden sm:inline">Back to App</span>
      </NuxtLink>

      <div class="mx-2 h-5 w-px bg-(--ui-border) hidden sm:block" />

      <!-- Title -->
      <span class="font-bold text-base bg-gradient-to-r from-violet-500 to-violet-400 bg-clip-text text-transparent tracking-wide hidden sm:inline">
        API Docs
      </span>

      <!-- Search (right-aligned) -->
      <div class="ml-auto w-64">
        <DocsSearch />
      </div>
    </header>

    <div class="flex flex-1 overflow-hidden">
      <!-- Desktop sidebar -->
      <aside class="hidden md:block border-r border-(--ui-border) overflow-y-auto shrink-0">
        <DocsSidebar
          :navigation="navigation ?? []"
          :current-path="route.path"
        />
      </aside>

      <!-- Mobile sidebar overlay -->
      <Teleport to="body">
        <Transition name="fade">
          <div
            v-if="sidebarOpen"
            class="fixed inset-0 z-40 bg-black/30 md:hidden"
            @click="sidebarOpen = false"
          />
        </Transition>
        <Transition name="slide">
          <aside
            v-if="sidebarOpen"
            class="fixed inset-y-0 left-0 z-50 w-72 bg-(--ui-bg) border-r border-(--ui-border) overflow-y-auto md:hidden shadow-xl"
          >
            <div class="flex items-center justify-between px-4 py-3 border-b border-(--ui-border)">
              <span class="font-semibold text-sm text-(--ui-text-highlighted)">Navigation</span>
              <button
                class="rounded-md p-1 text-(--ui-text-muted) hover:bg-(--ui-bg-elevated) transition-colors cursor-pointer"
                aria-label="Close sidebar"
                @click="sidebarOpen = false"
              >
                <UIcon name="i-lucide-x" class="size-4" />
              </button>
            </div>
            <DocsSidebar
              :navigation="navigation ?? []"
              :current-path="route.path"
            />
          </aside>
        </Transition>
      </Teleport>

      <!-- Main content area -->
      <main class="flex-1 overflow-y-auto">
        <div class="mx-auto max-w-4xl px-6 py-6">
          <!-- Breadcrumbs -->
          <nav v-if="breadcrumbs.length > 1" class="mb-4" aria-label="Breadcrumb">
            <ol class="flex items-center gap-1 text-sm">
              <li v-for="(crumb, idx) in breadcrumbs" :key="crumb.to" class="flex items-center gap-1">
                <UIcon
                  v-if="idx > 0"
                  name="i-lucide-chevron-right"
                  class="size-3.5 text-(--ui-text-dimmed) shrink-0"
                />
                <NuxtLink
                  v-if="idx < breadcrumbs.length - 1"
                  :to="crumb.to"
                  class="text-(--ui-text-muted) hover:text-(--ui-text) transition-colors"
                >
                  <UIcon v-if="crumb.icon" :name="crumb.icon" class="size-3.5 inline-block mr-0.5 align-text-bottom" />
                  {{ crumb.label }}
                </NuxtLink>
                <span v-else class="text-(--ui-text-highlighted) font-medium">
                  {{ crumb.label }}
                </span>
              </li>
            </ol>
          </nav>

          <!-- Page content slot -->
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.2s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
}
</style>
