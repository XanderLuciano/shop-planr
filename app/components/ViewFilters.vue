<script setup lang="ts">
import type { FilterState, Tag } from '~/types/domain'

const props = defineProps<{
  filters: FilterState
  availableTags?: Tag[]
}>()

const emit = defineEmits<{
  change: [filters: FilterState]
}>()

const statusOptions = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
]

function update<K extends keyof FilterState>(key: K, value: FilterState[K]) {
  const next = { ...props.filters, [key]: value }
  emit('change', next)
}

function clearAll() {
  emit('change', { status: 'all', tagIds: [] })
}

function toggleTag(tagId: string) {
  const current = props.filters.tagIds ?? []
  const next = current.includes(tagId)
    ? current.filter(id => id !== tagId)
    : [...current, tagId]
  update('tagIds', next)
}

function isTagSelected(tagId: string) {
  return props.filters.tagIds?.includes(tagId) ?? false
}

const tagFilterOpen = ref(false)

const selectedTagCount = computed(() => props.filters.tagIds?.length ?? 0)

const hasActiveFilters = computed(() => {
  const f = props.filters
  return !!(f.jobName || f.jiraTicketKey || f.stepName || f.assignee || f.priority || f.label || (f.status && f.status !== 'all') || f.tagIds?.length)
})
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <UInput
      :model-value="filters.jobName ?? ''"
      size="sm"
      placeholder="Job name"
      icon="i-lucide-briefcase"
      class="w-36"
      @update:model-value="update('jobName', ($event as string) || undefined)"
    >
      <template #trailing>
        <UButton
          v-if="filters.jobName"
          icon="i-lucide-x"
          color="neutral"
          variant="link"
          size="xs"
          :padded="false"
          aria-label="Clear job name filter"
          @click="update('jobName', undefined)"
        />
      </template>
    </UInput>
    <USelect
      :model-value="filters.status ?? 'all'"
      :items="statusOptions"
      size="sm"
      class="w-32"
      @update:model-value="update('status', ($event as FilterState['status']))"
    />
    <UInput
      :model-value="filters.priority ?? ''"
      size="sm"
      placeholder="Priority"
      icon="i-lucide-signal"
      class="w-28"
      @update:model-value="update('priority', ($event as string) || undefined)"
    >
      <template #trailing>
        <UButton
          v-if="filters.priority"
          icon="i-lucide-x"
          color="neutral"
          variant="link"
          size="xs"
          :padded="false"
          aria-label="Clear priority filter"
          @click="update('priority', undefined)"
        />
      </template>
    </UInput>
    <UInput
      :model-value="filters.stepName ?? ''"
      size="sm"
      placeholder="Step"
      icon="i-lucide-footprints"
      class="w-28"
      @update:model-value="update('stepName', ($event as string) || undefined)"
    >
      <template #trailing>
        <UButton
          v-if="filters.stepName"
          icon="i-lucide-x"
          color="neutral"
          variant="link"
          size="xs"
          :padded="false"
          aria-label="Clear step filter"
          @click="update('stepName', undefined)"
        />
      </template>
    </UInput>
    <UButton
      v-if="hasActiveFilters"
      size="xs"
      variant="ghost"
      color="neutral"
      icon="i-lucide-x"
      label="Clear"
      @click="clearAll"
    />

    <!-- Tag filter dropdown -->
    <div
      v-if="availableTags?.length"
      class="relative"
    >
      <UButton
        variant="outline"
        color="neutral"
        size="sm"
        icon="i-lucide-tag"
        :trailing-icon="tagFilterOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        :label="selectedTagCount ? `Tags (${selectedTagCount})` : 'Tags'"
        @click="tagFilterOpen = !tagFilterOpen"
      />
      <div
        v-if="tagFilterOpen"
        class="fixed inset-0 z-40"
        @click="tagFilterOpen = false"
      />
      <div
        v-if="tagFilterOpen"
        class="absolute z-50 mt-1 w-52 rounded-md border border-(--ui-border) bg-(--ui-bg) shadow-lg"
        @click.stop
      >
        <div class="max-h-48 overflow-y-auto">
          <div
            v-for="tag in availableTags"
            :key="tag.id"
            class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-(--ui-bg-elevated) text-sm"
            @click="toggleTag(tag.id)"
          >
            <UIcon
              :name="isTagSelected(tag.id) ? 'i-lucide-check-square' : 'i-lucide-square'"
              class="size-4 shrink-0 text-(--ui-text-muted)"
            />
            <JobTagPill :tag="tag" />
          </div>
        </div>
      </div>
    </div>

    <slot />
  </div>
</template>
