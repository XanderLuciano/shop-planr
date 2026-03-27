# Requirements Document

## Introduction

This document captures the requirements for fixing the back-arrow navigation bug on the Step View page. Currently, when a user navigates from a Job detail page to a Step View page, the back arrow always directs them to `/parts` (the Parts list) instead of back to the Job detail page they came from. The fix makes back navigation context-aware by passing the referrer route as a query parameter, so the Step View page returns the user to their actual origin.

## Glossary

- **Step_View_Page**: The page at `/parts/step/:stepId` that displays a single process step with advancement or serial creation UI (`app/pages/parts/step/[stepId].vue`)
- **Job_Detail_Page**: The tabbed job view at `/jobs/:id` with routing, serial numbers, and step navigation via StepTracker (`app/pages/jobs/[id].vue`)
- **Parts_View_Page**: The list of all active parts grouped by job/step at `/parts` (`app/pages/parts/index.vue`)
- **Back_Arrow**: The navigation element on the Step_View_Page that returns the user to a previous page
- **From_Query_Parameter**: A URL query parameter (`from`) appended to the Step View URL to indicate the page the user navigated from
- **Resolve_Back_Navigation**: A pure helper function that computes the back-arrow destination and label based on the From_Query_Parameter value
- **StepTracker**: The component on the Job_Detail_Page that displays process steps and allows clicking to navigate to the Step_View_Page

## Requirements

### Requirement 1: Pass Referrer Context on Navigation from Job Detail

**User Story:** As a user viewing a Job detail page, I want the navigation to Step View to include referrer context, so that the Step View page knows where I came from.

#### Acceptance Criteria

1. WHEN a user clicks a step in the StepTracker on the Job_Detail_Page, THE Job_Detail_Page SHALL navigate to the Step_View_Page with a From_Query_Parameter containing the current Job_Detail_Page path (e.g., `/parts/step/:stepId?from=/jobs/:id`)
2. THE Job_Detail_Page SHALL URL-encode the From_Query_Parameter value to ensure safe transmission of the referrer path

### Requirement 2: Context-Aware Back Arrow on Step View

**User Story:** As a user who arrived at the Step View from a Job detail page, I want the back arrow to return me to that Job detail page, so that I can continue reviewing the job without losing my place.

#### Acceptance Criteria

1. WHEN the From_Query_Parameter contains a valid Job_Detail_Page path (starting with `/jobs/`), THE Step_View_Page SHALL set the Back_Arrow destination to that Job_Detail_Page path
2. WHEN the From_Query_Parameter contains a valid Job_Detail_Page path, THE Step_View_Page SHALL display the Back_Arrow label as "Back to Job"
3. WHEN the From_Query_Parameter is absent, empty, or contains an invalid path, THE Resolve_Back_Navigation function SHALL return `/parts` as the destination and "Back to Parts" as the label

### Requirement 3: Preserve Default Back Navigation

**User Story:** As a user who arrived at the Step View from the Parts list or via direct URL, I want the back arrow to continue taking me to the Parts list, so that existing navigation behavior is unchanged.

#### Acceptance Criteria

1. WHEN a user navigates from the Parts_View_Page to the Step_View_Page, THE Step_View_Page SHALL display the Back_Arrow linking to `/parts` with the label "Back to Parts"
2. WHEN a user accesses the Step_View_Page directly via URL without a From_Query_Parameter, THE Step_View_Page SHALL display the Back_Arrow linking to `/parts` with the label "Back to Parts"
3. WHEN the From_Query_Parameter contains a value that does not start with `/jobs/`, THE Resolve_Back_Navigation function SHALL return `/parts` as the destination and "Back to Parts" as the label

### Requirement 4: Cancel Action Respects Referrer Context

**User Story:** As a user on the Step View page, I want the cancel action to return me to the same page as the back arrow, so that navigation is consistent.

#### Acceptance Criteria

1. WHEN the user triggers the cancel action on the Step_View_Page, THE Step_View_Page SHALL navigate to the same destination as the Back_Arrow (the value computed by Resolve_Back_Navigation)

### Requirement 5: Preserve Referrer Context Across Step Navigation

**User Story:** As a user navigating between steps using Prev/Next buttons on the Step View page, I want the back arrow to continue pointing to my original referrer page, so that I can return to where I started after browsing multiple steps.

#### Acceptance Criteria

1. WHEN the user clicks a Prev or Next step button on the Step_View_Page, THE Step_View_Page SHALL propagate the current From_Query_Parameter to the new Step_View_Page URL
2. WHEN the From_Query_Parameter is propagated across step navigation, THE Step_View_Page SHALL preserve the original referrer context for the Back_Arrow

### Requirement 6: Input Validation for Referrer Parameter

**User Story:** As a developer, I want the referrer parameter to be validated, so that only safe and expected values are used for navigation.

#### Acceptance Criteria

1. THE Resolve_Back_Navigation function SHALL only accept From_Query_Parameter values that start with `/jobs/` as valid job referrer paths
2. IF the From_Query_Parameter contains a value that does not start with `/jobs/` (e.g., external URLs, `javascript:` URIs, or arbitrary paths), THEN THE Resolve_Back_Navigation function SHALL fall back to `/parts` as the destination
