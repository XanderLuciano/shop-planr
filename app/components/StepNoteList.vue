<script setup lang="ts">
import type { StepNote } from '~/types/domain'

defineProps<{
  notes: readonly StepNote[]
}>()
</script>

<template>
  <div
    v-if="!notes.length"
    class="text-xs text-(--ui-text-muted) py-2 text-center"
  >
    No notes yet.
  </div>
  <div
    v-else
    class="space-y-1.5"
  >
    <div
      v-for="note in notes"
      :key="note.id"
      class="border border-(--ui-border) rounded-md px-2.5 py-1.5 text-xs space-y-0.5"
    >
      <div class="flex items-center justify-between gap-2">
        <span class="font-medium text-(--ui-text-highlighted)">{{ note.createdBy }}</span>
        <span class="text-(--ui-text-muted) whitespace-nowrap">{{ formatRelativeTime(note.createdAt) }}</span>
      </div>
      <p class="text-(--ui-text) whitespace-pre-wrap break-words">
        {{ note.text }}
      </p>
      <div
        v-if="note.partIds.length"
        class="flex items-center gap-1 flex-wrap"
      >
        <UBadge
          v-for="pid in note.partIds"
          :key="pid"
          size="xs"
          variant="subtle"
          color="neutral"
          class="font-mono"
        >
          {{ pid }}
        </UBadge>
        <UBadge
          v-if="note.pushedToJira"
          size="xs"
          variant="subtle"
          color="info"
        >
          Jira
        </UBadge>
      </div>
    </div>
  </div>
</template>
