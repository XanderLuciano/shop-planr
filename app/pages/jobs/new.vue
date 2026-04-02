<script setup lang="ts">
const { isAdmin, init } = useUsers()

onMounted(async () => {
  await init()
  if (!isAdmin.value) {
    navigateTo('/jobs')
  }
})

function onSaved(jobId: string) {
  navigateTo(`/jobs/${encodeURIComponent(jobId)}`)
}

function onCancel() {
  navigateTo('/jobs')
}
</script>

<template>
  <div class="p-4 space-y-4 max-w-5xl">
    <NuxtLink
      to="/jobs"
      class="inline-flex items-center gap-1 text-xs text-(--ui-text-muted) hover:text-(--ui-text-highlighted) transition-colors"
    >
      <UIcon name="i-lucide-arrow-left" class="size-3" />
      Back to Jobs
    </NuxtLink>

    <h1 class="text-lg font-bold text-(--ui-text-highlighted)">New Job</h1>

    <JobCreationForm mode="create" @saved="onSaved" @cancel="onCancel" />
  </div>
</template>
