# Bugfix Requirements Document

## Introduction

When a serial number is scrapped via the operator view, it continues to appear in the work queue for its current step. The scrapped serial is included in the step's part count and serial list, allowing operators to attempt actions on it (e.g., advance or scrap again), which then fail with a validation error. The root cause is that the `listByStepIndex` repository method queries serials by `path_id` and `current_step_index` without filtering out serials whose `status` is `'scrapped'`. Since scrapping a serial sets `status = 'scrapped'` but does not change `currentStepIndex`, the scrapped serial matches the query and is returned to the operator queue.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a serial number has `status = 'scrapped'` and `listByStepIndex` is called for that serial's `pathId` and `currentStepIndex` THEN the system includes the scrapped serial in the returned list

1.2 WHEN a scrapped serial appears in the operator work queue THEN the system displays it in the step's serial list and counts it toward the step's `partCount`

1.3 WHEN an operator attempts to scrap or advance a serial that is already scrapped THEN the system returns a validation error ("Serial is already scrapped" or "Cannot advance a scrapped serial") instead of preventing the action by hiding the serial from the queue

### Expected Behavior (Correct)

2.1 WHEN a serial number has `status = 'scrapped'` and `listByStepIndex` is called for that serial's `pathId` and `currentStepIndex` THEN the system SHALL exclude the scrapped serial from the returned list

2.2 WHEN a serial has been scrapped THEN the system SHALL NOT display it in the operator work queue for any step, and the step's `partCount` SHALL only reflect non-scrapped serials

2.3 WHEN a serial is scrapped during an active operator session THEN the system SHALL remove it from the work queue upon the next queue refresh, preventing further operator actions on it

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a serial has `status = 'in_progress'` THEN the system SHALL CONTINUE TO include it in `listByStepIndex` results and display it in the operator work queue at its current step

3.2 WHEN a serial has `status = 'completed'` and `currentStepIndex = -1` THEN the system SHALL CONTINUE TO exclude it from `listByStepIndex` results (completed serials already have `currentStepIndex = -1` and do not match any step query)

3.3 WHEN `listByStepIndex` is called for a step with no matching non-scrapped serials THEN the system SHALL CONTINUE TO return an empty list, and the operator queue SHALL CONTINUE TO omit that step group

3.4 WHEN the `scrapSerial` lifecycle method is called THEN the system SHALL CONTINUE TO set `status = 'scrapped'`, record scrap metadata, and write an audit entry — the scrap operation itself is unchanged

3.5 WHEN `listByPathId` or `listByJobId` is called THEN the system SHALL CONTINUE TO return all serials regardless of status (these methods are used for job-level views that need full serial visibility)
