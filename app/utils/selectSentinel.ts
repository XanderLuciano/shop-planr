/**
 * Sentinel value for USelect "no selection" state.
 *
 * Reka UI's SelectRoot (used by Nuxt UI's USelect) does not support
 * undefined or null as model values. Use this constant as the default
 * value for any ref bound to a USelect v-model, and include it as a
 * disabled item in the items array so the types align.
 *
 * Auto-imported by Nuxt — no explicit import needed.
 *
 * @example
 * ```ts
 * const selected = ref<MyType | typeof SELECT_NONE>(SELECT_NONE)
 * const items = [
 *   { label: 'Choose...', value: SELECT_NONE, disabled: true },
 *   { label: 'Option A', value: 'a' },
 * ]
 * ```
 */
export const SELECT_NONE = '__none__' as const
export type SelectNone = typeof SELECT_NONE
