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