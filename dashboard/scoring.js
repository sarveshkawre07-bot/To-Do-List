/**
 * scoring.js
 * Task Recommendation Scoring Engine - USP MVP Step 7 (V2)
 *
 * Public API:
 *   calculateTaskScore(task)              -> { score, breakdown }
 *   getRecommendedTask(tasks)             -> { task, score, breakdown } | null
 *   getRecommendationReasons(task, breakdown) -> string[]
 *
 * No UI dependencies. No AI/ML. Fully deterministic.
 */

// ============================================================
// 1. PRIORITY SCORE  (0-40)
// ============================================================

function getPriorityScore(task) {
    const map = { high: 40, medium: 28, low: 15 };
    return map[task.priority] ?? 15;
}

// ============================================================
// 2. DUE-DATE SCORE  (0-40)
// ============================================================

function getDueDateTime(task) {
    if (!task.dueDate) return null;
    const [year, month, day] = task.dueDate.split("-").map(Number);
    if (task.dueTime) {
        const [hours, minutes] = task.dueTime.split(":").map(Number);
        return new Date(year, month - 1, day, hours, minutes, 0);
    }
    return new Date(year, month - 1, day, 23, 59, 59);
}

// Returns the calendar-day difference between the task due date and today.
// Negative  = overdue (due date is in the past).
// 0         = due today.
// 1         = due tomorrow, etc.
// Special case: if the task is due today but the exact due time has already
// passed, we treat it as overdue (return -1) so it scores the same as
// a past-date task.
function getCalendarDayDiff(task) {
    if (!task.dueDate) return null;
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const [year, month, day] = task.dueDate.split("-").map(Number);
    const dueMidnight = new Date(year, month - 1, day);
    const calDiff = Math.round((dueMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
    // If due today, check whether the exact due time has already passed
    if (calDiff === 0 && task.dueTime) {
        const dueExact = getDueDateTime(task);
        if (dueExact && dueExact < now) return -1;
    }
    return calDiff;
}

function getDueDateScore(task) {
    const diff = getCalendarDayDiff(task);
    if (diff === null) return 0;
    if (diff < 0)   return 40;  // overdue
    if (diff === 0) return 35;  // due today
    if (diff === 1) return 28;  // due tomorrow
    if (diff <= 3)  return 18;  // within 3 days
    if (diff <= 7)  return 10;  // within 7 days
    return 4;                   // later
}

// ============================================================
// 3. IMPORTANT SCORE  (0-15)
// ============================================================

function getImportantScore(task) {
    return task.starred === true ? 15 : 0;
}

// ============================================================
// 4. ESTIMATED EFFORT SCORE  (0-5)
//
// Effort is a secondary tiebreaker only.
// Short tasks get a small nudge; long tasks lose a small amount.
// This must never override priority or due-date urgency.
// ============================================================

function getEffortScore(task) {
    const effort = task.estimatedEffort ?? "30";
    const map = { "15": 5, "30": 4, "60": 3, "120": 2, "180+": 1 };
    return map[effort] ?? 4;  // unknown -> treat as 30 min
}

// ============================================================
// 5. MAIN SCORING FUNCTION
// ============================================================

/**
 * calculateTaskScore(task)
 * Returns { score: number, breakdown: { priority, dueDate, important, effort } }
 *
 * Max score = 100  (priority 40 + dueDate 40 + important 15 + effort 5)
 */
export function calculateTaskScore(task) {
    const priority  = getPriorityScore(task);
    const dueDate   = getDueDateScore(task);
    const important = getImportantScore(task);
    const effort    = getEffortScore(task);
    return {
        score: priority + dueDate + important + effort,
        breakdown: { priority, dueDate, important, effort }
    };
}

// ============================================================
// 6. RECOMMENDED TASK
// ============================================================

/**
 * getRecommendedTask(tasks)
 * Filters completed tasks, scores the rest, returns highest scorer.
 * Tie-breaking: earlier due date wins; no due date loses to one with a date;
 * both without due date: preserve original order (stable sort).
 * Returns null when no incomplete tasks exist.
 */
export function getRecommendedTask(tasks) {
    const incomplete = (tasks || []).filter(t => t.completed !== true);
    if (incomplete.length === 0) return null;

    const scored = incomplete.map(task => ({ task, ...calculateTaskScore(task) }));

    scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const dueA = getDueDateTime(a.task);
        const dueB = getDueDateTime(b.task);
        if (dueA && dueB) return dueA - dueB;
        if (dueA) return -1;
        if (dueB) return  1;
        return 0;
    });

    const best = scored[0];
    return { task: best.task, score: best.score, breakdown: best.breakdown };
}

// ============================================================
// 7. EXPLAINABILITY HELPER
// ============================================================

/**
 * getRecommendationReasons(task, breakdown)
 * Returns human-readable strings explaining the recommendation.
 * Example: ["High priority", "Due today", "Marked important", "Estimated effort: 30 min"]
 */
export function getRecommendationReasons(task, breakdown) {
    const reasons = [];

    const priorityLabels = { high: "High priority", medium: "Medium priority", low: "Low priority" };
    reasons.push(priorityLabels[task.priority] ?? "Unknown priority");

    const diff = getCalendarDayDiff(task);
    if (diff === null) {
        reasons.push("No due date");
    } else {
        if      (diff < 0)    reasons.push("Overdue");
        else if (diff === 0)  reasons.push("Due today");
        else if (diff === 1)  reasons.push("Due tomorrow");
        else if (diff <= 3)   reasons.push("Due within 3 days");
        else if (diff <= 7)   reasons.push("Due within 7 days");
        else                  reasons.push("Due later");
    }

    if (task.starred) reasons.push("Marked important");

    const effortLabels = {
        "15":   "Estimated effort: 15 min",
        "30":   "Estimated effort: 30 min",
        "60":   "Estimated effort: 1 hr",
        "120":  "Estimated effort: 2 hrs",
        "180+": "Estimated effort: 3+ hrs"
    };
    const key = task.estimatedEffort ?? "30";
    reasons.push(effortLabels[key] ?? `Estimated effort: ${key} min`);

    return reasons;
}