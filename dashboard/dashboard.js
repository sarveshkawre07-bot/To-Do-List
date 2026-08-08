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


    // Get form values

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


    // Create task object

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

        subtasks: subtasks,

        createdAt: serverTimestamp()

    };


    console.log("New task:", task);


    // Display task

    const user = auth.currentUser;

if (!user) {

    console.error("No authenticated user.");

    return;

}

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

task.id = taskRef.id;

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

});


// ======================================
// Display Task
// ======================================

function addTaskToUI(task) {

    const taskCard =
        document.createElement("article");

    taskCard.className = "task-card";


    taskCard.innerHTML = `

        <div class="task-check">

            <input
            type="checkbox"
            class="task-checkbox"
            ${task.completed ? "checked" : ""}
            >

        </div>


        <div class="task-info">

            <h3>
                ${task.title}
            </h3>

            <p>
                ${task.description || "No description added."}
            </p>


            <div class="task-meta">

    <span>
        📁 ${formatCategory(task.category)}
    </span>

    <span>
        ${getPriorityIcon(task.priority)}
        ${formatPriority(task.priority)}
    </span>

    ${
        task.dueDate && task.dueTime
        ? `
            <span>
                📅 ${task.dueDate}
                ⏰ ${formatTime(task.dueTime)}
            </span>
        `
        : task.dueDate
        ? `
            <span>
                📅 ${task.dueDate}
            </span>
        `
        : task.dueTime
        ? `
            <span>
                ⏰ ${formatTime(task.dueTime)}
            </span>
        `
        : ""
    }

</div>

        </div>


        <div class="task-actions">

            <button class="star-btn">
            ${task.starred ? "★" : "☆"}
            </button>

            <button class="more-btn" title="Delete task">
            🗑️
            </button>
        </div>

    `;


    taskList.appendChild(taskCard);

// Restore completed state visually
if (task.completed) {

    taskCard.classList.add("completed");

}

const checkbox =
    taskCard.querySelector(".task-checkbox");


checkbox.addEventListener("change", async () => {

    const user = auth.currentUser;

    if (!user) {

        console.error(
            "No authenticated user."
        );

        return;

    }

    const newCompletedState =
        checkbox.checked;

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
                completed: newCompletedState
            }
        );

        task.completed =
            newCompletedState;

        taskCard.classList.toggle(
            "completed",
            task.completed
        );

        console.log(
            "Task completion saved:",
            task.completed
        );

        updateProgress();

    } catch (error) {

        console.error(
            "Failed to update task:",
            error
        );

        // Revert checkbox if Firestore update fails
        checkbox.checked =
            task.completed;

    }

});;

const starButton =
    taskCard.querySelector(".star-btn");


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

        console.log(
            "Task star saved:",
            task.starred
        );

    } catch (error) {

        console.error(
            "Failed to update star:",
            error
        );

    }

});

// Delete Task

const deleteButton =
    taskCard.querySelector(".more-btn");

deleteButton.addEventListener("click", async () => {

    const confirmed =
        confirm(`Delete "${task.title}"?`);

    if (!confirmed) {
        return;
    }

    try {

        const user = auth.currentUser;

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

        console.log(
            "Task deleted from Firestore:",
            task
        );

        updateProgress();
        updateTaskCount();

    } catch (error) {

        console.error(
            "Failed to delete task:",
            error
        );

    }

});

}


// ======================================
// Category Formatting
// ======================================

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