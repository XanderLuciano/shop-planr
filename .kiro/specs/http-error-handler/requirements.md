# Requirements Document

## Introduction

Shop Planr's 52+ API routes all use a duplicated catch block that maps `ValidationError` → 400, `NotFoundError` → 404, and unknown errors → re-throw or 500. The `createError()` call omits `statusMessage`, causing Nuxt/Nitro to default every response to `"Server Error"` regardless of the actual HTTP status code (GitHub Issue #28). This feature introduces a shared error handler utility in `server/utils/` (auto-imported by Nitro) that centralizes error-to-HTTP mapping, provides correct RFC 9110 status messages, and replaces the duplicated catch blocks across all API route files.

## Glossary

- **Error_Handler**: A utility function in `server/utils/` that catches service-layer errors and converts them into properly-formed Nuxt HTTP errors with correct `statusCode`, `statusMessage`, and `message` fields.
- **Status_Message_Map**: A lookup table mapping HTTP status codes to their standard RFC 9110 reason phrases (e.g., 400 → "Bad Request", 404 → "Not Found", 500 → "Internal Server Error").
- **API_Route**: A Nitro server route handler file in `server/api/` that defines an HTTP endpoint.
- **ValidationError**: A custom error class thrown by services when input validation fails (maps to HTTP 400).
- **NotFoundError**: A custom error class thrown by services when a requested resource does not exist (maps to HTTP 404).
- **Service_Error**: Any error thrown by the service layer, including ValidationError, NotFoundError, and unexpected errors.

## Requirements

### Requirement 1: Status Code to Status Message Mapping

**User Story:** As a developer, I want a lookup from HTTP status codes to standard reason phrases, so that every error response includes the correct `statusMessage` per RFC 9110.

#### Acceptance Criteria

1. THE Status_Message_Map SHALL map each HTTP status code to its standard RFC 9110 reason phrase.
2. WHEN a status code is present in the Status_Message_Map, THE Error_Handler SHALL use the corresponding reason phrase as the `statusMessage`.
3. WHEN a status code is not present in the Status_Message_Map, THE Error_Handler SHALL use "Unknown Error" as the `statusMessage`.
4. THE Status_Message_Map SHALL include at minimum the following codes: 400 ("Bad Request"), 401 ("Unauthorized"), 403 ("Forbidden"), 404 ("Not Found"), 409 ("Conflict"), 422 ("Unprocessable Entity"), 500 ("Internal Server Error").

### Requirement 2: Error Classification and HTTP Mapping

**User Story:** As a developer, I want the error handler to automatically map service-layer error types to the correct HTTP status codes, so that I do not need to write instanceof checks in every route.

#### Acceptance Criteria

1. WHEN a ValidationError is caught, THE Error_Handler SHALL produce an HTTP error with `statusCode` 400, `statusMessage` "Bad Request", and `message` set to the ValidationError's message.
2. WHEN a NotFoundError is caught, THE Error_Handler SHALL produce an HTTP error with `statusCode` 404, `statusMessage` "Not Found", and `message` set to the NotFoundError's message.
3. WHEN an unknown error is caught, THE Error_Handler SHALL produce an HTTP error with `statusCode` 500, `statusMessage` "Internal Server Error", and `message` "Internal server error".
4. WHEN an error that is already an H3Error (from `createError`) is caught, THE Error_Handler SHALL re-throw the error unchanged to preserve upstream error details.

### Requirement 3: Error Handler Utility Function

**User Story:** As a developer, I want a single utility function that wraps my route handler logic and handles all error mapping, so that I can remove duplicated catch blocks from every API route.

#### Acceptance Criteria

1. THE Error_Handler SHALL accept a handler function and return a Nitro event handler that wraps the handler in a try/catch with error classification.
2. THE Error_Handler SHALL be exported from `server/utils/` so that Nitro auto-imports the function in all API route files.
3. WHEN the wrapped handler executes without error, THE Error_Handler SHALL return the handler's result unchanged.
4. WHEN the wrapped handler throws a Service_Error, THE Error_Handler SHALL classify and convert the error per Requirement 2.

### Requirement 4: API Route Migration

**User Story:** As a developer, I want all existing API routes to use the shared error handler, so that error responses are consistent and the duplicated catch blocks are eliminated.

#### Acceptance Criteria

1. WHEN an API_Route uses the Error_Handler wrapper, THE API_Route SHALL contain no manual `instanceof ValidationError` or `instanceof NotFoundError` checks.
2. THE Error_Handler SHALL be applied to all API_Route files in `server/api/` that currently contain duplicated error catch blocks.
3. WHEN an API_Route is migrated, THE API_Route SHALL preserve its existing request parsing, service calls, and response logic unchanged.
4. WHEN an API_Route previously used `throw createError({ statusCode: 500, message: 'Internal server error' })` as a fallback, THE Error_Handler SHALL produce the same behavior automatically.

### Requirement 5: Correct HTTP Status Messages in Responses

**User Story:** As an API consumer, I want error responses to include the correct HTTP status message matching the status code, so that I can distinguish error types without parsing the message body.

#### Acceptance Criteria

1. WHEN a 400 error is returned, THE Error_Handler SHALL set `statusMessage` to "Bad Request".
2. WHEN a 404 error is returned, THE Error_Handler SHALL set `statusMessage` to "Not Found".
3. WHEN a 500 error is returned, THE Error_Handler SHALL set `statusMessage` to "Internal Server Error".
4. THE Error_Handler SHALL produce responses where `statusMessage` matches the standard reason phrase for the `statusCode` in all cases covered by the Status_Message_Map.

### Requirement 6: Extensibility for Future Error Types

**User Story:** As a developer, I want the error handler to be easy to extend with new error types and status codes, so that adding new error classes does not require modifying every route.

#### Acceptance Criteria

1. WHEN a new custom error class is added to the codebase, THE Error_Handler SHALL support adding a mapping from the new error class to an HTTP status code in a single location.
2. THE Error_Handler SHALL use a data-driven mapping structure (not hardcoded if/else chains) for error class to status code resolution.

### Requirement 7: Property-Based Test for Status Message Mapping

**User Story:** As a developer, I want property-based tests that verify the status message mapping is correct for all supported codes, so that regressions are caught automatically.

#### Acceptance Criteria

1. FOR ALL status codes in the Status_Message_Map, THE test suite SHALL verify that the Error_Handler produces the correct `statusMessage` for each code.
2. FOR ALL ValidationError messages, THE test suite SHALL verify that the Error_Handler produces `statusCode` 400 and `statusMessage` "Bad Request" with the original message preserved.
3. FOR ALL NotFoundError resource/id pairs, THE test suite SHALL verify that the Error_Handler produces `statusCode` 404 and `statusMessage` "Not Found" with the original message preserved.
4. FOR ALL unknown errors, THE test suite SHALL verify that the Error_Handler produces `statusCode` 500 and `statusMessage` "Internal Server Error" with message "Internal server error".
