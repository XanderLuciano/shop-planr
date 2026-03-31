<script setup lang="ts">
import type { StepNote } from '~/types/domain'

const props = defineProps<{
  partId: string
  hideHeading?: boolean
}>()

const { notes, loading, fetchNotesForPart } = useNotes()

onMounted(() => {
  fetchNotesForPart(props.partId)
})

const sortedNotes = computed(() =>
  [...notes.value].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
)

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}
</script>

<template>
  <div class="space-y-2">
    <h4 v-if="!hideHeading" class="text-sm font-semibold text-(--ui-text-highlighted) flex items-center gap-1.5">
      <UIcon name="i-lucide-message-square" class="size-4" />
      Notes
    </h4>

    <div v-if="loading" class="text-sm text-(--ui-text-muted)">Loading notes...</div>

    <div v-else-if="!sortedNotes.length" class="text-sm text-(--ui-text-muted)">
      No notes for this part
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="note in sortedNotes"
        :key="note.id"
        class="border border-(--ui-border) rounded-md p-3 space-y-1"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-(--ui-text-muted)">{{ note.createdBy }}</span>
          <span class="text-xs text-(--ui-text-muted)">{{ formatDate(note.createdAt) }}</span>
        </div>
        <p class="text-sm text-(--ui-text-highlighted)">{{ note.text }}</p>
        <div v-if="note.pushedToJira" class="flex items-center gap-1">
          <UBadge color="info" variant="subtle" size="xs">Pushed to Jira</UBadge>
        </div>
      </div>
    </div>
  </div>
</template>
