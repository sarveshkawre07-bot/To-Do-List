// ============================================================
// TO-DO FLOW - COMPLETE DASHBOARD
// ============================================================

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


// ============================================================
// GLOBAL VARIABLES
// ============================================================

let currentUser = null;

let allTasks = [];

let allGoals = [];

let categories = [
    {
        id: "personal",
        name: "Personal",
        icon: "👤"
    },
    {
        id: "work",
        name: "Work",
        icon: "💼"
    },
    {
        id: "study",
        name: "Study",
        icon: "📚"
    },
    {
        id: "fitness",
        name: "Fitness",
        icon: "🏋️"
    }
];

let currentPage = "today";

let editingTask = null;

let subtasks = [];

let selectedCalendarDate = null;

let calendarDate = new Date();


// ============================================================
// DOM
// ============================================================

const taskList =
    document.getElementById("taskList");

const taskModal =
    document.getElementById("taskModal");

const taskForm =
    document.getElementById("taskForm");

const addTaskBtn =
    document.getElementById("addTaskBtn");

const searchInput =
    document.getElementById("searchInput");

const pageTitle =
    document.getElementById("pageTitle");


// ============================================================
// THEME
// ============================================================

const themeToggle =
    document.getElementById("themeToggle");

function applyTheme(theme) {

    document.documentElement.setAttribute(
        "data-theme",
        theme
    );

    document.getElementById(
        "themeIcon"
    ).textContent =
        theme === "dark"
            ? "☀️"
            : "🌙";

    document.getElementById(
        "themeText"
    ).textContent =
        theme === "dark"
            ? "Light Mode"
            : "Dark Mode";
}

applyTheme(
    localStorage.getItem("theme") || "light"
);

themeToggle.addEventListener(
    "click",
    () => {

        const current =
            document.documentElement
                .getAttribute("data-theme");

        const newTheme =
            current === "dark"
                ? "light"
                : "dark";

        localStorage.setItem(
            "theme",
            newTheme
        );

        applyTheme(newTheme);
    }
);


// ============================================================
// DATE + GREETING
// ============================================================

function updateHeader() {

    const now = new Date();

    document.getElementById(
        "currentDate"
    ).textContent =
        now.toLocaleDateString(
            "en-US",
            {
                weekday: "long",
                month: "long",
                day: "numeric"
            }
        );


    const hour =
        now.getHours();

    let greeting;

    if (hour < 12) {

        greeting = "Good morning";

    } else if (hour < 18) {

        greeting = "Good afternoon";

    } else {

        greeting = "Good evening";
    }


    document.getElementById(
        "greetingText"
    ).textContent =
        greeting;
}

updateHeader();


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(
    auth,
    async (user) => {

        if (!user) {

            window.location.href =
                "../login/login.html";

            return;
        }


        currentUser = user;


        document.getElementById(
            "userName"
        ).textContent =
            user.displayName || "User";


        if (user.photoURL) {

            document.getElementById(
                "profileImage"
            ).src =
                user.photoURL;
        }


        await loadCategories();

        await loadTasks();

        await loadGoals();

        populateCategorySelect();

        renderPage();

        calculatePoints();

        requestNotificationPermission();

        setupReminderChecker();
    }
);


// ============================================================
// LOGOUT
// ============================================================

document.getElementById(
    "logoutBtn"
).addEventListener(
    "click",
    async () => {

        try {

            await signOut(auth);

            window.location.href =
                "../login/login.html";

        } catch (error) {

            console.error(error);

            alert(
                "Logout failed."
            );
        }
    }
);


// ============================================================
// NAVIGATION
// ============================================================

document
    .querySelectorAll(
        ".nav-item[data-page]"
    )
    .forEach(
        item => {

            item.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    currentPage =
                        item.dataset.page;


                    document
                        .querySelectorAll(
                            ".nav-item[data-page]"
                        )
                        .forEach(
                            nav =>
                                nav.classList.toggle(
                                    "active",
                                    nav.dataset.page ===
                                        currentPage
                                )
                        );


                    const titles = {

                        today: "Today",

                        "all-tasks":
                            "All Tasks",

                        important:
                            "Important",

                        calendar:
                            "Calendar",

                        goals:
                            "Goals",

                        progress:
                            "Progress",

                        focus:
                            "Focus",

                        categories:
                            "Categories"
                    };


                    pageTitle.textContent =
                        titles[currentPage];


                    renderPage();
                }
            );
        }
    );


// ============================================================
// SHOW PAGE
// ============================================================

function renderPage() {

    const taskView =
        document.getElementById(
            "taskView"
        );

    const calendarView =
        document.getElementById(
            "calendarView"
        );

    const goalsView =
        document.getElementById(
            "goalsView"
        );

    const progressView =
        document.getElementById(
            "progressView"
        );

    const focusView =
        document.getElementById(
            "focusView"
        );

    const categoriesView =
        document.getElementById(
            "categoriesView"
        );


    [
        taskView,
        calendarView,
        goalsView,
        progressView,
        focusView,
        categoriesView
    ]
        .forEach(
            view => {

                if (view) {
                    view.hidden = true;
                }
            }
        );


    const dashboardProgress =
        document.getElementById(
            "dashboardProgress"
        );


    dashboardProgress.hidden =
        currentPage !== "today";


    if (currentPage === "today") {

        taskView.hidden = false;

        document.getElementById(
            "taskSectionTitle"
        ).textContent =
            "Today's Tasks";

        renderTasks(
            getTodayTasks()
        );

    }


    else if (
        currentPage ===
        "all-tasks"
    ) {

        taskView.hidden = false;

        document.getElementById(
            "taskSectionTitle"
        ).textContent =
            "All Tasks";

        renderTasks(
            allTasks
        );

    }


    else if (
        currentPage ===
        "important"
    ) {

        taskView.hidden = false;

        document.getElementById(
            "taskSectionTitle"
        ).textContent =
            "Important Tasks";

        renderTasks(
            allTasks.filter(
                task =>
                    task.starred === true
            )
        );

    }


    else if (
        currentPage ===
        "calendar"
    ) {

        calendarView.hidden = false;

        renderCalendar();

    }


    else if (
        currentPage ===
        "goals"
    ) {

        goalsView.hidden = false;

        renderGoals();

    }


    else if (
        currentPage ===
        "progress"
    ) {

        progressView.hidden = false;

        renderProgress();

    }


    else if (
        currentPage ===
        "focus"
    ) {

        focusView.hidden = false;

    }


    else if (
        currentPage ===
        "categories"
    ) {

        categoriesView.hidden = false;

        renderCategories();
    }


    updateTaskCount();
    updateTodayProgress();
}


// ============================================================
// TASK LOADING
// ============================================================

async function loadTasks() {

    const taskCollection =
        collection(
            db,
            "users",
            currentUser.uid,
            "tasks"
        );


    const snapshot =
        await getDocs(
            taskCollection
        );


    allTasks = [];


    snapshot.forEach(
        item => {

            allTasks.push({

                id: item.id,

                ...item.data()
            });
        }
    );


    allTasks.sort(
        (a, b) => {

            const dateA =
                a.dueDate || "9999";

            const dateB =
                b.dueDate || "9999";

            return dateA.localeCompare(
                dateB
            );
        }
    );
}


// ============================================================
// TODAY
// ============================================================

function getTodayString() {

    const date =
        new Date();

    return `${date.getFullYear()}-${String(
        date.getMonth() + 1
    ).padStart(2, "0")}-${String(
        date.getDate()
    ).padStart(2, "0")}`;
}


function getTodayTasks() {

    const today =
        getTodayString();

    return allTasks.filter(
        task => {

            if (!task.dueDate) {
                return true;
            }

            return task.dueDate === today;
        }
    );
}


// ============================================================
// SEARCH
// ============================================================

searchInput.addEventListener(
    "input",
    () => {

        if (
            currentPage !==
            "today" &&
            currentPage !==
            "all-tasks" &&
            currentPage !==
            "important"
        ) {
            return;
        }


        let tasks;


        if (
            currentPage ===
            "today"
        ) {

            tasks =
                getTodayTasks();

        } else if (
            currentPage ===
            "important"
        ) {

            tasks =
                allTasks.filter(
                    task =>
                        task.starred
                );

        } else {

            tasks =
                allTasks;
        }


        const search =
            searchInput.value
                .trim()
                .toLowerCase();


        if (search) {

            tasks =
                tasks.filter(
                    task => {

                        return (
                            task.title
                                ?.toLowerCase()
                                .includes(search)
                            ||
                            task.description
                                ?.toLowerCase()
                                .includes(search)
                        );
                    }
                );
        }


        renderTasks(tasks);
    }
);


// ============================================================
// FILTER
// ============================================================

let activeFilter = "all";


document.getElementById(
    "filterBtn"
).addEventListener(
    "click",
    () => {

        const filters = [
            "all",
            "high",
            "medium",
            "low",
            "completed",
            "pending"
        ];


        const index =
            filters.indexOf(
                activeFilter
            );


        activeFilter =
            filters[
                (index + 1) %
                filters.length
            ];


        document.getElementById(
            "filterBtn"
        ).textContent =
            `Filter: ${activeFilter}`;


        applyFilter();
    }
);


function applyFilter() {

    let tasks =
        currentPage === "today"
            ? getTodayTasks()
            : allTasks;


    if (
        currentPage ===
        "important"
    ) {

        tasks =
            allTasks.filter(
                task =>
                    task.starred
            );
    }


    if (
        activeFilter ===
        "high"
    ) {

        tasks =
            tasks.filter(
                task =>
                    task.priority ===
                    "high"
            );
    }


    if (
        activeFilter ===
        "medium"
    ) {

        tasks =
            tasks.filter(
                task =>
                    task.priority ===
                    "medium"
            );
    }


    if (
        activeFilter ===
        "low"
    ) {

        tasks =
            tasks.filter(
                task =>
                    task.priority ===
                    "low"
            );
    }


    if (
        activeFilter ===
        "completed"
    ) {

        tasks =
            tasks.filter(
                task =>
                    task.completed
            );
    }


    if (
        activeFilter ===
        "pending"
    ) {

        tasks =
            tasks.filter(
                task =>
                    !task.completed
            );
    }


    renderTasks(tasks);
}


// ============================================================
// RENDER TASKS
// ============================================================

function renderTasks(tasks) {

    taskList.innerHTML = "";


    if (!tasks.length) {

        taskList.innerHTML = `
            <div class="empty-state">
                <div>📭</div>
                <h3>No tasks found</h3>
                <p>Create a task to get started.</p>
            </div>
        `;

        return;
    }


    tasks.forEach(
        task => {

            taskList.appendChild(
                createTaskCard(task)
            );
        }
    );
}


// ============================================================
// CREATE TASK CARD
// ============================================================

function createTaskCard(task) {

    const card =
        document.createElement(
            "article"
        );


    card.className =
        "task-card";


    if (task.completed) {

        card.classList.add(
            "completed"
        );
    }


    const row =
        document.createElement(
            "div"
        );

    row.className =
        "task-main-row";


    // Checkbox

    const check =
        document.createElement(
            "input"
        );

    check.type =
        "checkbox";

    check.checked =
        Boolean(task.completed);


    check.addEventListener(
        "change",
        () =>
            toggleTaskCompletion(
                task,
                check.checked
            )
    );


    const checkBox =
        document.createElement(
            "div"
        );

    checkBox.className =
        "task-check";

    checkBox.appendChild(check);


    // Information

    const info =
        document.createElement(
            "div"
        );

    info.className =
        "task-info";


    const title =
        document.createElement(
            "h3"
        );

    title.textContent =
        task.title;


    const description =
        document.createElement(
            "p"
        );

    description.textContent =
        task.description ||
        "No description added.";


    const meta =
        document.createElement(
            "div"
        );

    meta.className =
        "task-meta";


    meta.innerHTML = `
        <span>
            ${categoryIcon(task.category)}
            ${categoryName(task.category)}
        </span>

        <span>
            ${priorityIcon(task.priority)}
            ${task.priority || "Medium"}
        </span>

        ${
            task.dueDate
                ? `<span>📅 ${task.dueDate}</span>`
                : ""
        }

        ${
            task.dueTime
                ? `<span>⏰ ${formatTime(task.dueTime)}</span>`
                : ""
        }
    `;


    info.appendChild(title);

    info.appendChild(description);

    info.appendChild(meta);


    // Actions

    const actions =
        document.createElement(
            "div"
        );

    actions.className =
        "task-actions";


    const star =
        document.createElement(
            "button"
        );

    star.type =
        "button";

    star.className =
        "star-task-btn";

    star.textContent =
        task.starred
            ? "★"
            : "☆";


    if (task.starred) {

        star.classList.add(
            "important"
        );
    }


    star.onclick =
        () =>
            toggleStar(task);


    const edit =
        document.createElement(
            "button"
        );

    edit.type =
        "button";

    edit.textContent =
        "✏️";

    edit.title =
        "Edit";


    edit.onclick =
        () =>
            openEditTask(task);


    const remove =
        document.createElement(
            "button"
        );

    remove.type =
        "button";

    remove.textContent =
        "🗑️";

    remove.title =
        "Delete";


    remove.onclick =
        () =>
            deleteTask(task);


    actions.appendChild(star);

    actions.appendChild(edit);

    actions.appendChild(remove);


    row.appendChild(checkBox);

    row.appendChild(info);

    row.appendChild(actions);


    card.appendChild(row);


    // Subtasks

    if (
        task.subtasks &&
        task.subtasks.length
    ) {

        const subtaskArea =
            document.createElement(
                "div"
            );

        subtaskArea.className =
            "subtask-section";


        const completed =
            task.subtasks.filter(
                item =>
                    item.completed
            ).length;


        subtaskArea.innerHTML = `
            <div class="subtask-header">
                <strong>Subtasks</strong>
                <span>
                    ${completed} /
                    ${task.subtasks.length}
                    completed
                </span>
            </div>
        `;


        task.subtasks.forEach(
            subtask => {

                const label =
                    document.createElement(
                        "label"
                    );

                label.className =
                    "task-subtask";


                if (subtask.completed) {

                    label.classList.add(
                        "completed"
                    );
                }


                const subCheck =
                    document.createElement(
                        "input"
                    );

                subCheck.type =
                    "checkbox";

                subCheck.checked =
                    Boolean(
                        subtask.completed
                    );


                subCheck.onchange =
                    () =>
                        toggleSubtask(
                            task,
                            subtask,
                            subCheck.checked
                        );


                const text =
                    document.createElement(
                        "span"
                    );

                text.textContent =
                    subtask.title;


                label.appendChild(
                    subCheck
                );

                label.appendChild(
                    text
                );


                subtaskArea.appendChild(
                    label
                );
            }
        );


        card.appendChild(
            subtaskArea
        );
    }


    return card;
}


// ============================================================
// CREATE TASK
// ============================================================

addTaskBtn.addEventListener(
    "click",
    () => {

        editingTask = null;

        subtasks = [];

        taskForm.reset();

        populateCategorySelect();

        document.getElementById(
            "taskModalTitle"
        ).textContent =
            "Create New Task";


        document.getElementById(
            "taskSubmitBtn"
        ).textContent =
            "Create Task";


        renderSubtaskInputs();

        openModal(taskModal);
    }
);


// ============================================================
// SUBTASK INPUT
// ============================================================

document.getElementById(
    "addSubtaskBtn"
).addEventListener(
    "click",
    () => {

        const input =
            document.querySelector(
                ".subtask-title"
            );


        const value =
            input.value.trim();


        if (!value) {
            return;
        }


        subtasks.push({

            id:
                Date.now(),

            title:
                value,

            completed:
                false
        });


        input.value = "";

        renderSubtaskInputs();

        input.focus();
    }
);


function renderSubtaskInputs() {

    const container =
        document.getElementById(
            "subtaskInputContainer"
        );


    container.innerHTML = `
        <div class="subtask-input">

            <input
                class="subtask-title"
                type="text"
                placeholder="Add a subtask..."
            >

            <button
                id="addSubtaskBtn"
                type="button"
            >
                + Add
            </button>

        </div>
    `;


    subtasks.forEach(
        (subtask, index) => {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "subtask-item";


            item.innerHTML = `
                <span>☐</span>

                <span>
                    ${subtask.title}
                </span>

                <button
                    type="button"
                    class="remove-subtask"
                >
                    ×
                </button>
            `;


            item.querySelector(
                ".remove-subtask"
            ).onclick =
                () => {

                    subtasks.splice(
                        index,
                        1
                    );

                    renderSubtaskInputs();
                };


            container.appendChild(
                item
            );
        }
    );


    document.getElementById(
        "addSubtaskBtn"
    ).onclick =
        () => {

            const input =
                document.querySelector(
                    ".subtask-title"
                );


            if (!input.value.trim()) {
                return;
            }


            subtasks.push({

                id:
                    Date.now(),

                title:
                    input.value.trim(),

                completed:
                    false
            });


            renderSubtaskInputs();
        };
}


// ============================================================
// TASK SUBMIT
// ============================================================

taskForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        const data = {

            title:
                document.getElementById(
                    "taskTitle"
                ).value.trim(),

            description:
                document.getElementById(
                    "taskDescription"
                ).value.trim(),

            category:
                document.getElementById(
                    "taskCategory"
                ).value,

            priority:
                document.getElementById(
                    "taskPriority"
                ).value,

            dueDate:
                document.getElementById(
                    "taskDueDate"
                ).value,

            dueTime:
                document.getElementById(
                    "taskDueTime"
                ).value,

            reminder:
                document.getElementById(
                    "taskReminder"
                ).value,

            repeat:
                document.getElementById(
                    "taskRepeat"
                ).value,

            subtasks:
                [...subtasks]
        };


        try {

            if (editingTask) {

                await updateDoc(
                    doc(
                        db,
                        "users",
                        currentUser.uid,
                        "tasks",
                        editingTask.id
                    ),
                    data
                );


                Object.assign(
                    editingTask,
                    data
                );

            } else {

                const newTask = {

                    ...data,

                    completed:
                        false,

                    starred:
                        false,

                    createdAt:
                        serverTimestamp()
                };


                const result =
                    await addDoc(
                        collection(
                            db,
                            "users",
                            currentUser.uid,
                            "tasks"
                        ),
                        newTask
                    );


                newTask.id =
                    result.id;


                allTasks.push(
                    newTask
                );
            }


            closeModal(
                taskModal
            );


            renderPage();

            calculatePoints();

        } catch (error) {

            console.error(error);

            alert(
                "Could not save task."
            );
        }
    }
);


// ============================================================
// EDIT TASK
// ============================================================

function openEditTask(task) {

    editingTask =
        task;


    document.getElementById(
        "taskTitle"
    ).value =
        task.title || "";


    document.getElementById(
        "taskDescription"
    ).value =
        task.description || "";


    populateCategorySelect();


    document.getElementById(
        "taskCategory"
    ).value =
        task.category || "personal";


    document.getElementById(
        "taskPriority"
    ).value =
        task.priority || "medium";


    document.getElementById(
        "taskDueDate"
    ).value =
        task.dueDate || "";


    document.getElementById(
        "taskDueTime"
    ).value =
        task.dueTime || "";


    document.getElementById(
        "taskReminder"
    ).value =
        task.reminder || "none";


    document.getElementById(
        "taskRepeat"
    ).value =
        task.repeat || "none";


    subtasks =
        task.subtasks
            ? [...task.subtasks]
            : [];


    renderSubtaskInputs();


    document.getElementById(
        "taskModalTitle"
    ).textContent =
        "Edit Task";


    document.getElementById(
        "taskSubmitBtn"
    ).textContent =
        "Save Changes";


    openModal(taskModal);
}


// ============================================================
// DELETE
// ============================================================

async function deleteTask(task) {

    if (
        !confirm(
            `Delete "${task.title}"?`
        )
    ) {
        return;
    }


    try {

        await deleteDoc(
            doc(
                db,
                "users",
                currentUser.uid,
                "tasks",
                task.id
            )
        );


        allTasks =
            allTasks.filter(
                item =>
                    item.id !==
                    task.id
            );


        renderPage();

        calculatePoints();

    } catch (error) {

        console.error(error);

        alert(
            "Could not delete task."
        );
    }
}


// ============================================================
// COMPLETE TASK
// ============================================================

async function toggleTaskCompletion(
    task,
    completed
) {

    try {

        const updatedSubtasks =
            (task.subtasks || [])
                .map(
                    item => ({
                        ...item,
                        completed
                    })
                );


        await updateDoc(
            doc(
                db,
                "users",
                currentUser.uid,
                "tasks",
                task.id
            ),
            {
                completed,
                subtasks:
                    updatedSubtasks
            }
        );


        task.completed =
            completed;

        task.subtasks =
            updatedSubtasks;


        renderPage();

        calculatePoints();

    } catch (error) {

        console.error(error);

        alert(
            "Could not update task."
        );
    }
}


// ============================================================
// SUBTASK
// ============================================================

async function toggleSubtask(
    task,
    subtask,
    completed
) {

    subtask.completed =
        completed;


    const allCompleted =
        task.subtasks.length > 0 &&
        task.subtasks.every(
            item =>
                item.completed
        );


    task.completed =
        allCompleted;


    try {

        await updateDoc(
            doc(
                db,
                "users",
                currentUser.uid,
                "tasks",
                task.id
            ),
            {
                completed:
                    allCompleted,

                subtasks:
                    task.subtasks
            }
        );


        renderPage();

        calculatePoints();

    } catch (error) {

        console.error(error);
    }
}


// ============================================================
// STAR
// ============================================================

async function toggleStar(task) {

    const value =
        !task.starred;


    try {

        await updateDoc(
            doc(
                db,
                "users",
                currentUser.uid,
                "tasks",
                task.id
            ),
            {
                starred:
                    value
            }
        );


        task.starred =
            value;


        renderPage();

    } catch (error) {

        console.error(error);
    }
}


// ============================================================
// PROGRESS
// ============================================================

function updateTodayProgress() {

    const tasks =
        getTodayTasks();


    const completed =
        tasks.filter(
            task =>
                task.completed
        ).length;


    const total =
        tasks.length;


    document.getElementById(
        "progressText"
    ).textContent =
        `${completed} / ${total} completed`;


    const percentage =
        total
            ? (completed / total) * 100
            : 0;


    document.getElementById(
        "progressFill"
    ).style.width =
        `${percentage}%`;
}


function updateTaskCount() {

    const tasks =
        getTodayTasks();


    const count =
        tasks.length;


    document.getElementById(
        "taskCountText"
    ).textContent =
        count === 1
            ? "You have 1 task planned for today."
            : `You have ${count} tasks planned for today.`;
}


// ============================================================
// CALENDAR
// ============================================================

document.getElementById(
    "prevMonthBtn"
).onclick =
    () => {

        calendarDate.setMonth(
            calendarDate.getMonth() - 1
        );

        renderCalendar();
    };


document.getElementById(
    "nextMonthBtn"
).onclick =
    () => {

        calendarDate.setMonth(
            calendarDate.getMonth() + 1
        );

        renderCalendar();
    };


function renderCalendar() {

    const year =
        calendarDate.getFullYear();

    const month =
        calendarDate.getMonth();


    document.getElementById(
        "calendarMonth"
    ).textContent =
        calendarDate.toLocaleDateString(
            "en-US",
            {
                month: "long",
                year: "numeric"
            }
        );


    const grid =
        document.getElementById(
            "calendarGrid"
        );


    grid.innerHTML = "";


    [
        "Sun",
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat"
    ]
        .forEach(
            day => {

                const header =
                    document.createElement(
                        "div"
                    );

                header.className =
                    "calendar-day-name";

                header.textContent =
                    day;

                grid.appendChild(
                    header
                );
            }
        );


    const firstDay =
        new Date(
            year,
            month,
            1
        ).getDay();


    const daysInMonth =
        new Date(
            year,
            month + 1,
            0
        ).getDate();


    for (
        let i = 0;
        i < firstDay;
        i++
    ) {

        grid.appendChild(
            document.createElement(
                "div"
            )
        );
    }


    for (
        let day = 1;
        day <= daysInMonth;
        day++
    ) {

        const cell =
            document.createElement(
                "button"
            );


        cell.type =
            "button";

        cell.className =
            "calendar-cell";


        const dateString =
            `${year}-${String(
                month + 1
            ).padStart(2, "0")}-${String(
                day
            ).padStart(2, "0")}`;


        cell.innerHTML = `
            <strong>${day}</strong>
        `;


        const tasks =
            allTasks.filter(
                task =>
                    task.dueDate ===
                    dateString
            );


        if (tasks.length) {

            cell.innerHTML += `
                <span class="calendar-count">
                    ${tasks.length} task${tasks.length > 1 ? "s" : ""}
                </span>
            `;
        }


        cell.onclick =
            () => {

                selectedCalendarDate =
                    dateString;

                showCalendarTasks(
                    dateString
                );
            };


        grid.appendChild(
            cell
        );
    }


    document.getElementById(
        "calendarTasks"
    ).innerHTML = `
        <div class="empty-state">
            Select a date to see tasks.
        </div>
    `;
}


function showCalendarTasks(date) {

    const tasks =
        allTasks.filter(
            task =>
                task.dueDate ===
                date
        );


    const container =
        document.getElementById(
            "calendarTasks"
        );


    container.innerHTML = `
        <h3>
            Tasks for ${date}
        </h3>
    `;


    if (!tasks.length) {

        container.innerHTML += `
            <p>No tasks for this date.</p>
        `;

        return;
    }


    tasks.forEach(
        task => {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "calendar-task-item";


            item.innerHTML = `
                <strong>
                    ${task.completed ? "✅" : "⬜"}
                    ${task.title}
                </strong>

                <span>
                    ${task.dueTime || "No time"}
                </span>
            `;


            container.appendChild(
                item
            );
        }
    );
}


// ============================================================
// GOALS
// ============================================================

document.getElementById(
    "addGoalBtn"
).onclick =
    () =>
        openModal(
            document.getElementById(
                "goalModal"
            )
        );


document.getElementById(
    "closeGoalModalBtn"
).onclick =
    () =>
        closeModal(
            document.getElementById(
                "goalModal"
            )
        );


document.getElementById(
    "cancelGoalBtn"
).onclick =
    () =>
        closeModal(
            document.getElementById(
                "goalModal"
            )
        );


document.getElementById(
    "goalForm"
).addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        const goal = {

            title:
                document.getElementById(
                    "goalTitle"
                ).value.trim(),

            target:
                Number(
                    document.getElementById(
                        "goalTarget"
                    ).value
                ),

            progress:
                0,

            createdAt:
                serverTimestamp()
        };


        try {

            const result =
                await addDoc(
                    collection(
                        db,
                        "users",
                        currentUser.uid,
                        "goals"
                    ),
                    goal
                );


            goal.id =
                result.id;


            allGoals.push(
                goal
            );


            event.target.reset();

            closeModal(
                document.getElementById(
                    "goalModal"
                )
            );


            renderGoals();

        } catch (error) {

            console.error(error);

            alert(
                "Could not create goal."
            );
        }
    }
);


async function loadGoals() {

    try {

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "users",
                    currentUser.uid,
                    "goals"
                )
            );


        allGoals = [];


        snapshot.forEach(
            item => {

                allGoals.push({

                    id:
                        item.id,

                    ...item.data()
                });
            }
        );

    } catch (error) {

        console.error(
            "Goals error:",
            error
        );
    }
}


function renderGoals() {

    const container =
        document.getElementById(
            "goalList"
        );


    container.innerHTML = "";


    if (!allGoals.length) {

        container.innerHTML = `
            <div class="empty-state">
                🎯
                <h3>No goals yet</h3>
                <p>Create your first goal.</p>
            </div>
        `;

        return;
    }


    allGoals.forEach(
        goal => {

            const percentage =
                Math.min(
                    100,
                    ((goal.progress || 0) /
                        goal.target) *
                        100
                );


            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "goal-card";


            card.innerHTML = `
                <div class="goal-header">

                    <div>
                        <h3>
                            ${goal.title}
                        </h3>

                        <p>
                            ${goal.progress || 0}
                            / ${goal.target}
                        </p>
                    </div>

                    <button
                        class="delete-goal"
                        type="button"
                    >
                        🗑️
                    </button>

                </div>

                <div class="progress-bar">
                    <div
                        class="progress-fill"
                        style="width:${percentage}%"
                    ></div>
                </div>

                <button
                    class="goal-progress-btn"
                    type="button"
                >
                    +1 Progress
                </button>
            `;


            card.querySelector(
                ".goal-progress-btn"
            ).onclick =
                async () => {

                    if (
                        goal.progress >=
                        goal.target
                    ) {
                        return;
                    }


                    goal.progress =
                        (goal.progress || 0) + 1;


                    await updateDoc(
                        doc(
                            db,
                            "users",
                            currentUser.uid,
                            "goals",
                            goal.id
                        ),
                        {
                            progress:
                                goal.progress
                        }
                    );


                    renderGoals();
                };


            card.querySelector(
                ".delete-goal"
            ).onclick =
                async () => {

                    if (
                        !confirm(
                            "Delete this goal?"
                        )
                    ) {
                        return;
                    }


                    await deleteDoc(
                        doc(
                            db,
                            "users",
                            currentUser.uid,
                            "goals",
                            goal.id
                        )
                    );


                    allGoals =
                        allGoals.filter(
                            item =>
                                item.id !==
                                goal.id
                        );


                    renderGoals();
                };


            container.appendChild(
                card
            );
        }
    );
}


// ============================================================
// PROGRESS PAGE
// ============================================================

function renderProgress() {

    const total =
        allTasks.length;


    const completed =
        allTasks.filter(
            task =>
                task.completed
        ).length;


    const pending =
        total - completed;


    const important =
        allTasks.filter(
            task =>
                task.starred
        ).length;


    const percentage =
        total
            ? Math.round(
                completed /
                total *
                100
            )
            : 0;


    document.getElementById(
        "statisticsContainer"
    ).innerHTML = `

        <div class="stat-box">
            <span>📋</span>
            <strong>${total}</strong>
            <small>Total Tasks</small>
        </div>

        <div class="stat-box">
            <span>✅</span>
            <strong>${completed}</strong>
            <small>Completed</small>
        </div>

        <div class="stat-box">
            <span>⏳</span>
            <strong>${pending}</strong>
            <small>Pending</small>
        </div>

        <div class="stat-box">
            <span>⭐</span>
            <strong>${important}</strong>
            <small>Important</small>
        </div>

        <div class="stat-box">
            <span>📈</span>
            <strong>${percentage}%</strong>
            <small>Completion Rate</small>
        </div>

    `;


    const categoryContainer =
        document.getElementById(
            "categoryProgress"
        );


    categoryContainer.innerHTML =
        "<h3>Category Progress</h3>";


    categories.forEach(
        category => {

            const tasks =
                allTasks.filter(
                    task =>
                        task.category ===
                        category.id
                );


            const done =
                tasks.filter(
                    task =>
                        task.completed
                ).length;


            const percent =
                tasks.length
                    ? done /
                        tasks.length *
                        100
                    : 0;


            categoryContainer.innerHTML += `

                <div class="category-progress-row">

                    <div>
                        ${category.icon}
                        ${category.name}
                    </div>

                    <strong>
                        ${done}/${tasks.length}
                    </strong>

                    <div class="progress-bar">
                        <div
                            class="progress-fill"
                            style="width:${percent}%"
                        ></div>
                    </div>

                </div>
            `;
        }
    );
}


// ============================================================
// FOCUS TIMER
// ============================================================

let timerSeconds = 25 * 60;

let timerInterval = null;

let focusRunning = false;


function updateTimerDisplay() {

    const minutes =
        Math.floor(
            timerSeconds / 60
        );

    const seconds =
        timerSeconds % 60;


    document.getElementById(
        "timerDisplay"
    ).textContent =
        `${String(minutes).padStart(2, "0")}:${String(
            seconds
        ).padStart(2, "0")}`;
}


document.getElementById(
    "startTimerBtn"
).onclick =
    () => {

        if (focusRunning) {
            return;
        }


        focusRunning =
            true;


        timerInterval =
            setInterval(
                () => {

                    timerSeconds--;

                    updateTimerDisplay();


                    if (
                        timerSeconds <=
                        0
                    ) {

                        clearInterval(
                            timerInterval
                        );

                        focusRunning =
                            false;

                        alert(
                            "Focus session completed! 🎉"
                        );

                        timerSeconds =
                            5 * 60;

                        document.getElementById(
                            "focusMode"
                        ).textContent =
                            "Break Time";

                        updateTimerDisplay();
                    }

                },
                1000
            );
    };


document.getElementById(
    "pauseTimerBtn"
).onclick =
    () => {

        clearInterval(
            timerInterval
        );

        focusRunning =
            false;
    };


document.getElementById(
    "resetTimerBtn"
).onclick =
    () => {

        clearInterval(
            timerInterval
        );

        focusRunning =
            false;

        timerSeconds =
            25 * 60;

        document.getElementById(
            "focusMode"
        ).textContent =
            "Focus Time";

        updateTimerDisplay();
    };


updateTimerDisplay();


// ============================================================
// CATEGORIES
// ============================================================

async function loadCategories() {

    try {

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "users",
                    currentUser.uid,
                    "categories"
                )
            );


        snapshot.forEach(
            item => {

                const data =
                    item.data();


                if (
                    !categories.some(
                        category =>
                            category.id ===
                            item.id
                    )
                ) {

                    categories.push({

                        id:
                            item.id,

                        name:
                            data.name,

                        icon:
                            data.icon ||
                            "📁"
                    });
                }
            }
        );

    } catch (error) {

        console.log(
            "Using default categories."
        );
    }
}


function populateCategorySelect() {

    const select =
        document.getElementById(
            "taskCategory"
        );


    select.innerHTML = "";


    categories.forEach(
        category => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                category.id;

            option.textContent =
                `${category.icon} ${category.name}`;


            select.appendChild(
                option
            );
        }
    );
}


document.getElementById(
    "addCategoryBtn"
).onclick =
    async () => {

        const input =
            document.getElementById(
                "newCategoryInput"
            );


        const name =
            input.value.trim();


        if (!name) {
            return;
        }


        const id =
            name
                .toLowerCase()
                .replace(
                    /[^a-z0-9]+/g,
                    "-"
                );


        if (
            categories.some(
                category =>
                    category.id === id
            )
        ) {

            alert(
                "Category already exists."
            );

            return;
        }


        try {

            await addDoc(
                collection(
                    db,
                    "users",
                    currentUser.uid,
                    "categories"
                ),
                {
                    name,
                    icon: "📁"
                }
            );


            categories.push({

                id,

                name,

                icon: "📁"
            });


            input.value = "";

            populateCategorySelect();

            renderCategories();

        } catch (error) {

            console.error(error);

            alert(
                "Could not create category."
            );
        }
    };


function renderCategories() {

    const container =
        document.getElementById(
            "categoryList"
        );


    container.innerHTML = "";


    categories.forEach(
        category => {

            const taskCount =
                allTasks.filter(
                    task =>
                        task.category ===
                        category.id
                ).length;


            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "category-card";


            item.innerHTML = `

                <div>
                    <span class="category-icon">
                        ${category.icon}
                    </span>

                    <strong>
                        ${category.name}
                    </strong>

                    <small>
                        ${taskCount} task${taskCount !== 1 ? "s" : ""}
                    </small>
                </div>

                <button
                    type="button"
                    class="category-open-btn"
                >
                    View
                </button>
            `;


            item.querySelector(
                ".category-open-btn"
            ).onclick =
                () => {

                    currentPage =
                        "all-tasks";


                    document
                        .querySelectorAll(
                            ".nav-item[data-page]"
                        )
                        .forEach(
                            nav =>
                                nav.classList.toggle(
                                    "active",
                                    nav.dataset.page ===
                                        "all-tasks"
                                )
                        );


                    pageTitle.textContent =
                        `${category.name} Tasks`;


                    document.getElementById(
                        "taskView"
                    ).hidden =
                        false;


                    document
                        .querySelectorAll(
                            ".page-view"
                        )
                        .forEach(
                            view =>
                                view.hidden =
                                    true
                        );


                    renderTasks(
                        allTasks.filter(
                            task =>
                                task.category ===
                                category.id
                        )
                    );
                };


            container.appendChild(
                item
            );
        }
    );
}


// ============================================================
// CATEGORY HELPERS
// ============================================================

function categoryName(id) {

    const category =
        categories.find(
            item =>
                item.id === id
        );


    return category
        ? category.name
        : "Other";
}


function categoryIcon(id) {

    const category =
        categories.find(
            item =>
                item.id === id
        );


    return category
        ? category.icon
        : "📁";
}


function priorityIcon(priority) {

    if (
        priority ===
        "high"
    ) {
        return "🔴";
    }

    if (
        priority ===
        "low"
    ) {
        return "🟢";
    }

    return "🟡";
}


function formatTime(time) {

    if (!time) {
        return "";
    }


    const parts =
        time.split(":");


    const date =
        new Date();


    date.setHours(
        Number(parts[0]),
        Number(parts[1])
    );


    return date.toLocaleTimeString(
        "en-US",
        {
            hour: "numeric",
            minute: "2-digit"
        }
    );
}


// ============================================================
// POINTS
// ============================================================

function calculatePoints() {

    const completed =
        allTasks.filter(
            task =>
                task.completed
        ).length;


    const points =
        completed * 10;


    document.getElementById(
        "pointsValue"
    ).textContent =
        points.toLocaleString();
}


// ============================================================
// MODAL
// ============================================================

function openModal(modal) {

    modal.hidden =
        false;

    modal.classList.add(
        "show"
    );
}


function closeModal(modal) {

    modal.classList.remove(
        "show"
    );

    modal.hidden =
        true;
}


document.getElementById(
    "closeModalBtn"
).onclick =
    () =>
        closeModal(taskModal);


document.getElementById(
    "cancelTaskBtn"
).onclick =
    () =>
        closeModal(taskModal);


document.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
            "Escape"
        ) {

            closeModal(taskModal);

            closeModal(
                document.getElementById(
                    "goalModal"
                )
            );
        }
    }
);


// ============================================================
// REMINDERS
// ============================================================

async function requestNotificationPermission() {

    if (
        "Notification" in window &&
        Notification.permission ===
            "default"
    ) {

        try {

            await Notification.requestPermission();

        } catch (error) {

            console.log(
                "Notification permission not available."
            );
        }
    }
}


function setupReminderChecker() {

    setInterval(
        checkReminders,
        30000
    );

    checkReminders();
}


function checkReminders() {

    if (
        !("Notification" in window) ||
        Notification.permission !==
            "granted"
    ) {
        return;
    }


    const now =
        new Date();


    allTasks.forEach(
        task => {

            if (
                !task.dueDate ||
                !task.dueTime ||
                task.reminder ===
                    "none" ||
                task.completed
            ) {
                return;
            }


            const due =
                new Date(
                    `${task.dueDate}T${task.dueTime}`
                );


            const reminderMinutes =
                Number(
                    task.reminder
                );


            const reminderTime =
                due.getTime() -
                reminderMinutes *
                    60 *
                    1000;


            const difference =
                now.getTime() -
                reminderTime;


            if (
                difference >= 0 &&
                difference < 60000
            ) {

                const key =
                    `reminder-${task.id}-${task.dueDate}-${task.dueTime}`;


                if (
                    !sessionStorage.getItem(
                        key
                    )
                ) {

                    new Notification(
                        "To-Do Flow Reminder",
                        {
                            body:
                                task.title
                        }
                    );


                    sessionStorage.setItem(
                        key,
                        "sent"
                    );
                }
            }
        }
    );
}


// ============================================================
// INITIAL
// ============================================================

renderPage();