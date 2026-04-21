/**
 * Pure helpers for the audit log UI.
 *
 * Extracted into `app/utils/` for auto-import and unit testability.
 * No Vue/Nuxt dependencies — just input-in, output-out.
 */
import type { AuditEntry, AuditAction } from '~/types/domain'

export interface ActionConfig {
  label: string
  color: string
  icon: string
}

const ACTION_CONFIG: Record<AuditAction, ActionConfig> = {
  cert_attached: { label: 'Cert Attached', color: 'text-blue-500', icon: 'i-lucide-paperclip' },
  part_created: { label: 'Part Created', color: 'text-green-500', icon: 'i-lucide-plus-circle' },
  part_advanced: { label: 'Advanced', color: 'text-violet-500', icon: 'i-lucide-arrow-right' },
  part_completed: { label: 'Completed', color: 'text-emerald-500', icon: 'i-lucide-check-circle' },
  note_created: { label: 'Note', color: 'text-amber-500', icon: 'i-lucide-message-square' },
  part_scrapped: { label: 'Scrapped', color: 'text-red-500', icon: 'i-lucide-trash-2' },
  part_force_completed: { label: 'Force Completed', color: 'text-amber-500', icon: 'i-lucide-shield-check' },
  step_override_created: { label: 'Override Created', color: 'text-blue-400', icon: 'i-lucide-shuffle' },
  step_override_reversed: { label: 'Override Reversed', color: 'text-slate-400', icon: 'i-lucide-undo-2' },
  step_skipped: { label: 'Step Skipped', color: 'text-slate-400', icon: 'i-lucide-skip-forward' },
  step_deferred: { label: 'Step Deferred', color: 'text-orange-400', icon: 'i-lucide-clock' },
  deferred_step_completed: { label: 'Deferred Completed', color: 'text-green-400', icon: 'i-lucide-check-circle-2' },
  step_waived: { label: 'Step Waived', color: 'text-purple-400', icon: 'i-lucide-circle-slash' },
  bom_edited: { label: 'BOM Edited', color: 'text-cyan-500', icon: 'i-lucide-table' },
  path_deleted: { label: 'Path Deleted', color: 'text-red-400', icon: 'i-lucide-folder-x' },
  part_deleted: { label: 'Part Deleted', color: 'text-red-500', icon: 'i-lucide-trash' },
  tag_created: { label: 'Tag Created', color: 'text-teal-500', icon: 'i-lucide-tag' },
  tag_updated: { label: 'Tag Updated', color: 'text-teal-400', icon: 'i-lucide-pencil' },
  tag_deleted: { label: 'Tag Deleted', color: 'text-red-400', icon: 'i-lucide-tag' },
}

const FALLBACK_CONFIG: ActionConfig = {
  label: '',
  color: 'text-(--ui-text-muted)',
  icon: 'i-lucide-circle',
}

/** Returns the display config for an audit action, or a neutral fallback using the raw action string. */
export function actionConfigFor(action: AuditAction | string): ActionConfig {
  const config = ACTION_CONFIG[action as AuditAction]
  return config ?? { ...FALLBACK_CONFIG, label: action }
}

/**
 * Formats an ISO timestamp as a short human-readable relative time
 * ("just now", "5m ago", "3h ago", "2d ago") or an absolute date for older entries.
 *
 * Split from `now` so tests can pin the reference time.
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const diffMs = now.getTime() - then.getTime()
  if (diffMs < 60_000) return 'just now'
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return then.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: then.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

/**
 * Truncates long IDs (e.g. `step_TyxbLnVHt9OL`) to a readable form like `step_Tyx…`.
 * IDs shorter than the target length are returned unchanged.
 *
 * Defaults: keep 8 visible chars + ellipsis.
 */
export function truncateId(id: string, visible = 8): string {
  if (id.length <= visible + 1) return id
  return `${id.slice(0, visible)}…`
}

/** `true` when the entry describes a step transition (both from and to are set). */
export function hasTransition(entry: Pick<AuditEntry, 'fromStepId' | 'toStepId'>): boolean {
  return Boolean(entry.fromStepId && entry.toStepId)
}

/**
 * Builds a short details summary string for an entry:
 * - transition: "step_Tyx… → step_Hqw…"
 * - single step: "at step_Tyx…"
 * - job only: "job job_Lh9…"
 * - nothing: empty string
 */
export function buildDetailsSummary(entry: Pick<AuditEntry, 'fromStepId' | 'toStepId' | 'stepId' | 'jobId'>): string {
  if (hasTransition(entry)) {
    return `${truncateId(entry.fromStepId!)} → ${truncateId(entry.toStepId!)}`
  }
  if (entry.stepId) return `at ${truncateId(entry.stepId)}`
  if (entry.jobId) return `job ${truncateId(entry.jobId)}`
  return ''
}
