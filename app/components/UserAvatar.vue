<script setup lang="ts">
const props = withDefaults(defineProps<{
  username: string
  displayName: string
  size?: 'sm' | 'md' | 'lg'
}>(), {
  size: 'md',
})

const sizeClasses: Record<string, string> = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-12 h-12 text-base',
  lg: 'w-16 h-16 text-lg',
}

const backgroundColor = computed(() => getAvatarColor(props.username))
const initials = computed(() => getInitials(props.displayName))
</script>

<template>
  <div
    class="flex items-center justify-center rounded-full font-bold text-white shrink-0"
    :class="sizeClasses[size]"
    :style="{ backgroundColor }"
  >
    {{ initials }}
  </div>
</template>
