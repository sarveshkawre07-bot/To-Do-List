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
// Focus Mode State
// ======================================

const focusState = {
    task:         null,
    totalSeconds: 0,
    remaining:    0,
    running:      false,
    intervalId:   null,
    startEpoch:   null,
    pausedAt:     null
};

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

// ======================================
// Timer Display Helpers
// ======================================

const RING_RADIUS       = 54;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ≈ 339.292

function updateTimerDisplay() {
    const s  = focusState.remaining;
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    const el = document.getElementById("focus-timer-display");
    if (el) el.textContent = `${mm}:${ss}`;
}

function updateRingProgress() {
    const total  = focusState.totalSeconds;
    const ratio  = total > 0
        ? Math.min(1, Math.max(0, focusState.remaining / total))
        : 0;
    const offset = RING_CIRCUMFERENCE * (1 - ratio);
    const el = document.getElementById("focus-ring-progress");
    if (el) el.style.strokeDashoffset = offset;
}

// ======================================
// Timer Engine
// ======================================

function startTimer() {
    if (focusState.running) return;
    focusState.running    = true;
    focusState.startEpoch = Date.now();
    const base = focusState.pausedAt ?? focusState.totalSeconds;
    focusState.intervalId = setInterval(() => {
        const elapsed = Math.floor((Date.now() - focusState.startEpoch) / 1000);
        focusState.remaining = Math.max(0, base - elapsed);
        updateTimerDisplay();
        updateRingProgress();
        if (focusState.remaining === 0) {
            clearInterval(focusState.intervalId);
            focusState.intervalId = null;
            focusState.running    = false;
            const banner = document.getElementById("focus-done-banner");
            if (banner) banner.style.display = "block";
        }
    }, 1000);
}

function pauseTimer() {
    if (!focusState.running) return;
    clearInterval(focusState.intervalId);
    focusState.intervalId = null;
    focusState.running    = false;
    focusState.pausedAt   = focusState.remaining;
    const btn = document.getElementById("focus-pause-btn");
    if (btn) btn.textContent = "Resume";
}

function resumeTimer() {
    if (focusState.running) return;
    // pausedAt is already set by pauseTimer(); startTimer() uses it as the base.
    startTimer();
    const btn = document.getElementById("focus-pause-btn");
    if (btn) btn.textContent = "Pause";
}

// ======================================
// Focus Overlay Population
// ======================================

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

    // Due date/time — show only when present
    const dueEl = document.getElementById("focus-task-due");
    if (task.dueDate || task.dueTime) {
        if (task.dueDate && task.dueTime) {
            dueEl.textContent = `📅 Due: ${formatDueDateTime(task.dueDate, task.dueTime)}`;
        } else if (task.dueDate) {
            dueEl.textContent = `📅 Due: ${formatDueDate(task.dueDate)}`;
        } else {
            dueEl.textContent = `⏰ Due: ${formatTime(task.dueTime)}`;
        }
        dueEl.style.display = "block";
    } else {
        dueEl.style.display = "none";
    }

    // Active duration chip — match data-minutes to focusState.totalSeconds / 60
    const activeMinutes = focusState.totalSeconds / 60;
    document.querySelectorAll(".focus-chip").forEach(chip => {
        chip.classList.toggle(
            "focus-chip--active",
            Number(chip.dataset.minutes) === activeMinutes
        );
    });

    // Timer display and ring
    updateTimerDisplay();
    updateRingProgress();

    // Reset done banner
    const banner = document.getElementById("focus-done-banner");
    if (banner) banner.style.display = "none";

    // Reset pause button label
    const pauseBtn = document.getElementById("focus-pause-btn");
    if (pauseBtn) pauseBtn.textContent = "Pause";

    // Build subtask list
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

// ======================================
// Focus Mode Open / Close
// ======================================

function openFocusMode(task) {
    if (!task) return;

    // Stop any previously-running timer before resetting state
    if (focusState.intervalId) {
        clearInterval(focusState.intervalId);
        focusState.intervalId = null;
    }

    focusState.task         = task;
    focusState.totalSeconds = effortToSeconds(task.estimatedEffort);
    focusState.remaining    = focusState.totalSeconds;
    focusState.running      = false;
    focusState.startEpoch   = null;
    focusState.pausedAt     = null;

    populateFocusOverlay(task);

    const overlay = document.getElementById("focus-overlay");
    if (overlay) overlay.style.display = "flex";

    startTimer();
}

function closeFocusMode() {
    clearInterval(focusState.intervalId);
    focusState.intervalId = null;
    focusState.running    = false;
    focusState.task       = null;
    const overlay = document.getElementById("focus-overlay");
    if (overlay) overlay.style.display = "none";
    updateRecommendationUI();
}

// ======================================
// Focus Mode Completion
// ======================================

async function handleFocusComplete() {
    const task = focusState.task;
    if (!task) return;

    // Locate the matching task card by title (no data-id on cards)
    const taskCard = [...document.querySelectorAll(".task-card")]
        .find(c => {
            const h3 = c.querySelector("h3");
            return h3 && h3.textContent.trim() === task.title.trim();
        }) || null;

    const result = await handleTaskCompletion(task, taskCard, true);

    if (result !== false) {
        closeFocusMode();
    } else {
        console.error("Focus: could not complete task", task);
    }
}

// ======================================
// Focus Subtask Toggle
// ======================================

async function handleFocusSubtaskToggle(subtask, checked, countEl, labelEl) {
    const task = focusState.task;
    const user = auth.currentUser;
    if (!task || !user) return;

    // Optimistically apply the change
    const prev        = subtask.completed;
    subtask.completed = checked;

    // Recompute derived state
    const allDone = (task.subtasks || []).every(s => s.completed);
    const done    = (task.subtasks || []).filter(s => s.completed).length;

    // Update count badge
    countEl.textContent = `${done} / ${task.subtasks.length}`;

    // Update label visual state
    labelEl.classList.toggle("completed", checked);

    // Sync matching main-list card — find by task title (cards have no data-id)
    const mainCard = [...document.querySelectorAll(".task-card")]
        .find(c => {
            const h3 = c.querySelector("h3");
            return h3 && h3.textContent.trim() === task.title.trim();
        });

    if (mainCard) {
        // Sync the individual subtask checkbox in the main card's subtask list
        const mainSubtaskLabels = mainCard.querySelectorAll(".task-subtask");
        mainSubtaskLabels.forEach(lbl => {
            const titleEl = lbl.querySelector(".subtask-title");
            if (titleEl && titleEl.textContent.trim() === subtask.title.trim()) {
                const cb = lbl.querySelector(".subtask-checkbox");
                if (cb) cb.checked = checked;
                lbl.classList.toggle("completed", checked);
            }
        });

        // Sync main task card checkbox and class to reflect allDone
        const mainTaskCb = mainCard.querySelector(".task-checkbox");
        if (mainTaskCb) mainTaskCb.checked = allDone;
        mainCard.classList.toggle("completed", allDone);
    }

    try {
        const taskRef = doc(db, "users", user.uid, "tasks", task.id);
        await updateDoc(taskRef, {
            subtasks:  task.subtasks,
            completed: allDone
        });
        task.completed = allDone;
        updateProgress();
    } catch (err) {
        console.error("Focus subtask toggle failed:", err);

        // Revert optimistic changes
        subtask.completed = prev;
        const revertDone  = (task.subtasks || []).filter(s => s.completed).length;
        countEl.textContent = `${revertDone} / ${task.subtasks.length}`;
        labelEl.classList.toggle("completed", prev);

        const cb = labelEl.querySelector("input[type='checkbox']");
        if (cb) cb.checked = prev;

        // Revert main card sync
        if (mainCard) {
            const mainSubtaskLabels = mainCard.querySelectorAll(".task-subtask");
            mainSubtaskLabels.forEach(lbl => {
                const titleEl = lbl.querySelector(".subtask-title");
                if (titleEl && titleEl.textContent.trim() === subtask.title.trim()) {
                    const cb = lbl.querySelector(".subtask-checkbox");
                    if (cb) cb.checked = prev;
                    lbl.classList.toggle("completed", prev);
                }
            });
        }
    }
}

// ======================================
// Task Collection (for scoring engine)
// ======================================

// Mirror of all tasks currently in the UI.
// Kept in sync by addTaskToUI (add) and the delete/edit flows (remove+re-add).
let allTasks = [];

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
        openFocusMode(result.task);
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
    openFocusMode(task);
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
// Focus Mode — Overlay Event Listeners
// ======================================

document.getElementById("focus-exit-btn")
    .addEventListener("click", closeFocusMode);

document.getElementById("focus-complete-btn")
    .addEventListener("click", handleFocusComplete);

document.getElementById("focus-pause-btn")
    .addEventListener("click", () => {
        if (focusState.running) pauseTimer(); else resumeTimer();
    });

document.querySelectorAll(".focus-chip").forEach(chip => {
    chip.addEventListener("click", () => {
        const mins = Number(chip.dataset.minutes);

        // Reset timer state to new duration
        clearInterval(focusState.intervalId);
        focusState.intervalId   = null;
        focusState.running      = false;
        focusState.totalSeconds = mins * 60;
        focusState.remaining    = focusState.totalSeconds;
        focusState.pausedAt     = null;

        // Update active chip highlight
        document.querySelectorAll(".focus-chip").forEach(c =>
            c.classList.toggle("focus-chip--active", c === chip));

        // Reset done banner and pause button
        const banner = document.getElementById("focus-done-banner");
        if (banner) banner.style.display = "none";
        const pauseBtn = document.getElementById("focus-pause-btn");
        if (pauseBtn) pauseBtn.textContent = "Pause";

        // Refresh display and start
        updateTimerDisplay();
        updateRingProgress();
        startTimer();
    });
});
