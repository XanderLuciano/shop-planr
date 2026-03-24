/**
 * Serialization utilities for SHOP_ERP domain objects.
 *
 * - `serialize(obj)` — converts a domain object to a JSON string
 * - `deserialize(json, type)` — parses JSON and validates structure, returns typed object
 * - `prettyPrint(obj)` — like serialize but with indentation for human readability
 *
 * Both `serialize` and `prettyPrint` produce valid JSON that `deserialize` can round-trip.
 * Malformed input produces descriptive errors identifying the problematic field.
 */

import { ValidationError } from './errors'

// ---- Domain type identifiers for deserialization ----
export type DomainType
  = | 'Job'
    | 'Path'
    | 'ProcessStep'
    | 'SerialNumber'
    | 'Certificate'
    | 'CertAttachment'
    | 'TemplateRoute'
    | 'TemplateStep'
    | 'BOM'
    | 'BomEntry'
    | 'AuditEntry'
    | 'ShopUser'
    | 'StepNote'
    | 'AppSettings'
    | 'JiraConnectionSettings'
    | 'JiraFieldMapping'

/**
 * Serialize a domain object to a compact JSON string.
 */
export function serialize(obj: unknown): string {
  return JSON.stringify(obj)
}

/**
 * Serialize a domain object to a pretty-printed JSON string.
 */
export function prettyPrint(obj: unknown): string {
  return JSON.stringify(obj, null, 2)
}

/**
 * Deserialize a JSON string into a domain object, validating structure.
 * Throws ValidationError with descriptive messages for malformed input.
 */
export function deserialize<T = unknown>(json: string, type: DomainType): T {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new ValidationError(`Deserialization error: invalid JSON — ${(json ?? '').slice(0, 100)}`)
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ValidationError(`Deserialization error: expected an object, got ${Array.isArray(parsed) ? 'array' : typeof parsed}`)
  }

  const obj = parsed as Record<string, unknown>
  const validator = validators[type]
  if (!validator) {
    throw new ValidationError(`Deserialization error: unknown type "${type}"`)
  }

  validator(obj)
  return obj as T
}

// ---- Field validation helpers ----

function requireString(obj: Record<string, unknown>, field: string, typeName: string): void {
  if (typeof obj[field] !== 'string') {
    throw new ValidationError(`Deserialization error: ${typeName}.${field} — expected string, got ${typeof obj[field]}`)
  }
}

function requireNumber(obj: Record<string, unknown>, field: string, typeName: string): void {
  if (typeof obj[field] !== 'number' || !Number.isFinite(obj[field] as number)) {
    throw new ValidationError(`Deserialization error: ${typeName}.${field} — expected number, got ${typeof obj[field]}`)
  }
}

function requireBoolean(obj: Record<string, unknown>, field: string, typeName: string): void {
  if (typeof obj[field] !== 'boolean') {
    throw new ValidationError(`Deserialization error: ${typeName}.${field} — expected boolean, got ${typeof obj[field]}`)
  }
}

function requireArray(obj: Record<string, unknown>, field: string, typeName: string): void {
  if (!Array.isArray(obj[field])) {
    throw new ValidationError(`Deserialization error: ${typeName}.${field} — expected array, got ${typeof obj[field]}`)
  }
}

function optionalString(obj: Record<string, unknown>, field: string, typeName: string): void {
  if (obj[field] !== undefined && obj[field] !== null && typeof obj[field] !== 'string') {
    throw new ValidationError(`Deserialization error: ${typeName}.${field} — expected string or null, got ${typeof obj[field]}`)
  }
}

function optionalNumber(obj: Record<string, unknown>, field: string, typeName: string): void {
  if (obj[field] !== undefined && obj[field] !== null && (typeof obj[field] !== 'number' || !Number.isFinite(obj[field] as number))) {
    throw new ValidationError(`Deserialization error: ${typeName}.${field} — expected number or null, got ${typeof obj[field]}`)
  }
}

function optionalArray(obj: Record<string, unknown>, field: string, typeName: string): void {
  if (obj[field] !== undefined && obj[field] !== null && !Array.isArray(obj[field])) {
    throw new ValidationError(`Deserialization error: ${typeName}.${field} — expected array or null, got ${typeof obj[field]}`)
  }
}

function optionalBoolean(obj: Record<string, unknown>, field: string, typeName: string): void {
  if (obj[field] !== undefined && obj[field] !== null && typeof obj[field] !== 'boolean') {
    throw new ValidationError(`Deserialization error: ${typeName}.${field} — expected boolean or null, got ${typeof obj[field]}`)
  }
}

// ---- Per-type validators ----

const validators: Record<DomainType, (obj: Record<string, unknown>) => void> = {
  Job(obj) {
    requireString(obj, 'id', 'Job')
    requireString(obj, 'name', 'Job')
    requireNumber(obj, 'goalQuantity', 'Job')
    requireString(obj, 'createdAt', 'Job')
    requireString(obj, 'updatedAt', 'Job')
    optionalArray(obj, 'pathIds', 'Job')
    optionalString(obj, 'jiraTicketKey', 'Job')
    optionalString(obj, 'jiraTicketSummary', 'Job')
    optionalString(obj, 'jiraPartNumber', 'Job')
    optionalString(obj, 'jiraPriority', 'Job')
    optionalString(obj, 'jiraEpicLink', 'Job')
    optionalArray(obj, 'jiraLabels', 'Job')
  },

  Path(obj) {
    requireString(obj, 'id', 'Path')
    requireString(obj, 'jobId', 'Path')
    requireString(obj, 'name', 'Path')
    requireNumber(obj, 'goalQuantity', 'Path')
    requireArray(obj, 'steps', 'Path')
    requireString(obj, 'createdAt', 'Path')
    requireString(obj, 'updatedAt', 'Path')
  },

  ProcessStep(obj) {
    requireString(obj, 'id', 'ProcessStep')
    requireString(obj, 'name', 'ProcessStep')
    requireNumber(obj, 'order', 'ProcessStep')
    optionalString(obj, 'location', 'ProcessStep')
  },

  SerialNumber(obj) {
    requireString(obj, 'id', 'SerialNumber')
    requireString(obj, 'jobId', 'SerialNumber')
    requireString(obj, 'pathId', 'SerialNumber')
    requireNumber(obj, 'currentStepIndex', 'SerialNumber')
    requireString(obj, 'createdAt', 'SerialNumber')
    requireString(obj, 'updatedAt', 'SerialNumber')
    optionalArray(obj, 'certIds', 'SerialNumber')
  },

  Certificate(obj) {
    requireString(obj, 'id', 'Certificate')
    requireString(obj, 'type', 'Certificate')
    const certType = obj.type as string
    if (certType !== 'material' && certType !== 'process') {
      throw new ValidationError('Deserialization error: Certificate.type — must be "material" or "process"')
    }
    requireString(obj, 'name', 'Certificate')
    requireString(obj, 'createdAt', 'Certificate')
  },

  CertAttachment(obj) {
    requireString(obj, 'certId', 'CertAttachment')
    requireString(obj, 'stepId', 'CertAttachment')
    requireString(obj, 'attachedAt', 'CertAttachment')
    requireString(obj, 'attachedBy', 'CertAttachment')
  },

  TemplateRoute(obj) {
    requireString(obj, 'id', 'TemplateRoute')
    requireString(obj, 'name', 'TemplateRoute')
    requireArray(obj, 'steps', 'TemplateRoute')
    requireString(obj, 'createdAt', 'TemplateRoute')
    requireString(obj, 'updatedAt', 'TemplateRoute')
  },

  TemplateStep(obj) {
    requireString(obj, 'name', 'TemplateStep')
    requireNumber(obj, 'order', 'TemplateStep')
    optionalString(obj, 'location', 'TemplateStep')
  },

  BOM(obj) {
    requireString(obj, 'id', 'BOM')
    requireString(obj, 'name', 'BOM')
    requireArray(obj, 'entries', 'BOM')
    requireString(obj, 'createdAt', 'BOM')
    requireString(obj, 'updatedAt', 'BOM')
  },

  BomEntry(obj) {
    requireString(obj, 'partType', 'BomEntry')
    requireNumber(obj, 'requiredQuantityPerBuild', 'BomEntry')
    requireArray(obj, 'contributingJobIds', 'BomEntry')
  },

  AuditEntry(obj) {
    requireString(obj, 'id', 'AuditEntry')
    requireString(obj, 'action', 'AuditEntry')
    requireString(obj, 'userId', 'AuditEntry')
    requireString(obj, 'timestamp', 'AuditEntry')
    optionalString(obj, 'serialId', 'AuditEntry')
    optionalString(obj, 'certId', 'AuditEntry')
    optionalString(obj, 'jobId', 'AuditEntry')
    optionalString(obj, 'pathId', 'AuditEntry')
    optionalString(obj, 'stepId', 'AuditEntry')
    optionalString(obj, 'fromStepId', 'AuditEntry')
    optionalString(obj, 'toStepId', 'AuditEntry')
    optionalNumber(obj, 'batchQuantity', 'AuditEntry')
  },

  ShopUser(obj) {
    requireString(obj, 'id', 'ShopUser')
    requireString(obj, 'name', 'ShopUser')
    requireBoolean(obj, 'active', 'ShopUser')
    requireString(obj, 'createdAt', 'ShopUser')
    optionalString(obj, 'department', 'ShopUser')
  },

  StepNote(obj) {
    requireString(obj, 'id', 'StepNote')
    requireString(obj, 'jobId', 'StepNote')
    requireString(obj, 'pathId', 'StepNote')
    requireString(obj, 'stepId', 'StepNote')
    requireArray(obj, 'serialIds', 'StepNote')
    requireString(obj, 'text', 'StepNote')
    requireString(obj, 'createdBy', 'StepNote')
    requireString(obj, 'createdAt', 'StepNote')
    requireBoolean(obj, 'pushedToJira', 'StepNote')
    optionalString(obj, 'jiraCommentId', 'StepNote')
  },

  AppSettings(obj) {
    requireString(obj, 'id', 'AppSettings')
    if (typeof obj.jiraConnection !== 'object' || obj.jiraConnection === null) {
      throw new ValidationError('Deserialization error: AppSettings.jiraConnection — expected object')
    }
    requireArray(obj, 'jiraFieldMappings', 'AppSettings')
    requireString(obj, 'updatedAt', 'AppSettings')
  },

  JiraConnectionSettings(obj) {
    requireString(obj, 'baseUrl', 'JiraConnectionSettings')
    requireString(obj, 'projectKey', 'JiraConnectionSettings')
    requireString(obj, 'username', 'JiraConnectionSettings')
    requireString(obj, 'apiToken', 'JiraConnectionSettings')
    requireBoolean(obj, 'enabled', 'JiraConnectionSettings')
    requireBoolean(obj, 'pushEnabled', 'JiraConnectionSettings')
  },

  JiraFieldMapping(obj) {
    requireString(obj, 'id', 'JiraFieldMapping')
    requireString(obj, 'jiraFieldId', 'JiraFieldMapping')
    requireString(obj, 'label', 'JiraFieldMapping')
    requireString(obj, 'shopErpField', 'JiraFieldMapping')
    requireBoolean(obj, 'isDefault', 'JiraFieldMapping')
  }
}
