/**
 * OpenAPI helpers for converting Zod schemas to JSON Schema.
 *
 * Uses Zod 4's native `z.toJSONSchema()` to produce OpenAPI 3.1-compatible
 * JSON Schema objects. These are used in `defineRouteMeta({ openAPI })` calls
 * to document request/response bodies without manual duplication.
 */
import { z } from 'zod'
import type { ZodType } from 'zod'

/**
 * Convert a Zod schema to an OpenAPI 3.1-compatible JSON Schema object.
 *
 * Strips the `$schema` meta-key that Zod emits (OpenAPI specs define their
 * own schema dialect at the top level).
 */
export function zodToJsonSchema(schema: ZodType): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>
  delete jsonSchema.$schema
  return jsonSchema
}

/**
 * Build an OpenAPI `requestBody` object from a Zod schema.
 */
export function zodRequestBody(schema: ZodType, description?: string) {
  return {
    required: true,
    ...(description && { description }),
    content: {
      'application/json': {
        schema: zodToJsonSchema(schema),
      },
    },
  }
}

/**
 * Build an OpenAPI JSON response content block from a plain schema object.
 */
export function jsonResponse(description: string, schema?: Record<string, unknown>) {
  const response: Record<string, unknown> = { description }
  if (schema) {
    response.content = {
      'application/json': { schema },
    }
  }
  return response
}
