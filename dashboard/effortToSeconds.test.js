/**
 * effortToSeconds.test.js
 *
 * Property 7: effortToSeconds covers all defined effort values
 *
 * For each value in ["15", "30", "60", "120", "180+"] the function must
 * return the corresponding minute count multiplied by 60.
 * "180+" specifically maps to 90 minutes (5400 s), not 180 minutes.
 * Any unrecognised value must return 1500 (25 minutes fallback).
 *
 * Validates: Requirements 3.3
 *
 * Run: node dashboard/effortToSeconds.test.js
 */

// ─── Implementation under test ────────────────────────────────────────────────
// Mirrors dashboard.js exactly so this file can run in Node without
// the Firebase/DOM dependencies that surround it in the full bundle.

function effortToSeconds(effort) {
    const map = {
        "15":   900,
        "30":   1800,
        "60":   3600,
        "120":  7200,
        "180+": 5400
    };
    return map[effort] ?? 1500;
}

// ─── Minimal test helpers (same style as scoring.test.js) ─────────────────────

let passed = 0, failed = 0;

function assertEqual(label, actual, expected) {
    if (actual === expected) {
        console.log("  PASS:", label);
        passed++;
    } else {
        console.error("  FAIL:", label, "| expected:", expected, "got:", actual);
        failed++;
    }
}

function assert(label, condition) {
    if (condition) {
        console.log("  PASS:", label);
        passed++;
    } else {
        console.error("  FAIL:", label);
        failed++;
    }
}

// ─── Property 7: effortToSeconds covers all defined effort values ─────────────
// Validates: Requirements 3.3

console.log("\n── Property 7: effortToSeconds — defined effort values ──");

// Each known effort value must equal its canonical minute count × 60.
const defined = [
    { effort: "15",   minutes: 15  },
    { effort: "30",   minutes: 30  },
    { effort: "60",   minutes: 60  },
    { effort: "120",  minutes: 120 },
];

for (const { effort, minutes } of defined) {
    const expected = minutes * 60;
    assertEqual(
        `effortToSeconds("${effort}") === ${minutes} * 60 = ${expected}`,
        effortToSeconds(effort),
        expected
    );
}

// "180+" maps to 90 minutes (5400 s), NOT 180 minutes — explicit spec assertion.
assertEqual(
    'effortToSeconds("180+") === 5400  (90 min cap, not 180 min)',
    effortToSeconds("180+"),
    5400
);

// Confirm "180+" is NOT 180 * 60 = 10800.
assert(
    'effortToSeconds("180+") !== 10800  (cap is 90 min, not literal 180)',
    effortToSeconds("180+") !== 10800
);

console.log("\n── Property 7: effortToSeconds — unknown / fallback values ──");

// Any unrecognised string must return 1500 (25-minute Pomodoro default).
const unknowns = ["", "0", "25", "45", "90", "180", "240", "foo", null, undefined];
for (const u of unknowns) {
    assertEqual(
        `effortToSeconds(${JSON.stringify(u)}) falls back to 1500`,
        effortToSeconds(u),
        1500
    );
}

// ─── Additional boundary / type-safety checks ─────────────────────────────────

console.log("\n── Property 7: effortToSeconds — return type is always a number ──");

const allValues = ["15", "30", "60", "120", "180+", "unknown", "", null, undefined];
for (const v of allValues) {
    assert(
        `effortToSeconds(${JSON.stringify(v)}) returns a number`,
        typeof effortToSeconds(v) === "number"
    );
}

console.log("\n── Property 7: effortToSeconds — values are positive integers ──");

for (const v of allValues) {
    const result = effortToSeconds(v);
    assert(
        `effortToSeconds(${JSON.stringify(v)}) = ${result} is a positive integer`,
        Number.isInteger(result) && result > 0
    );
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(50)}`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
if (typeof process !== "undefined" && failed > 0) process.exit(1);
