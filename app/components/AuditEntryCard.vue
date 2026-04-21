<script setup lang="ts">
/**
 * Card layout for a single audit entry, used on mobile viewports.
 * Shows action + timestamp on top, user · part on second line,
 * and a truncated details/transition summary below.
 */
import type { AuditEntry } from '~/types/domain'

const props = defineProps<{
  entry: AuditEntry
  userDisplay?: string
}>()

const config = computed(() => actionConfigFor(props.entry.action))
const summary = computed(() => buildDetailsSummary(props.entry))
const user = computed(() => props.userDisplay ?? (props.entry.userId || '—'))
const partLabel = computed(() => {
  const { partId, batchQuantity } = props.entry
  if (partId) return truncateId(partId, 12)
  if (batchQuantity) return `×${batchQuantity}`
  return ''
})
</script>

<template>
  <div
    class="audit-card p-3 border-b border-(--ui-border-muted) last:border-0 space-y-1"
    data-testid="audit-card"
  >
    <div class="flex items-center justify-between gap-2">
      <span
        class="inline-flex items-center gap-1 text-sm font-medium"
        :class="config.color"
        data-testid="audit-card-action"
      >
        <UIcon
          :name="config.icon"
          class="size-3.5 shrink-0"
        />
        {{ config.label }}
      </span>
      <span
        class="text-xs text-(--ui-text-muted) shrink-0"
        data-testid="audit-card-time"
      >
        {{ formatRelativeTime(entry.timestamp) }}
      </span>
    </div>

    <div
      class="flex items-center gap-2 text-xs text-(--ui-text-highlighted) flex-wrap"
      data-testid="audit-card-meta"
    >
      <span class="truncate">{{ user }}</span>
      <template v-if="partLabel">
        <span
          class="text-(--ui-text-muted)"
          aria-hidden="true"
        >·</span>
        <span
          class="font-mono truncate"
          data-testid="audit-card-part"
        >{{ partLabel }}</span>
      </template>
      <template v-if="entry.certId">
        <span
          class="text-(--ui-text-muted)"
          aria-hidden="true"
        >·</span>
        <span
          class="font-mono truncate"
          data-testid="audit-card-cert"
        >{{ truncateId(entry.certId, 10) }}</span>
      </template>
    </div>

    <div
      v-if="summary"
      class="text-xs text-(--ui-text-muted) font-mono truncate"
      data-testid="audit-card-summary"
    >
      {{ summary }}
    </div>
  </div>
</template>
