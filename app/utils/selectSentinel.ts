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

/** Returns the value if a real selection was made, or `undefined` if it's the sentinel. */
export function selectedOrUndefined<T extends string>(value: T | SelectNone): T | undefined {
  return value === SELECT_NONE ? undefined : value
}

/**
 * Sentinel value for "Unassigned" in assignment dropdowns.
 *
 * Unlike SELECT_NONE (which is a disabled placeholder), this is a real
 * selectable option meaning "remove the current assignment".
 */
export const SELECT_UNASSIGNED = '__unassigned__' as const
export type SelectUnassigned = typeof SELECT_UNASSIGNED

/** Returns `null` if the value is the unassigned sentinel, otherwise the value. */
export function selectedOrNull<T extends string>(value: T | SelectUnassigned): T | null {
  return value === SELECT_UNASSIGNED ? null : value
}

/**
 * Sentinel value for "All / no filter" in filter dropdowns.
 *
 * Used in filter selects where one option means "show everything"
 * (e.g., "All Jobs", "All Statuses"). Unlike SELECT_NONE (disabled
 * placeholder), this is a selectable option.
 */
export const SELECT_ALL = '__all__' as const
export type SelectAll = typeof SELECT_ALL

/** Returns the value if a real filter was selected, or `undefined` if it's the "all" sentinel. */
export function selectedAllOrUndefined<T extends string>(value: T | SelectAll): T | undefined {
  return value === SELECT_ALL ? undefined : value
}
