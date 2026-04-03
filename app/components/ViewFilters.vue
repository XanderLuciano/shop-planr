<script setup lang="ts">
import type { FilterState } from '~/types/domain'

const props = defineProps<{
  filters: FilterState
}>()

const emit = defineEmits<{
  change: [filters: FilterState]
}>()

const statusOptions = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' }
]

function update<K extends keyof FilterState>(key: K, value: FilterState[K]) {
  const next = { ...props.filters, [key]: value }
  emit('change', next)
}

function clearAll() {
  emit('change', { status: 'all' })
}

const hasActiveFilters = computed(() => {
  const f = props.filters
  return !!(f.jobName || f.jiraTicketKey || f.stepName || f.assignee || f.priority || f.label || (f.status && f.status !== 'all'))
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
    <slot />
  </div>
</template>
