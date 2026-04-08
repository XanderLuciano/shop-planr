<script setup lang="ts">
import type { EnrichedPart } from '~/types/computed'

defineProps<{
  parts: readonly EnrichedPart[]
}>()

const emit = defineEmits<{
  select: [part: EnrichedPart]
}>()

const { users } = useAuth()

const userMap = computed(() => {
  const map = new Map<string, { username: string, displayName: string }>()
  for (const u of users.value) {
    map.set(u.id, { username: u.username, displayName: u.displayName })
  }
  return map
})

function resolveUser(id?: string | null) {
  if (!id) return null
  return userMap.value.get(id) ?? null
}

function statusLabel(status: string) {
  if (status === 'completed') return 'Completed'
  if (status === 'scrapped') return 'Scrapped'
  return 'In Progress'
}

function statusColor(status: string) {
  if (status === 'completed') return 'success' as const
  if (status === 'scrapped') return 'error' as const
  return 'warning' as const
}
</script>

<template>
  <div class="md:hidden space-y-2">
    <div
      v-if="parts.length === 0"
      class="text-sm text-(--ui-text-muted) py-8 text-center"
    >
      No parts found.
    </div>
    <div
      v-for="s in parts"
      :key="s.id"
      class="p-3 rounded-lg border border-(--ui-border) hover:bg-(--ui-bg-elevated)/50 cursor-pointer space-y-1.5"
      role="link"
      tabindex="0"
      @click="emit('select', s)"
      @keydown.enter.prevent="emit('select', s)"
      @keydown.space.prevent="emit('select', s)"
    >
      <div class="flex items-center justify-between">
        <span class="font-mono text-sm font-medium text-(--ui-text-highlighted)">{{ s.id }}</span>
        <UBadge :color="statusColor(s.status)" variant="subtle" size="sm">{{ statusLabel(s.status) }}</UBadge>
      </div>
      <div class="text-xs text-(--ui-text-muted)">{{ s.jobName }}</div>
      <div class="flex items-center justify-between text-xs">
        <span>{{ s.currentStepName }}</span>
        <span v-if="resolveUser(s.assignedTo)" class="inline-flex items-center gap-1 text-(--ui-text-muted)">
          <UserAvatar :username="resolveUser(s.assignedTo)!.username" :display-name="resolveUser(s.assignedTo)!.displayName" size="sm" />
          <span>{{ resolveUser(s.assignedTo)!.displayName }}</span>
        </span>
        <span v-else class="text-(--ui-text-dimmed)">Unassigned</span>
      </div>
    </div>
  </div>
</template>
