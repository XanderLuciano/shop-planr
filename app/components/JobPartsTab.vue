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
const $api = useAuthFetch()
const filterStatus = ref<string>(SELECT_ALL)
const filterPath = ref<string>(SELECT_ALL)
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
    const all = await $api<EnrichedPart[]>('/api/parts')
    parts.value = all.filter(s => s.jobId === props.jobId)
  } catch {
    parts.value = []
  } finally {
    loading.value = false
  }
}

const filteredParts = computed(() => {
  let list = [...parts.value]
  if (filterStatus.value && filterStatus.value !== SELECT_ALL) list = list.filter(s => s.status === filterStatus.value)
  if (filterPath.value && filterPath.value !== SELECT_ALL) list = list.filter(s => s.pathName === filterPath.value)
  if (filterStep.value) list = list.filter(s => s.currentStepName.toLowerCase().includes(filterStep.value.toLowerCase()))

  const col = sortColumn.value
  const dir = sortDirection.value === 'asc' ? 1 : -1
  list.sort((a, b) => {
    const aVal = String(a[col] ?? '')
    const bVal = String(b[col] ?? '')
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

const { execute: handleQuickAdvance, loading: advanceLoading } = useGuardedAction(async (partId: string) => {
  try {
    await $api('/api/parts/advance', { method: 'POST', body: { partIds: [partId] } })
    await loadParts()
  } catch {
    // silent — inline quick-advance intentionally swallows errors
  }
})

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
            { label: 'All', value: SELECT_ALL },
            { label: 'In Progress', value: 'in-progress' },
            { label: 'Completed', value: 'completed' },
            { label: 'Scrapped', value: 'scrapped' },
          ]"
          value-key="value"
          label-key="label"
          size="xs"
          class="w-full md:w-32"
        />
      </div>
      <div>
        <label class="text-xs font-medium text-(--ui-text-muted) block mb-0.5">Path</label>
        <USelect
          v-model="filterPath"
          :items="[{ label: 'All Paths', value: SELECT_ALL }, ...pathNames.map(n => ({ label: n, value: n }))]"
          value-key="value"
          label-key="label"
          size="xs"
          class="w-full md:w-36"
        />
      </div>
      <div>
        <label class="text-xs font-medium text-(--ui-text-muted) block mb-0.5">Step</label>
        <UInput
          v-model="filterStep"
          placeholder="Filter step..."
          size="xs"
          class="w-full md:w-32"
        />
      </div>
      <span class="text-xs text-(--ui-text-muted)">{{ filteredParts.length }} of {{ parts.length }} parts</span>
    </div>

    <!-- Loading -->
    <div
      v-if="loading"
      class="flex items-center gap-2 text-sm text-(--ui-text-muted)"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="animate-spin size-4"
      />
      Loading parts...
    </div>

    <!-- Empty -->
    <div
      v-else-if="!parts.length"
      class="text-sm text-(--ui-text-muted) py-6 text-center"
    >
      No parts created yet.
    </div>

    <!-- Table — desktop -->
    <div
      v-if="!loading && parts.length"
      class="hidden md:block border border-(--ui-border) rounded-md overflow-x-auto"
    >
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-(--ui-bg-elevated)/50 text-xs text-(--ui-text-muted)">
            <th
              class="px-3 py-2 text-left cursor-pointer select-none hover:text-(--ui-text-highlighted)"
              @click="toggleSort('id')"
            >
              Part{{ sortIndicator('id') }}
            </th>
            <th class="px-3 py-2 text-left">
              Path
            </th>
            <th
              class="px-3 py-2 text-left cursor-pointer select-none hover:text-(--ui-text-highlighted)"
              @click="toggleSort('currentStepName')"
            >
              Current Step{{ sortIndicator('currentStepName') }}
            </th>
            <th
              class="px-3 py-2 text-left cursor-pointer select-none hover:text-(--ui-text-highlighted)"
              @click="toggleSort('status')"
            >
              Status{{ sortIndicator('status') }}
            </th>
            <th
              class="px-3 py-2 text-left cursor-pointer select-none hover:text-(--ui-text-highlighted)"
              @click="toggleSort('createdAt')"
            >
              Created{{ sortIndicator('createdAt') }}
            </th>
            <th class="px-3 py-2 text-right">
              Actions
            </th>
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
            <td class="px-3 py-2 text-(--ui-text-muted)">
              {{ s.pathName }}
            </td>
            <td class="px-3 py-2">
              {{ s.currentStepName }}
            </td>
            <td class="px-3 py-2">
              <UBadge
                :color="statusColor(s.status)"
                variant="subtle"
                size="xs"
              >
                {{ statusLabel(s) }}
              </UBadge>
            </td>
            <td class="px-3 py-2 text-(--ui-text-muted)">
              {{ formatDate(s.createdAt) }}
            </td>
            <td
              class="px-3 py-2 text-right"
              @click.stop
            >
              <div
                v-if="s.status === 'in-progress'"
                class="flex items-center gap-1 justify-end"
              >
                <UButton
                  size="xs"
                  variant="ghost"
                  icon="i-lucide-arrow-right"
                  title="Advance"
                  :loading="advanceLoading"
                  @click="handleQuickAdvance(s.id)"
                />
                <UButton
                  size="xs"
                  variant="ghost"
                  color="error"
                  icon="i-lucide-trash-2"
                  title="Scrap"
                  @click="openScrap(s.id)"
                />
              </div>
              <UButton
                v-else
                size="xs"
                variant="ghost"
                icon="i-lucide-eye"
                title="View"
                @click="navigateTo(`/parts-browser/${encodeURIComponent(s.id)}`)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Cards — mobile -->
    <div
      v-if="!loading && parts.length"
      class="md:hidden space-y-2"
    >
      <div
        v-for="(s, idx) in filteredParts"
        :key="s.id"
        class="p-3 rounded-lg border border-(--ui-border) cursor-pointer space-y-1.5"
        :class="s.status === 'scrapped' ? 'opacity-60' : 'hover:bg-(--ui-bg-elevated)/50'"
        role="link"
        tabindex="0"
        @click="navigateTo(`/parts-browser/${encodeURIComponent(s.id)}`)"
        @keydown.enter.prevent="navigateTo(`/parts-browser/${encodeURIComponent(s.id)}`)"
        @keydown.space.prevent="navigateTo(`/parts-browser/${encodeURIComponent(s.id)}`)"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <span
              class="font-mono text-sm font-medium text-(--ui-text-highlighted)"
              :class="s.status === 'scrapped' ? 'line-through' : ''"
            >{{ s.id }}</span>
            <BonusBadge :show="isBonus(idx)" />
          </div>
          <UBadge
            :color="statusColor(s.status)"
            variant="subtle"
            size="xs"
          >
            {{ statusLabel(s) }}
          </UBadge>
        </div>
        <div class="flex items-center justify-between text-xs">
          <span class="text-(--ui-text-muted)">{{ s.pathName }}</span>
          <span>{{ s.currentStepName }}</span>
        </div>
        <div
          v-if="s.status === 'in-progress'"
          class="flex items-center gap-1 pt-0.5"
          @click.stop
        >
          <UButton
            size="xs"
            variant="ghost"
            icon="i-lucide-arrow-right"
            label="Advance"
            :loading="advanceLoading"
            @click="handleQuickAdvance(s.id)"
          />
          <UButton
            size="xs"
            variant="ghost"
            color="error"
            icon="i-lucide-trash-2"
            label="Scrap"
            @click="openScrap(s.id)"
          />
        </div>
      </div>
      <div
        v-if="filteredParts.length === 0"
        class="text-sm text-(--ui-text-muted) py-6 text-center"
      >
        No parts match filters.
      </div>
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
