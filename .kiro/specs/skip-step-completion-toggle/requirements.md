# Requirements Document

## Introduction

This feature adds a "Mark this step as complete?" checkbox to the Advanced options section of the ProcessAdvancementPanel component. The checkbox controls whether the origin step is marked as completed or skipped/deferred when an admin uses the "Skip Selected Parts" flow to advance parts to a non-adjacent target step. The change is UI-only — the server-side `AdvanceToStepInput.skip` field and `lifecycleService.advanceToStep()` already support both behaviors.

## Glossary

- **ProcessAdvancementPanel**: The Vue component (`app/components/ProcessAdvancementPanel.vue`) that provides the UI for advancing parts through process steps, including the Advanced options section for skip-to-step functionality.
- **Advanced_Options_Section**: The admin-only collapsible section within ProcessAdvancementPanel that contains the skip-to-step dropdown, bypass preview, and skip action button.
- **markComplete**: A reactive boolean ref in ProcessAdvancementPanel that tracks the state of the "Mark this step as complete?" checkbox. Defaults to `false`.
- **Origin_Step**: The process step a part is currently at when the skip operation is initiated.
- **Skip_Flag**: The `skip` boolean parameter passed to `advanceToStep()`. When `true`, the origin step is marked skipped or deferred. When `false`, the origin step is marked completed.
- **Target_Step**: The future process step selected in the skip-to dropdown that parts will be advanced to.

## Requirements

### Requirement 1: Checkbox Rendering

**User Story:** As an admin operator, I want to see a "Mark this step as complete?" checkbox in the Advanced options section, so that I can choose whether the origin step is marked as completed or skipped when advancing parts to a non-adjacent step.

#### Acceptance Criteria

1.1. WHILE the Advanced options section is open and a target step is selected, THE ProcessAdvancementPanel SHALL display a "Mark this step as complete?" checkbox between the bypass preview and the "Skip Selected Parts" button.

1.2. WHEN no target step is selected, THE ProcessAdvancementPanel SHALL hide the "Mark this step as complete?" checkbox.

1.3. WHILE the Advanced options section is collapsed, THE ProcessAdvancementPanel SHALL hide the "Mark this step as complete?" checkbox.

### Requirement 2: Default Checkbox State

**User Story:** As an admin operator, I want the checkbox to default to unchecked, so that the existing skip behavior is preserved unless I explicitly opt into marking the step as complete.

#### Acceptance Criteria

2.1. WHEN the ProcessAdvancementPanel is initially rendered, THE markComplete ref SHALL be `false`.

2.2. WHEN the current step changes (props.job.stepId changes), THE ProcessAdvancementPanel SHALL reset markComplete to `false`.

### Requirement 3: Skip Flag Derivation

**User Story:** As an admin operator, I want the skip flag sent to the server to reflect my checkbox choice, so that the origin step is marked correctly based on my intent.

#### Acceptance Criteria

3.1. WHEN the admin clicks "Skip Selected Parts" with markComplete checked, THE ProcessAdvancementPanel SHALL call advanceToStep with `skip: false` for each selected part.

3.2. WHEN the admin clicks "Skip Selected Parts" with markComplete unchecked, THE ProcessAdvancementPanel SHALL call advanceToStep with `skip: true` for each selected part.

### Requirement 4: Contextual Help Text

**User Story:** As an admin operator, I want to see a description of what the checkbox does, so that I understand the effect of checking or unchecking it before I act.

#### Acceptance Criteria

4.1. WHILE markComplete is checked, THE ProcessAdvancementPanel SHALL display the text "The current step will be marked as completed before advancing."

4.2. WHILE markComplete is unchecked, THE ProcessAdvancementPanel SHALL display the text "The current step will be marked as skipped or deferred."

### Requirement 5: Toast Feedback

**User Story:** As an admin operator, I want the success toast to reflect whether parts were completed-and-advanced or skipped, so that I have clear confirmation of what happened.

#### Acceptance Criteria

5.1. WHEN a skip operation succeeds with markComplete checked, THE ProcessAdvancementPanel SHALL show a toast with title "Parts advanced" and description indicating parts were "completed and advanced".

5.2. WHEN a skip operation succeeds with markComplete unchecked, THE ProcessAdvancementPanel SHALL show a toast with title "Parts skipped" and description indicating parts were "skipped forward".

### Requirement 6: Admin-Only Access

**User Story:** As a system administrator, I want the checkbox to only be accessible to admin users, so that non-admin operators cannot change the skip/complete behavior.

#### Acceptance Criteria

6.1. THE ProcessAdvancementPanel SHALL render the "Mark this step as complete?" checkbox only within the admin-gated Advanced options section (the existing `v-if="isAdmin"` block).

### Requirement 7: State Reset on Step Navigation

**User Story:** As an admin operator, I want the checkbox state to reset when I navigate to a different step, so that I don't accidentally carry over a previous choice.

#### Acceptance Criteria

7.1. WHEN props.job.stepId changes, THE ProcessAdvancementPanel SHALL reset markComplete to `false` alongside the existing resets of advancedOpen and selectedTargetStepId.
