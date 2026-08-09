/**
 * scoring.js
 * Task Recommendation Scoring Engine - USP MVP Step 2
 *
 * Public API:
 *   calculateTaskScore(task)              -> { score, breakdown }
 *   getRecommendedTask(tasks)             -> { task, score, breakdown } | null
 *   getRecommendationReasons(task, breakdown) -> string[]
 *
 * No UI dependencies. No AI/ML. Fully deterministic.
 */

// ============================================================
// 1. PRIORITY SCORE  (0-30)
// ============================================================

function getPriorityScore(task) {
    const map = { high: 30, medium: 20, low: 10 };
    return map[task.priority] ?? 10;
}

// ============================================================
// 2. DUE-DATE SCORE  (0-35)
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
    if (diff < 0)  return 35;
    if (diff === 0) return 30;
    if (diff === 1) return 25;
    if (diff <= 3) return 18;
    if (diff <= 7) return 10;
    return 5;
}

// ============================================================
// 3. IMPORTANT SCORE  (0-15)
// ============================================================

function getImportantScore(task) {
    return task.starred === true ? 15 : 0;
}

// ============================================================
// 4. ESTIMATED EFFORT SCORE  (0-20)
// ============================================================

function getEffortScore(task) {
    const effort = task.estimatedEffort ?? "30";
    const map = { "15": 20, "30": 18, "60": 14, "120": 8, "180+": 4 };
    return map[effort] ?? 18;
}

// ============================================================
// 5. MAIN SCORING FUNCTION
// ============================================================

/**
 * calculateTaskScore(task)
 * Returns { score: number, breakdown: { priority, dueDate, important, effort } }
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