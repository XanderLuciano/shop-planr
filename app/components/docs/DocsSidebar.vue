<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'
import { getMethodColor } from '~/utils/docsMethodColor'

const props = defineProps<{
  navigation: ContentNavigationItem[]
  currentPath: string
}>()

/** Sort items by their `order` field (falls back to 999 for missing values). */
function sortByOrder(items: ContentNavigationItem[]): ContentNavigationItem[] {
  return [...items].sort((a, b) => ((a as any).order ?? 999) - ((b as any).order ?? 999))
}

/** Sorted top-level categories. */
const sortedNavigation = computed(() => sortByOrder(props.navigation))

/** Track which categories are expanded (keyed by path). */
const expandedCategories = ref<Record<string, boolean>>({})

function isExpanded(path: string): boolean {
  if (expandedCategories.value[path] !== undefined) {
    return expandedCategories.value[path]
  }
  return props.currentPath.startsWith(path)
}

function toggleCategory(path: string) {
  expandedCategories.value[path] = !isExpanded(path)
}

function isActive(path: string): boolean {
  return props.currentPath === path
}

/** Check if current path is within this category (for highlighting). */
function isInCategory(path: string): boolean {
  return props.currentPath.startsWith(path)
}

const isEmpty = computed(() => !props.navigation || props.navigation.length === 0)
</script>

<template>
  <nav class="w-64 shrink-0 overflow-y-auto py-4 pl-3 pr-4" aria-label="Documentation sidebar">
    <!-- Empty state -->
    <div v-if="isEmpty" class="flex flex-col items-center gap-2 py-8 text-center">
      <UIcon name="i-lucide-file-question" class="size-8 text-(--ui-text-dimmed)" />
      <p class="text-sm text-(--ui-text-muted)">No documentation available.</p>
    </div>

    <!-- Navigation tree -->
    <ul v-else class="space-y-0.5">
      <li v-for="category in sortedNavigation" :key="category.path">
        <!-- Category header: link + expand toggle -->
        <div
          class="flex items-center rounded-md transition-colors"
          :class="[
            isActive(category.path)
              ? 'bg-(--ui-color-primary-50) dark:bg-(--ui-color-primary-950)/30'
              : isInCategory(category.path)
                ? 'bg-(--ui-bg-elevated)/40'
                : 'hover:bg-(--ui-bg-elevated)/60'
          ]"
        >
          <NuxtLink
            :to="category.path"
            class="flex flex-1 items-center gap-2 px-2 py-1.5 text-sm font-semibold transition-colors min-w-0"
            :class="[
              isActive(category.path)
                ? 'text-(--ui-color-primary-500)'
                : isInCategory(category.path)
                  ? 'text-(--ui-text-highlighted)'
                  : 'text-(--ui-text)'
            ]"
          >
            <UIcon
              v-if="category.icon"
              :name="category.icon"
              class="size-4 shrink-0 text-(--ui-text-muted)"
            />
            <span class="truncate">{{ category.title }}</span>
          </NuxtLink>
          <button
            v-if="category.children?.length"
            class="shrink-0 p-1.5 rounded-md text-(--ui-text-dimmed) hover:text-(--ui-text-muted) hover:bg-(--ui-bg-elevated) transition-colors cursor-pointer"
            aria-label="Toggle section"
            @click.stop="toggleCategory(category.path)"
          >
            <UIcon
              :name="isExpanded(category.path) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
              class="size-3.5"
            />
          </button>
        </div>

        <!-- Children (endpoint pages) -->
        <ul
          v-if="category.children?.length && isExpanded(category.path)"
          class="mt-0.5 ml-3 space-y-0.5 border-l border-(--ui-border) pl-2"
        >
          <li v-for="child in sortByOrder(category.children).filter(c => c.path !== category.path)" :key="child.path">
            <NuxtLink
              :to="child.path"
              class="flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors"
              :class="[
                isActive(child.path)
                  ? 'bg-(--ui-color-primary-50) dark:bg-(--ui-color-primary-950)/30 text-(--ui-color-primary-500) font-medium'
                  : 'text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated)/60'
              ]"
            >
              <!-- HTTP method badge -->
              <span
                v-if="child.method"
                class="inline-flex shrink-0 items-center rounded px-1 py-px text-[10px] font-bold uppercase leading-tight tracking-wide"
                :class="[getMethodColor(child.method as string).bg, getMethodColor(child.method as string).text]"
              >
                {{ child.method }}
              </span>
              <span class="truncate">{{ child.title }}</span>
            </NuxtLink>
          </li>
        </ul>
      </li>
    </ul>
  </nav>
</template>
