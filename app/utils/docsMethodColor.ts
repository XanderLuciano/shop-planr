/**
 * Maps an HTTP method string to Tailwind CSS color classes for badge styling.
 *
 * Returns an object with `bg` and `text` classes for light/dark mode.
 * Unknown methods fall back to neutral gray.
 */
export interface MethodColorClasses {
  bg: string
  text: string
}

const METHOD_COLORS: Record<string, MethodColorClasses> = {
  GET: { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300' },
  POST: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300' },
  PUT: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300' },
  DELETE: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300' },
  PATCH: {
    bg: 'bg-purple-100 dark:bg-purple-900/40',
    text: 'text-purple-700 dark:text-purple-300',
  },
}

export function getMethodColor(method: string): MethodColorClasses {
  return (
    METHOD_COLORS[method.toUpperCase()] ?? {
      bg: 'bg-gray-100 dark:bg-gray-800',
      text: 'text-gray-700 dark:text-gray-300',
    }
  )
}
