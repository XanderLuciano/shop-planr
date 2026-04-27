<script setup lang="ts">
import type { BomSummary } from '~/types/computed'
import type { BOM, Tag } from '~/types/domain'
import type { BomSavePayload } from '~/types/api'
import { extractApiError } from '~/utils/apiError'

const { boms, loading, fetchBoms, createBom, getBomWithSummary, archiveBom, unarchiveBom } = useBom()
const { jobs, fetchJobs } = useJobs()
const { editBom } = useBomVersions()
const { tags, fetchTags } = useTags()
const { isAdmin, authenticatedUser } = useAuth()

const showForm = ref(false)
const formSaving = ref(false)
const expandedId = ref<string | null>(null)
const summaries = ref<Record<string, BomSummary>>({})
const summaryLoading = ref<string | null>(null)
const showArchived = ref(false)

// Edit state
const editingBomId = ref<string | null>(null)
const editSaving = ref(false)
const editError = ref('')

// Archive state
const archiveConfirmId = ref<string | null>(null)
const archiving = ref(false)

// Version history state
const showVersionsId = ref<string | null>(null)

// "Create from tag" state
const prefillJobIds = ref<string[]>([])
const prefillName = ref('')

// Component refs
const createEditorRef = ref<{ submit: () => void } | null>(null)
const editEditorRefs = ref<Record<string, { submit: () => void }>>({})
const editRefCallbacks = new Map<string, (el: unknown) => void>()

function setEditEditorRef(bomId: string) {
  let cb = editRefCallbacks.get(bomId)
  if (!cb) {
    cb = (el: unknown) => {
      if (el) editEditorRefs.value[bomId] = el as { submit: () => void }
      else {
        const { [bomId]: _, ...rest } = editEditorRefs.value
        editEditorRefs.value = rest
      }
    }
    editRefCallbacks.set(bomId, cb)
  }
  return cb
}

const activeBoms = computed(() => boms.value.filter(b => !b.archivedAt))
const archivedBoms = computed(() => boms.value.filter(b => !!b.archivedAt))

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

function onCancelCreate() {
  showForm.value = false
  prefillJobIds.value = []
  prefillName.value = ''
}

async function onSave(payload: BomSavePayload) {
  formSaving.value = true
  try {
    await createBom(payload)
    showForm.value = false
    prefillJobIds.value = []
    prefillName.value = ''
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
    await fetchBoms(showArchived.value)
  } catch (e) {
    editError.value = extractApiError(e, 'Failed to edit BOM')
  } finally {
    editSaving.value = false
  }
}

function toggleVersions(bomId: string) {
  showVersionsId.value = showVersionsId.value === bomId ? null : bomId
}

const toast = useToast()

function createFromTag(tag: Tag) {
  const jobIds = jobs.value
    .filter(j => j.tags.some(t => t.id === tag.id))
    .map(j => j.id)
  if (!jobIds.length) {
    toast.add({ title: `No jobs found with tag "${tag.name}"`, color: 'warning' })
    return
  }
  prefillJobIds.value = jobIds
  prefillName.value = tag.name
  showForm.value = true
}

async function handleArchive(bom: BOM) {
  archiving.value = true
  try {
    const userId = authenticatedUser.value?.id
    if (!userId) return
    await archiveBom(bom.id, userId)
    archiveConfirmId.value = null
    toast.add({ title: `"${bom.name}" archived`, color: 'success' })
    await fetchBoms(showArchived.value)
  } catch (e) {
    toast.add({ title: extractApiError(e, 'Failed to archive BOM'), color: 'error' })
  } finally {
    archiving.value = false
  }
}

async function handleUnarchive(bom: BOM) {
  archiving.value = true
  try {
    const userId = authenticatedUser.value?.id
    if (!userId) return
    await unarchiveBom(bom.id, userId)
    toast.add({ title: `"${bom.name}" restored`, color: 'success' })
    await fetchBoms(showArchived.value)
  } catch (e) {
    toast.add({ title: extractApiError(e, 'Failed to restore BOM'), color: 'error' })
  } finally {
    archiving.value = false
  }
}

async function toggleShowArchived() {
  showArchived.value = !showArchived.value
  await fetchBoms(showArchived.value)
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
        <UButton
          v-if="isAdmin"
          :icon="showArchived ? 'i-lucide-eye-off' : 'i-lucide-archive'"
          :label="showArchived ? 'Hide Archived' : 'Show Archived'"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="toggleShowArchived"
        />
        <UFieldGroup size="sm">
          <UButton
            icon="i-lucide-plus"
            label="New BOM"
            color="neutral"
            variant="subtle"
            @click="showForm = true"
          />
          <UDropdownMenu
            v-if="tags.length"
            :modal="false"
            :items="[[{ label: 'New BOM from tag', type: 'label', class: 'text-[10px] text-(--ui-text-dimmed) font-normal py-0' }], tags.map(t => ({ label: t.name, onSelect: () => createFromTag(t) }))]"
          >
            <UButton
              icon="i-lucide-chevron-down"
              color="neutral"
              variant="subtle"
            />
          </UDropdownMenu>
        </UFieldGroup>
      </div>
    </div>

    <!-- Create modal -->
    <UModal
      v-model:open="showForm"
      title="New BOM"
      @update:open="(val: boolean) => { if (!val) onCancelCreate() }"
    >
      <template #body>
        <BomEditor
          ref="createEditorRef"
          :jobs="jobs"
          :prefill-job-ids="prefillJobIds"
          :prefill-name="prefillName"
          @save="onSave"
          @cancel="onCancelCreate"
        />
      </template>
      <template #footer>
        <div class="flex gap-2 justify-end w-full">
          <UButton
            variant="ghost"
            size="sm"
            label="Cancel"
            @click="onCancelCreate"
          />
          <UButton
            size="sm"
            label="Create BOM"
            @click="createEditorRef?.submit()"
          />
        </div>
      </template>
    </UModal>

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
      v-else-if="!activeBoms.length && !archivedBoms.length"
      class="text-sm text-(--ui-text-muted) py-8 text-center"
    >
      No BOMs defined yet. Create a BOM to track sub-assembly requirements.
    </div>

    <template v-else>
      <!-- Active BOM list -->
      <div
        v-if="activeBoms.length"
        class="space-y-2"
      >
        <div
          v-for="b in activeBoms"
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
              <UButton
                v-if="isAdmin"
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-archive"
                title="Archive"
                @click.stop="archiveConfirmId = b.id"
              />
              <UIcon
                :name="expandedId === b.id ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                class="size-4 text-(--ui-text-muted)"
              />
            </div>
          </button>

          <!-- Archive confirmation modal -->
          <UModal
            :open="archiveConfirmId === b.id"
            title="Archive BOM"
            description="This BOM will be hidden from the default view."
            @update:open="(val: boolean) => { if (!val) archiveConfirmId = null }"
          >
            <template #body>
              <p class="text-sm text-(--ui-text-muted)">
                Are you sure you want to archive "{{ b.name }}"? It can be restored later from the archived list.
              </p>
            </template>
            <template #footer>
              <div class="flex gap-2 justify-end w-full">
                <UButton
                  variant="ghost"
                  size="sm"
                  label="Cancel"
                  @click="archiveConfirmId = null"
                />
                <UButton
                  size="sm"
                  color="error"
                  label="Archive"
                  :loading="archiving"
                  @click="handleArchive(b)"
                />
              </div>
            </template>
          </UModal>

          <!-- Edit modal -->
          <UModal
            :open="editingBomId === b.id"
            title="Edit BOM"
            @update:open="(val: boolean) => { if (!val) { editingBomId = null; editError = '' } }"
          >
            <template #body>
              <BomEditor
                :ref="setEditEditorRef(b.id)"
                :bom="b"
                :jobs="jobs"
                @save="(payload: BomSavePayload) => onEditSave(b.id, payload)"
                @cancel="editingBomId = null"
              />
              <p
                v-if="editError"
                class="text-xs text-red-500 mt-2"
              >
                {{ editError }}
              </p>
            </template>
            <template #footer>
              <div class="flex gap-2 justify-end w-full">
                <UButton
                  variant="ghost"
                  size="sm"
                  label="Cancel"
                  @click="editingBomId = null"
                />
                <UButton
                  size="sm"
                  label="Update BOM"
                  @click="editEditorRefs[b.id]?.submit()"
                />
              </div>
            </template>
          </UModal>

          <!-- Version history -->
          <div
            v-if="showVersionsId === b.id"
            class="px-3 pb-3 border-t border-(--ui-border-muted)"
          >
            <BomVersionHistory :bom-id="b.id" />
          </div>

          <!-- Expanded summary -->
          <div
            v-if="expandedId === b.id"
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

      <!-- Empty active state when only archived exist -->
      <div
        v-else-if="!activeBoms.length && archivedBoms.length && !showArchived"
        class="text-sm text-(--ui-text-muted) py-8 text-center"
      >
        All BOMs are archived. Click "Show Archived" to view them.
      </div>

      <!-- Archived BOMs section -->
      <div
        v-if="showArchived && archivedBoms.length"
        class="space-y-2"
      >
        <h2 class="text-sm font-medium text-(--ui-text-muted) flex items-center gap-1.5 pt-2">
          <UIcon
            name="i-lucide-archive"
            class="size-3.5"
          />
          Archived ({{ archivedBoms.length }})
        </h2>
        <div
          v-for="b in archivedBoms"
          :key="b.id"
          class="border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/30 opacity-70"
        >
          <div class="w-full flex items-center justify-between px-3 py-2">
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium text-(--ui-text-muted)">
                {{ b.name }}
              </div>
              <div class="text-xs text-(--ui-text-dimmed) mt-0.5">
                {{ b.entries.length }} job{{ b.entries.length !== 1 ? 's' : '' }} · Archived
              </div>
            </div>
            <UButton
              v-if="isAdmin"
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-archive-restore"
              label="Restore"
              :loading="archiving"
              @click="handleUnarchive(b)"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
