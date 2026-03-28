<script setup lang="ts">
import type { AuditEntry, AuditAction } from '~/server/types/domain'

defineProps<{
  entries: AuditEntry[]
}>()

const actionConfig: Record<AuditAction, { label: string, color: string, icon: string }> = {
  cert_attached: { label: 'Cert Attached', color: 'text-blue-500', icon: 'i-lucide-paperclip' },
  part_created: { label: 'Part Created', color: 'text-green-500', icon: 'i-lucide-plus-circle' },
  part_advanced: { label: 'Advanced', color: 'text-violet-500', icon: 'i-lucide-arrow-right' },
  part_completed: { label: 'Completed', color: 'text-emerald-500', icon: 'i-lucide-check-circle' },
  note_created: { label: 'Note', color: 'text-amber-500', icon: 'i-lucide-message-square' }
}

function formatTime(ts: string): string {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
}
</script>

<template>
  <div
    v-if="!entries.length"
    class="text-xs text-(--ui-text-muted) py-4 text-center"
  >
    No audit entries found.
  </div>
  <table
    v-else
    class="w-full text-xs"
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
          {{ formatTime(entry.timestamp) }}
        </td>
        <td class="py-1 px-2 whitespace-nowrap">
          <span
            class="inline-flex items-center gap-1"
            :class="actionConfig[entry.action]?.color"
          >
            <UIcon
              :name="actionConfig[entry.action]?.icon"
              class="size-3"
            />
            {{ actionConfig[entry.action]?.label ?? entry.action }}
          </span>
        </td>
        <td class="py-1 px-2 text-(--ui-text-highlighted)">
          {{ entry.userId || '—' }}
        </td>
        <td class="py-1 px-2 font-mono">
          {{ entry.partId || (entry.batchQuantity ? `×${entry.batchQuantity}` : '—') }}
        </td>
        <td class="py-1 px-2 font-mono">
          {{ entry.certId || '—' }}
        </td>
        <td class="py-1 px-2 text-(--ui-text-muted)">
          <span v-if="entry.fromStepId && entry.toStepId">{{ entry.fromStepId }} → {{ entry.toStepId }}</span>
          <span v-else-if="entry.stepId">at {{ entry.stepId }}</span>
          <span v-else-if="entry.jobId">job {{ entry.jobId }}</span>
          <span v-else>—</span>
        </td>
      </tr>
    </tbody>
  </table>
</template>
