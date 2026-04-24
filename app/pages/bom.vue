<script setup lang="ts">
import type { BomSummary } from '~/types/computed'
import type { BOM, Tag } from '~/types/domain'

type BomSavePayload = { name: string, entries: { jobId: string, requiredQuantity?: number }[] }

const { boms, loading, fetchBoms, createBom, getBomWithSummary } = useBom()
const { jobs, fetchJobs } = useJobs()
const { editBom } = useBomVersions()
const { tags, fetchTags } = useTags()

const showForm = ref(false)
const formSaving = ref(false)
const expandedId = ref<string | null>(null)
const summaries = ref<Record<string, BomSummary>>({})
const summaryLoading = ref<string | null>(null)

// Edit state
const editingBomId = ref<string | null>(null)
const editSaving = ref(false)
const editError = ref('')

// Version history state
const showVersionsId = ref<string | null>(null)

// "Create from tag" state
const prefillJobIds = ref<string[]>([])

async function toggleExpand(bom: BOM) {
  if (expandedId.value === bom.id) {
    expandedId.value = null
    return
  }
  expandedId.value = bom.id
  if (!summaries.value[bom.id]) {
    summaryLoading.value = bom.id
    try {
      const result = await getBomWithSummary(bom.id)
      summaries.value[bom.id] = result.summary
    } catch {
      // summary fetch failed
    } finally {
      summaryLoading.value = null
    }
  }
}

async function onSave(payload: BomSavePayload) {
  formSaving.value = true
  try {
    await createBom(payload)
    showForm.value = false
    prefillJobIds.value = []
  } catch {
    // error handled by composable
  } finally {
    formSaving.value = false
  }
}

async function onEditSave(bomId: string, payload: BomSavePayload) {
  editSaving.value = true
  editError.value = ''
  try {
    await editBom(bomId, {
      name: payload.name,
      entries: payload.entries,
      changeDescription: 'Updated BOM entries',
    })
    editingBomId.value = null
    const { [bomId]: _, ...rest } = summaries.value
    summaries.value = rest
    await fetchBoms()
  } catch (e) {
    editError.value = e?.data?.message ?? e?.message ?? 'Failed to edit BOM'
  } finally {
    editSaving.value = false
  }
}

function toggleVersions(bomId: string) {
  showVersionsId.value = showVersionsId.value === bomId ? null : bomId
}

function createFromTag(tag: Tag) {
  const jobIds = jobs.value
    .filter(j => j.tags.some(t => t.id === tag.id))
    .map(j => j.id)
  if (!jobIds.length) return
  prefillJobIds.value = jobIds
  showForm.value = true
}

onMounted(async () => {
  await Promise.all([fetchBoms(), fetchJobs(), fetchTags()])
})
</script>

<template>
  <div class="p-4 space-y-3 max-w-4xl">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-bold text-(--ui-text-highlighted)">
        Bill of Materials
      </h1>
      <div class="flex items-center gap-2">
        <!-- Create from tag dropdown -->
        <UDropdownMenu
          v-if="tags.length"
          :items="tags.map(t => ({ label: t.name, click: () => createFromTag(t) }))"
        >
          <UButton
            icon="i-lucide-tag"
            label="From Tag"
            size="sm"
            variant="soft"
          />
        </UDropdownMenu>
        <UButton
          v-if="!showForm"
          icon="i-lucide-plus"
          label="New BOM"
          size="sm"
          @click="showForm = true"
        />
      </div>
    </div>

    <!-- Create form -->
    <BomEditor
      v-if="showForm"
      :jobs="jobs"
      :prefill-job-ids="prefillJobIds"
      @save="onSave"
      @cancel="showForm = false; prefillJobIds = []"
    />

    <!-- Loading -->
    <div
      v-if="loading"
      class="flex items-center gap-2 text-sm text-(--ui-text-muted)"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="animate-spin size-4"
      />
      Loading BOMs...
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!boms.length && !showForm"
      class="text-sm text-(--ui-text-muted) py-8 text-center"
    >
      No BOMs defined yet. Create a BOM to track sub-assembly requirements.
    </div>

    <!-- BOM list -->
    <div
      v-else
      class="space-y-2"
    >
      <div
        v-for="b in boms"
        :key="b.id"
        class="border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/50"
      >
        <!-- Header row -->
        <button
          class="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-(--ui-bg-elevated) transition-colors cursor-pointer"
          @click="toggleExpand(b)"
        >
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium text-(--ui-text-highlighted)">
              {{ b.name }}
            </div>
            <div class="text-xs text-(--ui-text-muted) mt-0.5">
              {{ b.entries.length }} job{{ b.entries.length !== 1 ? 's' : '' }}
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-pencil"
              title="Edit"
              @click.stop="editingBomId = editingBomId === b.id ? null : b.id"
            />
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-history"
              title="Version History"
              @click.stop="toggleVersions(b.id)"
            />
            <UIcon
              :name="expandedId === b.id ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              class="size-4 text-(--ui-text-muted)"
            />
          </div>
        </button>

        <!-- Edit form -->
        <div
          v-if="editingBomId === b.id"
          class="px-3 pb-3 border-t border-(--ui-border-muted)"
        >
          <BomEditor
            :bom="b"
            :jobs="jobs"
            @save="(payload: BomSavePayload) => onEditSave(b.id, payload)"
            @cancel="editingBomId = null"
          />
          <p
            v-if="editError"
            class="text-xs text-red-500 mt-1"
          >
            {{ editError }}
          </p>
        </div>

        <!-- Version history -->
        <div
          v-if="showVersionsId === b.id"
          class="px-3 pb-3 border-t border-(--ui-border-muted)"
        >
          <BomVersionHistory :bom-id="b.id" />
        </div>

        <!-- Expanded summary -->
        <div
          v-if="expandedId === b.id && editingBomId !== b.id"
          class="px-3 pb-3 border-t border-(--ui-border-muted)"
        >
          <div
            v-if="summaryLoading === b.id"
            class="flex items-center gap-2 py-2 text-xs text-(--ui-text-muted)"
          >
            <UIcon
              name="i-lucide-loader-2"
              class="animate-spin size-3"
            />
            Loading summary...
          </div>
          <table
            v-else-if="summaries[b.id]"
            class="w-full text-xs mt-2"
          >
            <thead>
              <tr class="text-(--ui-text-muted) border-b border-(--ui-border-muted)">
                <th class="text-left py-1 font-medium">
                  Job
                </th>
                <th class="text-right py-1 font-medium">
                  Required
                </th>
                <th class="text-right py-1 font-medium">
                  Completed
                </th>
                <th class="text-right py-1 font-medium">
                  In Progress
                </th>
                <th class="text-right py-1 font-medium">
                  Outstanding
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="entry in summaries[b.id]!.entries"
                :key="entry.jobId"
                class="border-b border-(--ui-border-muted) last:border-0"
              >
                <td class="py-1">
                  <NuxtLink
                    :to="`/jobs/${entry.jobId}`"
                    class="text-(--ui-primary) hover:underline"
                  >
                    {{ entry.jobName }}
                  </NuxtLink>
                </td>
                <td class="py-1 text-right">
                  {{ entry.requiredQuantity }}
                </td>
                <td class="py-1 text-right text-green-500">
                  {{ entry.totalCompleted }}
                </td>
                <td class="py-1 text-right text-blue-500">
                  {{ entry.totalInProgress }}
                </td>
                <td
                  class="py-1 text-right"
                  :class="entry.totalOutstanding > 0 ? 'text-amber-500' : 'text-(--ui-text-muted)'"
                >
                  {{ entry.totalOutstanding }}
                </td>
              </tr>
            </tbody>
          </table>
          <div
            v-else
            class="py-2 text-xs text-(--ui-text-muted)"
          >
            No summary available.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
