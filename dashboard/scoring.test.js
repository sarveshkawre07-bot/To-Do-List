/**
 * scoring.test.js
 * Tests for the Task Recommendation Scoring Engine
 * Run: node scoring.test.js
 */

import { calculateTaskScore, getRecommendedTask, getRecommendationReasons } from "./scoring.js";

// ─── helpers ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label, condition) {
    if (condition) {
        console.log("  PASS:", label);
        passed++;
    } else {
        console.error("  FAIL:", label);
        failed++;
    }
}

function assertEqual(label, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) {
        console.log("  PASS:", label);
        passed++;
    } else {
        console.error("  FAIL:", label);
        console.error("    expected:", JSON.stringify(expected));
        console.error("    actual  :", JSON.stringify(actual));
        failed++;
    }
}

// ─── mock tasks ─────────────────────────────────────────────────────────────

const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
const today     = new Date();
const tomorrow  = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
const in5Days   = new Date(); in5Days.setDate(in5Days.getDate() + 5);
const in30Days  = new Date(); in30Days.setDate(in30Days.getDate() + 30);

function toDateStr(d) {
    return d.toISOString().slice(0, 10);
}

const tasks = {
    // 1. High priority + overdue  => 30 + 35 + 0 + 18 = 83
    highOverdue: {
        id: "1", title: "Overdue report", completed: false,
        priority: "high", starred: false,
        dueDate: toDateStr(yesterday), dueTime: "09:00",
        estimatedEffort: "30"
    },
    // 2. Medium priority + future due date (5 days)  => 20 + 10 + 0 + 18 = 48
    medFuture: {
        id: "2", title: "Future meeting prep", completed: false,
        priority: "medium", starred: false,
        dueDate: toDateStr(in5Days), dueTime: null,
        estimatedEffort: "30"
    },
    // 3. Important task, medium, due tomorrow  => 20 + 25 + 15 + 14 = 74
    importantTomorrow: {
        id: "3", title: "Important review", completed: false,
        priority: "medium", starred: true,
        dueDate: toDateStr(tomorrow), dueTime: "10:00",
        estimatedEffort: "60"
    },
    // 4. Short task (15 min), low, no due date  => 10 + 0 + 0 + 20 = 30
    shortNoDue: {
        id: "4", title: "Quick email", completed: false,
        priority: "low", starred: false,
        dueDate: null, dueTime: null,
        estimatedEffort: "15"
    },
    // 5. Long task (3+ hrs), high, due in 30 days  => 30 + 5 + 0 + 4 = 39
    longFarFuture: {
        id: "5", title: "Big project", completed: false,
        priority: "high", starred: false,
        dueDate: toDateStr(in30Days), dueTime: null,
        estimatedEffort: "180+"
    },
    // 6. No due date, low priority  => 10 + 0 + 0 + 18 = 28
    noDueDate: {
        id: "6", title: "Someday task", completed: false,
        priority: "low", starred: false,
        dueDate: null, dueTime: null,
        estimatedEffort: "30"
    },
    // 7. Completed — must never be recommended
    completed: {
        id: "7", title: "Done task", completed: true,
        priority: "high", starred: true,
        dueDate: toDateStr(yesterday), dueTime: "08:00",
        estimatedEffort: "15"
    },
    // 8. Missing estimatedEffort — should default to "30" => 18
    noEffort: {
        id: "8", title: "No effort field", completed: false,
        priority: "medium", starred: false,
        dueDate: toDateStr(today), dueTime: null
        // estimatedEffort intentionally omitted
    },
    // 9a. Tie task A — high, overdue, no effort => 30 + 35 + 0 + 18 = 83, due yesterday 09:00
    tieA: {
        id: "9a", title: "Tie A", completed: false,
        priority: "high", starred: false,
        dueDate: toDateStr(yesterday), dueTime: "09:00",
        estimatedEffort: "30"
    },
    // 9b. Tie task B — same score 83, due yesterday 08:00 (earlier => should win)
    tieB: {
        id: "9b", title: "Tie B", completed: false,
        priority: "high", starred: false,
        dueDate: toDateStr(yesterday), dueTime: "08:00",
        estimatedEffort: "30"
    }
};

// ─── tests ──────────────────────────────────────────────────────────────────

console.log("\n=== calculateTaskScore ===");

const s1 = calculateTaskScore(tasks.highOverdue);
assertEqual("highOverdue: score = 83", s1.score, 83);
assertEqual("highOverdue: breakdown.priority = 30", s1.breakdown.priority, 30);
assertEqual("highOverdue: breakdown.dueDate = 35",  s1.breakdown.dueDate, 35);
assertEqual("highOverdue: breakdown.important = 0", s1.breakdown.important, 0);
assertEqual("highOverdue: breakdown.effort = 18",   s1.breakdown.effort, 18);

const s2 = calculateTaskScore(tasks.importantTomorrow);
assertEqual("importantTomorrow: score = 74", s2.score, 74);
assertEqual("importantTomorrow: breakdown.important = 15", s2.breakdown.important, 15);

const s3 = calculateTaskScore(tasks.shortNoDue);
assertEqual("shortNoDue: score = 30", s3.score, 30);
assertEqual("shortNoDue: breakdown.dueDate = 0", s3.breakdown.dueDate, 0);
assertEqual("shortNoDue: breakdown.effort = 20",  s3.breakdown.effort, 20);

const s4 = calculateTaskScore(tasks.longFarFuture);
assertEqual("longFarFuture: score = 39", s4.score, 39);
assertEqual("longFarFuture: breakdown.effort = 4", s4.breakdown.effort, 4);

const s5 = calculateTaskScore(tasks.noEffort);
assertEqual("noEffort: effort defaults to 18 (30 min)", s5.breakdown.effort, 18);

console.log("\n=== getRecommendedTask ===");

// Completed task must be excluded
const recFromAll = getRecommendedTask(Object.values(tasks));
assert("completed task excluded from recommendation", recFromAll.task.id !== "7");
assert("highest score wins (highOverdue or tieA/B)", recFromAll.score === 83);

// All completed => null
const recNull = getRecommendedTask([tasks.completed]);
assertEqual("all completed => null", recNull, null);

// Empty array => null
assertEqual("empty array => null", getRecommendedTask([]), null);

// Tie-breaking: tieB has earlier due time, should win over tieA
const recTie = getRecommendedTask([tasks.tieA, tasks.tieB]);
assertEqual("tie-break: earlier due time (tieB) wins", recTie.task.id, "9b");

console.log("\n=== getRecommendationReasons ===");

const r1 = getRecommendationReasons(tasks.highOverdue, s1.breakdown);
assert("reasons includes 'High priority'",   r1.includes("High priority"));
assert("reasons includes 'Overdue'",         r1.includes("Overdue"));
assert("reasons includes effort label",      r1.includes("Estimated effort: 30 min"));
assert("completed task: no 'Marked important' reason", !r1.includes("Marked important"));

const r2 = getRecommendationReasons(tasks.importantTomorrow, s2.breakdown);
assert("importantTomorrow: reasons includes 'Marked important'", r2.includes("Marked important"));
assert("importantTomorrow: reasons includes 'Due tomorrow'",     r2.includes("Due tomorrow"));

const r3 = getRecommendationReasons(tasks.noDueDate, calculateTaskScore(tasks.noDueDate).breakdown);
assert("noDueDate: reasons includes 'No due date'", r3.includes("No due date"));

// ─── summary ────────────────────────────────────────────────────────────────

console.log("\n=== Results ===");
console.log(`Passed: ${passed}  Failed: ${failed}`);
if (failed > 0) process.exit(1);
