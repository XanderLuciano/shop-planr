<script setup lang="ts">
import type { PageToggles } from '~/server/types/domain'

interface PageItem {
  key: keyof PageToggles | null
  label: string
  icon: string
  alwaysOn: boolean
}

const props = defineProps<{
  toggles: PageToggles
}>()

const emit = defineEmits<{
  (e: 'update', toggles: PageToggles): void
}>()

const pages: PageItem[] = [
  { key: null, label: 'Dashboard', icon: 'i-lucide-layout-dashboard', alwaysOn: true },
  { key: 'jobs', label: 'Jobs', icon: 'i-lucide-briefcase', alwaysOn: false },
  { key: 'serials', label: 'Serials', icon: 'i-lucide-hash', alwaysOn: false },
  { key: 'parts', label: 'Parts', icon: 'i-lucide-wrench', alwaysOn: false },
  { key: 'queue', label: 'Work Queue', icon: 'i-lucide-hard-hat', alwaysOn: false },
  { key: 'templates', label: 'Templates', icon: 'i-lucide-copy', alwaysOn: false },
  { key: 'bom', label: 'BOM', icon: 'i-lucide-package', alwaysOn: false },
  { key: 'certs', label: 'Certs', icon: 'i-lucide-shield-check', alwaysOn: false },
  { key: 'jira', label: 'Jira', icon: 'i-lucide-ticket', alwaysOn: false },
  { key: 'audit', label: 'Audit', icon: 'i-lucide-scroll-text', alwaysOn: false },
  { key: null, label: 'Settings', icon: 'i-lucide-settings', alwaysOn: true },
]

function onToggle(key: keyof PageToggles, value: boolean) {
  emit('update', { ...props.toggles, [key]: value })
}
</script>

<template>
  <div class="space-y-1">
    <div
      v-for="page in pages"
      :key="page.label"
      class="flex items-center justify-between px-3 py-2 rounded-md"
      :class="page.alwaysOn ? 'opacity-60' : ''"
    >
      <div class="flex items-center gap-2.5">
        <UIcon
          :name="page.icon"
          class="size-4 text-(--ui-text-muted)"
        />
        <span class="text-sm text-(--ui-text-highlighted)">{{ page.label }}</span>
        <UBadge
          v-if="page.alwaysOn"
          size="xs"
          color="neutral"
          variant="subtle"
        >
          Always on
        </UBadge>
      </div>
      <USwitch
        v-if="!page.alwaysOn && page.key"
        :model-value="props.toggles[page.key]"
        @update:model-value="onToggle(page.key!, $event as boolean)"
      />
      <USwitch
        v-else
        :model-value="true"
        disabled
      />
    </div>
  </div>
</template>
