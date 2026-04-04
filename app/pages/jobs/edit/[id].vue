<script setup lang="ts">
import type { Job, Path } from '~/types/domain'
import type { JobProgress } from '~/types/computed'

const route = useRoute()
const jobId = route.params.id as string

const loading = ref(true)
const error = ref('')
const jobWithPaths = ref<(Job & { paths: Path[] }) | null>(null)

async function loadJob() {
  loading.value = true
  error.value = ''
  try {
    const data = await $fetch<Job & { paths: Path[], progress: JobProgress }>(`/api/jobs/${jobId}`)
    const { paths, ...job } = data
    jobWithPaths.value = { ...job, paths }
  } catch (e) {
    error.value = e?.data?.message ?? e?.message ?? 'Job not found'
  } finally {
    loading.value = false
  }
}

function onSaved(id: string) {
  navigateTo(`/jobs/${encodeURIComponent(id)}`)
}

function onCancel() {
  navigateTo(`/jobs/${encodeURIComponent(jobId)}`)
}

onMounted(() => {
  loadJob()
})
</script>

<template>
  <div class="p-4 space-y-4 max-w-5xl">
    <NuxtLink
      :to="`/jobs/${encodeURIComponent(jobId)}`"
      class="inline-flex items-center gap-1 text-xs text-(--ui-text-muted) hover:text-(--ui-text-highlighted) transition-colors"
    >
      <UIcon
        name="i-lucide-arrow-left"
        class="size-3"
      />
      Back to Job
    </NuxtLink>

    <!-- Loading -->
    <div
      v-if="loading"
      class="flex items-center gap-2 text-sm text-(--ui-text-muted) py-8"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="animate-spin size-4"
      />
      Loading job...
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="space-y-2 py-8"
    >
      <p class="text-sm text-red-500">
        {{ error }}
      </p>
      <NuxtLink
        :to="`/jobs/${encodeURIComponent(jobId)}`"
        class="inline-flex items-center gap-1 text-xs text-(--ui-text-muted) hover:text-(--ui-text-highlighted) transition-colors"
      >
        <UIcon
          name="i-lucide-arrow-left"
          class="size-3"
        />
        Back to Job
      </NuxtLink>
    </div>

    <!-- Edit form -->
    <template v-else-if="jobWithPaths">
      <h1 class="text-lg font-bold text-(--ui-text-highlighted)">
        Edit Job — {{ jobWithPaths.name }}
      </h1>

      <JobCreationForm
        mode="edit"
        :existing-job="jobWithPaths"
        @saved="onSaved"
        @cancel="onCancel"
      />
    </template>
  </div>
</template>
