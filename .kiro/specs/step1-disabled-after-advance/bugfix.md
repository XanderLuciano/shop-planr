# Bugfix Requirements Document

## Introduction

When all serial numbers at the first step (step_order = 0) of a Path are advanced to the next step, the Step View page becomes completely inaccessible. The API endpoint returns a 404 because zero serials remain, and the frontend shows an empty state. Since step 1 is the only step where new serial numbers can be created, the full UI (including the SerialCreationPanel) must remain visible and functional even when the serial count at that step is zero.

Additionally, non-first steps (step_order > 0) that have zero serials currently return a 404, which is unhelpful. These steps are valid parts of an active process — they simply have no work yet because the prior step hasn't advanced any serials. The system should provide context to the user (e.g., how many serials the previous step is working on) rather than treating the step as non-existent. A 404 should only be returned for truly invalid step IDs that don't exist in the database.

GitHub Issue: https://github.com/XanderLuciano/shop-planr/issues/2

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN all serial numbers at the first step (step_order = 0) are advanced to the next step THEN the API endpoint `GET /api/operator/step/[stepId]` throws a 404 error ("No active parts at this step") because it treats zero serials as a not-found condition regardless of step position

1.2 WHEN the API returns a 404 for the first step with zero serials THEN the Step View page (`/parts/step/[stepId]`) displays a "Step not found" or empty state, hiding the SerialCreationPanel and preventing the user from creating new serial numbers

1.3 WHEN the first step has zero serials and the user navigates to the Parts View (`/parts`) THEN the first step is not listed (since the `_all` endpoint skips steps with zero serials), making it unreachable via normal navigation

1.4 WHEN a non-first step (step_order > 0) has zero serials (because the prior step has not yet advanced any work) THEN the API endpoint returns a 404 error instead of providing useful context about the step's status and the prior step's work-in-progress count

1.5 WHEN the Step View page renders for any step THEN the step header information (step name, job name, path name, location) is displayed twice — once in the page-level header and again inside the SerialCreationPanel or ProcessAdvancementPanel component header, creating a redundant and cluttered UI

1.6 WHEN the user is viewing a step THEN there is no way to navigate directly to the previous or next step in the path without going back to the Parts View first

### Expected Behavior (Correct)

2.1 WHEN all serial numbers at the first step (step_order = 0) are advanced to the next step THEN the API endpoint SHALL return a valid response with `partCount: 0` and an empty `serialIds` array, allowing the page to render normally

2.2 WHEN the Step View page loads for the first step with zero serials THEN the system SHALL display the full SerialCreationPanel UI (operator selector, serial creation form, note field) so the user can create new serial numbers

2.3 WHEN the first step has zero serials THEN the Parts View SHALL still include the first step as a navigable entry so the user can reach the Step View to create new serials

2.4 WHEN a non-first step (step_order > 0) has zero serials THEN the API endpoint SHALL return a valid response with `partCount: 0`, an empty `serialIds` array, and information about the previous step's current work-in-progress count (how many serials the prior step has that have not yet been advanced)

2.5 WHEN the Step View page loads for a non-first step with zero serials THEN the system SHALL display a "waiting for prior step" state that shows the previous step's name and its current work-in-progress count, helping the user understand how much work is pending upstream and plan their schedule accordingly

2.6 WHEN the Step View page renders for any step THEN the step header information SHALL be displayed exactly once in the page-level header, and the SerialCreationPanel and ProcessAdvancementPanel components SHALL NOT render their own duplicate headers

2.7 WHEN the Step View page renders for any step THEN the page SHALL display prev/next step navigation buttons that link directly to the adjacent steps in the path, with the previous button disabled on the first step and the next button disabled on the final step

2.8 WHEN the Step View page renders THEN the page header SHALL display a "Step X of Y" indicator showing the current step's position within the path

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a step ID does not correspond to any existing process step in the database THEN the system SHALL CONTINUE TO return a 404 "ProcessStep not found" error

3.2 WHEN the first step has one or more active serials THEN the system SHALL CONTINUE TO display the SerialCreationPanel with the full serial list, selection checkboxes, and advancement controls as it does today

3.3 WHEN serials are advanced from any step THEN the system SHALL CONTINUE TO correctly update serial positions and refresh the step data

3.4 WHEN a non-first step has one or more active serials THEN the system SHALL CONTINUE TO display the normal step view with the serial list and advancement controls as it does today
