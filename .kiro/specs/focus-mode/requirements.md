# Requirements Document

## Introduction

The Focus Mode feature adds a dedicated, distraction-free view to the To-Do Flow dashboard. When a user activates Focus Mode, the Dashboard hides all chrome (sidebar, top bar, stats, task list, recommendation card) and displays a single-task view centred on the currently active task. The view includes a countdown Pomodoro-style timer, controls to pause/resume and stop the session, a completion action, and a minimal progress indicator. The feature is entirely client-side and requires no changes to the Firestore data model beyond the fields already stored on tasks.

---

## Glossary

- **Focus_Mode**: The full-screen, single-task view that the user enters to work on one task without distraction.
- **Active_Task**: The task that has been selected for a Focus Mode session — either the recommended task chosen via "Start Task" or any task started directly from a task card.
- **Focus_Timer**: The countdown clock displayed during a Focus Mode session. One cycle is 25 minutes by default.
- **Session**: A continuous period of focused work bounded by a Focus_Timer cycle. A session ends when the timer reaches zero, the user completes the task, or the user exits manually.
- **Dashboard**: The main content area defined in `dashboard/index.html`, including the sidebar, top bar, task list, and recommendation card.
- **Scoring_Engine**: The deterministic task scoring module in `dashboard/scoring.js`.
- **Task_Card**: An individual task element rendered by `addTaskToUI()` in `dashboard/dashboard.js`.

---

## Requirements

### Requirement 1 — Entering Focus Mode from the Recommendation Card

**User Story:** As a user, I want to start a focused session directly from the "What should I do now?" recommendation card, so that I can immediately begin working on the highest-priority task without navigating elsewhere.

#### Acceptance Criteria

1. WHEN the user clicks the "Start Task" button on the recommendation card, THE Focus_Mode SHALL activate with the recommended Active_Task loaded into the Focus Mode view.
2. WHEN Focus_Mode activates, THE Dashboard SHALL hide the sidebar, top bar, greeting section, task controls, progress section, recommendation section, and task list.
3. WHEN Focus_Mode activates, THE Focus_Timer SHALL begin counting down from 25 minutes.
4. WHEN Focus_Mode activates, THE Focus_Mode view SHALL display the Active_Task's title, category, priority badge, and estimated effort label.
5. WHEN the Active_Task has a due date or due time, THE Focus_Mode view SHALL display the due date/time beneath the task title.

---

### Requirement 2 — Entering Focus Mode from a Task Card

**User Story:** As a user, I want to start a focused session from any task card in the task list, so that I can work on a task of my own choosing rather than the recommended one.

#### Acceptance Criteria

1. THE Focus_Mode view SHALL be accessible from each Task_Card via a "Focus" action button rendered alongside the existing edit and delete buttons in the task options menu.
2. WHEN the user clicks the "Focus" action button on a Task_Card, THE Focus_Mode SHALL activate with that task as the Active_Task.
3. WHILE the Active_Task is already marked as completed, THE Focus_Mode SHALL activate and display the task in its completed state with the option to mark it incomplete.

---

### Requirement 3 — Focus Timer Behaviour

**User Story:** As a user, I want a visible countdown timer during my focused session, so that I can manage my time without checking an external clock.

#### Acceptance Criteria

1. THE Focus_Timer SHALL display the remaining time in MM:SS format, updating every 1 second.
2. WHEN the user clicks the Pause button, THE Focus_Timer SHALL stop decrementing and the Pause button SHALL change its label to "Resume".
3. WHEN the user clicks the Resume button, THE Focus_Timer SHALL resume decrementing from the paused value and the button label SHALL revert to "Pause".
4. WHEN the Focus_Timer reaches 00:00, THE Focus_Mode view SHALL display a session-complete notification within the Focus Mode view indicating that the timer has ended.
5. WHEN the Focus_Timer reaches 00:00, THE Focus_Timer SHALL stop decrementing and remain at 00:00 until the user takes an explicit action.
6. IF the user's browser tab loses focus WHILE the Focus_Timer is running, THE Focus_Timer SHALL continue decrementing using the browser's `setTimeout`/`setInterval` API so that elapsed time remains accurate.

---

### Requirement 4 — Completing the Task from Focus Mode

**User Story:** As a user, I want to mark the active task as complete without leaving Focus Mode, so that I can record my progress and return to the dashboard in one smooth flow.

#### Acceptance Criteria

1. THE Focus_Mode view SHALL display a "Complete Task" button that is visible at all times during the session.
2. WHEN the user clicks "Complete Task", THE Focus_Mode SHALL mark the Active_Task as completed by calling the same Firestore `updateDoc` path used by the main task checkbox in `dashboard.js`.
3. WHEN the user clicks "Complete Task", THE Focus_Mode SHALL exit and restore the Dashboard view with the Active_Task's Task_Card rendered in the completed state.
4. WHEN the user clicks "Complete Task", THE Dashboard progress bar and task count SHALL update to reflect the newly completed task.

---

### Requirement 5 — Exiting Focus Mode Without Completing the Task

**User Story:** As a user, I want to exit Focus Mode at any time without being forced to complete the task, so that I can return to the full dashboard if my plans change.

#### Acceptance Criteria

1. THE Focus_Mode view SHALL display an "Exit" button that is visible at all times during the session.
2. WHEN the user clicks the "Exit" button, THE Focus_Mode SHALL stop the Focus_Timer and restore the Dashboard view without modifying the Active_Task's completion state.
3. WHEN Focus_Mode exits, THE Dashboard SHALL restore all previously hidden sections to their pre-session visibility state.
4. WHEN Focus_Mode exits, THE Scoring_Engine's recommendation card SHALL re-evaluate and display the current highest-priority incomplete task.

---

### Requirement 6 — Visual Design and Accessibility

**User Story:** As a user, I want the Focus Mode view to be visually calm and distraction-free, so that the environment itself supports concentration.

#### Acceptance Criteria

1. THE Focus_Mode view SHALL occupy the full viewport width and height, covering all Dashboard content.
2. THE Focus_Mode view SHALL apply the active theme (light or dark) as set by the existing `data-theme` attribute on `document.documentElement`, maintaining visual consistency with the rest of the application.
3. WHEN the theme changes WHILE Focus_Mode is active, THE Focus_Mode view SHALL reflect the new theme without requiring the user to exit and re-enter Focus Mode.
4. THE Focus_Timer display SHALL use a font size of at least 48px so that the remaining time is legible without the user leaning toward the screen.
5. THE Focus_Mode view SHALL provide visible focus indicators on all interactive controls (Pause/Resume, Complete Task, Exit) that meet WCAG 2.1 AA contrast requirements for focus states.
6. THE Focus_Mode view SHALL set `aria-live="polite"` on the timer element so that assistive technologies announce timer state changes.

---

### Requirement 7 — State Persistence Across Page Refresh

**User Story:** As a user, I want the dashboard to return to its normal state if I accidentally refresh the page during a Focus Mode session, so that I do not lose access to my task list.

#### Acceptance Criteria

1. WHEN the page is reloaded WHILE Focus_Mode is active, THE Dashboard SHALL render in its normal (non-Focus) state with all sections visible.
2. WHEN the page is reloaded WHILE Focus_Mode is active, THE Focus_Timer state SHALL be discarded and no in-progress session SHALL be restored.
