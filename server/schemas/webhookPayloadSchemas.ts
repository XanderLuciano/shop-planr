/**
 * Zod schemas for webhook event payloads — one per event type.
 *
 * Single source of truth for:
 *   1. Runtime validation in emitWebhookEvent() (dev safety net)
 *   2. Developer tab payload documentation (auto-rendered from schemas)
 *   3. Test data generators (derive from schemas)
 *   4. Test assertions (validate emitted payloads match the schema)
 *
 * Each schema describes the union of fields that may appear across all
 * call sites for that event type. Fields present only in some call sites
 * (e.g. batch-only or advance-to-only) are marked `.optional()`.
 *
 * Convention: every payload includes `user` (display name of the actor).
 * Single-part operations use `partId` (string); batch operations use
 * `partIds` (string[]). Some events can be emitted from both single and
 * batch routes, so both fields are optional.
 */
import { z } from 'zod'
import type { WebhookEventType } from '../types/domain'

// ---- Per-event-type payload schemas ----

export const partAdvancedPayload = z.object({
  user: z.string().describe('Display name of the user who performed the action'),
  partId: z.string().optional().describe('Serial number ID — present on single-part advance'),
  partIds: z.array(z.string()).optional().describe('Serial number IDs — present on batch advance'),
  advancedCount: z.number().optional().describe('Number of parts successfully advanced (batch only)'),
  failedCount: z.number().optional().describe('Number of parts that failed to advance (batch only)'),
  targetStepId: z.string().optional().describe('ID of the target step (advance-to only, absent on simple next-step advance)'),
  skip: z.boolean().optional().describe('Whether intermediate steps were skipped (advance-to only)'),
  newStatus: z.string().optional().describe('Part status after advancement (single-part only)'),
  pathId: z.string().optional().describe('Route path ID the part belongs to'),
  pathName: z.string().optional().describe('Route path name the part belongs to'),
  jobId: z.string().optional().describe('Parent job ID'),
  jobName: z.string().optional().describe('Parent job name'),
}).describe('Fired when one or more parts are advanced. Simple advance emits partId only; advance-to adds targetStepId and skip; batch variants use partIds.')

export const partCompletedPayload = z.object({
  user: z.string().describe('Display name of the user'),
  partId: z.string().optional().describe('Serial number ID — present on single-part advance'),
  partIds: z.array(z.string()).optional().describe('Serial number IDs — present on batch advance'),
  count: z.number().optional().describe('Number of parts completed (batch only)'),
  targetStepId: z.string().optional().describe('ID of the final step (advance-to only)'),
  skip: z.boolean().optional().describe('Whether intermediate steps were skipped (single-part advance-to only)'),
  newStatus: z.string().optional().describe('"completed" (single-part only)'),
  pathId: z.string().optional().describe('Route path ID the part belongs to'),
  pathName: z.string().optional().describe('Route path name the part belongs to'),
  jobId: z.string().optional().describe('Parent job ID'),
  jobName: z.string().optional().describe('Parent job name'),
}).describe('Fired when one or more parts finish their final process step.')

export const partCreatedPayload = z.object({
  user: z.string().describe('Display name of the user'),
  partIds: z.array(z.string()).describe('New serial number IDs'),
  count: z.number().describe('Number of parts created'),
  jobId: z.string().describe('Parent job ID'),
  jobName: z.string().describe('Parent job name'),
  pathId: z.string().describe('Route path ID'),
  pathName: z.string().describe('Route path name'),
}).describe('Fired when parts are batch-created.')

export const partScrappedPayload = z.object({
  user: z.string().describe('Display name of the user'),
  partId: z.string().describe('Serial number ID'),
  reason: z.string().describe('Scrap reason code (e.g. out_of_tolerance)'),
  explanation: z.string().optional().describe('Optional free-text explanation'),
  pathId: z.string().optional().describe('Route path ID the part belongs to'),
  pathName: z.string().optional().describe('Route path name the part belongs to'),
  jobId: z.string().optional().describe('Parent job ID'),
  jobName: z.string().optional().describe('Parent job name'),
}).describe('Fired when a part is marked as scrap.')

export const partForceCompletedPayload = z.object({
  user: z.string().describe('Display name of the user'),
  partId: z.string().describe('Serial number ID'),
  reason: z.string().optional().describe('Optional reason for force completion'),
  pathId: z.string().optional().describe('Route path ID the part belongs to'),
  pathName: z.string().optional().describe('Route path name the part belongs to'),
  jobId: z.string().optional().describe('Parent job ID'),
  jobName: z.string().optional().describe('Parent job name'),
}).describe('Fired when a part is force-completed with remaining steps incomplete.')

export const partDeletedPayload = z.object({
  user: z.string().describe('Display name of the user'),
  partId: z.string().describe('Deleted serial number ID'),
  pathId: z.string().optional().describe('Route path ID the part belonged to'),
  pathName: z.string().optional().describe('Route path name the part belonged to'),
  jobId: z.string().optional().describe('Parent job ID'),
  jobName: z.string().optional().describe('Parent job name'),
}).describe('Fired when a part is admin-deleted (cascade deletes dependents).')

export const stepSkippedPayload = z.object({
  user: z.string().describe('Display name of the user'),
  partId: z.string().optional().describe('Serial number ID — present on single-part advance'),
  partIds: z.array(z.string()).optional().describe('Serial number IDs — present on batch advance'),
  count: z.number().optional().describe('Number of parts that skipped this step (batch only)'),
  stepId: z.string().describe('Skipped step ID'),
  stepName: z.string().describe('Skipped step name'),
  pathId: z.string().optional().describe('Route path ID the step belongs to'),
  pathName: z.string().optional().describe('Route path name the step belongs to'),
  jobId: z.string().optional().describe('Parent job ID'),
  jobName: z.string().optional().describe('Parent job name'),
}).describe('Fired when a process step is skipped during advancement.')

export const stepDeferredPayload = z.object({
  user: z.string().describe('Display name of the user'),
  partId: z.string().optional().describe('Serial number ID — present on single-part advance'),
  partIds: z.array(z.string()).optional().describe('Serial number IDs — present on batch advance'),
  count: z.number().optional().describe('Number of parts that deferred this step (batch only)'),
  stepId: z.string().describe('Deferred step ID'),
  stepName: z.string().describe('Deferred step name'),
  pathId: z.string().optional().describe('Route path ID the step belongs to'),
  pathName: z.string().optional().describe('Route path name the step belongs to'),
  jobId: z.string().optional().describe('Parent job ID'),
  jobName: z.string().optional().describe('Parent job name'),
}).describe('Fired when a required step is deferred during advancement.')

export const stepWaivedPayload = z.object({
  user: z.string().describe('Display name of the user'),
  partId: z.string().describe('Serial number ID'),
  stepId: z.string().describe('Waived step ID'),
  stepName: z.string().optional().describe('Waived step name'),
  reason: z.string().describe('Waiver justification'),
  pathId: z.string().optional().describe('Route path ID the step belongs to'),
  pathName: z.string().optional().describe('Route path name the step belongs to'),
  jobId: z.string().optional().describe('Parent job ID'),
  jobName: z.string().optional().describe('Parent job name'),
}).describe('Fired when a deferred step is waived by an approver.')

export const deferredStepCompletedPayload = z.object({
  user: z.string().describe('Display name of the user'),
  partId: z.string().describe('Serial number ID'),
  stepId: z.string().describe('Completed step ID'),
  stepName: z.string().optional().describe('Completed step name'),
  pathId: z.string().optional().describe('Route path ID the step belongs to'),
  pathName: z.string().optional().describe('Route path name the step belongs to'),
  jobId: z.string().optional().describe('Parent job ID'),
  jobName: z.string().optional().describe('Parent job name'),
}).describe('Fired when a previously deferred step is completed.')

export const stepOverrideCreatedPayload = z.object({
  user: z.string().describe('Display name of the user'),
  partIds: z.array(z.string()).describe('Affected part IDs'),
  count: z.number().describe('Number of parts'),
  stepId: z.string().describe('Overridden step ID'),
  stepName: z.string().optional().describe('Overridden step name (resolved from first part)'),
  reason: z.string().optional().describe('Reason for the override'),
  pathId: z.string().optional().describe('Route path ID the step belongs to'),
  pathName: z.string().optional().describe('Route path name the step belongs to'),
  jobId: z.string().optional().describe('Parent job ID'),
  jobName: z.string().optional().describe('Parent job name'),
}).describe('Fired when a fast-track step override is created for one or more parts.')

export const stepOverrideReversedPayload = z.object({
  user: z.string().describe('Display name of the user'),
  partId: z.string().describe('Serial number ID'),
  stepId: z.string().describe('Step ID whose override was reversed'),
  stepName: z.string().optional().describe('Step name whose override was reversed'),
  pathId: z.string().optional().describe('Route path ID the step belongs to'),
  pathName: z.string().optional().describe('Route path name the step belongs to'),
  jobId: z.string().optional().describe('Parent job ID'),
  jobName: z.string().optional().describe('Parent job name'),
}).describe('Fired when a step override is reversed (re-enabled).')

export const jobCreatedPayload = z.object({
  user: z.string().describe('Display name of the user'),
  jobId: z.string().describe('New job ID'),
  jobName: z.string().describe('Job name'),
  goalQuantity: z.number().describe('Target quantity'),
}).describe('Fired when a new production job is created.')

export const jobDeletedPayload = z.object({
  user: z.string().describe('Display name of the user'),
  jobId: z.string().describe('Deleted job ID'),
  jobName: z.string().describe('Deleted job name'),
}).describe('Fired when a job is deleted.')

export const pathDeletedPayload = z.object({
  user: z.string().describe('Display name of the user'),
  pathId: z.string().describe('Deleted path ID'),
  pathName: z.string().describe('Deleted path name'),
  jobId: z.string().describe('Parent job ID'),
  deletedPartIds: z.array(z.string()).describe('IDs of parts cascade-deleted with the path'),
}).describe('Fired when a route path is deleted (admin cascade delete).')

export const noteCreatedPayload = z.object({
  user: z.string().describe('Display name of the user'),
  noteId: z.string().describe('Note ID'),
  stepId: z.string().describe('Step the note is attached to'),
  stepName: z.string().optional().describe('Step name'),
  partIds: z.array(z.string()).describe('Affected part IDs'),
  text: z.string().describe('Note content'),
  pathId: z.string().optional().describe('Route path ID the step belongs to'),
  pathName: z.string().optional().describe('Route path name the step belongs to'),
  jobId: z.string().optional().describe('Parent job ID'),
  jobName: z.string().optional().describe('Parent job name'),
}).describe('Fired when a defect note is created on a process step.')

export const certAttachedPayload = z.object({
  user: z.string().describe('Display name of the user'),
  certId: z.string().describe('Certificate ID'),
  certName: z.string().describe('Certificate name'),
  certType: z.string().describe('Certificate type (material or process)'),
  partId: z.string().optional().describe('Part ID — present on single-part attach'),
  partIds: z.array(z.string()).optional().describe('Part IDs — present on batch attach'),
  count: z.number().optional().describe('Number of parts (batch only)'),
  stepId: z.string().describe('Step where the cert was attached'),
  stepName: z.string().optional().describe('Step name where the cert was attached'),
  pathId: z.string().optional().describe('Route path ID the step belongs to'),
  pathName: z.string().optional().describe('Route path name the step belongs to'),
  jobId: z.string().optional().describe('Parent job ID'),
  jobName: z.string().optional().describe('Parent job name'),
}).describe('Fired when a quality certificate is attached to parts.')

// ---- Registry: event type → payload schema ----

/**
 * Maps each webhook event type to its Zod payload schema.
 *
 * Used by:
 *   - emitWebhookEvent() for runtime validation
 *   - Developer tab for auto-generated payload docs
 *   - Tests for payload shape assertions
 */
export const WEBHOOK_PAYLOAD_SCHEMAS: Record<WebhookEventType, z.ZodObject<z.ZodRawShape>> = {
  part_advanced: partAdvancedPayload,
  part_completed: partCompletedPayload,
  part_created: partCreatedPayload,
  part_scrapped: partScrappedPayload,
  part_force_completed: partForceCompletedPayload,
  part_deleted: partDeletedPayload,
  step_skipped: stepSkippedPayload,
  step_deferred: stepDeferredPayload,
  step_waived: stepWaivedPayload,
  deferred_step_completed: deferredStepCompletedPayload,
  step_override_created: stepOverrideCreatedPayload,
  step_override_reversed: stepOverrideReversedPayload,
  job_created: jobCreatedPayload,
  job_deleted: jobDeletedPayload,
  path_deleted: pathDeletedPayload,
  note_created: noteCreatedPayload,
  cert_attached: certAttachedPayload,
}

// ---- Compile-time type map ----

/**
 * Maps each webhook event type to the inferred TypeScript type of its
 * Zod payload schema. Used by `emitWebhookEvent` to provide compile-time
 * type checking at every call site.
 */
export interface WebhookPayloadMap {
  part_advanced: z.infer<typeof partAdvancedPayload>
  part_completed: z.infer<typeof partCompletedPayload>
  part_created: z.infer<typeof partCreatedPayload>
  part_scrapped: z.infer<typeof partScrappedPayload>
  part_force_completed: z.infer<typeof partForceCompletedPayload>
  part_deleted: z.infer<typeof partDeletedPayload>
  step_skipped: z.infer<typeof stepSkippedPayload>
  step_deferred: z.infer<typeof stepDeferredPayload>
  step_waived: z.infer<typeof stepWaivedPayload>
  deferred_step_completed: z.infer<typeof deferredStepCompletedPayload>
  step_override_created: z.infer<typeof stepOverrideCreatedPayload>
  step_override_reversed: z.infer<typeof stepOverrideReversedPayload>
  job_created: z.infer<typeof jobCreatedPayload>
  job_deleted: z.infer<typeof jobDeletedPayload>
  path_deleted: z.infer<typeof pathDeletedPayload>
  note_created: z.infer<typeof noteCreatedPayload>
  cert_attached: z.infer<typeof certAttachedPayload>
}

/**
 * Extract field documentation from a Zod object schema.
 *
 * Uses Zod's internal `_zod.def` structure to read field types and
 * optionality without `instanceof` checks (which break under Nuxt's
 * bundled Zod re-exports). Falls back to 'unknown' for unrecognized types.
 */
export function extractPayloadFields(schema: z.ZodObject<z.ZodRawShape>): {
  name: string
  type: string
  description: string
  required: boolean
}[] {
  const shape = schema.shape
  return Object.entries(shape).map(([name, field]) => {
    // Cast through any to access isOptional/description across Zod re-export boundaries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = field as any
    const isOpt = typeof f.isOptional === 'function' ? f.isOptional() : false
    const desc = f.description ?? ''
    const typeName = resolveTypeName(field as z.ZodTypeAny)
    return { name, type: isOpt ? `${typeName}?` : typeName, description: desc, required: !isOpt }
  })
}

/**
 * Resolve a human-readable type name from a Zod schema using the
 * internal `_zod.def.type` discriminator. Avoids `instanceof` which
 * breaks across Zod re-export boundaries in Nuxt's build.
 */
function resolveTypeName(schema: z.ZodTypeAny): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (schema as any)?._zod?.def
  if (!def) return 'unknown'

  switch (def.type) {
    case 'optional':
      return resolveTypeName(def.innerType)
    case 'nullable':
      return resolveTypeName(def.innerType)
    case 'array':
      return `${resolveTypeName(def.element)}[]`
    case 'string':
      return 'string'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'enum':
      return 'string'
    case 'record':
      return 'object'
    case 'object':
      return 'object'
    default:
      return 'unknown'
  }
}
