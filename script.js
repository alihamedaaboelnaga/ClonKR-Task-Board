/* =========================================================
   SHARED TASK BOARD — script.js
   Features: per-owner filtering, date filtering, reset UI
========================================================= */

/* ---------------------------------------------------------
   CONSTANTS
--------------------------------------------------------- */

const STORAGE_KEY = "shared-task-board.tasks";

const STATUSES = [
  { value: "todo", label: "To Do" },
  { value: "doing", label: "In Progress" },
  { value: "done", label: "Done" },
];

/* Avatar colour palette — assigned by a hash of the owner name,
   so every owner always gets the same colour. */
const AVATAR_PALETTE = [
  { bg: "#dbeafe", fg: "#1d4ed8" },
  { bg: "#dcfce7", fg: "#15803d" },
  { bg: "#fef3c7", fg: "#b45309" },
  { bg: "#fce7f3", fg: "#be185d" },
  { bg: "#ede9fe", fg: "#6d28d9" },
  { bg: "#cffafe", fg: "#0e7490" },
];

/* ---------------------------------------------------------
   STATE
--------------------------------------------------------- */

let tasks = loadTasks();

/* "all" or an owner name such as "Ali" / "Mohamed" */
let filterOwner = "all";

/* ---------------------------------------------------------
   DOM REFERENCES
--------------------------------------------------------- */

const els = {
  datePicker: document.getElementById("datePicker"),
  addTaskBtn: document.getElementById("addTaskBtn"),

  ownerFilters: document.getElementById("ownerFilters"),
  filterSummary: document.getElementById("filterSummary"),
  resetBtn: document.getElementById("resetBtn"),

  totalTasks: document.getElementById("totalTasks"),
  progressTasks: document.getElementById("progressTasks"),
  completedTasks: document.getElementById("completedTasks"),

  todoList: document.getElementById("todoList"),
  doingList: document.getElementById("doingList"),
  doneList: document.getElementById("doneList"),

  todoCount: document.getElementById("todoCount"),
  doingCount: document.getElementById("doingCount"),
  doneCount: document.getElementById("doneCount"),

  modal: document.getElementById("modal"),
  closeModal: document.getElementById("closeModal"),
  cancelBtn: document.getElementById("cancelBtn"),

  taskForm: document.getElementById("taskForm"),
  taskName: document.getElementById("taskName"),
  taskOwner: document.getElementById("taskOwner"),
  taskNotes: document.getElementById("taskNotes"),
};

/* ---------------------------------------------------------
   STORAGE
--------------------------------------------------------- */

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) return [];

    /* Validate and normalise every saved task so a corrupt
       entry can never break the board. */
    return parsed
      .filter((task) => task && typeof task === "object")
      .map((task) => ({
        id: String(task.id ?? createId()),
        name: String(task.name ?? "Untitled task"),
        owner: String(task.owner ?? "Unassigned"),
        notes: String(task.notes ?? ""),
        status: STATUSES.some((s) => s.value === task.status)
          ? task.status
          : "todo",
        date: String(task.date ?? todayISO()),
        createdAt: Number(task.createdAt) || Date.now(),
      }));
  } catch (error) {
    console.warn("Could not read saved tasks:", error);
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.warn("Could not save tasks:", error);
  }
}

/* ---------------------------------------------------------
   UTILITIES
--------------------------------------------------------- */

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getAvatarColors(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

/* Reads the owner list straight from the <select> in the modal,
   so the HTML stays the single source of truth. */
function getOwners() {
  return Array.from(els.taskOwner.options)
    .map((option) => option.value.trim())
    .filter(Boolean);
}

/* ---------------------------------------------------------
   FILTERING
--------------------------------------------------------- */

function getVisibleTasks() {
  const date = els.datePicker.value || todayISO();

  return tasks.filter((task) => {
    const sameDate = task.date === date;
    const sameOwner = filterOwner === "all" || task.owner === filterOwner;
    return sameDate && sameOwner;
  });
}

/* ---------------------------------------------------------
   RENDERING
--------------------------------------------------------- */

function render() {
  const visible = getVisibleTasks();

  const groups = {
    todo: visible.filter((task) => task.status === "todo"),
    doing: visible.filter((task) => task.status === "doing"),
    done: visible.filter((task) => task.status === "done"),
  };

  renderColumn(els.todoList, groups.todo);
  renderColumn(els.doingList, groups.doing);
  renderColumn(els.doneList, groups.done);

  els.todoCount.textContent = groups.todo.length;
  els.doingCount.textContent = groups.doing.length;
  els.doneCount.textContent = groups.done.length;

  els.totalTasks.textContent = visible.length;
  els.progressTasks.textContent = groups.doing.length;
  els.completedTasks.textContent = groups.done.length;

  updateFilterSummary();
}

function renderColumn(listEl, listTasks) {
  listEl.innerHTML = "";

  if (listTasks.length === 0) {
    listEl.appendChild(createEmptyState());
    return;
  }

  /* Newest tasks first inside each column */
  [...listTasks]
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach((task) => listEl.appendChild(createTaskCard(task)));
}

function createEmptyState() {
  const empty = document.createElement("p");
  empty.className = "empty-state";

  empty.textContent =
    filterOwner === "all"
      ? "No tasks for this day"
      : `No tasks for ${filterOwner} on this day`;

  return empty;
}

function createTaskCard(task) {
  const card = document.createElement("article");
  card.className = "task" + (task.status === "done" ? " completed" : "");
  card.dataset.id = task.id;

  /* ---------- Top row: title + delete ---------- */
  const top = document.createElement("div");
  top.className = "task-top";

  const title = document.createElement("h3");
  title.className = "task-title";
  title.textContent = task.name;

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "×";
  deleteBtn.title = "Delete task";
  deleteBtn.setAttribute("aria-label", `Delete task: ${task.name}`);
  deleteBtn.addEventListener("click", () => handleDelete(task.id));

  top.append(title, deleteBtn);
  card.appendChild(top);

  /* ---------- Notes ---------- */
  if (task.notes.trim()) {
    const notes = document.createElement("p");
    notes.className = "task-notes";
    notes.textContent = task.notes;
    card.appendChild(notes);
  }

  /* ---------- Bottom row: owner + status ---------- */
  const bottom = document.createElement("div");
  bottom.className = "task-bottom";

  const owner = document.createElement("div");
  owner.className = "owner";

  const colors = getAvatarColors(task.owner);

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = getInitials(task.owner);
  avatar.style.background = colors.bg;
  avatar.style.color = colors.fg;

  const ownerName = document.createElement("span");
  ownerName.className = "owner-name";
  ownerName.textContent = task.owner;

  owner.append(avatar, ownerName);

  const select = document.createElement("select");
  select.className = "status-select";
  select.setAttribute("aria-label", `Status for ${task.name}`);

  STATUSES.forEach((status) => {
    const option = document.createElement("option");
    option.value = status.value;
    option.textContent = status.label;
    option.selected = task.status === status.value;
    select.appendChild(option);
  });

  select.addEventListener("change", () => {
    handleStatusChange(task.id, select.value);
  });

  bottom.append(owner, select);
  card.appendChild(bottom);

  return card;
}

/* ---------------------------------------------------------
   FILTER CHIPS
--------------------------------------------------------- */

function buildOwnerFilters() {
  els.ownerFilters.innerHTML = "";

  els.ownerFilters.appendChild(createChip("all", "All"));

  getOwners().forEach((owner) => {
    els.ownerFilters.appendChild(createChip(owner, owner));
  });
}

function createChip(value, label) {
  const chip = document.createElement("button");

  chip.type = "button";
  chip.className = "chip" + (filterOwner === value ? " active" : "");
  chip.dataset.owner = value;
  chip.textContent = label;

  chip.setAttribute(
    "aria-pressed",
    filterOwner === value ? "true" : "false"
  );

  chip.addEventListener("click", () => setOwnerFilter(value));

  return chip;
}

function updateChipStates() {
  els.ownerFilters.querySelectorAll(".chip").forEach((chip) => {
    const isActive = chip.dataset.owner === filterOwner;
    chip.classList.toggle("active", isActive);
    chip.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function setOwnerFilter(owner) {
  filterOwner = owner;
  updateChipStates();
  render();
}

function updateFilterSummary() {
  els.filterSummary.textContent =
    filterOwner === "all"
      ? "Showing all tasks"
      : `Showing ${filterOwner}'s tasks`;
}

/* ---------------------------------------------------------
   ACTIONS
--------------------------------------------------------- */

function handleAddTask(event) {
  event.preventDefault();

  const name = els.taskName.value.trim();
  if (!name) {
    els.taskName.focus();
    return;
  }

  const newTask = {
    id: createId(),
    name,
    owner: els.taskOwner.value || "Unassigned",
    notes: els.taskNotes.value.trim(),
    status: "todo",
    date: els.datePicker.value || todayISO(),
    createdAt: Date.now(),
  };

  tasks.push(newTask);
  saveTasks();

  /* Make sure the task the user just created is actually visible */
  if (filterOwner !== "all" && newTask.owner !== filterOwner) {
    filterOwner = "all";
    updateChipStates();
  }

  if (els.datePicker.value !== newTask.date) {
    els.datePicker.value = newTask.date;
  }

  closeModal();
  render();
}

function handleStatusChange(id, status) {
  const task = tasks.find((item) => item.id === id);
  if (!task || task.status === status) return;

  task.status = status;
  saveTasks();
  render();
}

function handleDelete(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  const confirmed = window.confirm(`Delete "${task.name}"?`);
  if (!confirmed) return;

  tasks = tasks.filter((item) => item.id !== id);
  saveTasks();
  render();
}

/* ---------------------------------------------------------
   RESET UI
   Restores the interface to its default state:
   today's date, "All" owners, closed modal, cleared form.
--------------------------------------------------------- */

function resetUI() {
  filterOwner = "all";

  els.datePicker.value = todayISO();

  els.taskForm.reset();
  closeModal();

  updateChipStates();
  render();
}

/* ---------------------------------------------------------
   MODAL
--------------------------------------------------------- */

function openModal() {
  els.taskForm.reset();

  /* Pre-select the owner currently being filtered */
  if (filterOwner !== "all") {
    els.taskOwner.value = filterOwner;
  }

  els.modal.classList.remove("hidden");
  els.taskName.focus();
}

function closeModal() {
  els.modal.classList.add("hidden");
}

/* ---------------------------------------------------------
   EVENTS
--------------------------------------------------------- */

function bindEvents() {
  els.addTaskBtn.addEventListener("click", openModal);
  els.closeModal.addEventListener("click", closeModal);
  els.cancelBtn.addEventListener("click", closeModal);

  els.taskForm.addEventListener("submit", handleAddTask);

  els.resetBtn.addEventListener("click", resetUI);

  /* Close modal when clicking the dark backdrop */
  els.modal.addEventListener("click", (event) => {
    if (event.target === els.modal) closeModal();
  });

  /* Close modal with Escape */
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.modal.classList.contains("hidden")) {
      closeModal();
    }
  });

  /* Date filter */
  els.datePicker.addEventListener("change", render);
}

/* ---------------------------------------------------------
   INIT
--------------------------------------------------------- */

function init() {
  els.datePicker.value = todayISO();

  buildOwnerFilters();
  bindEvents();
  render();
}

document.addEventListener("DOMContentLoaded", init);