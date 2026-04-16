/**
 * Shared tag constants — single source of truth for API boundary validation
 * (`tagSchemas.ts`), service-layer business rules (`tagService.ts`), and
 * anywhere else that needs to agree on tag shape.
 */

/** Maximum tag name length, counted after trimming surrounding whitespace. */
export const TAG_NAME_MAX = 30

/** Maximum number of tags that can be assigned to a single job in one request. */
export const JOB_TAGS_MAX = 50

/** Case-insensitive 6-digit hex color regex. Matches e.g. `#8b5cf6` or `#FFF000`. */
export const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/

/** Default tag color when the caller doesn't specify one. Also set as the DB default. */
export const DEFAULT_TAG_COLOR = '#8b5cf6'
