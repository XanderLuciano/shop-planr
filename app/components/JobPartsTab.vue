<script setup lang="ts">
import type { Path } from '~/types/domain'
import type { EnrichedPart } from '~/types/computed'

const props = defineProps<{
  jobId: string
  paths: Path[]
  goalQuantity: number
}>()

const loading = ref(false)
const parts = ref<EnrichedPart[]>([])

// Filters
const filterStatus = ref('__all__')
const filterPath = ref('__all__')
const filterStep = ref('')

// Sort
const sortColumn = ref<'id' | 'status' | 'currentStepName' | 'createdAt'>('id')
const sortDirection = ref<'asc' | 'desc'>('asc')

// Scrap dialog
const scrapPartId = ref<string | null>(null)
const showScrapDialog = ref(false)

async function loadParts() {
  loading.value = true
  try {
    const all = await $fetch<EnrichedPart[]>('/api/parts')
    parts.value = all.filter(s => s.jobId === props.jobId)
  } catch {
    parts.value = []
  } finally {
    loading.value = false
  }
}

const filteredParts = computed(() => {
  let list = [...parts.value]
  if (filterStatus.value && filterStatus.value !== '__all__') list = list.filter(s => s.status === filterStatus.value)
  if (filterPath.value && filterPath.value !== '__all__') list = list.filter(s => s.pathName === filterPath.value)
  if (filterStep.value) list = list.filter(s => s.currentStepName.toLowerCase().includes(filterStep.value.toLowerCase()))

  const col = sortColumn.value
  const dir = sortDirection.value === 'asc' ? 1 : -1
  list.sort((a, b) => {
    const aVal = String((a as any)[col] ?? '')
    const bVal = String((b as any)[col] ?? '')
    return aVal.localeCompare(bVal) * dir
  })
  return list
})

const pathNames = computed(() => [...new Set(parts.value.map(s => s.pathName))])

function toggleSort(col: typeof sortColumn.value) {
  if (sortColumn.value === col) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortColumn.value = col
    sortDirection.value = 'asc'
  }
}

function sortIndicator(col: string) {
  if (sortColumn.value !== col) return ''
  return sortDirection.value === 'asc' ? ' ↑' : ' ↓'
}

function isBonus(index: number): boolean {
  return index >= props.goalQuantity
}

function statusColor(status: string) {
  if (status === 'completed') return 'success'
  if (status === 'scrapped') return 'error'
  return 'warning'
}

function statusLabel(s: EnrichedPart) {
  if (s.status === 'scrapped') return 'Scrapped'
  if (s.status === 'completed' && s.forceCompleted) return 'Force Completed'
  if (s.status === 'completed') return 'Completed'
  return 'In Progress'
}

function openScrap(partId: string) {
  scrapPartId.value = partId
  showScrapDialog.value = true
}

function onScrapped() {
  loadParts()
}

async function handleQuickAdvance(partId: string) {
  const { operatorId } = useOperatorIdentity()
  if (!operatorId.value) return
  try {
    const { advancePart } = useParts()
    await advancePart(partId, operatorId.value)
    await loadParts()
  } catch {
    // silent
  }
}

onMounted(() => {
  loadParts()
})
</script>

<template>
  <div class="space-y-3">
    <!-- Filters -->
    <div class="flex flex-wrap items-end gap-3">
      <div>
        <label class="text-xs font-medium text-(--ui-text-muted) block mb-0.5">Status</label>
        <USelect
          v-model="filterStatus"
          :items="[
            { label: 'All', value: '__all__' },
            { label: 'In Progress', value: 'in-progress' },
            { label: 'Completed', value: 'completed' },
            { label: 'Scrapped', value: 'scrapped' },
          ]"
          value-key="value"
          label-key="label"
          size="xs"
          class="w-32"
        />
      </div>
      <div>
        <label class="text-xs font-medium text-(--ui-text-muted) block mb-0.5">Path</label>
        <USelect
          v-model="filterPath"
          :items="[{ label: 'All Paths', value: '__all__' }, ...pathNames.map(n => ({ label: n, value: n }))]"
          value-key="value"
          label-key="label"
          size="xs"
          class="w-36"
        />
      </div>
      <div>
        <label class="text-xs font-medium text-(--ui-text-muted) block mb-0.5">Step</label>
        <UInput v-model="filterStep" placeholder="Filter step..." size="xs" class="w-32" />
      </div>
      <span class="text-xs text-(--ui-text-muted)">{{ filteredParts.length }} of {{ parts.length }} parts</span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center gap-2 text-sm text-(--ui-text-muted)">
      <UIcon name="i-lucide-loader-2" class="animate-spin size-4" />
      Loading parts...
    </div>

    <!-- Empty -->
    <div v-else-if="!parts.length" class="text-sm text-(--ui-text-muted) py-6 text-center">
      No parts created yet.
    </div>

    <!-- Table -->
    <div v-else class="border border-(--ui-border) rounded-md overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-(--ui-bg-elevated)/50 text-xs text-(--ui-text-muted)">
            <th class="px-3 py-2 text-left cursor-pointer select-none hover:text-(--ui-text-highlighted)" @click="toggleSort('id')">
              Part{{ sortIndicator('id') }}
            </th>
            <th class="px-3 py-2 text-left">Path</th>
            <th class="px-3 py-2 text-left cursor-pointer select-none hover:text-(--ui-text-highlighted)" @click="toggleSort('currentStepName')">
              Current Step{{ sortIndicator('currentStepName') }}
            </th>
            <th class="px-3 py-2 text-left cursor-pointer select-none hover:text-(--ui-text-highlighted)" @click="toggleSort('status')">
              Status{{ sortIndicator('status') }}
            </th>
            <th class="px-3 py-2 text-left cursor-pointer select-none hover:text-(--ui-text-highlighted)" @click="toggleSort('createdAt')">
              Created{{ sortIndicator('createdAt') }}
            </th>
            <th class="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-(--ui-border)">
          <tr
            v-for="(s, idx) in filteredParts"
            :key="s.id"
            class="hover:bg-(--ui-bg-elevated)/50 cursor-pointer transition-colors"
            :class="s.status === 'scrapped' ? 'opacity-60' : ''"
            @click="navigateTo(`/parts-browser/${encodeURIComponent(s.id)}`)"
          >
            <td class="px-3 py-2 font-mono text-(--ui-text-highlighted) flex items-center gap-1.5">
              <span :class="s.status === 'scrapped' ? 'line-through' : ''">{{ s.id }}</span>
              <BonusBadge :show="isBonus(idx)" />
            </td>
            <td class="px-3 py-2 text-(--ui-text-muted)">{{ s.pathName }}</td>
            <td class="px-3 py-2">{{ s.currentStepName }}</td>
            <td class="px-3 py-2">
              <UBadge :color="statusColor(s.status)" variant="subtle" size="xs">
                {{ statusLabel(s) }}
              </UBadge>
            </td>
            <td class="px-3 py-2 text-(--ui-text-muted)">{{ new Date(s.createdAt).toLocaleDateString() }}</td>
            <td class="px-3 py-2 text-right" @click.stop>
              <div v-if="s.status === 'in-progress'" class="flex items-center gap-1 justify-end">
                <UButton size="xs" variant="ghost" icon="i-lucide-arrow-right" title="Advance" @click="handleQuickAdvance(s.id)" />
                <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" title="Scrap" @click="openScrap(s.id)" />
              </div>
              <UButton v-else size="xs" variant="ghost" icon="i-lucide-eye" title="View" @click="navigateTo(`/parts-browser/${encodeURIComponent(s.id)}`)" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Scrap dialog -->
    <ScrapDialog
      v-if="scrapPartId"
      :part-id="scrapPartId"
      :model-value="showScrapDialog"
      @update:model-value="showScrapDialog = $event"
      @scrapped="onScrapped"
    />
  </div>
</template>
