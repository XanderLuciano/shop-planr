#!/usr/bin/env npx tsx
/**
 * Shop Planr MCP Server
 *
 * A Model Context Protocol server that wraps the Shop Planr HTTP API,
 * allowing AI agents to query and create jobs, paths, parts, and users.
 *
 * Usage:
 *   npx tsx mcp-server/index.ts
 *
 * Expects the Nuxt dev server running at BASE_URL (default: http://localhost:3000).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const BASE_URL = process.env.SHOP_PLANR_URL || 'http://localhost:3000'

// ---- HTTP helpers ----

async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GET ${path} failed (${res.status}): ${text}`)
  }
  return res.json() as Promise<T>
}

async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`POST ${path} failed (${res.status}): ${text}`)
  }
  return res.json() as Promise<T>
}

async function apiPut<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PUT ${path} failed (${res.status}): ${text}`)
  }
  return res.json() as Promise<T>
}

async function apiDelete<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`DELETE ${path} failed (${res.status}): ${text}`)
  }
  return res.json() as Promise<T>
}

async function apiPatch<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PATCH ${path} failed (${res.status}): ${text}`)
  }
  return res.json() as Promise<T>
}

function textResult(data: unknown): { content: { type: 'text' as const; text: string }[] } {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

// ---- Server setup ----

const server = new McpServer({
  name: 'shop-planr',
  version: '1.0.0',
})

// ============================================================
// JOBS
// ============================================================

server.tool(
  'list_jobs',
  'List all production jobs with their basic info (id, name, goalQuantity, priority, timestamps)',
  {},
  async () => textResult(await apiGet('/api/jobs')),
)

server.tool(
  'get_job',
  'Get a single job by ID, including its paths, steps, and progress summary',
  { jobId: z.string().describe('The job ID (e.g. job_abc123)') },
  async ({ jobId }) => textResult(await apiGet(`/api/jobs/${jobId}`)),
)

server.tool(
  'create_job',
  'Create a new production job',
  {
    name: z.string().describe('Job name'),
    goalQuantity: z.number().int().positive().describe('Target quantity to produce'),
  },
  async (args) => textResult(await apiPost('/api/jobs', args)),
)

server.tool(
  'update_job',
  'Update an existing job (name and/or goalQuantity)',
  {
    jobId: z.string().describe('The job ID to update'),
    name: z.string().optional().describe('New job name'),
    goalQuantity: z.number().int().positive().optional().describe('New goal quantity'),
  },
  async ({ jobId, ...body }) => textResult(await apiPut(`/api/jobs/${jobId}`, body)),
)

server.tool(
  'delete_job',
  'Delete a job (only if it has no paths, parts, or BOM references)',
  {
    jobId: z.string().describe('The job ID to delete'),
  },
  async ({ jobId }) => textResult(await apiDelete(`/api/jobs/${jobId}`)),
)

// ============================================================
// PATHS (routes with process steps)
// ============================================================

server.tool(
  'get_path',
  'Get a path by ID, including its steps, step distribution, and completed count',
  { pathId: z.string().describe('The path ID') },
  async ({ pathId }) => textResult(await apiGet(`/api/paths/${pathId}`)),
)

server.tool(
  'create_path',
  'Create a new path (route) for a job with ordered process steps',
  {
    jobId: z.string().describe('The job this path belongs to'),
    name: z.string().describe('Path name (e.g. "Main Route", "Rework Route")'),
    goalQuantity: z.number().int().positive().describe('How many parts to route through this path'),
    advancementMode: z.enum(['strict', 'flexible', 'per_step']).optional()
      .describe('How parts advance: strict (sequential only), flexible (skip allowed), per_step (configured per step). Default: strict'),
    steps: z.array(z.object({
      name: z.string().describe('Step name (e.g. "CNC Machining", "Inspection")'),
      location: z.string().optional().describe('Physical location (e.g. "Bay 3")'),
      optional: z.boolean().optional().describe('Whether this step can be skipped'),
      dependencyType: z.enum(['physical', 'preferred', 'completion_gate']).optional()
        .describe('Dependency type. Default: physical'),
    })).describe('Ordered list of process steps'),
  },
  async (args) => textResult(await apiPost('/api/paths', args)),
)

server.tool(
  'update_path',
  'Update a path (name, goalQuantity, advancementMode, and/or steps)',
  {
    pathId: z.string().describe('The path ID to update'),
    name: z.string().optional().describe('New path name'),
    goalQuantity: z.number().int().positive().optional().describe('New goal quantity'),
    advancementMode: z.enum(['strict', 'flexible', 'per_step']).optional().describe('New advancement mode'),
    steps: z.array(z.object({
      id: z.string().optional().describe('Existing step ID to preserve (omit for new steps)'),
      name: z.string().describe('Step name'),
      location: z.string().optional(),
      optional: z.boolean().optional(),
      dependencyType: z.enum(['physical', 'preferred', 'completion_gate']).optional(),
    })).optional().describe('Updated step list (order matters)'),
  },
  async ({ pathId, ...body }) => textResult(await apiPut(`/api/paths/${pathId}`, body)),
)

server.tool(
  'delete_path',
  'Delete a path and cascade-delete all its parts and dependent records (admin only)',
  {
    pathId: z.string().describe('The path ID to delete'),
    userId: z.string().describe('Admin user ID performing the deletion'),
  },
  async ({ pathId, userId }) => textResult(await apiDelete(`/api/paths/${pathId}`, { userId })),
)

// ============================================================
// PARTS (serial numbers)
// ============================================================

server.tool(
  'list_parts',
  'List all parts across all jobs with enriched info (job name, path name, current step, status)',
  {},
  async () => textResult(await apiGet('/api/parts')),
)

server.tool(
  'get_part',
  'Get a single part by ID with full detail',
  { partId: z.string().describe('The part ID') },
  async ({ partId }) => textResult(await apiGet(`/api/parts/${partId}`)),
)

server.tool(
  'create_parts',
  'Batch-create parts (serial numbers) for a job/path combination',
  {
    jobId: z.string().describe('The job ID'),
    pathId: z.string().describe('The path ID'),
    quantity: z.number().int().positive().describe('Number of parts to create'),
    userId: z.string().describe('User ID performing the creation'),
    certId: z.string().optional().describe('Optional certificate ID to auto-attach'),
  },
  async (args) => textResult(await apiPost('/api/parts', args)),
)

server.tool(
  'advance_part',
  'Advance a part to its next process step',
  {
    partId: z.string().describe('The part ID to advance'),
    userId: z.string().describe('User ID performing the advancement'),
  },
  async ({ partId, userId }) => textResult(await apiPost(`/api/parts/${partId}/advance`, { userId })),
)

server.tool(
  'get_part_route',
  'Get the full routing info for a part (all steps with statuses)',
  { partId: z.string().describe('The part ID') },
  async ({ partId }) => textResult(await apiGet(`/api/parts/${partId}/full-route`)),
)

server.tool(
  'get_part_step_statuses',
  'Get step-by-step status history for a part',
  { partId: z.string().describe('The part ID') },
  async ({ partId }) => textResult(await apiGet(`/api/parts/${partId}/step-statuses`)),
)

// ============================================================
// USERS
// ============================================================

server.tool(
  'list_users',
  'List all active users (id, username, displayName, isAdmin)',
  {},
  async () => textResult(await apiGet('/api/users')),
)

server.tool(
  'create_user',
  'Create a new user',
  {
    username: z.string().describe('Unique username'),
    displayName: z.string().describe('Display name'),
    isAdmin: z.boolean().optional().describe('Whether user has admin privileges. Default: false'),
  },
  async (args) => textResult(await apiPost('/api/users', args)),
)

server.tool(
  'update_user',
  'Update an existing user',
  {
    userId: z.string().describe('The user ID to update'),
    username: z.string().optional().describe('New username'),
    displayName: z.string().optional().describe('New display name'),
    isAdmin: z.boolean().optional().describe('Admin flag'),
    active: z.boolean().optional().describe('Active flag'),
  },
  async ({ userId, ...body }) => textResult(await apiPut(`/api/users/${userId}`, body)),
)

// ============================================================
// TEMPLATES
// ============================================================

server.tool(
  'list_templates',
  'List all route templates',
  {},
  async () => textResult(await apiGet('/api/templates')),
)

server.tool(
  'get_template',
  'Get a route template by ID',
  { templateId: z.string().describe('The template ID') },
  async ({ templateId }) => textResult(await apiGet(`/api/templates/${templateId}`)),
)

server.tool(
  'create_template',
  'Create a reusable route template with steps',
  {
    name: z.string().describe('Template name'),
    steps: z.array(z.object({
      name: z.string().describe('Step name'),
      location: z.string().optional().describe('Physical location'),
    })).describe('Ordered list of template steps'),
  },
  async (args) => textResult(await apiPost('/api/templates', args)),
)

server.tool(
  'apply_template',
  'Apply a template to create a new path on a job',
  {
    templateId: z.string().describe('The template ID to apply'),
    jobId: z.string().describe('The job to create the path on'),
    goalQuantity: z.number().int().positive().describe('Goal quantity for the new path'),
    pathName: z.string().optional().describe('Custom name for the new path'),
  },
  async ({ templateId, ...body }) => textResult(await apiPost(`/api/templates/${templateId}/apply`, body)),
)

// ============================================================
// CERTIFICATES
// ============================================================

server.tool(
  'list_certs',
  'List all certificates',
  {},
  async () => textResult(await apiGet('/api/certs')),
)

server.tool(
  'create_cert',
  'Create a new certificate (material or process)',
  {
    type: z.enum(['material', 'process']).describe('Certificate type'),
    name: z.string().describe('Certificate name'),
    metadata: z.record(z.unknown()).optional().describe('Optional metadata key-value pairs'),
  },
  async (args) => textResult(await apiPost('/api/certs', args)),
)

server.tool(
  'batch_attach_cert',
  'Attach a certificate to multiple parts at once',
  {
    certId: z.string().describe('The certificate ID'),
    partIds: z.array(z.string()).describe('Array of part IDs to attach the cert to'),
    userId: z.string().describe('User performing the attachment'),
  },
  async (args) => textResult(await apiPost('/api/certs/batch-attach', args)),
)

// ============================================================
// AUDIT
// ============================================================

server.tool(
  'list_audit_entries',
  'List audit trail entries with optional filters',
  {},
  async () => textResult(await apiGet('/api/audit')),
)

server.tool(
  'get_part_audit',
  'Get audit trail entries for a specific part',
  { partId: z.string().describe('The part ID') },
  async ({ partId }) => textResult(await apiGet(`/api/audit/part/${partId}`)),
)

// ============================================================
// OPERATOR / WORK QUEUE
// ============================================================

server.tool(
  'get_work_queue',
  'Get the operator work queue (all active work grouped by step)',
  {},
  async () => textResult(await apiGet('/api/operator/work-queue')),
)

server.tool(
  'get_step_view',
  'Get detailed step view for a specific process step',
  { stepId: z.string().describe('The step ID') },
  async ({ stepId }) => textResult(await apiGet(`/api/operator/step/${stepId}`)),
)

server.tool(
  'get_user_queue',
  'Get work queue items assigned to a specific user',
  { userId: z.string().describe('The user ID') },
  async ({ userId }) => textResult(await apiGet(`/api/operator/queue/${userId}`)),
)

// ============================================================
// NOTES
// ============================================================

server.tool(
  'create_note',
  'Create a process step note/defect',
  {
    jobId: z.string().describe('The job ID'),
    pathId: z.string().describe('The path ID'),
    stepId: z.string().describe('The step ID'),
    partIds: z.array(z.string()).describe('Part IDs this note applies to'),
    text: z.string().describe('Note text'),
    createdBy: z.string().describe('User ID creating the note'),
  },
  async (args) => textResult(await apiPost('/api/notes', args)),
)

server.tool(
  'get_notes_by_step',
  'Get all notes for a specific step',
  { stepId: z.string().describe('The step ID') },
  async ({ stepId }) => textResult(await apiGet(`/api/notes/step/${stepId}`)),
)

server.tool(
  'get_notes_by_part',
  'Get all notes for a specific part',
  { partId: z.string().describe('The part ID') },
  async ({ partId }) => textResult(await apiGet(`/api/notes/part/${partId}`)),
)

// ============================================================
// LIFECYCLE (scrap, force-complete, advance-to)
// ============================================================

server.tool(
  'scrap_part',
  'Scrap a part with a reason',
  {
    partId: z.string().describe('The part ID to scrap'),
    reason: z.enum(['out_of_tolerance', 'process_defect', 'damaged', 'operator_error', 'other'])
      .describe('Scrap reason'),
    explanation: z.string().optional().describe('Required when reason is "other"'),
    userId: z.string().describe('User performing the scrap'),
  },
  async ({ partId, ...body }) => textResult(await apiPost(`/api/parts/${partId}/scrap`, body)),
)

server.tool(
  'force_complete_part',
  'Force-complete a part (skip remaining steps)',
  {
    partId: z.string().describe('The part ID'),
    reason: z.string().optional().describe('Reason for force completion'),
    userId: z.string().describe('User performing the force completion'),
  },
  async ({ partId, ...body }) => textResult(await apiPost(`/api/parts/${partId}/force-complete`, body)),
)

server.tool(
  'advance_part_to_step',
  'Advance a part directly to a specific step (flexible/per_step mode)',
  {
    partId: z.string().describe('The part ID'),
    targetStepId: z.string().describe('The step ID to advance to'),
    userId: z.string().describe('User performing the advancement'),
  },
  async ({ partId, ...body }) => textResult(await apiPost(`/api/parts/${partId}/advance-to`, body)),
)

// ============================================================
// SETTINGS
// ============================================================

server.tool(
  'get_settings',
  'Get application settings (Jira config, page toggles)',
  {},
  async () => textResult(await apiGet('/api/settings')),
)

// ============================================================
// Start server
// ============================================================

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`Shop Planr MCP server running (API: ${BASE_URL})`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
