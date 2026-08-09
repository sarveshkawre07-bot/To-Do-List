# Design Document — Focus Mode UI

## Overview

Focus Mode is a full-screen, single-task overlay injected entirely into the existing
single-page app. No new files are created. All HTML additions go in `dashboard/index.html`,
all CSS additions go in `dashboard/dashboard.css`, and all JS additions go in
`dashboard/dashboard.js`. The overlay sits on top of the normal dashboard content using
`position: fixed; inset: 0` with a high `z-index`, so hiding/restoring the dashboard
sections is not required — the overlay simply covers them.

---

## Architecture

### Component Map

```
dashboard/
  index.html       ← #focus-overlay (new static element, hidden by default)
  dashboard.css    ← .focus-* rules + dark-theme overrides
  dashboard.js     ← focusState object + openFocusMode() + closeFocusMode()
                      + timerTick() + enterFocusFromCard() helpers
```

### State Object

```js
// Single source of truth for a running session
const focusState = {
    task:          null,   // active task object
    totalSeconds:  0,      // session duration chosen by user (or mapped from effort)
    remaining:     0,      // seconds left
    running:       false,  // timer is ticking
    intervalId:    null,   // setInterval handle
    startEpoch:    null,   // Date.now() when last resumed (for drift correction)
    pausedAt:      null,   // remaining value when paused
};
```

All timer mutations happen through the three functions `startTimer()`, `pauseTimer()`, and
`resumeTimer()`. The overlay reads directly from `focusState` to update its DOM nodes.

---

## HTML Structure

One static `<div id="focus-overlay">` is appended before `</body>`. It is hidden by
default (`display: none`). `openFocusMode()` sets it to `display: flex`.

```html
<!-- index.html — placed just before </body>, after the task modal -->

<div id="focus-overlay" class="focus-overlay" role="dialog"
     aria-modal="true" aria-labelledby="focus-task-title" style="display:none;">

  <!-- Top-right exit button -->
  <button id="focus-exit-btn" class="focus-exit-btn" type="button"
          aria-label="Exit Focus Mode">✕ Exit</button>

  <!-- Central card -->
  <div class="focus-card">

    <!-- Task metadata -->
    <div class="focus-meta">
      <span id="focus-category-badge" class="focus-badge focus-badge--category"></span>
      <span id="focus-priority-badge" class="focus-badge focus-badge--priority"></span>
      <span id="focus-effort-badge"   class="focus-badge focus-badge--effort"></span>
    </div>

    <h2 id="focus-task-title" class="focus-task-title"></h2>
    <p  id="focus-task-due"   class="focus-task-due"   style="display:none;"></p>

    <!-- SVG circular timer -->
    <div class="focus-timer-ring" role="timer" aria-live="polite"
         aria-label="Focus timer">
      <svg viewBox="0 0 120 120" class="focus-ring-svg" aria-hidden="true">
        <circle class="focus-ring-track" cx="60" cy="60" r="54"/>
        <circle id="focus-ring-progress" class="focus-ring-progress"
                cx="60" cy="60" r="54"/>
      </svg>
      <span id="focus-timer-display" class="focus-timer-display">25:00</span>
    </div>

    <!-- Duration chips -->
    <div class="focus-duration-chips" role="group" aria-label="Session duration">
      <button class="focus-chip" data-minutes="15"  type="button">15 min</button>
      <button class="focus-chip" data-minutes="30"  type="button">30 min</button>
      <button class="focus-chip" data-minutes="60"  type="button">60 min</button>
      <button class="focus-chip" data-minutes="120" type="button">120 min</button>
      <button class="focus-chip" data-minutes="90"  type="button">180+ min</button>
    </div>

    <!-- Timer expired banner (hidden until 00:00) -->
    <div id="focus-done-banner" class="focus-done-banner" role="alert"
         aria-live="assertive" style="display:none;">
      ⏰ Time's up! Great work.
    </div>

    <!-- Subtasks (collapsible) -->
    <details id="focus-subtasks-details" class="focus-subtasks-details"
             style="display:none;">
      <summary class="focus-subtasks-summary">
        Subtasks <span id="focus-subtasks-count" class="focus-subtasks-count"></span>
      </summary>
      <div id="focus-subtasks-list" class="focus-subtasks-list"></div>
    </details>

    <!-- Bottom controls -->
    <div class="focus-controls">
      <button id="focus-pause-btn"    class="focus-btn focus-btn--secondary"
              type="button">Pause</button>
      <button id="focus-complete-btn" class="focus-btn focus-btn--primary"
              type="button">Complete Task</button>
    </div>

  </div>
</div>
```

---

## CSS Design

### Layout & Overlay

The overlay uses `position: fixed; inset: 0; z-index: 2000` so it covers the
`z-index: 1000` task modal. The central `.focus-card` is a `max-width: 480px`
column centred with flexbox.

### SVG Ring Timer

The progress ring uses `strokeDasharray` / `strokeDashoffset` on a `<circle r="54">`.

```
circumference = 2π × 54 ≈ 339.3 px

dasharray  = circumference                        (fixed)
dashoffset = circumference × (remaining / total)  (updated each tick)
```

When `remaining === total` the ring is full (offset = 0 … wait, reversed):

```
dashoffset = circumference × (1 - remaining / total)
```

`dashoffset = 0` → full ring. `dashoffset = circumference` → empty ring.
The `stroke-linecap: round` and a `-90 deg` `transform-origin` rotation give the
standard "starts at 12 o'clock" appearance.

### Theme Inheritance

All colour values use CSS custom properties already defined in `:root` and
`[data-theme="dark"]` blocks (e.g., `var(--bg-main)`, `var(--accent)`). Because the
overlay lives in the same document, theme switches via `applyTheme()` automatically
propagate — no JS listener needed in Focus Mode.

### Duration Chip Active State

The `.focus-chip--active` class is toggled on the currently selected chip. On
`openFocusMode()`, the chip matching `task.estimatedEffort` receives this class.

---

## JavaScript Design

### Entry Points

#### 1. From Recommendation Card — replacing existing scroll/highlight

In `updateRecommendationUI()`, replace the `freshBtn` click handler body:

```js
freshBtn.addEventListener("click", () => {
    openFocusMode(result.task);
});
```

#### 2. From Task Card — new "Focus" menu item

Inside `addTaskToUI(task)`, add a third button to `.task-menu`:

```js
// Appended to the taskMenu innerHTML or injected after render:
const focusMenuBtn = document.createElement("button");
focusMenuBtn.type = "button";
focusMenuBtn.textContent = "🎯 Focus";
focusMenuBtn.addEventListener("click", () => {
    taskMenu.classList.remove("show");
    taskCard.classList.remove("menu-open");
    openFocusMode(task);
});
taskMenu.appendChild(focusMenuBtn);
```

### openFocusMode(task)

```js
function openFocusMode(task) {
    // 1. Map estimatedEffort to session seconds
    focusState.task          = task;
    focusState.totalSeconds  = effortToSeconds(task.estimatedEffort);
    focusState.remaining     = focusState.totalSeconds;
    focusState.running       = false;
    focusState.intervalId    = null;
    focusState.startEpoch    = null;
    focusState.pausedAt      = null;

    // 2. Populate overlay DOM
    populateFocusOverlay(task);

    // 3. Show overlay
    document.getElementById("focus-overlay").style.display = "flex";

    // 4. Auto-start timer
    startTimer();
}
```

### effortToSeconds(value)

| estimatedEffort | minutes | seconds |
|-----------------|---------|---------|
| "15"            | 15      | 900     |
| "30"            | 30      | 1800    |
| "60"            | 60      | 3600    |
| "120"           | 120     | 7200    |
| "180+"          | 90      | 5400    |
| (unknown)       | 25      | 1500    |

```js
function effortToSeconds(effort) {
    const map = { "15": 900, "30": 1800, "60": 3600,
                  "120": 7200, "180+": 5400 };
    return map[effort] ?? 1500;
}
```

### populateFocusOverlay(task)

Fills all static text nodes and marks the correct duration chip active. Also builds
the subtask list if `task.subtasks?.length > 0` and shows `#focus-subtasks-details`.

```js
function populateFocusOverlay(task) {
    // Title
    document.getElementById("focus-task-title").textContent = task.title;

    // Category / priority / effort badges
    document.getElementById("focus-category-badge").textContent =
        `${getCategoryIcon(task.category)} ${formatCategory(task.category)}`;
    document.getElementById("focus-priority-badge").textContent =
        `${getPriorityIcon(task.priority)} ${formatPriority(task.priority)}`;
    document.getElementById("focus-effort-badge").textContent =
        task.estimatedEffort ? `⏱ ${formatEffort(task.estimatedEffort)}` : "";

    // Due date/time
    const dueEl = document.getElementById("focus-task-due");
    if (task.dueDate || task.dueTime) {
        dueEl.textContent = task.dueDate && task.dueTime
            ? `📅 Due: ${formatDueDateTime(task.dueDate, task.dueTime)}`
            : task.dueDate
                ? `📅 Due: ${formatDueDate(task.dueDate)}`
                : `⏰ Due: ${formatTime(task.dueTime)}`;
        dueEl.style.display = "block";
    } else {
        dueEl.style.display = "none";
    }

    // Active duration chip
    const minutes = focusState.totalSeconds / 60;
    document.querySelectorAll(".focus-chip").forEach(chip => {
        chip.classList.toggle(
            "focus-chip--active",
            Number(chip.dataset.minutes) === minutes
        );
    });

    // Timer display
    updateTimerDisplay();

    // Done banner — hidden
    document.getElementById("focus-done-banner").style.display = "none";

    // Pause button label
    document.getElementById("focus-pause-btn").textContent = "Pause";

    // Subtasks
    const detailsEl = document.getElementById("focus-subtasks-details");
    const listEl    = document.getElementById("focus-subtasks-list");
    const countEl   = document.getElementById("focus-subtasks-count");
    listEl.innerHTML = "";

    const subtasks = task.subtasks || [];
    if (subtasks.length > 0) {
        const done = subtasks.filter(s => s.completed).length;
        countEl.textContent = `${done} / ${subtasks.length}`;
        subtasks.forEach(sub => {
            const label = document.createElement("label");
            label.className = `focus-subtask-item${sub.completed ? " completed" : ""}`;
            label.innerHTML = `
                <input type="checkbox" class="focus-subtask-check"
                       ${sub.completed ? "checked" : ""}>
                <span>${sub.title}</span>`;
            const cb = label.querySelector(".focus-subtask-check");
            cb.addEventListener("change", () =>
                handleFocusSubtaskToggle(sub, cb.checked, countEl, label));
            listEl.appendChild(label);
        });
        detailsEl.style.display = "block";
    } else {
        detailsEl.style.display = "none";
    }
}
```

### Timer Engine

Drift correction uses `Date.now()` snapshots. `setInterval` fires approximately
every 1 000 ms but may drift; each tick computes actual elapsed time.

```js
function startTimer() {
    if (focusState.running) return;
    focusState.running    = true;
    focusState.startEpoch = Date.now();

    focusState.intervalId = setInterval(() => {
        const elapsed = Math.floor((Date.now() - focusState.startEpoch) / 1000);
        const base    = focusState.pausedAt ?? focusState.totalSeconds;
        focusState.remaining = Math.max(0, base - elapsed);

        updateTimerDisplay();
        updateRingProgress();

        if (focusState.remaining === 0) {
            clearInterval(focusState.intervalId);
            focusState.intervalId = null;
            focusState.running    = false;
            document.getElementById("focus-done-banner").style.display = "block";
        }
    }, 1000);
}

function pauseTimer() {
    if (!focusState.running) return;
    clearInterval(focusState.intervalId);
    focusState.intervalId = null;
    focusState.running    = false;
    focusState.pausedAt   = focusState.remaining;
    document.getElementById("focus-pause-btn").textContent = "Resume";
}

function resumeTimer() {
    if (focusState.running) return;
    focusState.startEpoch = Date.now();
    // pausedAt holds the remaining seconds at pause time;
    // startTimer() uses pausedAt as the base.
    startTimer();
    document.getElementById("focus-pause-btn").textContent = "Pause";
}
```

### updateTimerDisplay()

```js
function updateTimerDisplay() {
    const s   = focusState.remaining;
    const mm  = String(Math.floor(s / 60)).padStart(2, "0");
    const ss  = String(s % 60).padStart(2, "0");
    document.getElementById("focus-timer-display").textContent = `${mm}:${ss}`;
}
```

### updateRingProgress()

```js
const RING_RADIUS       = 54;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ≈ 339.3

function updateRingProgress() {
    const ratio  = focusState.totalSeconds > 0
        ? focusState.remaining / focusState.totalSeconds
        : 0;
    const offset = RING_CIRCUMFERENCE * (1 - ratio);
    document.getElementById("focus-ring-progress")
        .style.strokeDashoffset = offset;
}
```

### closeFocusMode()

Stops the timer and hides the overlay. Does not touch the task document.

```js
function closeFocusMode() {
    // Stop timer
    if (focusState.intervalId) {
        clearInterval(focusState.intervalId);
        focusState.intervalId = null;
    }
    focusState.running = false;
    focusState.task    = null;

    // Hide overlay
    document.getElementById("focus-overlay").style.display = "none";

    // Refresh recommendation card
    updateRecommendationUI();
}
```

### handleFocusComplete()

Called when the user clicks "Complete Task". Delegates to the existing
`handleTaskCompletion()` then closes the overlay.

```js
async function handleFocusComplete() {
    const task = focusState.task;
    if (!task) return;

    // Find the task card in the DOM by task.id data attribute or title match
    const taskCard = [...document.querySelectorAll(".task-card")]
        .find(card => {
            const h3 = card.querySelector("h3");
            return h3 && h3.textContent.trim() === task.title.trim();
        });

    // Mark complete through existing path (updateDoc + visual update)
    const result = taskCard
        ? await handleTaskCompletion(task, taskCard, true)
        : null;

    if (result === false) {
        // Firestore write failed — keep overlay open, show nothing extra
        return;
    }

    closeFocusMode();
}
```

### handleFocusSubtaskToggle()

Mirrors the subtask checkbox logic in the main task list. Updates Firestore using
the same `updateDoc` path.

```js
async function handleFocusSubtaskToggle(subtask, checked, countEl, labelEl) {
    const task = focusState.task;
    const user = auth.currentUser;
    if (!task || !user) return;

    const prev        = subtask.completed;
    subtask.completed = checked;

    const allDone = (task.subtasks || []).every(s => s.completed);

    try {
        const taskRef = doc(db, "users", user.uid, "tasks", task.id);
        await updateDoc(taskRef, {
            subtasks:  task.subtasks,
            completed: allDone
        });
        task.completed = allDone;

        // Update count badge
        const done = (task.subtasks || []).filter(s => s.completed).length;
        countEl.textContent = `${done} / ${task.subtasks.length}`;

        // Update visual state of the label
        labelEl.classList.toggle("completed", checked);

        // Sync main-list card checkbox if visible
        const taskCard = [...document.querySelectorAll(".task-card")]
            .find(c => c.querySelector("h3")?.textContent.trim() === task.title.trim());
        if (taskCard) {
            const mainCb = taskCard.querySelector(".task-checkbox");
            if (mainCb) mainCb.checked = allDone;
            taskCard.classList.toggle("completed", allDone);
        }

        updateProgress();
    } catch (err) {
        console.error("Focus subtask toggle failed:", err);
        subtask.completed = prev;
        const cb = labelEl.querySelector(".focus-subtask-check");
        if (cb) cb.checked = prev;
    }
}
```

### Duration Chip Interaction

```js
document.querySelectorAll(".focus-chip").forEach(chip => {
    chip.addEventListener("click", () => {
        const minutes = Number(chip.dataset.minutes);
        const seconds = minutes * 60;

        // Reset timer with new duration
        if (focusState.intervalId) clearInterval(focusState.intervalId);
        focusState.intervalId   = null;
        focusState.running      = false;
        focusState.pausedAt     = null;
        focusState.totalSeconds = seconds;
        focusState.remaining    = seconds;

        document.querySelectorAll(".focus-chip")
            .forEach(c => c.classList.remove("focus-chip--active"));
        chip.classList.add("focus-chip--active");

        document.getElementById("focus-pause-btn").textContent = "Pause";
        document.getElementById("focus-done-banner").style.display = "none";

        updateTimerDisplay();
        updateRingProgress();
        startTimer();
    });
});
```

### Pause/Resume Button Wiring

```js
document.getElementById("focus-pause-btn").addEventListener("click", () => {
    focusState.running ? pauseTimer() : resumeTimer();
});
```

### Exit and Complete Button Wiring

```js
document.getElementById("focus-exit-btn")
    .addEventListener("click", closeFocusMode);

document.getElementById("focus-complete-btn")
    .addEventListener("click", handleFocusComplete);
```

---

## Data Models

No changes to the Firestore schema. The overlay reads from the same task object
already used by `addTaskToUI()`. The `focusState` object lives only in memory and
is not persisted (satisfying Requirement 7).

### Task Object Fields Used

| Field              | Used for                               |
|--------------------|----------------------------------------|
| `id`               | Firestore doc reference for updateDoc  |
| `title`            | Displayed in `#focus-task-title`       |
| `category`         | Category badge                         |
| `priority`         | Priority badge                         |
| `estimatedEffort`  | Default session duration               |
| `dueDate`          | Due label (optional)                   |
| `dueTime`          | Due label (optional)                   |
| `subtasks`         | Collapsible subtask list               |
| `completed`        | Determines initial visual state        |

---

## Error Handling

| Scenario                           | Handling                                                             |
|------------------------------------|----------------------------------------------------------------------|
| Firestore `updateDoc` fails on complete | Keep overlay open; log error; do not close                    |
| Firestore `updateDoc` fails on subtask toggle | Revert checkbox to previous state; log error          |
| `openFocusMode` called with null task | Guard clause: return early, log warning                       |
| User logs out while overlay open   | `onAuthStateChanged` redirects to login; overlay is discarded        |
| Task card not found in DOM         | `handleFocusComplete` proceeds with Firestore write only; card state reconciled on next load |

---

## CSS Specification

```css
/* ======================================
   FOCUS MODE OVERLAY
====================================== */

.focus-overlay {
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: var(--bg-main);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    overflow-y: auto;
    animation: focusIn 0.2s ease;
}

@keyframes focusIn {
    from { opacity: 0; transform: scale(0.98); }
    to   { opacity: 1; transform: scale(1);    }
}

/* Exit button — top-right corner */
.focus-exit-btn {
    position: absolute;
    top: 20px;
    right: 24px;
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-secondary);
    border-radius: 8px;
    padding: 7px 14px;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
}
.focus-exit-btn:hover          { background: var(--bg-hover); color: var(--text-main); }
.focus-exit-btn:focus-visible  { outline: 2px solid var(--accent); outline-offset: 2px; }

/* Central card */
.focus-card {
    width: 100%;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    text-align: center;
}

/* Metadata badges */
.focus-meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
}
.focus-badge {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 4px 12px;
    font-size: 12px;
    color: var(--text-secondary);
}

/* Task title */
.focus-task-title {
    font-size: 24px;
    font-weight: 700;
    color: var(--text-main);
    line-height: 1.3;
    margin: 0;
}

/* Due date */
.focus-task-due {
    font-size: 13px;
    color: var(--text-secondary);
    margin: -10px 0 0;
}

/* SVG ring wrapper */
.focus-timer-ring {
    position: relative;
    width: 180px;
    height: 180px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.focus-ring-svg {
    position: absolute;
    inset: 0;
    transform: rotate(-90deg);
    width: 100%;
    height: 100%;
}
.focus-ring-track {
    fill: none;
    stroke: var(--border);
    stroke-width: 8;
}
.focus-ring-progress {
    fill: none;
    stroke: var(--accent);
    stroke-width: 8;
    stroke-linecap: round;
    stroke-dasharray: 339.3;
    stroke-dashoffset: 0;
    transition: stroke-dashoffset 0.9s linear;
}

/* Timer text */
.focus-timer-display {
    font-size: 52px;
    font-weight: 700;
    color: var(--text-main);
    letter-spacing: -1px;
    font-variant-numeric: tabular-nums;
    position: relative;
    z-index: 1;
}

/* Duration chips */
.focus-duration-chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
}
.focus-chip {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 5px 14px;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
}
.focus-chip:hover          { background: var(--bg-hover); border-color: var(--accent); }
.focus-chip--active        { background: var(--accent-soft); border-color: var(--accent);
                              color: var(--accent); font-weight: 600; }
.focus-chip:focus-visible  { outline: 2px solid var(--accent); outline-offset: 2px; }

/* Done banner */
.focus-done-banner {
    background: var(--accent-soft);
    border: 1px solid var(--accent);
    border-radius: 12px;
    padding: 12px 20px;
    font-size: 15px;
    font-weight: 600;
    color: var(--accent);
    width: 100%;
}

/* Subtasks collapsible */
.focus-subtasks-details {
    width: 100%;
    text-align: left;
}
.focus-subtasks-summary {
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-main);
    padding: 8px 0;
    list-style: none;
    display: flex;
    align-items: center;
    gap: 8px;
}
.focus-subtasks-summary::-webkit-details-marker { display: none; }
.focus-subtasks-count {
    font-size: 12px;
    font-weight: 400;
    color: var(--text-secondary);
}
.focus-subtasks-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
}
.focus-subtask-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 14px;
    color: var(--text-main);
    cursor: pointer;
}
.focus-subtask-item input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; }
.focus-subtask-item.completed span         { text-decoration: line-through;
                                              color: var(--text-muted); }

/* Bottom controls */
.focus-controls {
    display: flex;
    gap: 12px;
    width: 100%;
    justify-content: center;
}
.focus-btn {
    border: none;
    border-radius: 12px;
    padding: 13px 28px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.1s ease;
}
.focus-btn:active         { transform: scale(0.97); }
.focus-btn:focus-visible  { outline: 3px solid var(--accent); outline-offset: 3px; }

.focus-btn--primary   { background: var(--accent); color: #fff; }
.focus-btn--primary:hover  { background: var(--accent-hover); }

.focus-btn--secondary {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    color: var(--text-main);
}
.focus-btn--secondary:hover { background: var(--bg-hover); }

/* Mobile */
@media (max-width: 500px) {
    .focus-task-title    { font-size: 20px; }
    .focus-timer-display { font-size: 44px; }
    .focus-timer-ring    { width: 150px; height: 150px; }
    .focus-controls      { flex-direction: column; }
    .focus-btn           { width: 100%; }
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Task metadata is fully rendered in the focus overlay

*For any* valid task object (with title, category, priority, estimatedEffort), calling
`populateFocusOverlay(task)` must produce an overlay whose DOM contains the task's
title text, category label, priority label, and effort label.

**Validates: Requirements 1.4**

---

### Property 2: Due date/time is rendered if and only if present

*For any* task object, the `#focus-task-due` element must be visible if and only if
`task.dueDate` or `task.dueTime` is non-empty, and its text content must match the
output of the existing `formatDueDate` / `formatDueDateTime` / `formatTime` helpers.

**Validates: Requirements 1.5**

---

### Property 3: Focus button exists on every task card

*For any* task added to the UI via `addTaskToUI(task)`, the resulting `.task-card`
must contain a button whose text includes "Focus" inside its `.task-menu`.

**Validates: Requirements 2.1, 2.2**

---

### Property 4: MM:SS timer formatting is correct for all valid durations

*For any* integer `s` in the range [0, 10800], `formatFocusTime(s)` must return a
string matching the pattern `/^\d{2}:\d{2}$/` where the minutes part equals
`Math.floor(s / 60)` (zero-padded to 2 digits) and the seconds part equals `s % 60`
(zero-padded to 2 digits).

**Validates: Requirements 3.1**

---

### Property 5: Pause → Resume is a round-trip on remaining time

*For any* running focus session with `remaining = R`, pausing and immediately resuming
(without any clock ticks in between) must produce a session where `remaining = R`
and `running = true`.

**Validates: Requirements 3.2, 3.3**

---

### Property 6: Timer remaining never goes below zero

*For any* focus session, at any tick of `setInterval`, `focusState.remaining` must
satisfy `remaining >= 0`. Once `remaining === 0`, subsequent ticks must leave it at 0.

**Validates: Requirements 3.5**

---

### Property 7: effortToSeconds covers all defined effort values

*For any* value in `["15", "30", "60", "120", "180+"]`, `effortToSeconds(value)` must
return the corresponding minute count multiplied by 60, and for `"180+"` specifically
must return 5400 (90 minutes). For any unrecognised value, it must return 1500 (25 minutes).

**Validates: Requirements 3.3** (default session duration mapping)

---

### Property 8: Exit round-trip — task state is unchanged

*For any* task and any running focus session, calling `closeFocusMode()` must leave
`task.completed` equal to its value before `openFocusMode(task)` was called, and the
overlay must be hidden (`display === "none"`).

**Validates: Requirements 5.1, 5.2, 5.3**

---

### Property 9: Focus overlay hides and restores atomically via fixed positioning

*For any* call to `openFocusMode(task)`, the `#focus-overlay` must have
`style.display !== "none"`. *For any* subsequent call to `closeFocusMode()`, it must
have `style.display === "none"`. All dashboard sections (sidebar, top-bar, etc.) remain
in the DOM throughout — they are visually covered, not hidden.

**Validates: Requirements 1.2, 5.3, 7.1**

---

### Property 10: Complete task round-trip — completed state reflects in card

*For any* task that is incomplete when `openFocusMode(task)` is called, after
`handleFocusComplete()` resolves successfully, the task card in the main list matching
that task's title must have the `completed` CSS class, and the task checkbox must be
checked.

**Validates: Requirements 4.2, 4.3, 4.4**

---
