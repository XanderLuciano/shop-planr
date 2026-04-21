<script setup lang="ts">
import type { AuditEntry } from '~/types/domain'

defineProps<{
  entries: readonly AuditEntry[]
}>()

const { users } = useAuth()
const { isMobile } = useMobileBreakpoint()

const userMap = computed(() => {
  const map = new Map<string, { username: string, displayName: string }>()
  for (const u of users.value) {
    map.set(u.id, { username: u.username, displayName: u.displayName })
  }
  return map
})

function resolveUser(userId?: string | null) {
  if (!userId) return null
  return userMap.value.get(userId) ?? null
}

function resolveUserLabel(userId?: string | null): string {
  if (!userId) return '—'
  const u = userMap.value.get(userId)
  return u?.displayName || u?.username || truncateId(userId, 10)
}
</script>

<template>
  <div
    v-if="!entries.length"
    class="text-xs text-(--ui-text-muted) py-4 text-center"
  >
    No audit entries found.
  </div>

  <!-- Mobile: card list -->
  <div
    v-else-if="isMobile"
    data-testid="audit-card-list"
  >
    <AuditEntryCard
      v-for="entry in entries"
      :key="entry.id"
      :entry="entry"
      :user="resolveUser(entry.userId)"
    />
  </div>

  <!-- Desktop: full table -->
  <table
    v-else
    class="w-full text-xs"
    data-testid="audit-table"
  >
    <thead>
      <tr class="text-(--ui-text-muted) border-b border-(--ui-border-muted)">
        <th class="text-left py-1 px-2 font-medium">
          Time
        </th>
        <th class="text-left py-1 px-2 font-medium">
          Action
        </th>
        <th class="text-left py-1 px-2 font-medium">
          User
        </th>
        <th class="text-left py-1 px-2 font-medium">
          Part
        </th>
        <th class="text-left py-1 px-2 font-medium">
          Cert
        </th>
        <th class="text-left py-1 px-2 font-medium">
          Details
        </th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="entry in entries"
        :key="entry.id"
        class="border-b border-(--ui-border-muted) last:border-0 hover:bg-(--ui-bg-elevated)/50"
      >
        <td class="py-1 px-2 text-(--ui-text-muted) whitespace-nowrap">
          {{ formatRelativeTime(entry.timestamp) }}
        </td>
        <td class="py-1 px-2 whitespace-nowrap">
          <span
            class="inline-flex items-center gap-1"
            :class="actionConfigFor(entry.action).color"
          >
            <UIcon
              :name="actionConfigFor(entry.action).icon"
              class="size-3"
            />
            {{ actionConfigFor(entry.action).label }}
          </span>
        </td>
        <td class="py-1 px-2 text-(--ui-text-highlighted)">
          {{ resolveUserLabel(entry.userId) }}
        </td>
        <td class="py-1 px-2 font-mono">
          {{ entry.partId || (entry.batchQuantity ? `×${entry.batchQuantity}` : '—') }}
        </td>
        <td class="py-1 px-2 font-mono">
          {{ entry.certId || '—' }}
        </td>
        <td class="py-1 px-2 text-(--ui-text-muted)">
          <span v-if="hasTransition(entry)">{{ entry.fromStepId }} → {{ entry.toStepId }}</span>
          <span v-else-if="entry.stepId">at {{ entry.stepId }}</span>
          <span v-else-if="entry.jobId">job {{ entry.jobId }}</span>
          <span v-else>—</span>
        </td>
      </tr>
    </tbody>
  </table>
</template>
