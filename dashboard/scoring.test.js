/**
 * scoring.test.js  -  V2
 * Updated for the V2 scoring weights:
 *   Priority  0-40  (was 0-30)
 *   Due date  0-40  (was 0-35)
 *   Important 0-15  (unchanged)
 *   Effort    0-5   (was 0-20)  -- secondary tiebreaker only
 *   Max       100
 */

import { calculateTaskScore, getRecommendedTask, getRecommendationReasons } from "./scoring.js";

let passed = 0, failed = 0;

function assert(label, condition) {
    if (condition) { console.log("  PASS:", label); passed++; }
    else           { console.error("  FAIL:", label); failed++; }
}
function assertEqual(label, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) { console.log("  PASS:", label); passed++; }
    else    { console.error("  FAIL:", label, "| expected:", expected, "got:", actual); failed++; }
}

// ─── date helpers ────────────────────────────────────────────────────────────
function ds(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
}

// ─── mock tasks ──────────────────────────────────────────────────────────────
// Scores annotated with new weights:
//   priority  high=40  medium=28  low=15
//   dueDate   overdue=40 today=35 tomorrow=28 <=3d=18 <=7d=10 later=4  none=0
//   important starred=15
//   effort    15min=5  30min=4  60min=3  120min=2  180+=1  missing->4

const T = {
    // high + overdue + 30min  =>  40+40+0+4 = 84
    highOverdue: {
        id:"1", completed:false, priority:"high", starred:false,
        dueDate:ds(-1), dueTime:"09:00", estimatedEffort:"30"
    },
    // medium + 5 days + 30min  =>  28+10+0+4 = 42
    medFuture: {
        id:"2", completed:false, priority:"medium", starred:false,
        dueDate:ds(5),  dueTime:null,    estimatedEffort:"30"
    },
    // medium + tomorrow + starred + 60min  =>  28+28+15+3 = 74
    importantTomorrow: {
        id:"3", completed:false, priority:"medium", starred:true,
        dueDate:ds(1),  dueTime:"10:00", estimatedEffort:"60"
    },
    // low + no due + 15min  =>  15+0+0+5 = 20
    shortNoDue: {
        id:"4", completed:false, priority:"low",    starred:false,
        dueDate:null,   dueTime:null,    estimatedEffort:"15"
    },
    // high + 30 days + 180+  =>  40+4+0+1 = 45
    longFarFuture: {
        id:"5", completed:false, priority:"high",   starred:false,
        dueDate:ds(30), dueTime:null,    estimatedEffort:"180+"
    },
    // low + no due + 30min  =>  15+0+0+4 = 19
    noDueDate: {
        id:"6", completed:false, priority:"low",    starred:false,
        dueDate:null,   dueTime:null,    estimatedEffort:"30"
    },
    // completed -- must never appear
    completedTask: {
        id:"7", completed:true,  priority:"high",   starred:true,
        dueDate:ds(-1), dueTime:"08:00", estimatedEffort:"15"
    },
    // medium + today + no effort => effort defaults to 4  =>  28+35+0+4 = 67
    noEffort: {
        id:"8", completed:false, priority:"medium", starred:false,
        dueDate:ds(0),  dueTime:null
    },
    // tie A: high + overdue + 30min + 09:00  =>  40+40+0+4 = 84
    tieA: {
        id:"9a", completed:false, priority:"high", starred:false,
        dueDate:ds(-1), dueTime:"09:00", estimatedEffort:"30"
    },
    // tie B: same score 84, due 08:00 (earlier) => should win
    tieB: {
        id:"9b", completed:false, priority:"high", starred:false,
        dueDate:ds(-1), dueTime:"08:00", estimatedEffort:"30"
    },
    // KEY V2 TEST: low-priority 15min no-due => 15+0+0+5 = 20
    // must NOT beat high-priority overdue task (84)
    trivialShort: {
        id:"10", completed:false, priority:"low", starred:false,
        dueDate:null, dueTime:null, estimatedEffort:"15"
    },
    // overdue high starred => 40+40+15+4 = 99
    overdueHighStarred: {
        id:"11", completed:false, priority:"high", starred:true,
        dueDate:ds(-2), dueTime:null, estimatedEffort:"30"
    }
};

// ─── Section 1: Individual component scores ───────────────────────────────────
console.log("\n── Priority scoring ──");
assertEqual("high   -> 40", getPriorityScore_test(T.highOverdue), 40);
assertEqual("medium -> 28", getPriorityScore_test(T.medFuture),   28);
assertEqual("low    -> 15", getPriorityScore_test(T.shortNoDue),  15);
assertEqual("missing-> 15", getPriorityScore_test({}),            15);

function getPriorityScore_test(task) {
    const map = { high: 40, medium: 28, low: 15 };
    return map[task.priority] ?? 15;
}
function getEffortScore_test(task) {
    const effort = task.estimatedEffort ?? "30";
    const map = { "15": 5, "30": 4, "60": 3, "120": 2, "180+": 1 };
    return map[effort] ?? 4;
}

console.log("\n── Effort scoring (secondary only) ──");
assertEqual('"15"   -> 5', getEffortScore_test(T.shortNoDue),  5);
assertEqual('"30"   -> 4', getEffortScore_test(T.highOverdue), 4);
assertEqual('"60"   -> 3', getEffortScore_test(T.importantTomorrow), 3);
assertEqual('"120"  -> 2', getEffortScore_test({estimatedEffort:"120"}), 2);
assertEqual('"180+" -> 1', getEffortScore_test(T.longFarFuture), 1);
assertEqual("missing-> 4 (default 30min)", getEffortScore_test(T.noEffort), 4);

// ─── Section 2: calculateTaskScore totals ─────────────────────────────────────
console.log("\n── calculateTaskScore totals ──");

const s1 = calculateTaskScore(T.highOverdue);
assertEqual("highOverdue: score = 84",             s1.score,              84);
assertEqual("highOverdue: priority = 40",          s1.breakdown.priority, 40);
assertEqual("highOverdue: dueDate  = 40",          s1.breakdown.dueDate,  40);
assertEqual("highOverdue: important = 0",          s1.breakdown.important, 0);
assertEqual("highOverdue: effort   = 4",           s1.breakdown.effort,    4);

const s2 = calculateTaskScore(T.importantTomorrow);
assertEqual("importantTomorrow: score = 74",       s2.score, 74);
assertEqual("importantTomorrow: important = 15",   s2.breakdown.important, 15);

const s3 = calculateTaskScore(T.shortNoDue);
assertEqual("shortNoDue: score = 20",              s3.score, 20);
assertEqual("shortNoDue: dueDate = 0",             s3.breakdown.dueDate, 0);
assertEqual("shortNoDue: effort  = 5",             s3.breakdown.effort,  5);

const s4 = calculateTaskScore(T.longFarFuture);
assertEqual("longFarFuture: score = 45",           s4.score, 45);
assertEqual("longFarFuture: effort = 1",           s4.breakdown.effort,   1);

const s5 = calculateTaskScore(T.noEffort);
assertEqual("noEffort: effort defaults to 4",      s5.breakdown.effort,   4);
assertEqual("noEffort: score = 67",                s5.score, 67);

const s6 = calculateTaskScore(T.overdueHighStarred);
assertEqual("overdueHighStarred: score = 99",      s6.score, 99);

// ─── Section 3: V2 KEY TESTS ──────────────────────────────────────────────────
console.log("\n── V2 key correctness tests ──");

// Test A: trivial 15min low-priority task must NOT beat high-priority overdue
assert(
    "high+overdue(84) beats trivial short low-priority(20)",
    calculateTaskScore(T.highOverdue).score > calculateTaskScore(T.trivialShort).score
);

// Test B: high+overdue beats medium+future even with shorter effort
assert(
    "high+overdue(84) beats medium+5days(42)",
    calculateTaskScore(T.highOverdue).score > calculateTaskScore(T.medFuture).score
);

// Test C: effort alone cannot elevate a low-priority task above high-priority
const lowShort  = calculateTaskScore({ priority:"low",  starred:false, dueDate:null, dueTime:null, estimatedEffort:"15", completed:false });
const highLong  = calculateTaskScore({ priority:"high", starred:false, dueDate:null, dueTime:null, estimatedEffort:"180+", completed:false });
assert(
    "high+long-effort(41) beats low+short-effort(20) — effort cannot flip priority",
    highLong.score > lowShort.score
);

// Test D: overdue task is a strong candidate
assert(
    "overdue score (40) is max due-date score",
    calculateTaskScore({ priority:"low", starred:false, dueDate:ds(-1), dueTime:null, estimatedEffort:"30", completed:false }).breakdown.dueDate === 40
);

// Test E: starred meaningful but cannot beat overdue high-priority
assert(
    "overdue high-priority(84) beats tomorrow medium-starred(74)",
    calculateTaskScore(T.highOverdue).score > calculateTaskScore(T.importantTomorrow).score
);

// ─── Section 4: getRecommendedTask ────────────────────────────────────────────
console.log("\n── getRecommendedTask ──");

const recAll = getRecommendedTask(Object.values(T));
assert("completed task excluded", recAll.task.id !== "7");
assert("winner has highest score (99 — overdueHighStarred)", recAll.score === 99);

assertEqual("all completed -> null", getRecommendedTask([T.completedTask]), null);
assertEqual("empty array -> null",   getRecommendedTask([]),               null);

// Tie-breaking: tieB (08:00) beats tieA (09:00) at equal score
const recTie = getRecommendedTask([T.tieA, T.tieB]);
assertEqual("tie: earlier due time (tieB 08:00) wins", recTie.task.id, "9b");

// trivialShort must not be recommended over highOverdue
const recVsTrivia = getRecommendedTask([T.trivialShort, T.highOverdue]);
assertEqual("highOverdue recommended over trivialShort", recVsTrivia.task.id, "1");

// ─── Section 5: getRecommendationReasons ─────────────────────────────────────
console.log("\n── getRecommendationReasons ──");

const r1 = getRecommendationReasons(T.highOverdue, s1.breakdown);
assert("highOverdue: High priority",           r1.includes("High priority"));
assert("highOverdue: Overdue",                 r1.includes("Overdue"));
assert("highOverdue: Estimated effort: 30 min",r1.includes("Estimated effort: 30 min"));
assert("highOverdue: no Marked important",    !r1.includes("Marked important"));

const r2 = getRecommendationReasons(T.importantTomorrow, s2.breakdown);
assert("importantTomorrow: Marked important",  r2.includes("Marked important"));
assert("importantTomorrow: Due tomorrow",      r2.includes("Due tomorrow"));

const r3 = getRecommendationReasons(T.noDueDate, calculateTaskScore(T.noDueDate).breakdown);
assert("noDueDate: No due date",               r3.includes("No due date"));

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${"=".repeat(40)}`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
if (typeof process !== "undefined" && failed > 0) process.exit(1);
