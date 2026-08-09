/**
 * scoring.test.js  -  V2 + Step 8 (context-aware effort)
 *
 * Scoring weights:
 *   Priority  0-40
 *   Due date  0-40
 *   Important 0-15
 *   Effort    0-5   (raw score nudge)
 *   Max       100
 *
 * Context-aware sort (getRecommendedTask):
 *   score diff > EFFORT_BAND(5): higher score wins outright
 *   score diff <= 5:             shorter effort wins
 *   same effort:                 earlier due date wins
 */

import { calculateTaskScore, getRecommendedTask, getRecommendationReasons } from "./scoring.js";

let passed = 0, failed = 0;
function assert(l, c) {
    if (c) { console.log("  PASS:", l); passed++; }
    else   { console.error("  FAIL:", l); failed++; }
}
function assertEqual(l, a, e) {
    const ok = JSON.stringify(a) === JSON.stringify(e);
    if (ok) { console.log("  PASS:", l); passed++; }
    else    { console.error("  FAIL:", l, "| expected:", e, "got:", a); failed++; }
}
function ds(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
}

// ─── FIXTURES ────────────────────────────────────────────────────────────────
// Scores:  priority + dueDate + important + effort
const T = {
    highOverdue:       { id:"1",  completed:false, priority:"high",   starred:false, dueDate:ds(-1), dueTime:"09:00", estimatedEffort:"30"  },  // 40+40+0+4=84
    medFuture:         { id:"2",  completed:false, priority:"medium", starred:false, dueDate:ds(5),  dueTime:null,    estimatedEffort:"30"  },  // 28+10+0+4=42
    importantTomorrow: { id:"3",  completed:false, priority:"medium", starred:true,  dueDate:ds(1),  dueTime:"10:00", estimatedEffort:"60"  },  // 28+28+15+3=74
    shortNoDue:        { id:"4",  completed:false, priority:"low",    starred:false, dueDate:null,   dueTime:null,    estimatedEffort:"15"  },  // 15+0+0+5=20
    longFarFuture:     { id:"5",  completed:false, priority:"high",   starred:false, dueDate:ds(30), dueTime:null,    estimatedEffort:"180+"},  // 40+4+0+1=45
    noDueDate:         { id:"6",  completed:false, priority:"low",    starred:false, dueDate:null,   dueTime:null,    estimatedEffort:"30"  },  // 15+0+0+4=19
    completedTask:     { id:"7",  completed:true,  priority:"high",   starred:true,  dueDate:ds(-1), dueTime:"08:00", estimatedEffort:"15"  },  // excluded
    noEffort:          { id:"8",  completed:false, priority:"medium", starred:false, dueDate:ds(0),  dueTime:null                           },  // 28+35+0+4=67 (missing->30min)
    tieA:              { id:"9a", completed:false, priority:"high",   starred:false, dueDate:ds(-1), dueTime:"09:00", estimatedEffort:"30"  },  // 84
    tieB:              { id:"9b", completed:false, priority:"high",   starred:false, dueDate:ds(-1), dueTime:"08:00", estimatedEffort:"30"  },  // 84, earlier time
    trivialShort:      { id:"10", completed:false, priority:"low",    starred:false, dueDate:null,   dueTime:null,    estimatedEffort:"15"  },  // 15+0+0+5=20
    overdueHighStarred:{ id:"11", completed:false, priority:"high",   starred:true,  dueDate:ds(-2), dueTime:null,    estimatedEffort:"30"  },  // 40+40+15+4=99
    // Step 8 fixtures
    // high+overdue+180min:    40+40+0+1 = 81   (diff vs medium+overdue+15min = 81-73=8 > BAND=5 -> score wins)
    highOverdueLong:   { id:"12", completed:false, priority:"high",   starred:false, dueDate:ds(-1), dueTime:null,    estimatedEffort:"180+"},  // 81
    // medium+overdue+15min:   28+40+0+5 = 73
    medOverdueShort:   { id:"13", completed:false, priority:"medium", starred:false, dueDate:ds(-1), dueTime:null,    estimatedEffort:"15"  },  // 73
    // medium+today+60min:     28+35+0+3 = 66   close-band pair
    medTodayLong:      { id:"14", completed:false, priority:"medium", starred:false, dueDate:ds(0),  dueTime:null,    estimatedEffort:"60"  },  // 66
    // medium+today+15min:     28+35+0+5 = 68   close-band pair
    medTodayShort:     { id:"15", completed:false, priority:"medium", starred:false, dueDate:ds(0),  dueTime:null,    estimatedEffort:"15"  },  // 68
    // low+overdue+180min:     15+40+0+1 = 56
    overdueButLong:    { id:"16", completed:false, priority:"low",    starred:false, dueDate:ds(-1), dueTime:null,    estimatedEffort:"180+"},  // 56
    // low+no-due+15min:       15+0+0+5  = 20
    nodueTrivialShort: { id:"17", completed:false, priority:"low",    starred:false, dueDate:null,   dueTime:null,    estimatedEffort:"15"  },  // 20
};

// ─── SECTION 1: calculateTaskScore (unchanged from V2) ───────────────────────
console.log("\n── calculateTaskScore totals ──");
const s1 = calculateTaskScore(T.highOverdue);
assertEqual("highOverdue score=84",        s1.score, 84);
assertEqual("highOverdue priority=40",     s1.breakdown.priority, 40);
assertEqual("highOverdue dueDate=40",      s1.breakdown.dueDate, 40);
assertEqual("highOverdue important=0",     s1.breakdown.important, 0);
assertEqual("highOverdue effort=4",        s1.breakdown.effort, 4);

const s2 = calculateTaskScore(T.importantTomorrow);
assertEqual("importantTomorrow score=74",  s2.score, 74);
assertEqual("importantTomorrow imp=15",    s2.breakdown.important, 15);

const s3 = calculateTaskScore(T.shortNoDue);
assertEqual("shortNoDue score=20",         s3.score, 20);
assertEqual("shortNoDue effort=5",         s3.breakdown.effort, 5);

const s4 = calculateTaskScore(T.longFarFuture);
assertEqual("longFarFuture score=45",      s4.score, 45);
assertEqual("longFarFuture effort=1",      s4.breakdown.effort, 1);

const s5 = calculateTaskScore(T.noEffort);
assertEqual("noEffort effort default=4",   s5.breakdown.effort, 4);
assertEqual("noEffort score=67",           s5.score, 67);

assertEqual("overdueHighStarred=99",       calculateTaskScore(T.overdueHighStarred).score, 99);
assertEqual("highOverdueLong=81",          calculateTaskScore(T.highOverdueLong).score, 81);
assertEqual("medOverdueShort=73",          calculateTaskScore(T.medOverdueShort).score, 73);
assertEqual("medTodayLong=66",             calculateTaskScore(T.medTodayLong).score, 66);
assertEqual("medTodayShort=68",            calculateTaskScore(T.medTodayShort).score, 68);

// ─── SECTION 2: V2 key correctness (unchanged assertions) ────────────────────
console.log("\n── V2 key correctness ──");
assert("high+overdue(84) > trivial-short(20)",
    calculateTaskScore(T.highOverdue).score > calculateTaskScore(T.trivialShort).score);
assert("high+overdue(84) > medium+5days(42)",
    calculateTaskScore(T.highOverdue).score > calculateTaskScore(T.medFuture).score);
assert("high+long(41) > low+short(20) — effort cannot flip priority",
    calculateTaskScore({ priority:"high", starred:false, dueDate:null, dueTime:null, estimatedEffort:"180+", completed:false }).score >
    calculateTaskScore(T.trivialShort).score);
assert("overdue dueDate score=40",
    calculateTaskScore({ priority:"low", starred:false, dueDate:ds(-1), dueTime:null, estimatedEffort:"30", completed:false }).breakdown.dueDate === 40);
assert("high+overdue(84) > medium+tomorrow+starred(74)",
    calculateTaskScore(T.highOverdue).score > calculateTaskScore(T.importantTomorrow).score);

// ─── SECTION 3: getRecommendedTask — existing tests ─────────────────────────
console.log("\n── getRecommendedTask (existing) ──");
const recAll = getRecommendedTask(Object.values(T));
assert("completed excluded", recAll.task.id !== "7");
assert("winner = overdueHighStarred (score 99)", recAll.score === 99);
assertEqual("all completed -> null", getRecommendedTask([T.completedTask]), null);
assertEqual("empty -> null",         getRecommendedTask([]), null);
// Tie: both 84, same effort (30min rank 2), tieB earlier time -> tieB wins
assertEqual("tie: tieB wins (earlier time)", getRecommendedTask([T.tieA, T.tieB]).task.id, "9b");
// Large score gap: score wins
assertEqual("highOverdue over trivialShort (large gap)", getRecommendedTask([T.trivialShort, T.highOverdue]).task.id, "1");

// ─── SECTION 4: Step 8 context-aware effort tests ────────────────────────────
console.log("\n── Step 8: context-aware effort ──");

// A) High+urgency large score gap -> score wins, effort irrelevant
// high+overdue+long(81) vs medium+overdue+short(73), diff=8 > BAND=5 -> score wins
assertEqual(
    "A) high+overdue+long(81) beats medium+overdue+short(73) — diff>band, score wins",
    getRecommendedTask([T.highOverdueLong, T.medOverdueShort]).task.id, "12"
);

// B) Close-band: same priority+urgency, differ only by effort
// medium+today+short(68) vs medium+today+long(66), diff=2 <= BAND=5 -> shorter wins
assertEqual(
    "B) close-band: medium+today+15min(68) wins over medium+today+60min(66)",
    getRecommendedTask([T.medTodayLong, T.medTodayShort]).task.id, "15"
);

// C) Overdue task beats trivial short no-due (large gap, score wins)
assertEqual(
    "C) overdue+long(56) beats no-due+short(20) — urgency dominates",
    getRecommendedTask([T.nodueTrivialShort, T.overdueButLong]).task.id, "16"
);

// D) Missing effort defaults to rank=2 (same as "30")
// medium+today+missing(67) vs medium+today+60min(66), diff=1 <= band -> effort rank
// missing->rank 2, 60min->rank 3 => missing (rank2) wins
assertEqual(
    "D) missing effort defaults to 30min rank, beats 60min in close band",
    getRecommendedTask([T.medTodayLong, T.noEffort]).task.id, "8"
);

// E) Effort cannot flip priority: high+no-due+180min(41) vs low+no-due+15min(20)
assertEqual(
    "E) effort cannot flip priority (high+long(41) vs low+short(20), diff=21 > band)",
    getRecommendedTask([T.shortNoDue, T.longFarFuture]).task.id, "5"
);

// F) Completed task never appears even when it would have highest score
const recWithCompleted = getRecommendedTask([T.completedTask, T.medTodayShort]);
assert("F) completed excluded, medTodayShort recommended", recWithCompleted !== null && recWithCompleted.task.id === "15");

// ─── SECTION 5: getRecommendationReasons ─────────────────────────────────────
console.log("\n── getRecommendationReasons ──");
const r1 = getRecommendationReasons(T.highOverdue, s1.breakdown);
assert("High priority",            r1.includes("High priority"));
assert("Overdue",                  r1.includes("Overdue"));
assert("Estimated effort: 30 min", r1.includes("Estimated effort: 30 min"));
assert("no Marked important",     !r1.includes("Marked important"));

const r2 = getRecommendationReasons(T.importantTomorrow, s2.breakdown);
assert("Marked important",         r2.includes("Marked important"));
assert("Due tomorrow",             r2.includes("Due tomorrow"));

const r3 = getRecommendationReasons(T.noDueDate, calculateTaskScore(T.noDueDate).breakdown);
assert("No due date",              r3.includes("No due date"));

// ─── SUMMARY ─────────────────────────────────────────────────────────────────
console.log(`\n${"=".repeat(40)}`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
if (typeof process !== "undefined" && failed > 0) process.exit(1);
