/**
 * OpenAPI helpers for converting Zod schemas to JSON Schema.
 *
 * Uses Zod 4's native `z.toJSONSchema()` to produce OpenAPI 3.1-compatible
 * JSON Schema objects. These are used in `defineRouteMeta({ openAPI })` calls
 * to document request/response bodies without manual duplication.
 *
 * Note: Return types use explicit casts because Zod's JSON Schema output is
 * structurally compatible with OpenAPI 3.1 but TypeScript can't verify this
 * against Nitro's internal OpenAPI types (which aren't publicly exported).
 * This is safe — `defineRouteMeta` is a build-time macro that extracts the
 * metadata statically; the types only matter for IDE feedback.
 */
import { z } from 'zod'
import type { ZodType } from 'zod'

/**
 * Convert a Zod schema to an OpenAPI 3.1-compatible JSON Schema object.
 *
 * Strips the `$schema` meta-key that Zod emits (OpenAPI specs define their
 * own schema dialect at the top level).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function zodToJsonSchema(schema: ZodType): any {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>
  delete jsonSchema.$schema
  return jsonSchema
}

/**
 * Build an OpenAPI `requestBody` object from a Zod schema.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function zodRequestBody(schema: ZodType, description?: string): any {
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonResponse(description: string, schema?: any) {
  const response: Record<string, unknown> = { description }
  if (schema) {
    response.content = {
      'application/json': { schema },
    }
  }
  return response
}
