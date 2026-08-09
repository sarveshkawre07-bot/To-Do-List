# Implementation Plan: Focus Mode UI

## Overview

Implement the Focus Mode overlay entirely within the three existing files (`index.html`, `dashboard.css`, `dashboard.js`). The overlay is a fixed-position element that covers the dashboard, contains an SVG countdown ring, task metadata, subtask list, duration chips, and Pause/Complete/Exit controls. All state lives in a single `focusState` object; Firestore writes reuse existing helpers.

---

## Tasks

- [x] 1. Add the focus overlay HTML to index.html
  - Insert `<div id="focus-overlay">` with all inner elements (exit button, focus card, meta badges, title, due date, SVG ring, duration chips, done banner, subtasks `<details>`, and bottom controls) just before `</body>`, after the task modal
  - Set `style="display:none;"` on the root overlay and `#focus-done-banner`; set `style="display:none;"` on `#focus-subtasks-details` and `#focus-task-due`
  - Add correct ARIA attributes: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="focus-task-title"`, `role="timer"`, `aria-live="polite"` on ring, `role="alert"` / `aria-live="assertive"` on done banner, `role="group"` on chip container
  - _Requirements: 1.1, 1.4, 2.1, 3.1, 3.4, 5.1, 6.1, 6.5, 6.6_

- [x] 2. Add focus mode CSS to dashboard.css
  - [x] 2.1 Add overlay layout and entry animation
    - Write `.focus-overlay` (`position: fixed; inset: 0; z-index: 2000; background: var(--bg-main); display: flex; align-items: center; justify-content: center; overflow-y: auto`) and `@keyframes focusIn`
    - Write `.focus-exit-btn` with absolute top-right positioning, `var(--border)` border, hover, and `:focus-visible` outline rules
    - Write `.focus-card` flex column, max-width 480 px, centred items
    - _Requirements: 6.1, 6.2, 6.3, 6.5_
  - [x] 2.2 Add badge, title, due date, and chip styles
    - Write `.focus-meta`, `.focus-badge`, `.focus-task-title` (font-size 24 px), `.focus-task-due`, `.focus-duration-chips`, `.focus-chip`, `.focus-chip--active`, `.focus-chip:focus-visible`
    - _Requirements: 1.4, 1.5, 6.4, 6.5_
  - [x] 2.3 Add SVG ring timer styles
    - Write `.focus-timer-ring` (180 × 180 px, relative), `.focus-ring-svg` (absolute, rotated −90 °), `.focus-ring-track` (stroke: `var(--border)`; stroke-width: 8), `.focus-ring-progress` (`stroke: var(--accent)`; stroke-dasharray: 339.3; transition: stroke-dashoffset 0.9 s linear; stroke-linecap: round)
    - Write `.focus-timer-display` (font-size 52 px; font-weight 700; tabular-nums; z-index: 1)
    - _Requirements: 3.1, 6.4_
  - [x] 2.4 Add done banner, subtask list, and control button styles
    - Write `.focus-done-banner` (accent-soft background, accent border, bold)
    - Write `.focus-subtasks-details`, `.focus-subtasks-summary`, `.focus-subtasks-count`, `.focus-subtasks-list`, `.focus-subtask-item`, `.focus-subtask-item.completed span` (line-through)
    - Write `.focus-controls`, `.focus-btn`, `.focus-btn--primary`, `.focus-btn--secondary`, `:active` scale, `:focus-visible` outline
    - _Requirements: 3.4, 4.1, 5.1, 6.5_
  - [x] 2.5 Add mobile responsive overrides
    - Write `@media (max-width: 500px)` block: reduce `.focus-task-title` to 20 px, `.focus-timer-display` to 44 px, `.focus-timer-ring` to 150 × 150 px, stack `.focus-controls` vertically with full-width buttons
    - _Requirements: 6.1, 6.4_

- [x] 3. Implement focusState and core helper functions in dashboard.js
  - [x] 3.1 Declare `focusState` object and `effortToSeconds()` helper
    - Add `const focusState = { task, totalSeconds, remaining, running, intervalId, startEpoch, pausedAt }` (all initialised to null/0/false)
    - Implement `effortToSeconds(effort)` using the lookup map `{ "15": 900, "30": 1800, "60": 3600, "120": 7200, "180+": 5400 }` with 1500 fallback
    - _Requirements: 3.3_
  - [-]* 3.2 Write property test for `effortToSeconds` (Property 7)
    - **Property 7: effortToSeconds covers all defined effort values**
    - For each value in `["15", "30", "60", "120", "180+"]` assert return equals minutes × 60; assert `"180+"` returns 5400; assert unknown string returns 1500
    - **Validates: Requirements 3.3**

- [x] 4. Implement timer engine functions
  - [x] 4.1 Implement `updateTimerDisplay()` and `updateRingProgress()`
    - `updateTimerDisplay` reads `focusState.remaining`, formats as zero-padded MM:SS, writes to `#focus-timer-display`
    - `updateRingProgress` computes `offset = RING_CIRCUMFERENCE * (1 - remaining / totalSeconds)` and sets `style.strokeDashoffset` on `#focus-ring-progress`; clamp ratio to [0,1] when totalSeconds is 0
    - _Requirements: 3.1_
  - [-]* 4.2 Write property test for MM:SS formatting (Property 4)
    - **Property 4: MM:SS timer formatting is correct for all valid durations**
    - For integers 0, 1, 59, 60, 599, 600, 3599, 3600, 10800 assert `updateTimerDisplay` writes text matching `/^\d{2}:\d{2}$/` with correct minute and second values
    - **Validates: Requirements 3.1**
  - [x] 4.3 Implement `startTimer()`, `pauseTimer()`, and `resumeTimer()`
    - `startTimer`: guard if already running; set `running = true`, `startEpoch = Date.now()`; `setInterval` every 1000 ms: compute elapsed from epoch, set `remaining = max(0, base − elapsed)` where base is `pausedAt ?? totalSeconds`; call `updateTimerDisplay` and `updateRingProgress`; when remaining reaches 0 clear interval and show `#focus-done-banner`
    - `pauseTimer`: clear interval, set `running = false`, `pausedAt = remaining`, update button label to "Resume"
    - `resumeTimer`: set `startEpoch = Date.now()`, call `startTimer()`, update button label to "Pause"
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6_
  - [-]* 4.4 Write property test for pause→resume round-trip (Property 5)
    - **Property 5: Pause → Resume is a round-trip on remaining time**
    - Stub `Date.now` and `setInterval`/`clearInterval`; call `startTimer()`, then `pauseTimer()`, then `resumeTimer()` with no clock ticks; assert `focusState.remaining === R` and `focusState.running === true`
    - **Validates: Requirements 3.2, 3.3**
  - [-]* 4.5 Write property test for timer floor (Property 6)
    - **Property 6: Timer remaining never goes below zero**
    - Simulate ticks that overshoot remaining; assert `focusState.remaining >= 0` after each tick; assert subsequent ticks keep remaining at 0
    - **Validates: Requirements 3.5**

- [x] 5. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement overlay population and open/close logic
  - [x] 6.1 Implement `populateFocusOverlay(task)`
    - Set title, category badge (using existing `getCategoryIcon` / `formatCategory`), priority badge, effort badge
    - Show/hide `#focus-task-due` based on `task.dueDate` / `task.dueTime` using existing `formatDueDate`, `formatDueDateTime`, `formatTime` helpers
    - Toggle `.focus-chip--active` on the chip whose `data-minutes` matches `focusState.totalSeconds / 60`
    - Call `updateTimerDisplay()` and `updateRingProgress()`; reset done banner to hidden; reset pause button label to "Pause"
    - Build subtask `<label>` elements with checkboxes wired to `handleFocusSubtaskToggle`; show/hide `#focus-subtasks-details`
    - _Requirements: 1.4, 1.5_
  - [-]* 6.2 Write property test for overlay population (Property 1)
    - **Property 1: Task metadata is fully rendered in the focus overlay**
    - For representative task objects call `populateFocusOverlay(task)`; assert `#focus-task-title`, `#focus-category-badge`, `#focus-priority-badge`, `#focus-effort-badge` all contain the expected text
    - **Validates: Requirements 1.4**
  - [-]* 6.3 Write property test for due date conditional rendering (Property 2)
    - **Property 2: Due date/time is rendered if and only if present**
    - For tasks with both fields, only dueDate, only dueTime, and neither: assert `#focus-task-due` display and text content behave as specified
    - **Validates: Requirements 1.5**
  - [x] 6.4 Implement `openFocusMode(task)` and `closeFocusMode()`
    - `openFocusMode`: guard on null task; populate `focusState`; call `populateFocusOverlay`; set overlay `display: flex`; call `startTimer()`
    - `closeFocusMode`: clear interval; reset `running` and `task`; set overlay `display: none`; call `updateRecommendationUI()`
    - _Requirements: 1.1, 1.2, 1.3, 5.2, 5.3, 5.4, 7.1, 7.2_
  - [-]* 6.5 Write property test for open/close round-trip (Property 8 & 9)
    - **Property 8: Exit round-trip — task state is unchanged**
    - **Property 9: Focus overlay hides and restores via fixed positioning**
    - Assert `task.completed` unchanged after `closeFocusMode()`; assert overlay `display === "none"` after close and `!== "none"` after open
    - **Validates: Requirements 5.1, 5.2, 5.3, 7.1**

- [x] 7. Implement task completion and subtask toggle
  - [x] 7.1 Implement `handleFocusComplete()`
    - Read `focusState.task`; locate matching `.task-card` by title; delegate to existing `handleTaskCompletion(task, card, true)`; on success call `closeFocusMode()`; on failure (returns false) keep overlay open and log error
    - _Requirements: 4.2, 4.3, 4.4_
  - [x] 7.2 Implement `handleFocusSubtaskToggle(subtask, checked, countEl, labelEl)`
    - Optimistically update `subtask.completed`; compute `allDone`; write `{ subtasks, completed: allDone }` via `updateDoc`; update count badge and label class; sync matching main-list card checkbox; on error revert checkbox and log
    - _Requirements: 4.2_
  - [-]* 7.3 Write property test for complete-task round-trip (Property 10)
    - **Property 10: Complete task round-trip — completed state reflects in card**
    - Mock `handleTaskCompletion` to resolve; call `handleFocusComplete()`; assert matching task card has `completed` class and checkbox is checked
    - **Validates: Requirements 4.2, 4.3, 4.4**

- [x] 8. Wire event listeners and entry points
  - [x] 8.1 Wire overlay button event listeners
    - Add `click` listener on `#focus-exit-btn` → `closeFocusMode`
    - Add `click` listener on `#focus-complete-btn` → `handleFocusComplete`
    - Add `click` listener on `#focus-pause-btn` → `focusState.running ? pauseTimer() : resumeTimer()`
    - Add `click` listeners on each `.focus-chip` → reset `focusState` duration fields, toggle `.focus-chip--active`, reset banner and button label, call `updateTimerDisplay`, `updateRingProgress`, then `startTimer`
    - _Requirements: 3.2, 3.3, 5.1, 5.2_
  - [x] 8.2 Add "Focus" button to task card menu in `addTaskToUI()`
    - Create a `<button>` with text `"🎯 Focus"`, append to `.task-menu`; on click: close menu, call `openFocusMode(task)`
    - _Requirements: 2.1, 2.2_
  - [-]* 8.3 Write property test for focus button presence (Property 3)
    - **Property 3: Focus button exists on every task card**
    - For representative task objects rendered via `addTaskToUI(task)`, assert the resulting `.task-menu` contains a button whose textContent includes "Focus"
    - **Validates: Requirements 2.1, 2.2**
  - [x] 8.4 Replace "Start Task" handler in `updateRecommendationUI()` with `openFocusMode`
    - In the `freshBtn` click handler body, replace any existing scroll/highlight logic with a single call to `openFocusMode(result.task)`
    - _Requirements: 1.1_

- [x] 9. Final checkpoint — Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All three files (`index.html`, `dashboard.css`, `dashboard.js`) are modified — no new files are created
- Theme inheritance is automatic via CSS custom properties; no JS listener needed for Requirement 6.3
- `handleTaskCompletion` and `updateRecommendationUI` are reused without modification
- Property tests require a DOM stub (jsdom or similar) and clock stubs for timer tests
- Each property test task references the specific property number from the design document

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["3.1", "2.1", "2.2", "2.3", "2.4", "2.5"] },
    { "id": 1, "tasks": ["3.2", "4.1"] },
    { "id": 2, "tasks": ["4.2", "4.3"] },
    { "id": 3, "tasks": ["4.4", "4.5", "6.1"] },
    { "id": 4, "tasks": ["6.2", "6.3", "6.4"] },
    { "id": 5, "tasks": ["6.5", "7.1", "7.2", "8.1", "8.2", "8.4"] },
    { "id": 6, "tasks": ["7.3", "8.3"] }
  ]
}
```
