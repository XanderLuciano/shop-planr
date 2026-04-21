<script setup lang="ts">
import type { EnrichedPart } from '~/types/computed'

defineProps<{
  parts: readonly EnrichedPart[]
  sortColumn: string
  sortDirection: 'asc' | 'desc'
}>()

const emit = defineEmits<{
  sort: [key: SortableKey]
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

type SortableKey = 'id' | 'jobName' | 'currentStepName' | 'status' | 'assignedTo' | 'createdAt'

const columns: { key: SortableKey, label: string }[] = [
  { key: 'id', label: 'Part' },
  { key: 'jobName', label: 'Job' },
  { key: 'currentStepName', label: 'Step' },
  { key: 'status', label: 'Status' },
  { key: 'assignedTo', label: 'Assignee' },
  { key: 'createdAt', label: 'Created' },
]

function sortIcon(col: string, current: string, dir: string) {
  if (current !== col) return ''
  return dir === 'asc' ? '↑' : '↓'
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
  <div class="hidden md:block border border-(--ui-border) rounded-md overflow-hidden">
    <table class="w-full text-sm">
      <thead>
        <tr class="bg-(--ui-bg-elevated)/50 text-xs text-(--ui-text-muted)">
          <th
            v-for="col in columns"
            :key="col.key"
            class="px-3 py-2 text-left cursor-pointer hover:text-(--ui-text-highlighted) select-none"
            @click="emit('sort', col.key)"
          >
            {{ col.label }}
            <span
              v-if="sortColumn === col.key"
              class="ml-0.5"
            >{{ sortIcon(col.key, sortColumn, sortDirection) }}</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-(--ui-border)">
        <tr
          v-for="s in parts"
          :key="s.id"
          class="cursor-pointer hover:bg-(--ui-bg-elevated)/50 transition-colors"
          @click="emit('select', s)"
        >
          <td class="px-3 py-2 font-medium text-(--ui-text-highlighted)">
            {{ s.id }}
          </td>
          <td class="px-3 py-2">
            {{ s.jobName }}
          </td>
          <td class="px-3 py-2">
            {{ s.currentStepName }}
          </td>
          <td class="px-3 py-2">
            <UBadge
              :color="statusColor(s.status)"
              variant="subtle"
              size="sm"
            >
              {{ statusLabel(s.status) }}
            </UBadge>
          </td>
          <td class="px-3 py-2 text-(--ui-text-muted)">
            <span
              v-if="resolveUser(s.assignedTo)"
              class="inline-flex items-center gap-1.5"
            >
              <UserAvatar
                :username="resolveUser(s.assignedTo)!.username"
                :display-name="resolveUser(s.assignedTo)!.displayName"
                size="sm"
              />
              <span>{{ resolveUser(s.assignedTo)!.displayName }}</span>
            </span>
            <span
              v-else
              class="text-(--ui-text-dimmed)"
            >Unassigned</span>
          </td>
          <td class="px-3 py-2 text-(--ui-text-muted)">
            {{ formatDate(s.createdAt) }}
          </td>
        </tr>
        <tr v-if="parts.length === 0">
          <td
            colspan="6"
            class="px-3 py-8 text-center text-(--ui-text-muted)"
          >
            No parts found.
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
