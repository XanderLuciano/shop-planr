<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const navItems: NavigationMenuItem[] = [
  { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/' },
  { label: 'Jobs', icon: 'i-lucide-briefcase', to: '/jobs' },
  { label: 'Parts Browser', icon: 'i-lucide-hash', to: '/parts-browser' },
  { label: 'Parts', icon: 'i-lucide-wrench', to: '/parts' },
  { label: 'Work Queue', icon: 'i-lucide-hard-hat', to: '/queue' },
  { label: 'Templates', icon: 'i-lucide-copy', to: '/templates' },
  { label: 'BOM', icon: 'i-lucide-package', to: '/bom' },
  { label: 'Certs', icon: 'i-lucide-shield-check', to: '/certs' },
  { label: 'Jira', icon: 'i-lucide-ticket', to: '/jira' },
  { label: 'Audit', icon: 'i-lucide-scroll-text', to: '/audit' },
  { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' },
]

const { settings } = useSettings()

const filteredNavItems = computed(() => {
  const toggles = settings.value?.pageToggles ?? DEFAULT_PAGE_TOGGLES
  return navItems.filter(item => isPageEnabled(toggles, item.to as string))
})

const { handleScan } = useBarcode()

function onScanned(result: ScanResult) {
  handleScan(result)
}
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar
      id="default-sidebar"
      collapsible
      resizable
      :min-size="10"
      :default-size="15"
      :max-size="20"
      :collapsed-size="4"
      :ui="{ root: 'group', body: 'group-data-[collapsed=true]:items-center group-data-[collapsed=true]:px-2', header: 'group-data-[collapsed=true]:justify-center', footer: 'group-data-[collapsed=true]:items-center group-data-[collapsed=true]:px-2' }"
    >
      <template #header>
        <NuxtLink
          to="/"
          class="flex items-center gap-2 px-1"
          aria-label="Home"
        >
          <span class="font-bold text-lg bg-gradient-to-r from-violet-500 to-violet-400 bg-clip-text text-transparent tracking-wide group-data-[collapsed=true]:hidden">
            Shop Planr
          </span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :items="filteredNavItems"
          :collapsed="collapsed"
          orientation="vertical"
        />
      </template>

      <template #footer>
        <div class="flex flex-col gap-2">
          <NuxtLink
            to="/api-docs"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="API Docs"
            class="flex items-center gap-2 px-2 py-1.5 text-sm text-(--ui-text-muted) hover:text-(--ui-text-highlighted) rounded-md hover:bg-(--ui-bg-elevated) transition-colors"
          >
            <UIcon
              name="i-lucide-book-open"
              class="size-4"
            />
            <span class="truncate group-data-[collapsed=true]:hidden">API Docs</span>
            <UIcon
              name="i-lucide-external-link"
              class="size-3 ml-auto opacity-50 group-data-[collapsed=true]:hidden"
            />
          </NuxtLink>
          <NuxtLink
            to="https://github.com/XanderLuciano/shop-planr/issues"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Report Issue"
            class="flex items-center gap-2 px-2 py-1.5 text-sm text-(--ui-text-muted) hover:text-(--ui-text-highlighted) rounded-md hover:bg-(--ui-bg-elevated) transition-colors"
          >
            <UIcon
              name="i-lucide-bug"
              class="size-4"
            />
            <span class="truncate group-data-[collapsed=true]:hidden">Report Issue</span>
            <UIcon
              name="i-lucide-external-link"
              class="size-3 ml-auto opacity-50 group-data-[collapsed=true]:hidden"
            />
          </NuxtLink>
          <UDashboardSidebarCollapse />
        </div>
      </template>
    </UDashboardSidebar>

    <UDashboardPanel>
      <template #header>
        <UDashboardNavbar>
          <template #left>
            <div class="flex-1 min-w-0">
              <BarcodeInput @scanned="onScanned" />
            </div>
          </template>

          <template #right>
            <UColorModeButton size="xs" />
            <UserSelector />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <slot />
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
