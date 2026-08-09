/**
 * scoring.js
 * Task Recommendation Scoring Engine - USP MVP Step 8 (V2 + context-aware effort)
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
// Effort contributes to the raw score as a small nudge (0-5).
// It cannot flip a priority tier or urgency step on its own.
//
// Additionally, getRecommendedTask() uses a "close-score band":
// when two tasks are within EFFORT_BAND points of each other,
// the shorter task wins — making the recommendation feel practical.
// See EFFORT_BAND constant and the sort comparator below.
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
// 5b. EFFORT RANK  (lower = shorter = more practical)
// Used by the close-band sort in getRecommendedTask.
// ============================================================

// When two tasks score within EFFORT_BAND points of each other,
// the shorter task is recommended.
//
// 5 is chosen because:
//   - The full effort score range is only 1-5 (spread = 4 pts).
//   - The smallest priority gap is 12 pts (medium 28 -> high 40).
//   - So effort can only activate the band when priority AND urgency
//     are already equal — i.e. genuine near-ties.
const EFFORT_BAND = 5;

function getEffortRank(task) {
    // Lower rank = shorter = preferred in a close contest
    const map = { "15": 1, "30": 2, "60": 3, "120": 4, "180+": 5 };
    return map[task.estimatedEffort ?? "30"] ?? 2;
}

// ============================================================
// 6. RECOMMENDED TASK
// ============================================================

/**
 * getRecommendedTask(tasks)
 * Filters completed tasks, scores the rest, returns the best recommendation.
 * Sort order:
 *   1. If score difference > EFFORT_BAND (8 pts): higher score wins.
 *   2. Within the band: shorter estimated effort wins (context-aware).
 *   3. Same effort: earlier due date wins.
 *   4. No due date loses to a task that has one.
 * Returns null when no incomplete tasks exist.
 */
export function getRecommendedTask(tasks) {
    const incomplete = (tasks || []).filter(t => t.completed !== true);
    if (incomplete.length === 0) return null;

    const scored = incomplete.map(task => ({ task, ...calculateTaskScore(task) }));

    scored.sort((a, b) => {
        const scoreDiff = b.score - a.score;

        // Outside the close-score band: higher score wins outright.
        if (Math.abs(scoreDiff) > EFFORT_BAND) return scoreDiff;

        // Within the close-score band: prefer the shorter task.
        const effortDiff = getEffortRank(a.task) - getEffortRank(b.task);
        if (effortDiff !== 0) return effortDiff;

        // Same effort rank: fall back to earlier due date.
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