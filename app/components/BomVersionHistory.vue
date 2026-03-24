<script setup lang="ts">
const props = defineProps<{
  bomId: string
}>()

const { versions, loading, fetchVersions } = useBomVersions()

onMounted(() => {
  fetchVersions(props.bomId)
})

watch(() => props.bomId, (id) => {
  if (id) fetchVersions(id)
})

const sortedVersions = computed(() =>
  [...versions.value].sort((a, b) => b.versionNumber - a.versionNumber),
)

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}
</script>

<template>
  <div class="space-y-3">
    <h4 class="text-sm font-semibold text-(--ui-text-highlighted) flex items-center gap-1.5">
      <UIcon name="i-lucide-history" class="size-4" />
      Version History
    </h4>

    <div v-if="loading" class="text-sm text-(--ui-text-muted)">Loading...</div>

    <div v-else-if="!sortedVersions.length" class="text-sm text-(--ui-text-muted)">
      No version history yet
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="version in sortedVersions"
        :key="version.id"
        class="border border-(--ui-border) rounded-md p-3 space-y-1"
      >
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-(--ui-text-highlighted)">
            Version {{ version.versionNumber }}
          </span>
          <span class="text-xs text-(--ui-text-muted)">
            {{ formatDate(version.createdAt) }}
          </span>
        </div>
        <p class="text-xs text-(--ui-text-muted)">
          By: {{ version.changedBy }}
        </p>
        <p v-if="version.changeDescription" class="text-xs text-(--ui-text-highlighted)">
          {{ version.changeDescription }}
        </p>
        <div class="text-xs text-(--ui-text-muted)">
          {{ version.entriesSnapshot.length }} entr{{ version.entriesSnapshot.length === 1 ? 'y' : 'ies' }} at time of snapshot
        </div>
      </div>
    </div>
  </div>
</template>
