# Requirements Document

## Introduction

This feature allows admin users to force-delete paths from jobs even when parts (serial numbers) are attached to the path. Currently, path deletion is blocked when parts exist (`Cannot delete path with parts attached`). This is too restrictive for correcting mistakes — an admin should be able to undo an incorrectly created path by deleting it along with all associated data. Parts are physically removed (hard-deleted) from the database along with all dependent records, in correct foreign key order. The audit trail records the deleted part IDs for future reference since the parts themselves are gone. The feature also adds a missing server-side admin authorization check to the delete API route, since the current route has no auth guard at all. Additionally, the parts browser status filter is updated to include the missing "Scrapped" option.

## Glossary

- **Path_Service**: The server-side service (`pathService`) that handles path CRUD and step operations.
- **Path_Delete_API**: The `DELETE /api/paths/:id` API route (`server/api/paths/[id].delete.ts`).
- **PathDeleteButton**: The Vue component (`PathDeleteButton.vue`) shown on the job detail page for deleting a path. Already gated behind `v-if="isAdmin"` on the parent page.
- **Admin_User**: A ShopUser with `isAdmin` set to `true`.
- **Regular_User**: A ShopUser with `isAdmin` set to `false`.
- **Part**: A tracked serial number belonging to a path, with status `in_progress`, `completed`, or `scrapped`.
- **StepNote**: A defect/note record (`step_notes` table) referencing `step_id` and `part_ids` (JSON array). StepNotes reference both part IDs and step IDs that will be deleted during a force-delete, so they must be cascade-deleted.
- **Part_Step_Status**: A routing history record (`part_step_statuses` table) tracking a part's visit to a process step.
- **Cert_Attachment**: A certificate-to-part join record (`cert_attachments` table) linking a certificate to a part at a specific step.
- **Part_Step_Override**: A step override record (`part_step_overrides` table) for a part at a specific step.
- **Audit_Service**: The server-side service (`auditService`) that records append-only audit trail entries.
- **Parts_Browser**: The parts browser page (`app/pages/parts-browser/index.vue`) that lists all parts with search, filter, and sort capabilities.
- **Parts_Browser_Composable**: The composable (`usePartBrowser.ts`) that provides filtering, searching, and sorting logic for the Parts_Browser.
- **useUsers_Composable**: The shared Vue composable (`useUsers.ts`) that exposes the reactive `isAdmin` computed property.

## Requirements

### Requirement 1: Server-Side Admin Authorization for Path Deletion

**User Story:** As a shop manager, I want the path delete API to reject requests from non-admin users, so that only authorized users can delete paths.

#### Acceptance Criteria

1. WHEN a delete request is received, THE Path_Delete_API SHALL identify the requesting user from the request body or query parameters.
2. WHEN the requesting user is not an Admin_User, THE Path_Delete_API SHALL return a 403 Forbidden response.
3. WHEN the requesting user is an Admin_User, THE Path_Delete_API SHALL proceed with the delete operation.
4. WHEN no user identifier is provided in the request, THE Path_Delete_API SHALL return a 400 Bad Request response.

### Requirement 2: Admin Force-Delete Path with Parts (Hard Delete)

**User Story:** As an admin user, I want to delete a path even when it has parts attached, so that I can correct mistakes by physically removing an incorrectly created path and all its associated data from the database.

#### Acceptance Criteria

1. WHEN an Admin_User requests deletion of a path with zero parts, THE Path_Service SHALL delete the path and its process steps (existing behavior).
2. WHEN an Admin_User requests deletion of a path with attached parts, THE Path_Service SHALL physically delete all StepNote records that reference the affected parts or the affected process steps.
3. WHEN an Admin_User requests deletion of a path with attached parts, THE Path_Service SHALL physically delete all Part_Step_Override records for the affected parts.
4. WHEN an Admin_User requests deletion of a path with attached parts, THE Path_Service SHALL physically delete all Cert_Attachment records for the affected parts.
5. WHEN an Admin_User requests deletion of a path with attached parts, THE Path_Service SHALL physically delete all Part_Step_Status records for the affected parts.
6. WHEN an Admin_User requests deletion of a path with attached parts, THE Path_Service SHALL physically delete all Part records belonging to the path.
7. WHEN an Admin_User requests deletion of a path with attached parts, THE Path_Service SHALL delete the path and its process steps after all dependent records have been removed.
8. THE Path_Service SHALL perform all deletions in acceptance criteria 2–7 within a single database transaction to ensure atomicity.
9. WHEN the path does not exist, THE Path_Service SHALL return a NotFoundError.

### Requirement 3: Audit Trail for Admin Path Deletion

**User Story:** As a shop manager, I want admin path deletions to be recorded in the audit trail, so that there is a permanent record of what was deleted and by whom.

#### Acceptance Criteria

1. WHEN an Admin_User deletes a path, THE Audit_Service SHALL record a `path_deleted` audit entry containing the admin user ID, path ID, path name, and job ID.
2. WHEN an Admin_User deletes a path that had parts attached, THE Audit_Service `path_deleted` entry SHALL include metadata containing the count of deleted parts.
3. WHEN an Admin_User deletes a path that had parts attached, THE Audit_Service `path_deleted` entry SHALL include metadata containing the list of deleted part IDs for future reference.

### Requirement 4: Confirmation Dialog for Force-Delete

**User Story:** As an admin user, I want a clear warning before deleting a path that has parts, so that I do not accidentally destroy production data.

#### Acceptance Criteria

1. WHEN an Admin_User clicks the delete button on a path with zero parts, THE PathDeleteButton SHALL display the existing inline confirmation prompt.
2. WHEN an Admin_User clicks the delete button on a path with attached parts, THE PathDeleteButton SHALL display a modal confirmation dialog that warns about the number of parts that will be permanently deleted and states that the action cannot be undone.
3. WHEN the Admin_User confirms the modal dialog, THE PathDeleteButton SHALL proceed with the delete operation.
4. WHEN the Admin_User dismisses or cancels the modal dialog, THE PathDeleteButton SHALL cancel the delete operation.

### Requirement 5: Enable Delete Button for Admins Regardless of Part Count

**User Story:** As an admin user, I want the delete button to be clickable even when parts exist on the path, so that I can initiate the force-delete workflow.

#### Acceptance Criteria

1. WHILE an Admin_User is selected and the path has zero parts, THE PathDeleteButton SHALL display an enabled delete button.
2. WHILE an Admin_User is selected and the path has attached parts, THE PathDeleteButton SHALL display an enabled delete button.
3. WHILE a Regular_User is selected, THE PathDeleteButton SHALL not be rendered (existing behavior via parent `v-if="isAdmin"`).
4. THE PathDeleteButton SHALL display the part count next to the delete button when parts are attached to the path.

### Requirement 6: Parts Browser Scrapped Status Filter

**User Story:** As a user, I want the parts browser status filter to include a "Scrapped" option, so that I can find scrapped parts without scrolling through all results.

#### Acceptance Criteria

1. THE Parts_Browser SHALL include "Scrapped" as a selectable option in the status filter dropdown, in addition to the existing "All Statuses", "In Progress", and "Completed" options.
2. THE Parts_Browser_Composable `PartBrowserFilters.status` type SHALL include `scrapped` as a valid value alongside `in-progress`, `completed`, and `all`.
3. WHEN the "Scrapped" status filter is selected, THE Parts_Browser SHALL display only parts with status `scrapped`.
4. WHEN a part has status `scrapped`, THE Parts_Browser SHALL display a status badge with an `error` color.
