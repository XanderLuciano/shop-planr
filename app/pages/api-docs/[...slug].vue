<script setup lang="ts">
definePageMeta({ layout: 'docs' })

const route = useRoute()

const { data: page } = await useAsyncData(
  `docs-${route.path}`,
  () => queryCollection('docs').path(route.path).first(),
  { watch: [() => route.path] }
)

if (!page.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Page not found',
    message: 'The documentation page you are looking for does not exist.',
    fatal: true
  })
}

const { data: surround } = await useAsyncData(
  `docs-surround-${route.path}`,
  () => queryCollectionItemSurroundings('docs', route.path, {
    fields: ['title', 'path']
  }),
  { watch: [() => route.path] }
)

const prev = computed(() => surround.value?.[0] ?? null)
const next = computed(() => surround.value?.[1] ?? null)
</script>

<template>
  <article>
    <ContentRenderer v-if="page" :value="page" class="prose prose-violet max-w-none" />

    <!-- Prev / Next navigation -->
    <nav
      v-if="prev || next"
      class="mt-10 flex items-center justify-between gap-4 border-t border-(--ui-border) pt-6"
    >
      <NuxtLink
        v-if="prev"
        :to="prev.path"
        class="group flex items-center gap-2 text-sm text-(--ui-text-muted) hover:text-(--ui-text) transition-colors"
      >
        <UIcon name="i-lucide-arrow-left" class="size-4 shrink-0" />
        <span class="group-hover:underline">{{ prev.title }}</span>
      </NuxtLink>
      <span v-else />

      <NuxtLink
        v-if="next"
        :to="next.path"
        class="group flex items-center gap-2 text-sm text-(--ui-text-muted) hover:text-(--ui-text) transition-colors"
      >
        <span class="group-hover:underline">{{ next.title }}</span>
        <UIcon name="i-lucide-arrow-right" class="size-4 shrink-0" />
      </NuxtLink>
    </nav>
  </article>
</template>
