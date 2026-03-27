# Requirements Document

## Introduction

This document captures the requirements for fixing a bug where navigating to a Step View page (`/parts/step/:stepId`) incorrectly redirects to the Dashboard when the "parts" page toggle is disabled. The Step View is a shared detail route used by Jobs, Parts, and Work Queue — it should always be accessible regardless of the "parts" toggle state. The fix introduces an always-enabled route concept in the `isPageEnabled()` function so that step sub-routes bypass the parent `/parts` toggle check.

## Glossary

- **Page_Toggle_System**: The server and client utility (`pageToggles.ts`) that determines whether a route is enabled based on admin-configured visibility settings.
- **isPageEnabled**: The pure function in `pageToggles.ts` that checks a route path against the current page toggles and returns whether navigation should be allowed.
- **ALWAYS_ENABLED_ROUTES**: A new constant array of route prefixes that bypass their parent toggle and are always accessible.
- **ROUTE_TOGGLE_MAP**: The existing mapping from route base paths (e.g., `/parts`) to their corresponding toggle key (e.g., `parts`).
- **pageGuard_Middleware**: The global Nuxt route middleware (`pageGuard.global.ts`) that calls `isPageEnabled()` and redirects to Dashboard if the route is disabled.
- **Step_View**: The page at `/parts/step/:stepId` used for serial advancement and creation, reachable from Jobs, Parts View, and Work Queue.
- **Parts_View**: The page at `/parts` that lists all active parts grouped by job/step.

## Requirements

### Requirement 1: Step View Always Accessible

**User Story:** As a shop floor operator, I want to open a Step View from any entry point (Jobs, Parts, Work Queue) without being redirected to the Dashboard, so that I can advance serials and perform work regardless of page visibility settings.

#### Acceptance Criteria

1. WHEN a user navigates to a Step_View route (`/parts/step/:stepId`), THE isPageEnabled function SHALL return `true` regardless of the current value of the `parts` page toggle.
2. WHEN the `parts` page toggle is set to `false`, THE isPageEnabled function SHALL still return `true` for any route path starting with `/parts/step/`.
3. WHEN the `parts` page toggle is set to `true`, THE isPageEnabled function SHALL return `true` for Step_View routes (no regression from the fix).

### Requirement 2: Parts View Toggle Preserved

**User Story:** As an administrator, I want the Parts View list page to remain gated by the `parts` toggle, so that I can still hide the parts listing from the sidebar and block direct navigation to it.

#### Acceptance Criteria

1. WHEN a user navigates to `/parts`, THE isPageEnabled function SHALL return the value of `pageToggles.parts`.
2. WHEN a user navigates to a `/parts` sub-route that is not in ALWAYS_ENABLED_ROUTES, THE isPageEnabled function SHALL return the value of `pageToggles.parts`.

### Requirement 3: Other Toggle-Mapped Routes Unaffected

**User Story:** As an administrator, I want all other page toggles (jobs, serials, queue, templates, bom, certs, jira, audit) to continue working as before, so that the bug fix does not introduce regressions in page visibility.

#### Acceptance Criteria

1. FOR ALL routes in ROUTE_TOGGLE_MAP other than `/parts/step` sub-routes, THE isPageEnabled function SHALL return the value of the corresponding page toggle key.
2. WHEN a user navigates to a detail route under a toggled-off page (e.g., `/jobs/:id` with `jobs` toggle off), THE isPageEnabled function SHALL return `false`.

### Requirement 4: Always-Enabled Routes Infrastructure

**User Story:** As a developer, I want a clear, maintainable mechanism for marking sub-routes as always-enabled, so that future shared detail routes can be exempted from parent toggles without ad-hoc logic.

#### Acceptance Criteria

1. THE Page_Toggle_System SHALL define an ALWAYS_ENABLED_ROUTES constant containing route prefixes that bypass toggle checks.
2. WHEN evaluating a route path, THE isPageEnabled function SHALL check ALWAYS_ENABLED_ROUTES before checking ROUTE_TOGGLE_MAP prefix matches.
3. WHEN a route path matches an entry in ALWAYS_ENABLED_ROUTES (exact match or starts with entry + `/`), THE isPageEnabled function SHALL return `true` without consulting page toggles.

### Requirement 5: Dashboard and Settings Always Enabled

**User Story:** As a user, I want the Dashboard and Settings pages to always be accessible, so that I am never locked out of core navigation.

#### Acceptance Criteria

1. FOR ALL page toggle configurations, THE isPageEnabled function SHALL return `true` for the route path `/`.
2. FOR ALL page toggle configurations, THE isPageEnabled function SHALL return `true` for the route path `/settings`.

### Requirement 6: Middleware Unchanged

**User Story:** As a developer, I want the fix to be contained entirely within `isPageEnabled()`, so that the global route middleware does not need modification and the change surface is minimal.

#### Acceptance Criteria

1. THE pageGuard_Middleware SHALL continue to call isPageEnabled with the current page toggles and the target route path.
2. WHEN isPageEnabled returns `false`, THE pageGuard_Middleware SHALL redirect the user to the Dashboard (`/`).
3. WHEN isPageEnabled returns `true`, THE pageGuard_Middleware SHALL allow navigation to proceed.
