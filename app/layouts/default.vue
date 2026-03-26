<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const navItems: NavigationMenuItem[] = [
  { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/' },
  { label: 'Jobs', icon: 'i-lucide-briefcase', to: '/jobs' },
  { label: 'Serials', icon: 'i-lucide-hash', to: '/serials' },
  { label: 'Parts', icon: 'i-lucide-wrench', to: '/parts' },
  { label: 'Work Queue', icon: 'i-lucide-hard-hat', to: '/queue' },
  { label: 'Templates', icon: 'i-lucide-copy', to: '/templates' },
  { label: 'BOM', icon: 'i-lucide-package', to: '/bom' },
  { label: 'Certs', icon: 'i-lucide-shield-check', to: '/certs' },
  { label: 'Jira', icon: 'i-lucide-ticket', to: '/jira' },
  { label: 'Audit', icon: 'i-lucide-scroll-text', to: '/audit' },
  { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' }
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
    >
      <template #header>
        <NuxtLink
          to="/"
          class="flex items-center gap-2 px-1"
        >
          <span class="font-bold text-lg bg-gradient-to-r from-violet-500 to-violet-400 bg-clip-text text-transparent tracking-wide">
            Shop Planr
          </span>
        </NuxtLink>
      </template>

      <UNavigationMenu
        :items="filteredNavItems"
        orientation="vertical"
      />

      <template #footer>
        <div class="flex items-center justify-between">
          <UDashboardSidebarCollapse />
          <UColorModeButton size="xs" />
        </div>
      </template>
    </UDashboardSidebar>

    <UDashboardPanel>
      <template #header>
        <div class="flex items-center justify-end w-full gap-3 px-4 py-1.5">
          <BarcodeInput @scanned="onScanned" />
          <UserSelector />
        </div>
      </template>

      <template #body>
        <slot />
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
