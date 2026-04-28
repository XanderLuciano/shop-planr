<script setup lang="ts">
import type { BomSummary } from '~/types/computed'
import type { BOM, Tag } from '~/types/domain'
import type { BomSavePayload } from '~/types/api'
import { extractApiError } from '~/utils/apiError'

const { boms, loading, fetchBoms, createBom, getBomWithSummary, archiveBom, unarchiveBom, fetchArchivedBoms } = useBom()
const { jobs, fetchJobs } = useJobs()
const { editBom } = useBomVersions()
const { tags, fetchTags } = useTags()
const { isAdmin } = useAuth()
const { isMobile } = useMobileBreakpoint()

const showForm = ref(false)
const expandedId = ref<string | null>(null)
const summaries = ref<Record<string, BomSummary>>({})
const summaryLoading = ref<string | null>(null)

// Edit state
const editingBomId = ref<string | null>(null)
const editSaving = ref(false)
const editError = ref('')

// Archive state
const archiveConfirmId = ref<string | null>(null)
const archiving = ref(false)
const archivedBoms = ref<BOM[]>([])
const archivedLoaded = ref(false)
const archivedLoading = ref(false)

// Filter state
type BomStatus = 'active' | 'archived' | 'all'
const statusFilter = ref<BomStatus>('active')
const nameSearch = ref('')

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Archived', value: 'archived' },
  { label: 'All', value: 'all' },
]

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

// Derived filtered list
const filteredBoms = computed(() => {
  let list: readonly BOM[]
  if (statusFilter.value === 'active') list = boms.value
  else if (statusFilter.value === 'archived') list = archivedBoms.value
  else list = [...boms.value, ...archivedBoms.value]

  const q = nameSearch.value.trim().toLowerCase()
  if (q) return list.filter(b => b.name.toLowerCase().includes(q))
  return list
})

const hasActiveFilters = computed(() =>
  statusFilter.value !== 'active' || nameSearch.value.trim().length > 0,
)

async function ensureArchivedLoaded() {
  if (archivedLoaded.value) return
  archivedLoading.value = true
  try {
    archivedBoms.value = await fetchArchivedBoms()
    archivedLoaded.value = true
  } catch {
    // silent
  } finally {
    archivedLoading.value = false
  }
}

async function onStatusChange(value: string) {
  statusFilter.value = value as BomStatus
  if (value === 'archived' || value === 'all') {
    await ensureArchivedLoaded()
  }
}

function clearFilters() {
  statusFilter.value = 'active'
  nameSearch.value = ''
}

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
  try {
    await createBom(payload)
    showForm.value = false
    prefillJobIds.value = []
    prefillName.value = ''
  } catch {
    // error handled by composable
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
    if (archivedLoaded.value) {
      archivedBoms.value = await fetchArchivedBoms()
    }
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
    const archived = await archiveBom(bom.id)
    archiveConfirmId.value = null
    toast.add({ title: `"${bom.name}" archived`, color: 'success' })
    // Move from active to archived list
    await fetchBoms()
    archivedBoms.value = [...archivedBoms.value, archived]
    archivedLoaded.value = true
  } catch (e) {
    toast.add({ title: extractApiError(e, 'Failed to archive BOM'), color: 'error' })
  } finally {
    archiving.value = false
  }
}

async function handleUnarchive(bom: BOM) {
  archiving.value = true
  try {
    await unarchiveBom(bom.id)
    toast.add({ title: `"${bom.name}" restored`, color: 'success' })
    // Move from archived to active list
    archivedBoms.value = archivedBoms.value.filter(b => b.id !== bom.id)
    await fetchBoms()
  } catch (e) {
    toast.add({ title: extractApiError(e, 'Failed to restore BOM'), color: 'error' })
  } finally {
    archiving.value = false
  }
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
    </div>

    <!-- Filter bar -->
    <div class="flex flex-wrap items-center gap-2">
      <UInput
        v-model="nameSearch"
        size="sm"
        placeholder="Search by name"
        icon="i-lucide-search"
        class="w-full sm:w-44"
      >
        <template #trailing>
          <UButton
            v-if="nameSearch"
            icon="i-lucide-x"
            color="neutral"
            variant="link"
            size="xs"
            :padded="false"
            aria-label="Clear search"
            @click="nameSearch = ''"
          />
        </template>
      </UInput>
      <USelect
        :model-value="statusFilter"
        :items="statusOptions"
        size="sm"
        class="w-28"
        @update:model-value="onStatusChange"
      />
      <UButton
        v-if="hasActiveFilters"
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-x"
        label="Clear"
        @click="clearFilters"
      />
      <div
        v-if="archivedLoading"
        class="flex items-center gap-1 text-xs text-(--ui-text-muted)"
      >
        <UIcon
          name="i-lucide-loader-2"
          class="animate-spin size-3"
        />
        Loading archived...
      </div>
      <div class="ml-auto">
        <!-- Desktop: split button -->
        <UFieldGroup
          v-if="!isMobile"
          size="sm"
        >
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
        <!-- Mobile: single dropdown -->
        <UDropdownMenu
          v-else
          :modal="false"
          :items="[
            [{ label: 'New BOM', icon: 'i-lucide-plus', onSelect: () => { showForm = true } }],
            ...(tags.length ? [[{ label: 'From tag', type: 'label' as const, class: 'text-[10px] text-(--ui-text-dimmed) font-normal py-0' }, ...tags.map(t => ({ label: t.name, icon: 'i-lucide-tag', onSelect: () => createFromTag(t) }))]] : []),
          ]"
        >
          <UButton
            icon="i-lucide-plus"
            label="New"
            size="sm"
            color="neutral"
            variant="subtle"
          />
        </UDropdownMenu>
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
      v-else-if="!filteredBoms.length"
      class="text-sm text-(--ui-text-muted) py-8 text-center"
    >
      <template v-if="hasActiveFilters">
        No BOMs match the current filters.
      </template>
      <template v-else>
        No BOMs defined yet. Create a BOM to track sub-assembly requirements.
      </template>
    </div>

    <!-- BOM list -->
    <div
      v-else
      class="space-y-2"
    >
      <div
        v-for="b in filteredBoms"
        :key="b.id"
        class="border border-(--ui-border) rounded-md"
        :class="b.archivedAt ? 'bg-(--ui-bg-elevated)/30 opacity-70' : 'bg-(--ui-bg-elevated)/50'"
      >
        <!-- Header row -->
        <button
          class="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-(--ui-bg-elevated) transition-colors cursor-pointer"
          @click="toggleExpand(b)"
        >
          <div class="min-w-0 flex-1">
            <div
              class="text-sm font-medium"
              :class="b.archivedAt ? 'text-(--ui-text-muted)' : 'text-(--ui-text-highlighted)'"
            >
              {{ b.name }}
            </div>
            <div class="text-xs text-(--ui-text-muted) mt-0.5">
              {{ b.entries.length }} job{{ b.entries.length !== 1 ? 's' : '' }}
              <span
                v-if="b.archivedAt"
                class="text-(--ui-text-dimmed)"
              > · Archived</span>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <template v-if="!b.archivedAt">
              <!-- Desktop: individual buttons -->
              <template v-if="!isMobile">
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
              </template>
              <!-- Mobile: overflow menu -->
              <UDropdownMenu
                v-else
                :modal="false"
                :items="[
                  [
                    { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => { editingBomId = b.id } },
                    { label: 'Version History', icon: 'i-lucide-history', onSelect: () => { toggleVersions(b.id) } },
                    ...(isAdmin ? [{ label: 'Archive', icon: 'i-lucide-archive', onSelect: () => { archiveConfirmId = b.id } }] : []),
                  ],
                ]"
              >
                <UButton
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-ellipsis-vertical"
                  @click.stop
                />
              </UDropdownMenu>
            </template>
            <UButton
              v-if="b.archivedAt && isAdmin"
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-archive-restore"
              :title="isMobile ? undefined : 'Restore'"
              :label="isMobile ? 'Restore' : undefined"
              :loading="archiving"
              @click.stop="handleUnarchive(b)"
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
              Are you sure you want to archive "{{ b.name }}"? It can be restored later by filtering for archived BOMs.
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
          <template v-else-if="summaries[b.id]">
            <!-- Desktop: table -->
            <table
              v-if="!isMobile"
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
            <!-- Mobile: stacked cards -->
            <div
              v-else
              class="space-y-2 mt-2"
            >
              <div
                v-for="entry in summaries[b.id]!.entries"
                :key="entry.jobId"
                class="rounded bg-(--ui-bg-elevated)/50 p-2 space-y-1"
              >
                <NuxtLink
                  :to="`/jobs/${entry.jobId}`"
                  class="text-xs font-medium text-(--ui-primary) hover:underline"
                >
                  {{ entry.jobName }}
                </NuxtLink>
                <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                  <span class="text-(--ui-text-muted)">Required</span>
                  <span class="text-right">{{ entry.requiredQuantity }}</span>
                  <span class="text-(--ui-text-muted)">Completed</span>
                  <span class="text-right text-green-500">{{ entry.totalCompleted }}</span>
                  <span class="text-(--ui-text-muted)">In Progress</span>
                  <span class="text-right text-blue-500">{{ entry.totalInProgress }}</span>
                  <span class="text-(--ui-text-muted)">Outstanding</span>
                  <span
                    class="text-right"
                    :class="entry.totalOutstanding > 0 ? 'text-amber-500' : 'text-(--ui-text-muted)'"
                  >{{ entry.totalOutstanding }}</span>
                </div>
              </div>
            </div>
          </template>
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
