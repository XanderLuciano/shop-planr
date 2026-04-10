<script setup lang="ts">
export interface Tab {
  label: string
  value: string
  icon?: string
}

const props = defineProps<{
  tabs: Tab[]
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const scrollEl = ref<HTMLElement | null>(null)
const fade = ref<'right' | 'left' | 'both' | 'none'>('none')

function updateFade() {
  const el = scrollEl.value
  if (!el) return
  const { scrollLeft, scrollWidth, clientWidth } = el
  const atStart = scrollLeft <= 1
  const atEnd = scrollLeft + clientWidth >= scrollWidth - 1
  if (atStart && atEnd) fade.value = 'none'
  else if (atStart) fade.value = 'right'
  else if (atEnd) fade.value = 'left'
  else fade.value = 'both'
}

onMounted(() => nextTick(updateFade))
</script>

<template>
  <div
    class="relative border-b border-(--ui-border)"
    :class="{
      'tab-fade-right': fade === 'right',
      'tab-fade-left': fade === 'left',
      'tab-fade-both': fade === 'both',
    }"
  >
    <div
      ref="scrollEl"
      class="flex gap-1 overflow-x-auto overflow-y-hidden scrollbar-none"
      @scroll="updateFade"
    >
      <button
        v-for="tab in props.tabs"
        :key="tab.value"
        class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0"
        :class="props.modelValue === tab.value
          ? 'border-(--ui-color-primary-500) text-(--ui-text-highlighted)'
          : 'border-transparent text-(--ui-text-muted) hover:text-(--ui-text-highlighted)'"
        @click="emit('update:modelValue', tab.value)"
      >
        <UIcon
          v-if="tab.icon"
          :name="tab.icon"
          class="size-3.5"
        />
        {{ tab.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}

.tab-fade-right {
  mask-image: linear-gradient(to right, black 85%, transparent 100%);
  -webkit-mask-image: linear-gradient(to right, black 85%, transparent 100%);
}
.tab-fade-left {
  mask-image: linear-gradient(to left, black 85%, transparent 100%);
  -webkit-mask-image: linear-gradient(to left, black 85%, transparent 100%);
}
.tab-fade-both {
  mask-image: linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%);
  -webkit-mask-image: linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%);
}
</style>
