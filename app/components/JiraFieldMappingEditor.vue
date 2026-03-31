<script setup lang="ts">
import type { JiraFieldMapping } from '~/types/domain'

const props = defineProps<{
  mappings: JiraFieldMapping[]
}>()

const emit = defineEmits<{
  save: [mappings: JiraFieldMapping[]]
}>()

const rows = ref<JiraFieldMapping[]>([])

watch(() => props.mappings, (m) => {
  rows.value = m.map(r => ({ ...r }))
}, { immediate: true, deep: true })

let nextId = 100

function addRow() {
  rows.value.push({
    id: `fm_new_${nextId++}`,
    jiraFieldId: '',
    label: '',
    shopErpField: '',
    isDefault: false
  })
}

function removeRow(index: number) {
  rows.value.splice(index, 1)
}

function onSave() {
  const valid = rows.value.filter(r => r.jiraFieldId.trim() && r.label.trim() && r.shopErpField.trim())
  emit('save', valid)
}
</script>

<template>
  <div class="space-y-3">
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr class="text-left text-(--ui-text-muted) border-b border-(--ui-border)">
            <th class="py-1.5 pr-2 font-medium">
              Jira Field ID
            </th>
            <th class="py-1.5 pr-2 font-medium">
              Label
            </th>
            <th class="py-1.5 pr-2 font-medium">
              SHOP_ERP Field
            </th>
            <th class="py-1.5 pr-2 font-medium w-16">
              Default
            </th>
            <th class="py-1.5 w-8" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, i) in rows"
            :key="row.id"
            class="border-b border-(--ui-border)/50"
          >
            <td class="py-1 pr-2">
              <UInput
                v-model="row.jiraFieldId"
                size="xs"
                placeholder="customfield_10908"
                class="min-w-32"
              />
            </td>
            <td class="py-1 pr-2">
              <UInput
                v-model="row.label"
                size="xs"
                placeholder="Part Number / Rev"
                class="min-w-28"
              />
            </td>
            <td class="py-1 pr-2">
              <UInput
                v-model="row.shopErpField"
                size="xs"
                placeholder="partNumber"
                class="min-w-28"
              />
            </td>
            <td class="py-1 pr-2">
              <UBadge
                v-if="row.isDefault"
                size="xs"
                variant="subtle"
                color="primary"
              >
                default
              </UBadge>
            </td>
            <td class="py-1">
              <UButton
                icon="i-lucide-x"
                size="xs"
                variant="ghost"
                color="error"
                @click="removeRow(i)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="!rows.length"
      class="text-xs text-(--ui-text-muted) py-4 text-center"
    >
      No field mappings. Add one to map Jira fields to SHOP_ERP.
    </div>

    <div class="flex items-center justify-between">
      <UButton
        icon="i-lucide-plus"
        size="xs"
        variant="ghost"
        label="Add Mapping"
        @click="addRow"
      />
      <UButton
        size="xs"
        label="Save Mappings"
        @click="onSave"
      />
    </div>
  </div>
</template>
