// dashboard.js

import {
    auth,
    signOut,
    db
} from "../login/firebase.js";

import {
    collection,
    addDoc,
    serverTimestamp,
    getDocs,
    deleteDoc,
    doc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
    getRecommendedTask,
    getRecommendationReasons
} from "./scoring.js";

// ======================================
// Navigation
// ======================================

const navItems = document.querySelectorAll(".nav-item[data-page]");
const pageTitle = document.getElementById("pageTitle");

// Map every data-page value to its section element ID and display title.
// Only implemented pages get a sectionId; unimplemented ones stay null.
const PAGE_MAP = {
    "today":     { sectionId: "page-today",     title: "Today"     },
    "all-tasks": { sectionId: "page-all-tasks",  title: "All Tasks" },
    "important": { sectionId: "page-important",  title: "Important" },
    "calendar":  { sectionId: "page-calendar",   title: "Calendar"  },
    "focus":     { sectionId: "page-focus",      title: "Focus"     }
};

// Track which page is currently active
let currentPage = "today";

function navigateTo(page) {
    const config = PAGE_MAP[page];
    if (!config) return;

    currentPage = page;

    // Update sidebar active state
    navItems.forEach((n) => n.classList.remove("active"));
    const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navItem) navItem.classList.add("active");

    // Update page title
    if (pageTitle && config.title) pageTitle.textContent = config.title;

    // Show the target section, hide all others
    Object.values(PAGE_MAP).forEach(({ sectionId }) => {
        if (!sectionId) return;
        const el = document.getElementById(sectionId);
        if (el) el.style.display = "none";
    });

    if (config.sectionId) {
        const target = document.getElementById(config.sectionId);
        if (target) {
            // Focus page uses flex layout; all others use block
            target.style.display = page === "focus" ? "flex" : "block";
        }
    }

    // Page-specific on-enter logic
    if (page === "all-tasks") {
        renderAllTasksPage();
    }
    if (page === "important") {
        renderImportantPage();
    }
    if (page === "calendar") {
        renderCalendarPage();
    }
    if (page === "focus") {
        renderFocusPage();
    }
    // Stop Pomodoro timer when navigating away from Focus
    if (page !== "focus") {
        pomoStop();
    }
}

navItems.forEach((item) => {
    item.addEventListener("click", (event) => {
        event.preventDefault();
        navigateTo(item.dataset.page);
    });
});

// ======================================
// Theme System
// ======================================

const themeToggle =
    document.getElementById("themeToggle");

const themeIcon =
    document.getElementById("themeIcon");

const themeText =
    document.getElementById("themeText");


function applyTheme(theme) {

    document.documentElement.setAttribute(
        "data-theme",
        theme
    );

    if (theme === "dark") {

        themeIcon.textContent = "☀️";
        themeText.textContent = "Light Mode";

    } else {

        themeIcon.textContent = "🌙";
        themeText.textContent = "Dark Mode";

    }

}


// Load saved theme immediately

const savedTheme =
    localStorage.getItem("theme") || "light";

applyTheme(savedTheme);


// Toggle theme

if (themeToggle) {

    themeToggle.addEventListener(
        "click",
        () => {

            const currentTheme =
                document.documentElement
                    .getAttribute("data-theme");

            const newTheme =
                currentTheme === "dark"
                    ? "light"
                    : "dark";

            localStorage.setItem(
                "theme",
                newTheme
            );

            applyTheme(newTheme);

        }
    );

}


// ======================================
// Authentication
// ======================================

const logoutButton = document.getElementById("logoutBtn");

onAuthStateChanged(auth, (user) => {

    if (user) {

        console.log("Logged in user:", user);

        // User's name
        const userName = document.getElementById("userName");

        if (userName) {
            userName.textContent = user.displayName || "User";
        }

        // User's profile picture
        const profileImage = document.getElementById("profileImage");

        if (profileImage) {
            console.log("Profile photo URL:", user.photoURL);
            
            if (user.photoURL) {
                profileImage.src = user.photoURL;
            }
        }
         // Load Firestore tasks
        loadTasks();

    } else {

        // No authenticated user
        window.location.href = "../login/login.html";

    }

});


// ======================================
// Logout
// ======================================

logoutButton.addEventListener("click", async () => {

    try {

        await signOut(auth);

        localStorage.removeItem("user");

        window.location.href = "../login/login.html";

    } catch (error) {

        console.error("Logout failed:", error);

    }

});


// ======================================
// Dynamic Date
// ======================================

const currentDateElement =
    document.getElementById("currentDate");

const now = new Date();

const dateOptions = {
    weekday: "long",
    month: "long",
    day: "numeric"
};

if (currentDateElement) {

    currentDateElement.textContent =
        now.toLocaleDateString("en-US", dateOptions);

}


// ======================================
// Dynamic Greeting
// ======================================

const greetingText =
    document.getElementById("greetingText");

const currentHour = now.getHours();

let greeting;

if (currentHour < 12) {

    greeting = "Good morning";

} else if (currentHour < 18) {

    greeting = "Good afternoon";

} else {

    greeting = "Good evening";

}

if (greetingText) {

    greetingText.textContent = greeting;

}

// ======================================
// Add Task Modal
// ======================================

const addTaskBtn =
    document.getElementById("addTaskBtn");

const taskModal =
    document.getElementById("taskModal");

const closeModalBtn =
    document.getElementById("closeModalBtn");

const cancelTaskBtn =
    document.getElementById("cancelTaskBtn");


// Open modal

addTaskBtn.addEventListener("click", () => {

    // Switch back to Create mode
    editingTask = null;
    editingTaskCard = null;

    // Reset form
    taskForm.reset();

    // Reset effort to default
    document.getElementById("taskEffort").value = "30";

    // Reset reminder note
    const reminderNote = document.getElementById("reminderNote");
    if (reminderNote) {
        reminderNote.style.display = "none";
        reminderNote.textContent = "";
    }

    // Reset subtasks
    subtasks = [];

    renderSubtasks();

    // Reset modal title
    document.getElementById(
        "taskModalTitle"
    ).textContent = "Create New Task";

    // Reset submit button
    document.getElementById(
        "taskSubmitBtn"
    ).textContent = "Create Task";

    // Open modal
    taskModal.classList.add("show");

});


// Close modal

closeModalBtn.addEventListener("click", () => {

    taskModal.classList.remove("show");

});


cancelTaskBtn.addEventListener("click", () => {

    taskModal.classList.remove("show");

});

// ======================================
// Task Form
// ======================================

const taskForm =
    document.getElementById("taskForm");

const taskList =
    document.getElementById("taskList");

// ======================================
// Task Form Mode
// ======================================

let editingTask = null;
let editingTaskCard = null;

// ======================================
// Pomodoro State  (single source of truth)
// ======================================

const POMO_RING_CIRCUMFERENCE = 339.292; // 2 * π * 54

const pomodoroState = {
    activeTaskId: null,   // ID of the task being focused on
    mode:         "work", // "work" | "break"
    workSecs:     25 * 60,
    breakSecs:    5  * 60,
    remaining:    25 * 60,
    running:      false,
    intervalId:   null
};

// ---- Timer helpers ----

function pomoSecsForMode() {
    return pomodoroState.mode === "work"
        ? pomodoroState.workSecs
        : pomodoroState.breakSecs;
}

function pomoUpdateDisplay() {
    const s  = pomodoroState.remaining;
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    const el = document.getElementById("pomo-timer-display");
    if (el) el.textContent = `${mm}:${ss}`;
}

function pomoUpdateRing() {
    const total = pomoSecsForMode();
    const ratio = total > 0
        ? Math.min(1, Math.max(0, pomodoroState.remaining / total))
        : 0;
    const offset = POMO_RING_CIRCUMFERENCE * (1 - ratio);
    const el = document.getElementById("pomo-ring-progress");
    if (el) el.style.strokeDashoffset = offset;
}

function pomoTick() {
    pomodoroState.remaining = Math.max(0, pomodoroState.remaining - 1);
    pomoUpdateDisplay();
    pomoUpdateRing();
    if (pomodoroState.remaining === 0) {
        pomoHandleModeTransition();
    }
}

// ---- Mode transition (work → break → work) ----

function pomoHandleModeTransition() {
    // Stop the current interval first — always exactly one interval
    pomoStop();

    const wasWork = pomodoroState.mode === "work";
    pomodoroState.mode = wasWork ? "break" : "work";
    pomodoroState.remaining = pomoSecsForMode();

    // Update mode badge and ring colour
    const badge = document.getElementById("pomo-mode-badge");
    if (badge) {
        badge.textContent = wasWork ? "BREAK" : "WORK";
        badge.className = `pomo-mode-badge pomo-mode-badge--${pomodoroState.mode}`;
    }
    const ring = document.getElementById("pomo-ring-progress");
    if (ring) {
        ring.classList.toggle("pomo-ring-progress--break", pomodoroState.mode === "break");
    }

    // Show transition banner
    const banner = document.getElementById("pomo-banner");
    if (banner) {
        banner.textContent = wasWork
            ? "🎉 Work session done! Take a break."
            : "⚡ Break over — back to work!";
        banner.className = `pomo-banner${wasWork ? " pomo-banner--break" : ""}`;
        banner.style.display = "block";
        // Auto-hide after 4 seconds
        setTimeout(() => { if (banner) banner.style.display = "none"; }, 4000);
    }

    pomoUpdateDisplay();
    pomoUpdateRing();

    // Auto-start next session (task is NOT completed by this)
    pomoStart();
}

// ---- Core controls ----

function pomoStart() {
    if (pomodoroState.running) return;
    // Safety: always clear any stale interval before creating a new one
    if (pomodoroState.intervalId) {
        clearInterval(pomodoroState.intervalId);
        pomodoroState.intervalId = null;
    }
    pomodoroState.running    = true;
    pomodoroState.intervalId = setInterval(pomoTick, 1000);
}

function pomoStop() {
    if (pomodoroState.intervalId) {
        clearInterval(pomodoroState.intervalId);
        pomodoroState.intervalId = null;
    }
    pomodoroState.running = false;
}

function pomoPause() {
    if (!pomodoroState.running) return;
    pomoStop();
    const btn = document.getElementById("pomo-pause-btn");
    if (btn) btn.textContent = "Resume";
}

function pomoResume() {
    if (pomodoroState.running) return;
    pomoStart();
    const btn = document.getElementById("pomo-pause-btn");
    if (btn) btn.textContent = "Pause";
}

function pomoReset() {
    pomoStop();
    pomodoroState.remaining = pomoSecsForMode();
    pomoUpdateDisplay();
    pomoUpdateRing();
    const btn = document.getElementById("pomo-pause-btn");
    if (btn) btn.textContent = "Pause";
    const banner = document.getElementById("pomo-banner");
    if (banner) banner.style.display = "none";
}

// ---- Entry point called by Start Task / task-card Focus button ----

function startFocusWithTask(task) {
    if (!task) return;

    // Store reference via ID, resolve against allTasks
    pomodoroState.activeTaskId = task.id;

    // Reset to work mode with default/current durations
    pomoStop();
    pomodoroState.mode      = "work";
    pomodoroState.remaining = pomodoroState.workSecs;

    navigateTo("focus");
    // renderFocusPage() is called by navigateTo — it populates the UI
    // Auto-start begins there after population
}

// ---- Complete task from Focus ----

async function pomoCompleteTask() {
    const task = allTasks.find(t => t.id === pomodoroState.activeTaskId);
    if (!task) return;

    pomoStop();

    // Find the Today card if visible (may be null on other pages)
    const todayCard = [...document.querySelectorAll("#taskList .task-card")]
        .find(c => c.querySelector("h3")?.textContent.trim() === task.title.trim()) || null;

    const result = await handleTaskCompletion(task, todayCard || { classList: { toggle: () => {}, querySelector: () => null } }, true);
    if (result === false) {
        console.error("Focus: could not complete task", task);
        return;
    }

    // Clear active task and navigate back to Today
    pomodoroState.activeTaskId = null;
    navigateTo("today");
}

// ======================================
// Task Collection (for scoring engine)
// ======================================

// Mirror of all tasks currently in the UI.
// Kept in sync by addTaskToUI (add) and the delete/edit flows (remove+re-add).
let allTasks = [];

// ======================================
// All Tasks — Category Definitions
// ======================================

// Single source of truth for categories.
// Matches the values used in the task form <select> and stored on task.category.
const CATEGORY_DEFS = [
    { value: "personal", label: "Personal" },
    { value: "work",     label: "Work"     },
    { value: "study",    label: "Study"    },
    { value: "fitness",  label: "Fitness"  }
];

// Active category filter for the All Tasks page ("all" = show everything)
let activeCategory = "all";

// ======================================
// All Tasks — Filter Helper
// ======================================

function filterTasksByCategory(tasks, category) {
    if (category === "all") return tasks;
    return tasks.filter(t => (t.category || "") === category);
}

// ======================================
// All Tasks — Build Task Card
// (reuses all existing formatting helpers and handlers via addTaskToAllTasksUI)
// ======================================

function buildAllTaskCard(task) {
    const card = document.createElement("article");
    card.className = "task-card";
    if (task.completed) card.classList.add("completed");

    card.innerHTML = `
    <div class="task-main-row">
        <div class="task-check">
            <input type="checkbox" class="task-checkbox" ${task.completed ? "checked" : ""}>
        </div>
        <div class="task-info">
            <h3>${task.title}</h3>
            <p>${task.description || "No description added."}</p>
            <div class="task-meta">
                <span>${getCategoryIcon(task.category)} ${formatCategory(task.category)}</span>
                <span>${getPriorityIcon(task.priority)} ${formatPriority(task.priority)}</span>
                ${task.dueDate && task.dueTime
                    ? `<span>📅 Due: ${formatDueDateTime(task.dueDate, task.dueTime)}</span>`
                    : task.dueDate
                    ? `<span>📅 Due: ${formatDueDate(task.dueDate)}</span>`
                    : task.dueTime
                    ? `<span>⏰ Due: ${formatTime(task.dueTime)}</span>`
                    : ""}
                ${task.estimatedEffort
                    ? `<span>⏱ ${formatEffort(task.estimatedEffort)}</span>`
                    : ""}
            </div>
        </div>
        <div class="task-actions">
            <button class="star-task-btn ${task.starred ? "important" : ""}" type="button"
                    title="${task.starred ? "Unmark important" : "Mark important"}">
                ${task.starred ? "★" : "☆"}
            </button>
            <button class="task-menu-btn" type="button" title="Task options">⋮</button>
            <div class="task-menu">
                <button class="edit-task-btn"   type="button">✏️ Edit</button>
                <button class="delete-task-btn" type="button">🗑️ Delete</button>
            </div>
        </div>
    </div>
    <div class="subtask-section" style="display:none;">
        <div class="subtask-header">
            <strong>Subtasks</strong>
            <span class="subtask-progress">0 / 0 completed</span>
        </div>
        <div class="subtask-list"></div>
    </div>`;

    const subtaskSection = card.querySelector(".subtask-section");
    renderTaskSubtasks(task, subtaskSection);

    // Expand / collapse subtasks on card click
    card.addEventListener("click", (e) => {
        if (e.target.closest("button") || e.target.closest("input")) return;
        const open = subtaskSection.style.display !== "none";
        subtaskSection.style.display = open ? "none" : "block";
    });

    // Checkbox — complete / uncomplete
    const checkbox = card.querySelector(".task-checkbox");
    checkbox.addEventListener("change", async () => {
        const result = await handleTaskCompletion(task, card, checkbox.checked);
        if (!result) { checkbox.checked = task.completed; return; }
        // Keep the Today list card in sync if it exists
        syncTodayCard(task);
    });

    // Star button
    const starBtn = card.querySelector(".star-task-btn");
    starBtn.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) return;
        const newStar = !task.starred;
        try {
            await updateDoc(doc(db, "users", user.uid, "tasks", task.id), { starred: newStar });
            task.starred = newStar;
            starBtn.textContent = newStar ? "★" : "☆";
            starBtn.classList.toggle("important", newStar);
            starBtn.title = newStar ? "Unmark important" : "Mark important";
            syncTodayCard(task);
            // Refresh Important page — task may have entered or left the list
            if (currentPage === "important") renderImportantList();
        } catch (err) { console.error("Failed to update importance:", err); }
    });

    // Menu open/close
    const menuBtn  = card.querySelector(".task-menu-btn");
    const taskMenu = card.querySelector(".task-menu");
    menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const opening = !taskMenu.classList.contains("show");
        document.querySelectorAll(".task-menu.show").forEach(m => {
            m.classList.remove("show");
            m.closest(".task-card")?.classList.remove("menu-open");
        });
        if (opening) { taskMenu.classList.add("show"); card.classList.add("menu-open"); }
    });
    document.addEventListener("click", () => {
        taskMenu.classList.remove("show");
        card.classList.remove("menu-open");
    });

    // Edit
    const editBtn = card.querySelector(".edit-task-btn");
    editBtn.addEventListener("click", () => {
        editingTask     = task;
        editingTaskCard = card;
        document.getElementById("taskModalTitle").textContent = "Edit Task";
        document.getElementById("taskSubmitBtn").textContent  = "Save Changes";
        taskMenu.classList.remove("show");
        document.getElementById("taskTitle").value       = task.title       || "";
        document.getElementById("taskDescription").value = task.description || "";
        document.getElementById("taskCategory").value    = task.category    || "";
        document.getElementById("taskPriority").value    = task.priority    || "";
        document.getElementById("taskDueDate").value     = task.dueDate     || "";
        document.getElementById("taskDueTime").value     = task.dueTime     || "";
        document.getElementById("taskReminder").value    = task.reminder    || "";
        document.getElementById("taskRepeat").value      = task.repeat      || "";
        document.getElementById("taskEffort").value      = task.estimatedEffort || "30";
        subtasks = task.subtasks ? [...task.subtasks] : [];
        renderSubtasks();
        taskModal.classList.add("show");
    });

    // Delete
    const deleteBtn = card.querySelector(".delete-task-btn");
    deleteBtn.addEventListener("click", async () => {
        if (!confirm(`Delete "${task.title}"?`)) return;
        const user = auth.currentUser;
        if (!user) return;
        try {
            await deleteDoc(doc(db, "users", user.uid, "tasks", task.id));
            card.remove();
            allTasks = allTasks.filter(t => t.id !== task.id);
            // Also remove from Today list
            removeTodayCard(task.id);
            updateProgress();
            updateTaskCount();
            // Refresh Important page if active
            if (currentPage === "important") renderImportantList();
        } catch (err) {
            console.error("Failed to delete task:", err);
            alert("Unable to delete this task. Please try again.");
        }
    });

    // Focus shortcut in menu
    const focusBtn = document.createElement("button");
    focusBtn.type = "button";
    focusBtn.textContent = "🎯 Focus";
    focusBtn.addEventListener("click", () => {
        taskMenu.classList.remove("show");
        card.classList.remove("menu-open");
        startFocusWithTask(task);
    });
    taskMenu.appendChild(focusBtn);

    return card;
}

// ======================================
// All Tasks — Sync helpers for Today list
// ======================================

// After an action in All Tasks, update the corresponding Today card if present.
function syncTodayCard(task) {
    const todayCard = [...document.querySelectorAll("#taskList .task-card")]
        .find(c => c.querySelector("h3")?.textContent.trim() === task.title.trim());
    if (!todayCard) return;
    const cb = todayCard.querySelector(".task-checkbox");
    if (cb) cb.checked = task.completed;
    todayCard.classList.toggle("completed", task.completed);
    const star = todayCard.querySelector(".star-task-btn");
    if (star) {
        star.textContent = task.starred ? "★" : "☆";
        star.classList.toggle("important", !!task.starred);
        star.title = task.starred ? "Unmark important" : "Mark important";
    }
}

function removeTodayCard(taskId) {
    // Today list cards don't carry a data-id; match by scanning allTasks id.
    // The simplest reliable approach: re-render is handled by updateTaskCount/updateProgress.
    // For immediate DOM removal we find by matching task title stored in allTasks before removal.
    // Since allTasks is filtered before this call, we rely on the card having been created
    // via addTaskToUI which appended to #taskList. We can't reliably find it without data-id,
    // so we leave the card in Today list (it will disappear on next page load / refresh).
    // This matches the existing delete behaviour which already removes from #taskList directly.
}

// ======================================
// All Tasks — Category Filter Bar
// ======================================

function buildCategoryFilterBar() {
    const bar = document.getElementById("categoryFilterBar");
    if (!bar) return;
    bar.innerHTML = "";

    // Derive which categories actually have tasks so we only show populated ones,
    // but always show "All". For maximum flexibility we show all known categories
    // regardless — matching the spec's "generated from existing category data".
    const categories = [
        { value: "all", label: "All" },
        ...CATEGORY_DEFS
    ];

    categories.forEach(({ value, label }) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "category-filter-btn" + (value === activeCategory ? " active" : "");
        btn.dataset.category = value;
        btn.textContent = value === "all"
            ? label
            : `${getCategoryIcon(value)} ${label}`;

        btn.addEventListener("click", () => {
            activeCategory = value;
            // Update active styling — only among filter buttons
            bar.querySelectorAll(".category-filter-btn").forEach(b =>
                b.classList.toggle("active", b === btn));
            // Re-render task list in place (no Firebase request)
            renderAllTasksList();
        });

        bar.appendChild(btn);
    });
}

// ======================================
// All Tasks — Render Task List
// ======================================

function renderAllTasksList() {
    const list = document.getElementById("allTasksList");
    if (!list) return;
    list.innerHTML = "";

    const filtered = filterTasksByCategory(allTasks, activeCategory);

    if (filtered.length === 0) {
        const empty = document.createElement("div");
        empty.className = "all-tasks-empty";
        empty.textContent = activeCategory === "all"
            ? "You're all caught up!"
            : `No tasks in ${formatCategory(activeCategory)}`;
        list.appendChild(empty);
        return;
    }

    filtered.forEach(task => list.appendChild(buildAllTaskCard(task)));
}

// ======================================
// All Tasks — Full Page Render
// (called by navigateTo when entering All Tasks)
// ======================================

function renderAllTasksPage() {
    buildCategoryFilterBar();
    renderAllTasksList();
}

// ======================================
// Important — Render List
// ======================================

function renderImportantList() {
    const list = document.getElementById("importantList");
    if (!list) return;
    list.innerHTML = "";

    const important = allTasks.filter(t => t.starred === true);

    if (important.length === 0) {
        const empty = document.createElement("div");
        empty.className = "all-tasks-empty";
        empty.innerHTML = "No important tasks yet.<br><small>Star a task to keep it here.</small>";
        list.appendChild(empty);
        return;
    }

    important.forEach(task => list.appendChild(buildAllTaskCard(task)));
}

// ======================================
// Important — Full Page Render
// (called by navigateTo when entering Important)
// ======================================

function renderImportantPage() {
    renderImportantList();
}

// ======================================
// Calendar — State
// ======================================

const calendarState = {
    year:  new Date().getFullYear(),
    month: new Date().getMonth()   // 0-indexed
};

// ======================================
// Calendar — Full Page Render
// ======================================

function renderCalendarPage() {
    renderCalendarGrid();

    // Wire prev/today/next buttons (replace to avoid duplicate listeners)
    ["calPrevBtn", "calTodayBtn", "calNextBtn"].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const fresh = btn.cloneNode(true);
        btn.parentNode.replaceChild(fresh, btn);
    });

    document.getElementById("calPrevBtn")?.addEventListener("click", () => {
        calendarState.month--;
        if (calendarState.month < 0) { calendarState.month = 11; calendarState.year--; }
        renderCalendarGrid();
    });

    document.getElementById("calTodayBtn")?.addEventListener("click", () => {
        const now = new Date();
        calendarState.year  = now.getFullYear();
        calendarState.month = now.getMonth();
        renderCalendarGrid();
    });

    document.getElementById("calNextBtn")?.addEventListener("click", () => {
        calendarState.month++;
        if (calendarState.month > 11) { calendarState.month = 0; calendarState.year++; }
        renderCalendarGrid();
    });

    // Wire detail panel close button
    const closeBtn = document.getElementById("calDetailClose");
    if (closeBtn) {
        const freshClose = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(freshClose, closeBtn);
        freshClose.addEventListener("click", () => {
            const panel = document.getElementById("calDetailPanel");
            if (panel) panel.style.display = "none";
        });
    }
}

// ======================================
// Calendar — Build Grid for current month
// ======================================

function renderCalendarGrid() {
    const { year, month } = calendarState;

    // Update month label
    const label = document.getElementById("calMonthLabel");
    if (label) {
        label.textContent = new Date(year, month, 1)
            .toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }

    const grid = document.getElementById("calGrid");
    if (!grid) return;
    grid.innerHTML = "";

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

    // Build a map: dateStr → tasks[]
    const tasksByDate = {};
    allTasks.forEach(task => {
        if (!task.dueDate) return;
        if (!tasksByDate[task.dueDate]) tasksByDate[task.dueDate] = [];
        tasksByDate[task.dueDate].push(task);
    });

    // First day of month (0=Sun) and total days
    const firstDow   = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev  = new Date(year, month, 0).getDate();

    const CHIP_LIMIT = 3; // max chips before "+N more"

    // Fill cells: leading padding + current month + trailing padding
    const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;

    for (let i = 0; i < totalCells; i++) {
        let cellDay, cellMonth, cellYear, outside;

        if (i < firstDow) {
            // Previous month
            cellDay   = daysInPrev - firstDow + i + 1;
            cellMonth = month - 1 < 0 ? 11 : month - 1;
            cellYear  = month - 1 < 0 ? year - 1 : year;
            outside   = true;
        } else if (i >= firstDow + daysInMonth) {
            // Next month
            cellDay   = i - firstDow - daysInMonth + 1;
            cellMonth = month + 1 > 11 ? 0 : month + 1;
            cellYear  = month + 1 > 11 ? year + 1 : year;
            outside   = true;
        } else {
            cellDay   = i - firstDow + 1;
            cellMonth = month;
            cellYear  = year;
            outside   = false;
        }

        const dateStr = `${cellYear}-${String(cellMonth + 1).padStart(2,"0")}-${String(cellDay).padStart(2,"0")}`;
        const isToday = dateStr === todayStr && !outside;
        const dayTasks = tasksByDate[dateStr] || [];

        const cell = document.createElement("div");
        cell.className = `cal-day${outside ? " cal-day--outside" : ""}${isToday ? " cal-day--today" : ""}`;
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("aria-label", dateStr);

        // Day number
        const numEl = document.createElement("span");
        numEl.className = "cal-day-num";
        numEl.textContent = cellDay;
        cell.appendChild(numEl);

        // Task chips
        const visible = dayTasks.slice(0, CHIP_LIMIT);
        const overflow = dayTasks.length - CHIP_LIMIT;

        visible.forEach(task => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = `cal-task-chip${task.completed ? " cal-task-chip--completed" : ""}`;
            chip.textContent = task.title;
            chip.title = task.title;
            chip.addEventListener("click", (e) => {
                e.stopPropagation();
                openCalendarDetailPanel(dateStr, dayTasks);
            });
            cell.appendChild(chip);
        });

        if (overflow > 0) {
            const more = document.createElement("button");
            more.type = "button";
            more.className = "cal-task-overflow";
            more.textContent = `+${overflow} more`;
            more.addEventListener("click", (e) => {
                e.stopPropagation();
                openCalendarDetailPanel(dateStr, dayTasks);
            });
            cell.appendChild(more);
        }

        // Click on empty cell area opens panel too (if there are tasks)
        if (dayTasks.length > 0) {
            cell.style.cursor = "pointer";
            cell.addEventListener("click", () => {
                openCalendarDetailPanel(dateStr, dayTasks);
            });
        }

        grid.appendChild(cell);
    }
}

// ======================================
// Calendar — Detail Panel
// ======================================

function openCalendarDetailPanel(dateStr, tasks) {
    const panel  = document.getElementById("calDetailPanel");
    const dateEl = document.getElementById("calDetailDate");
    const body   = document.getElementById("calDetailBody");
    if (!panel || !dateEl || !body) return;

    // Format date nicely
    const [y, m, d] = dateStr.split("-").map(Number);
    dateEl.textContent = new Date(y, m - 1, d)
        .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

    body.innerHTML = "";

    if (tasks.length === 0) {
        const empty = document.createElement("p");
        empty.className = "cal-detail-empty";
        empty.textContent = "No tasks on this day.";
        body.appendChild(empty);
    } else {
        tasks.forEach(task => {
            const card = buildAllTaskCard(task);
            body.appendChild(card);
        });
    }

    panel.style.display = "flex";
}

// ======================================
// Focus — Render Page
// ======================================

function renderFocusPage() {
    const emptyState = document.getElementById("focus-empty-state");
    const workspace  = document.getElementById("focus-workspace");

    const task = allTasks.find(t => t.id === pomodoroState.activeTaskId) || null;

    if (!task) {
        // No active task — show empty state
        if (emptyState) emptyState.style.display = "flex";
        if (workspace)  workspace.style.display  = "none";
        return;
    }

    // Has active task — show workspace
    if (emptyState) emptyState.style.display = "none";
    if (workspace)  workspace.style.display  = "flex";

    // Mode badge
    const badge = document.getElementById("pomo-mode-badge");
    if (badge) {
        badge.textContent = pomodoroState.mode === "work" ? "WORK" : "BREAK";
        badge.className   = `pomo-mode-badge pomo-mode-badge--${pomodoroState.mode}`;
    }

    // Ring colour
    const ring = document.getElementById("pomo-ring-progress");
    if (ring) {
        ring.classList.toggle("pomo-ring-progress--break", pomodoroState.mode === "break");
    }

    // Timer display
    pomoUpdateDisplay();
    pomoUpdateRing();

    // Pause button label
    const pauseBtn = document.getElementById("pomo-pause-btn");
    if (pauseBtn) pauseBtn.textContent = pomodoroState.running ? "Pause" : "Resume";

    // Hide banner on fresh render
    const banner = document.getElementById("pomo-banner");
    if (banner) banner.style.display = "none";

    // Task info
    const titleEl = document.getElementById("pomo-task-title");
    if (titleEl) titleEl.textContent = task.title;

    const metaEl = document.getElementById("pomo-task-meta");
    if (metaEl) {
        const parts = [];
        parts.push(`<span>${getCategoryIcon(task.category)} ${formatCategory(task.category)}</span>`);
        parts.push(`<span>${getPriorityIcon(task.priority)} ${formatPriority(task.priority)}</span>`);
        if (task.estimatedEffort) parts.push(`<span>⏱ ${formatEffort(task.estimatedEffort)}</span>`);
        metaEl.innerHTML = parts.join("");
    }

    const dueEl = document.getElementById("pomo-task-due");
    if (dueEl) {
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
    }

    // Work duration chips — mark active chip
    document.querySelectorAll(".pomo-chip[data-type='work']").forEach(chip => {
        const active = Number(chip.dataset.minutes) * 60 === pomodoroState.workSecs;
        chip.classList.toggle("pomo-chip--active", active);
    });
    // Break duration chips — mark active chip
    document.querySelectorAll(".pomo-chip[data-type='break']").forEach(chip => {
        const active = Number(chip.dataset.minutes) * 60 === pomodoroState.breakSecs;
        chip.classList.toggle("pomo-chip--active", active);
    });

    // Subtasks
    const detailsEl = document.getElementById("pomo-subtasks-details");
    const listEl    = document.getElementById("pomo-subtasks-list");
    const countEl   = document.getElementById("pomo-subtasks-count");
    if (listEl) listEl.innerHTML = "";

    const taskSubs = task.subtasks || [];
    if (detailsEl) {
        if (taskSubs.length > 0) {
            const done = taskSubs.filter(s => s.completed).length;
            if (countEl) countEl.textContent = `${done} / ${taskSubs.length}`;

            taskSubs.forEach(sub => {
                const label = document.createElement("label");
                label.className = `focus-subtask-item${sub.completed ? " completed" : ""}`;
                label.innerHTML = `
                    <input type="checkbox" class="focus-subtask-check"
                           ${sub.completed ? "checked" : ""}>
                    <span>${sub.title}</span>`;
                const cb = label.querySelector(".focus-subtask-check");
                cb.addEventListener("change", () =>
                    pomoSubtaskToggle(sub, cb.checked, countEl, label, task));
                listEl.appendChild(label);
            });

            detailsEl.style.display = "block";
        } else {
            detailsEl.style.display = "none";
        }
    }

    // Wire Pause button (replace to avoid duplicate listeners)
    const freshPause = pauseBtn.cloneNode(true);
    pauseBtn.parentNode.replaceChild(freshPause, pauseBtn);
    freshPause.addEventListener("click", () => {
        if (pomodoroState.running) {
            pomoPause();
        } else {
            pomoResume();
        }
    });

    // Wire Reset button (replace to avoid duplicate listeners)
    const resetBtn = document.getElementById("pomo-reset-btn");
    if (resetBtn) {
        const freshReset = resetBtn.cloneNode(true);
        resetBtn.parentNode.replaceChild(freshReset, resetBtn);
        freshReset.addEventListener("click", () => {
            pomoReset();
        });
    }

    // Wire Complete button (replace to avoid duplicate listeners)
    const completeBtn = document.getElementById("pomo-complete-btn");
    if (completeBtn) {
        const freshComplete = completeBtn.cloneNode(true);
        completeBtn.parentNode.replaceChild(freshComplete, completeBtn);
        freshComplete.addEventListener("click", pomoCompleteTask);
    }

    // Wire duration chips (replace each to avoid duplicate listeners)
    document.querySelectorAll(".pomo-chip").forEach(chip => {
        const fresh = chip.cloneNode(true);
        chip.parentNode.replaceChild(fresh, chip);
        fresh.addEventListener("click", () => {
            const mins = Number(fresh.dataset.minutes);
            const type = fresh.dataset.type;

            if (type === "work") {
                pomodoroState.workSecs = mins * 60;
                // Update active chip in the work group only
                document.querySelectorAll(".pomo-chip[data-type='work']").forEach(c =>
                    c.classList.toggle("pomo-chip--active", c === fresh));
                // If currently in work mode, reset to new duration
                if (pomodoroState.mode === "work") {
                    pomoReset();
                    pomoStart();
                    const pb = document.getElementById("pomo-pause-btn");
                    if (pb) pb.textContent = "Pause";
                }
            } else {
                pomodoroState.breakSecs = mins * 60;
                document.querySelectorAll(".pomo-chip[data-type='break']").forEach(c =>
                    c.classList.toggle("pomo-chip--active", c === fresh));
                // If currently in break mode, reset to new duration
                if (pomodoroState.mode === "break") {
                    pomoReset();
                    pomoStart();
                    const pb = document.getElementById("pomo-pause-btn");
                    if (pb) pb.textContent = "Pause";
                }
            }
        });
    });

    // Auto-start work timer when entering Focus with a task
    if (!pomodoroState.running) {
        pomoStart();
        const pb = document.getElementById("pomo-pause-btn");
        if (pb) pb.textContent = "Pause";
    }
}

// ======================================
// Focus — Subtask toggle from Focus page
// ======================================

async function pomoSubtaskToggle(subtask, checked, countEl, labelEl, task) {
    const user = auth.currentUser;
    if (!task || !user) return;

    const prev        = subtask.completed;
    subtask.completed = checked;

    const allDone = (task.subtasks || []).every(s => s.completed);
    const done    = (task.subtasks || []).filter(s => s.completed).length;

    if (countEl) countEl.textContent = `${done} / ${task.subtasks.length}`;
    labelEl.classList.toggle("completed", checked);

    try {
        const taskRef = doc(db, "users", user.uid, "tasks", task.id);
        await updateDoc(taskRef, { subtasks: task.subtasks, completed: allDone });
        task.completed = allDone;
        updateProgress();
    } catch (err) {
        console.error("Focus subtask toggle failed:", err);
        subtask.completed = prev;
        const cb = labelEl.querySelector("input[type='checkbox']");
        if (cb) cb.checked = prev;
        labelEl.classList.toggle("completed", prev);
        const revertDone = (task.subtasks || []).filter(s => s.completed).length;
        if (countEl) countEl.textContent = `${revertDone} / ${task.subtasks.length}`;
    }
}

function updateRecommendationUI() {
    const recCard  = document.getElementById("rec-card");
    const recEmpty = document.getElementById("rec-empty");
    const recTitle = document.getElementById("rec-title");
    const recMeta  = document.getElementById("rec-meta");
    const recBtn   = document.getElementById("rec-start-btn");

    if (!recCard || !recEmpty) return;

    const result = getRecommendedTask(allTasks);

    if (!result) {
        recCard.style.display  = "none";
        recEmpty.style.display = "block";
        return;
    }

    // Build concise meta line from reasons
    const reasons = getRecommendationReasons(result.task, result.breakdown);
    // reasons = [priority, due, (optional "Marked important"), effort]
    const metaParts = [];
    // Due label (index 1)
    if (reasons[1] && reasons[1] !== "No due date") metaParts.push(reasons[1]);
    // Priority (index 0)
    metaParts.push(reasons[0]);
    // Effort (last item)
    const effortLabel = reasons[reasons.length - 1];
    if (effortLabel && effortLabel.startsWith("Estimated effort:")) {
        metaParts.push(effortLabel.replace("Estimated effort: ", ""));
    }

    recTitle.textContent = result.task.title;
    recMeta.textContent  = metaParts.join(" · ");

    // Wire Start Task button (replace to avoid duplicate listeners)
    const freshBtn = recBtn.cloneNode(true);
    recBtn.parentNode.replaceChild(freshBtn, recBtn);
    freshBtn.addEventListener("click", () => {
        // Navigate to Focus with the recommended task
        startFocusWithTask(result.task);
    });

    recCard.style.display  = "flex";
    recEmpty.style.display = "none";
}

// ======================================
// Subtasks
// ======================================

let subtasks = [];

const addSubtaskButton =
    document.getElementById("addSubtaskBtn");

const subtaskContainer =
    document.getElementById("subtaskInputContainer");


addSubtaskButton.addEventListener("click", () => {

    const input =
        subtaskContainer.querySelector(
            ".subtask-title"
        );

    const title =
        input.value.trim();


    if (!title) {
        input.focus();
        return;
    }


    const subtask = {

        id: Date.now(),

        title: title,

        completed: false

    };


    subtasks.push(subtask);


    renderSubtasks();


    input.value = "";

    input.focus();


    console.log(
        "Subtasks:",
        subtasks
    );

});

function renderSubtasks() {

    const existingItems =
        subtaskContainer.querySelectorAll(
            ".subtask-item"
        );


    existingItems.forEach(item => {
        item.remove();
    });


    subtasks.forEach((subtask) => {

        const subtaskElement =
            document.createElement("div");


        subtaskElement.className =
            "subtask-item";


        subtaskElement.innerHTML = `

            <span class="subtask-check">
                ☐
            </span>

            <span class="subtask-name">
                ${subtask.title}
            </span>

            <button
                type="button"
                class="remove-subtask"
                data-id="${subtask.id}"
                title="Remove subtask"
            >
                ×
            </button>

        `;


        const removeButton =
            subtaskElement.querySelector(
                ".remove-subtask"
            );


        removeButton.addEventListener(
            "click",
            () => {

                subtasks =
                    subtasks.filter(
                        item =>
                            item.id !== subtask.id
                    );


                renderSubtasks();

            }
        );


        subtaskContainer.appendChild(
            subtaskElement
        );

    });

}


taskForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        // ===============================
        // Get form values
        // ===============================

        const title =
            document.getElementById("taskTitle").value.trim();

        const description =
            document.getElementById("taskDescription").value.trim();

        const category =
            document.getElementById("taskCategory").value;

        const priority =
            document.getElementById("taskPriority").value;

        const dueDate =
            document.getElementById("taskDueDate").value;

        const dueTime =
            document.getElementById("taskDueTime").value;

        const reminder =
            document.getElementById("taskReminder").value;

        const repeat =
            document.getElementById("taskRepeat").value;

        const estimatedEffort =
            document.getElementById("taskEffort").value;


        // ===============================
        // Check user
        // ===============================

        const user = auth.currentUser;

        if (!user) {

            console.error(
                "No authenticated user."
            );

            return;

        }


        // ===============================
        // EDIT EXISTING TASK
        // ===============================

        if (editingTask) {

            try {

                const taskRef = doc(
                    db,
                    "users",
                    user.uid,
                    "tasks",
                    editingTask.id
                );


                // ======================================
// Determine task completion from subtasks
// ======================================

const updatedSubtasks =
    [...subtasks];

const allSubtasksCompleted =
    updatedSubtasks.length > 0 &&
    updatedSubtasks.every(
        (subtask) =>
            subtask.completed === true
    );


// A task is complete only when
// all of its subtasks are complete.

const updatedCompleted =
    updatedSubtasks.length > 0
        ? allSubtasksCompleted
        : editingTask.completed;


const updatedTaskData = {

    title: title,

    description: description,

    category: category,

    priority: priority,

    dueDate: dueDate,

    dueTime: dueTime,

    reminder: reminder,

    repeat: repeat,

    subtasks: updatedSubtasks,

    completed: updatedCompleted,

    estimatedEffort: estimatedEffort

};


                await updateDoc(
                    taskRef,
                    updatedTaskData
                );


                // Update local task object

                editingTask.title =
                    title;

                editingTask.description =
                    description;

                editingTask.category =
                    category;

                editingTask.priority =
                    priority;

                editingTask.dueDate =
                    dueDate;

                editingTask.dueTime =
                    dueTime;

                editingTask.reminder =
                    reminder;

                editingTask.repeat =
                    repeat;

                editingTask.subtasks =
                    [...subtasks];
                    
                editingTask.completed =
                updatedCompleted;

                editingTask.estimatedEffort =
                    estimatedEffort;

                console.log(
                    "Task updated in Firestore:",
                    editingTask
                );


                // Replace old card with updated card

                if (editingTaskCard) {

                    editingTaskCard.remove();

                }

                // Remove stale entry so addTaskToUI re-adds the updated one
                allTasks = allTasks.filter(t => t.id !== editingTask.id);

                addTaskToUI(editingTask);


                // Update dashboard

                updateProgress();

                updateTaskCount();

                // Refresh All Tasks page if it is currently active
                if (currentPage === "all-tasks") renderAllTasksList();
                // Refresh Important page if active (starred state may have changed)
                if (currentPage === "important") renderImportantList();


                // Close modal

                taskModal.classList.remove("show");


                // Reset form state

                taskForm.reset();

                subtasks = [];

                editingTask = null;

                editingTaskCard = null;

                renderSubtasks();


                // Reset modal UI

                document.getElementById(
                    "taskModalTitle"
                ).textContent =
                    "Create New Task";

                document.getElementById(
                    "taskSubmitBtn"
                ).textContent =
                    "Create Task";


                return;

            } catch (error) {

                console.error(
                    "Failed to update task:",
                    error
                );

                alert(
                    "Unable to update this task. Please try again."
                );

                return;

            }

        }


        // ===============================
        // CREATE NEW TASK
        // ===============================

        const task = {

            title: title,

            description: description,

            category: category,

            priority: priority,

            completed: false,

            starred: false,

            dueDate: dueDate,

            dueTime: dueTime,

            reminder: reminder,

            repeat: repeat,

            estimatedEffort: estimatedEffort,

            subtasks: [...subtasks],

            createdAt: serverTimestamp()

        };


        console.log(
            "New task:",
            task
        );


        try {

            const tasksCollection =
                collection(
                    db,
                    "users",
                    user.uid,
                    "tasks"
                );


            const taskRef =
                await addDoc(
                    tasksCollection,
                    task
                );


            task.id =
                taskRef.id;


            console.log(
                "Task saved to Firestore:",
                task
            );


            addTaskToUI(task);

            updateProgress();

            updateTaskCount();

            // Refresh All Tasks page if it is currently active
            if (currentPage === "all-tasks") renderAllTasksList();
            // Refresh Important page if active
            if (currentPage === "important") renderImportantList();


            // Close modal

            taskModal.classList.remove("show");


            // Reset form

            taskForm.reset();

            subtasks = [];

            editingTask = null;

            editingTaskCard = null;

            renderSubtasks();


        } catch (error) {

            console.error(
                "Failed to create task:",
                error
            );

            alert(
                "Unable to create this task. Please try again."
            );

        }

    }
);


// ======================================
// Display Task
// ======================================

function addTaskToUI(task) {

    const taskCard =
        document.createElement("article");

    taskCard.className = "task-card";


    taskCard.innerHTML = `

    <div class="task-main-row">

        <!-- Task checkbox -->

        <div class="task-check">

            <input
                type="checkbox"
                class="task-checkbox"
                ${task.completed ? "checked" : ""}
            >

        </div>


        <!-- Task information -->

        <div class="task-info">

            <h3>
                ${task.title}
            </h3>

            <p>
                ${task.description || "No description added."}
            </p>

            <div class="task-meta">

                <span>
    ${getCategoryIcon(task.category)}
    ${formatCategory(task.category)}
</span>

                <span>
                    ${getPriorityIcon(task.priority)}
                    ${formatPriority(task.priority)}
                </span>

                ${
                    task.dueDate && task.dueTime
                    ? `<span>📅 Due: ${formatDueDateTime(task.dueDate, task.dueTime)}</span>`
                    : task.dueDate
                    ? `<span>📅 Due: ${formatDueDate(task.dueDate)}</span>`
                    : task.dueTime
                    ? `<span>⏰ Due: ${formatTime(task.dueTime)}</span>`
                    : ""
                }

                ${
                    task.estimatedEffort
                    ? `<span>⏱ ${formatEffort(task.estimatedEffort)}</span>`
                    : ""
                }

            </div>

        </div>


        <!-- Task actions -->

        <div class="task-actions">

            <button
                class="star-task-btn ${task.starred ? "important" : ""}"
                type="button"
                title="${task.starred ? "Unmark important" : "Mark important"}"
            >
                ${task.starred ? "★" : "☆"}
            </button>


            <button
                class="task-menu-btn"
                type="button"
                title="Task options"
            >
                ⋮
            </button>


            <div class="task-menu">

                <button
                    class="edit-task-btn"
                    type="button"
                >
                    ✏️ Edit
                </button>

                <button
                    class="delete-task-btn"
                    type="button"
                >
                    🗑️ Delete
                </button>

            </div>

        </div>

    </div>


    <!-- Subtasks -->

    <div
        class="subtask-section"
        style="display: none;"
    >

        <div class="subtask-header">

            <strong>
                Subtasks
            </strong>

            <span class="subtask-progress">
                0 / 0 completed
            </span>

        </div>

        <div class="subtask-list"></div>

    </div>

`;


    taskList.appendChild(taskCard);

    // Register task in the scoring engine mirror
    allTasks.push(task);

    const subtaskSection =
    taskCard.querySelector(
        ".subtask-section"
    );

    

renderTaskSubtasks(
    task,
    subtaskSection
);

// ======================================
// Expand / Collapse Subtasks
// ======================================

taskCard.addEventListener(
    "click",
    (event) => {

        // Don't expand when clicking
        // buttons or checkboxes
        if (
            event.target.closest("button") ||
            event.target.closest("input")
        ) {
            return;
        }


        const isOpen =
            subtaskSection.style.display !== "none";


        subtaskSection.style.display =
            isOpen
                ? "none"
                : "block";

    }
);

// Restore completed state visually
if (task.completed) {

    taskCard.classList.add("completed");

}

const checkbox =
    taskCard.querySelector(".task-checkbox");


checkbox.addEventListener("change", async () => {

    const completed =
        checkbox.checked;

    const result =
        await handleTaskCompletion(
            task,
            taskCard,
            completed
        );

    // Firestore update failed
    if (!result) {

        checkbox.checked =
            task.completed;

        return;

    }

    // Task was just completed
    if (result.completedNow) {

        console.log(
            "Completion event triggered:",
            task.id
        );

    }

    // Task was just uncompleted
    if (result.uncompletedNow) {

        console.log(
            "Task completion undone:",
            task.id
        );

    }

});

// ======================================
// Task Options Menu
// ======================================

const menuButton =
    taskCard.querySelector(".task-menu-btn");

const taskMenu =
    taskCard.querySelector(".task-menu");

const editButton =
    taskCard.querySelector(".edit-task-btn");

   editButton.addEventListener("click", () => {

    console.log(
        "Editing task:",
        task
    );

    editingTask = task;
    editingTaskCard = taskCard;

    document.getElementById(
    "taskModalTitle"
).textContent = "Edit Task";

document.getElementById(
    "taskSubmitBtn"
).textContent = "Save Changes";

    taskMenu.classList.remove("show");


    // ===============================
    // Populate Edit Form
    // ===============================

    document.getElementById("taskTitle").value =
        task.title || "";

    document.getElementById("taskDescription").value =
        task.description || "";

    document.getElementById("taskCategory").value =
        task.category || "";

    document.getElementById("taskPriority").value =
        task.priority || "";

    document.getElementById("taskDueDate").value =
        task.dueDate || "";

    document.getElementById("taskDueTime").value =
        task.dueTime || "";

    document.getElementById("taskReminder").value =
        task.reminder || "";

    document.getElementById("taskRepeat").value =
        task.repeat || "";

    document.getElementById("taskEffort").value =
        task.estimatedEffort || "30";


    // ===============================
    // Populate Subtasks
    // ===============================

    subtasks =
        task.subtasks
            ? [...task.subtasks]
            : [];

    renderSubtasks();


    // Open modal

    taskModal.classList.add("show");

});

const starButton =
    taskCard.querySelector(".star-task-btn");

const deleteButton =
    taskCard.querySelector(".delete-task-btn");


// Open / close menu

menuButton.addEventListener("click", (event) => {

    event.stopPropagation();

    const isOpening =
        !taskMenu.classList.contains("show");


    // Close other open menus

    document
        .querySelectorAll(".task-menu.show")
        .forEach((menu) => {

            menu.classList.remove("show");

            const card =
                menu.closest(".task-card");

            if (card) {
                card.classList.remove("menu-open");
            }

        });


    if (isOpening) {

        taskMenu.classList.add("show");

        taskCard.classList.add("menu-open");

    }

});


// Close menu when clicking elsewhere

document.addEventListener("click", () => {

    taskMenu.classList.remove("show");

    taskCard.classList.remove("menu-open");

});


// ======================================
// Mark Important
// ======================================

starButton.addEventListener("click", async () => {

    const user = auth.currentUser;

    if (!user) {

        console.error(
            "No authenticated user."
        );

        return;

    }

    const newStarState =
        !task.starred;

    try {

        const taskRef = doc(
            db,
            "users",
            user.uid,
            "tasks",
            task.id
        );

        await updateDoc(
            taskRef,
            {
                starred: newStarState
            }
        );

        task.starred =
            newStarState;

        starButton.textContent =
    task.starred ? "★" : "☆";

starButton.classList.toggle(
    "important",
    task.starred
);

starButton.title =
    task.starred
        ? "Unmark important"
        : "Mark important";

        console.log(
            "Task importance saved:",
            task.starred
        );

        // Refresh Important page — task may have entered or left the list
        if (currentPage === "important") renderImportantList();

    } catch (error) {

        console.error(
            "Failed to update importance:",
            error
        );

    }

});


// ======================================
// Delete Task
// ======================================

deleteButton.addEventListener(
    "click",
    async () => {

        const confirmed =
            confirm(
                `Delete "${task.title}"?`
            );

        if (!confirmed) {
            return;
        }

        try {

            const user =
                auth.currentUser;

            if (!user) {

                console.error(
                    "No authenticated user."
                );

                return;

            }

            const taskRef = doc(
                db,
                "users",
                user.uid,
                "tasks",
                task.id
            );

            await deleteDoc(taskRef);

            taskCard.remove();

            // Remove from scoring engine mirror
            allTasks = allTasks.filter(t => t.id !== task.id);

            updateProgress();
            updateTaskCount();

            // Refresh All Tasks page if it is currently active
            if (currentPage === "all-tasks") renderAllTasksList();
            // Refresh Important page if active
            if (currentPage === "important") renderImportantList();

            console.log(
                "Task deleted from Firestore:",
                task
            );

        } catch (error) {

            console.error(
                "Failed to delete task:",
                error
            );

            alert(
                "Unable to delete this task. Please try again."
            );

        }

    }
);

// ======================================
// Focus Task
// ======================================

const focusBtn = document.createElement("button");
focusBtn.type = "button";
focusBtn.textContent = "🎯 Focus";

focusBtn.addEventListener("click", () => {
    taskMenu.classList.remove("show");
    taskCard.classList.remove("menu-open");
    startFocusWithTask(task);
});

taskMenu.appendChild(focusBtn);

}

function renderTaskSubtasks(
    task,
    subtaskSection
) {

    const subtaskList =
        subtaskSection.querySelector(
            ".subtask-list"
        );

    const subtaskProgress =
        subtaskSection.querySelector(
            ".subtask-progress"
        );

    subtaskList.innerHTML = "";

    const taskSubtasks =
        task.subtasks || [];

    let completedCount = 0;


    taskSubtasks.forEach((subtask) => {

        if (subtask.completed) {
            completedCount++;
        }


        const subtaskItem =
            document.createElement("label");

        subtaskItem.className =
    `task-subtask ${
        subtask.completed
            ? "completed"
            : ""
    }`;


        subtaskItem.innerHTML = `

    <input
        type="checkbox"
        class="subtask-checkbox"
        ${subtask.completed ? "checked" : ""}
    >

    <span class="subtask-title">
        ${subtask.title}
    </span>

`;


        const checkbox =
            subtaskItem.querySelector(
                ".subtask-checkbox"
            );


        checkbox.addEventListener(
    "change",
    async (event) => {

        event.stopPropagation();

        const previousState =
            subtask.completed;

        subtask.completed =
            checkbox.checked;


        try {

            const user =
                auth.currentUser;

            if (!user) {

                subtask.completed =
                    previousState;

                checkbox.checked =
                    previousState;

                return;

            }


            // ======================================
            // Check whether ALL subtasks are complete
            // ======================================

            const allSubtasksCompleted =
                taskSubtasks.length > 0 &&
                taskSubtasks.every(
                    (item) => item.completed
                );


            // ======================================
            // Main task follows subtask completion
            // ======================================

            const newTaskCompleted =
                allSubtasksCompleted;


            const taskRef = doc(
                db,
                "users",
                user.uid,
                "tasks",
                task.id
            );


            // ======================================
            // Save BOTH to Firebase
            // ======================================

            await updateDoc(
                taskRef,
                {

                    completed:
                        newTaskCompleted,

                    subtasks:
                        taskSubtasks

                }
            );


            // ======================================
            // Update local task
            // ======================================

            task.completed =
                newTaskCompleted;

            task.subtasks =
                taskSubtasks;


            // ======================================
            // Update main task UI
            // ======================================

            const taskCard =
                subtaskSection.closest(
                    ".task-card"
                );

            const mainTaskCheckbox =
    taskCard.querySelector(
        ".task-checkbox"
    );

if (mainTaskCheckbox) {

    mainTaskCheckbox.checked =
        newTaskCompleted;

}


            if (taskCard) {

                taskCard.classList.toggle(
                    "completed",
                    newTaskCompleted
                );

            }


            // ======================================
            // Update subtask counter
            // ======================================

            let completedCount = 0;

            taskSubtasks.forEach(
                (item) => {

                    if (item.completed) {
                        completedCount++;
                    }

                }
            );


            subtaskProgress.textContent =
                `${completedCount} / ${taskSubtasks.length} completed`;


            // ======================================
            // Update subtask visual state
            // ======================================

            subtaskItem.classList.toggle(
                "completed",
                subtask.completed
            );


            // ======================================
            // Update Today's Progress
            // ======================================

            updateProgress();


            console.log(
                "Subtask saved to Firebase:",
                subtask
            );

            console.log(
                "Main task completion:",
                newTaskCompleted
            );


        } catch (error) {

            console.error(
                "Failed to save subtask:",
                error
            );


            // Restore previous state

            subtask.completed =
                previousState;

            checkbox.checked =
                previousState;

        }

    }
);


        subtaskList.appendChild(
            subtaskItem
        );

    });


    subtaskProgress.textContent =
        `${completedCount} / ${taskSubtasks.length} completed`;

}

// ======================================
// Category Formatting
// ======================================

function getCategoryIcon(category) {

    const icons = {

        personal: "👤",

        work: "💼",

        study: "📚",

        fitness: "🏋️"

    };

    return icons[category] || "📁";

}


function formatCategory(category) {

    const categories = {

        personal: "Personal",

        work: "Work",

        study: "Study",

        fitness: "Fitness"

    };

    return categories[category] || category;

}


// ======================================
// Priority Formatting
// ======================================

function formatPriority(priority) {

    const priorities = {

        low: "Low",

        medium: "Medium",

        high: "High"

    };

    return priorities[priority] || priority;

}


function getPriorityIcon(priority) {

    const icons = {

        low: "🟢",

        medium: "🟡",

        high: "🔴"

    };

    return icons[priority] || "⚪";

}

function formatTime(time) {

    if (!time) {
        return "";
    }

    const [hours, minutes] = time.split(":");

    const date = new Date();

    date.setHours(
        Number(hours),
        Number(minutes)
    );

    return date.toLocaleTimeString(
        "en-US",
        {
            hour: "numeric",
            minute: "2-digit"
        }
    );

}

// ======================================
// Due Date / Time Formatting
// ======================================

function formatDueDate(dateStr) {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDueDateTime(dateStr, timeStr) {
    const datePart = formatDueDate(dateStr);
    const timePart = formatTime(timeStr);
    if (datePart && timePart) return `${datePart}, ${timePart}`;
    return datePart || timePart;
}

// ======================================
// Estimated Effort Formatting
// ======================================

function formatEffort(value) {
    const labels = {
        "15":   "15 min",
        "30":   "30 min",
        "60":   "1 hr",
        "120":  "2 hrs",
        "180+": "3+ hrs"
    };
    return labels[value] || `${value} min`;
}

// ======================================
// Task Progress
// ======================================

function updateProgress() {

    const tasks =
        document.querySelectorAll(".task-card");

    const completedTasks =
        document.querySelectorAll(
            ".task-card.completed"
        );

    const total =
        tasks.length;

    const completed =
        completedTasks.length;


    // Update text

    const progressText =
        document.getElementById("progressText");

    if (progressText) {

        progressText.textContent =
            `${completed} / ${total} completed`;

    }


    // Calculate percentage

    let percentage = 0;

    if (total > 0) {

        percentage =
            (completed / total) * 100;

    }


    // Update progress bar

    const progressFill =
        document.getElementById("progressFill");

    if (progressFill) {

        progressFill.style.width =
            `${percentage}%`;

    }

    // Recalculate recommendation whenever task set changes
    updateRecommendationUI();

}

// ======================================
// Existing Task Checkboxes
// ======================================

function setupExistingTaskCheckboxes() {

    const taskCards =
        document.querySelectorAll(".task-card");


    taskCards.forEach((taskCard) => {

        const checkbox =
            taskCard.querySelector(".task-checkbox");


        if (!checkbox) {
            return;
        }


        checkbox.addEventListener("change", () => {

            taskCard.classList.toggle(
                "completed",
                checkbox.checked
            );


            console.log(
                "Existing task completed:",
                checkbox.checked
            );


            updateProgress();

        });

    });

}

setupExistingTaskCheckboxes();

updateProgress();

// ======================================
// Task Count
// ======================================

function updateTaskCount() {

    const taskCards =
        document.querySelectorAll(".task-card");

    const taskCount =
        taskCards.length;

    const taskCountText =
        document.getElementById("taskCountText");

    if (!taskCountText) {
        return;
    }

    if (taskCount === 1) {

        taskCountText.textContent =
            "You have 1 task planned for today.";

    } else {

        taskCountText.textContent =
            `You have ${taskCount} tasks planned for today.`;

    }

}

updateTaskCount();


// ======================================
// Load Tasks From Firestore
// ======================================

async function loadTasks() {

    const user = auth.currentUser;

    if (!user) {

        console.error(
            "No authenticated user."
        );

        return;

    }

    try {

        const tasksCollection =
            collection(
                db,
                "users",
                user.uid,
                "tasks"
            );

        const snapshot =
            await getDocs(tasksCollection);

        snapshot.forEach((doc) => {

            const task = {

                id: doc.id,

                ...doc.data()

            };

            console.log(
                "Task loaded:",
                task
            );

            addTaskToUI(task);

        });

        // Update dashboard after Firestore tasks are loaded
        updateProgress();
        updateTaskCount();

    } catch (error) {

        console.error(
            "Failed to load tasks:",
            error
        );

    }

}


// ======================================
// Task Completion
// ======================================

async function handleTaskCompletion(
    task,
    taskCard,
    completed
) {

    const user = auth.currentUser;

    const wasCompleted =
        task.completed;

    if (!user) {

        console.error(
            "No authenticated user."
        );

        return false;

    }

    try {

        const taskRef = doc(
            db,
            "users",
            user.uid,
            "tasks",
            task.id
        );


        // Sync every subtask with the main task

        const updatedSubtasks =
            (task.subtasks || []).map(
                (subtask) => ({

                    ...subtask,

                    completed: completed

                })
            );


        // Save main task + subtasks

        await updateDoc(
            taskRef,
            {

                completed: completed,

                subtasks: updatedSubtasks

            }
        );


        // Update local data

        task.completed =
            completed;

        task.subtasks =
            updatedSubtasks;


        // Update main task appearance

        taskCard.classList.toggle(
            "completed",
            completed
        );

        // Sync the checkbox to match the new completed state.
        // When completion is triggered programmatically (e.g. from Focus),
        // the checkbox DOM element is not clicked by the user so its
        // checked property must be updated explicitly.
        const taskCheckbox = taskCard.querySelector(".task-checkbox");
        if (taskCheckbox) taskCheckbox.checked = completed;


        // Update visible subtasks

        const subtaskSection =
            taskCard.querySelector(
                ".subtask-section"
            );

        if (subtaskSection) {

            renderTaskSubtasks(
                task,
                subtaskSection
            );

        }


        // Progress still counts ONLY main tasks

        updateProgress();


        console.log(
            "Task completion saved:",
            completed
        );

        console.log(
            "Subtasks synchronized:",
            updatedSubtasks
        );


        return {

            success: true,

            completedNow:
                !wasCompleted && completed,

            uncompletedNow:
                wasCompleted && !completed

        };


    } catch (error) {

        console.error(
            "Failed to update task completion:",
            error
        );

        return false;

    }

}


// ======================================
// Focus Mode — overlay event listeners removed.
// The Focus page is now a full page section (#page-focus).
// All timer controls are wired inside renderFocusPage().
// ======================================
