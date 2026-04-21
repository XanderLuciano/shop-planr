<script setup lang="ts">
/**
 * Card layout for a single audit entry, used on mobile viewports.
 * Compact by default: avatar + action + time + meta + summary.
 * Tap to expand and reveal full (untruncated) IDs and metadata.
 */
import type { AuditEntry } from '~/types/domain'

const props = defineProps<{
  entry: AuditEntry
  /** Pre-resolved user display info. If omitted, falls back to userId. */
  user?: { username: string, displayName: string } | null
}>()

const expanded = ref(false)

const config = computed(() => actionConfigFor(props.entry.action))
const summary = computed(() => buildDetailsSummary(props.entry))

const userName = computed(() => {
  if (props.user) return props.user.displayName || props.user.username
  return props.entry.userId || '—'
})

const avatarUser = computed(() => props.user ?? null)

const partLabel = computed(() => {
  const { partId, batchQuantity } = props.entry
  if (partId) return truncateId(partId, 12)
  if (batchQuantity) return `×${batchQuantity}`
  return ''
})

const absoluteTime = computed(() => {
  const d = new Date(props.entry.timestamp)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
})

/**
 * Extra rows to show when expanded: every non-empty ID/metadata field.
 * Kept as a computed list of {label, value} so the template stays simple.
 */
const expandedFields = computed<{ label: string, value: string }[]>(() => {
  const rows: { label: string, value: string }[] = []
  const e = props.entry
  if (e.partId) rows.push({ label: 'Part', value: e.partId })
  if (e.batchQuantity) rows.push({ label: 'Batch', value: `×${e.batchQuantity}` })
  if (e.certId) rows.push({ label: 'Cert', value: e.certId })
  if (e.jobId) rows.push({ label: 'Job', value: e.jobId })
  if (e.pathId) rows.push({ label: 'Path', value: e.pathId })
  if (e.stepId && !e.fromStepId) rows.push({ label: 'Step', value: e.stepId })
  if (e.fromStepId) rows.push({ label: 'From', value: e.fromStepId })
  if (e.toStepId) rows.push({ label: 'To', value: e.toStepId })
  if (e.userId) rows.push({ label: 'User ID', value: e.userId })
  return rows
})

const hasMetadata = computed(() =>
  props.entry.metadata != null && Object.keys(props.entry.metadata).length > 0,
)

function toggleExpanded() {
  expanded.value = !expanded.value
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    toggleExpanded()
  }
}
</script>

<template>
  <div
    class="audit-card p-3 border-b border-(--ui-border-muted) last:border-0 space-y-1 cursor-pointer select-none hover:bg-(--ui-bg-elevated)/30"
    data-testid="audit-card"
    role="button"
    tabindex="0"
    :aria-expanded="expanded"
    @click="toggleExpanded"
    @keydown="onKey"
  >
    <div class="flex items-start gap-3">
      <UserAvatar
        v-if="avatarUser"
        :username="avatarUser.username"
        :display-name="avatarUser.displayName"
        size="sm"
        data-testid="audit-card-avatar"
      />
      <div
        v-else
        class="w-6 h-6 shrink-0 rounded-full bg-(--ui-bg-elevated) flex items-center justify-center text-(--ui-text-muted) text-xs"
        data-testid="audit-card-avatar-placeholder"
        aria-hidden="true"
      >
        ?
      </div>

      <div class="flex-1 min-w-0 space-y-1">
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
          <template v-if="partLabel">
            <span
              class="font-mono truncate"
              data-testid="audit-card-part"
            >{{ partLabel }}</span>
          </template>
          <template v-if="entry.certId">
            <span
              v-if="partLabel"
              class="text-(--ui-text-muted)"
              aria-hidden="true"
            >·</span>
            <span
              class="font-mono truncate"
              data-testid="audit-card-cert"
            >{{ truncateId(entry.certId, 10) }}</span>
          </template>
          <span
            class="truncate ml-auto"
            data-testid="audit-card-user"
          >{{ userName }}</span>
        </div>

        <div
          v-if="summary && !expanded"
          class="text-xs text-(--ui-text-muted) font-mono truncate"
          data-testid="audit-card-summary"
        >
          {{ summary }}
        </div>
      </div>

      <UIcon
        :name="expanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        class="size-4 text-(--ui-text-muted) shrink-0 mt-0.5"
        aria-hidden="true"
      />
    </div>

    <!-- Expanded details -->
    <div
      v-if="expanded"
      class="pt-2 border-t border-(--ui-border-muted) space-y-1.5 text-xs"
      data-testid="audit-card-expanded"
      @click.stop
    >
      <div class="flex items-center gap-2 text-(--ui-text-muted)">
        <UIcon
          name="i-lucide-clock"
          class="size-3 shrink-0"
        />
        <span data-testid="audit-card-absolute-time">{{ absoluteTime }}</span>
      </div>

      <div
        v-for="row in expandedFields"
        :key="row.label"
        class="flex gap-2"
        data-testid="audit-card-field"
      >
        <span class="text-(--ui-text-muted) w-14 shrink-0">{{ row.label }}</span>
        <span class="font-mono text-(--ui-text-highlighted) break-all">{{ row.value }}</span>
      </div>

      <div
        v-if="!expandedFields.length && !hasMetadata"
        class="text-(--ui-text-muted) italic"
        data-testid="audit-card-no-details"
      >
        No additional details.
      </div>

      <div
        v-if="hasMetadata"
        class="pt-1"
        data-testid="audit-card-metadata"
      >
        <div class="text-(--ui-text-muted) mb-1">
          Metadata
        </div>
        <pre class="font-mono text-(--ui-text-highlighted) bg-(--ui-bg-elevated)/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">{{ JSON.stringify(entry.metadata, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>
