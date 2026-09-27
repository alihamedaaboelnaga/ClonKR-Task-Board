/* =========================================================
   SHARED TASK BOARD — script.js (Supabase version)
========================================================= */

/* ---------------------------------------------------------
   1. SUPABASE CONFIG  ✅ جاهزة
--------------------------------------------------------- */

const SUPABASE_URL = "https://ehmabwajvgjodptqnyqi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_3jVhLzBVSfGflE-h6ZWbdg_9AcUXvdM";

/* ---------------------------------------------------------
   2. INIT SUPABASE CLIENT
--------------------------------------------------------- */

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/* ---------------------------------------------------------
   3. CONSTANTS
--------------------------------------------------------- */

const STATUSES = [
  { value: "todo", label: "To Do" },
  { value: "doing", label: "In Progress" },
  { value: "done", label: "Done" },
];

const AVATAR_PALETTE = [
  { bg: "#dbeafe", fg: "#1d4ed8" },
  { bg: "#dcfce7", fg: "#15803d" },
  { bg: "#fef3c7", fg: "#b45309" },
  { bg: "#fce7f3", fg: "#be185d" },
  { bg: "#ede9fe", fg: "#6d28d9" },
  { bg: "#cffafe", fg: "#0e7490" },
];

/* ---------------------------------------------------------
   4. STATE
--------------------------------------------------------- */

let tasks = [];
let filterOwner = "all";

/* ---------------------------------------------------------
   5. DOM REFERENCES
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
   6. UTILITIES
--------------------------------------------------------- */

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

function getOwners() {
  return Array.from(els.taskOwner.options)
    .map((option) => option.value.trim())
    .filter(Boolean);
}

/* ---------------------------------------------------------
   7. DATABASE OPERATIONS
--------------------------------------------------------- */

async function fetchTasks() {
  const { data, error } = await supabaseClient
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch tasks:", error.message);
    return;
  }

  tasks = data || [];
  render();
}

async function dbInsertTask(task) {
  const { error } = await supabaseClient.from("tasks").insert([task]);
  if (error) {
    console.error("Insert failed:", error.message);
    alert("Could not save task: " + error.message);
  }
}

async function dbUpdateStatus(id, status) {
  const { error } = await supabaseClient
    .from("tasks")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("Update failed:", error.message);
    alert("Could not update task: " + error.message);
  }
}

async function dbDeleteTask(id) {
  const { error } = await supabaseClient.from("tasks").delete().eq("id", id);
  if (error) {
    console.error("Delete failed:", error.message);
    alert("Could not delete task: " + error.message);
  }
}

/* ---------------------------------------------------------
   8. FILTERING
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
   9. RENDERING
--------------------------------------------------------- */

function render() {
  const visible = getVisibleTasks();

  const groups = {
    todo: visible.filter((t) => t.status === "todo"),
    doing: visible.filter((t) => t.status === "doing"),
    done: visible.filter((t) => t.status === "done"),
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

  listTasks.forEach((task) => listEl.appendChild(createTaskCard(task)));
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

  if (task.notes && task.notes.trim()) {
    const notes = document.createElement("p");
    notes.className = "task-notes";
    notes.textContent = task.notes;
    card.appendChild(notes);
  }

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
   10. FILTER CHIPS
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
  chip.setAttribute("aria-pressed", filterOwner === value ? "true" : "false");
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
   11. ACTION HANDLERS
--------------------------------------------------------- */

async function handleAddTask(event) {
  event.preventDefault();

  const name = els.taskName.value.trim();
  if (!name) {
    els.taskName.focus();
    return;
  }

  const newTask = {
    name,
    owner: els.taskOwner.value || "Unassigned",
    notes: els.taskNotes.value.trim(),
    status: "todo",
    date: els.datePicker.value || todayISO(),
  };

  await dbInsertTask(newTask);

  if (filterOwner !== "all" && newTask.owner !== filterOwner) {
    filterOwner = "all";
    updateChipStates();
  }

  if (els.datePicker.value !== newTask.date) {
    els.datePicker.value = newTask.date;
  }

  closeModal();
}

async function handleStatusChange(id, status) {
  const task = tasks.find((t) => t.id === id);
  if (!task || task.status === status) return;
  await dbUpdateStatus(id, status);
}

async function handleDelete(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;

  const confirmed = window.confirm(`Delete "${task.name}"?`);
  if (!confirmed) return;

  await dbDeleteTask(id);
}

/* ---------------------------------------------------------
   12. RESET UI
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
   13. MODAL
--------------------------------------------------------- */

function openModal() {
  els.taskForm.reset();
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
   14. EVENTS
--------------------------------------------------------- */

function bindEvents() {
  els.addTaskBtn.addEventListener("click", openModal);
  els.closeModal.addEventListener("click", closeModal);
  els.cancelBtn.addEventListener("click", closeModal);

  els.taskForm.addEventListener("submit", handleAddTask);
  els.resetBtn.addEventListener("click", resetUI);

  els.modal.addEventListener("click", (event) => {
    if (event.target === els.modal) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.modal.classList.contains("hidden")) {
      closeModal();
    }
  });

  els.datePicker.addEventListener("change", render);
}

/* ---------------------------------------------------------
   15. REALTIME SUBSCRIPTION
--------------------------------------------------------- */

function subscribeToChanges() {
  supabaseClient
    .channel("tasks-channel")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tasks" },
      () => {
        fetchTasks();
      }
    )
    .subscribe();
}

/* ---------------------------------------------------------
   16. INIT
--------------------------------------------------------- */

async function init() {
  els.datePicker.value = todayISO();
  buildOwnerFilters();
  bindEvents();

  await fetchTasks();
  subscribeToChanges();
}

document.addEventListener("DOMContentLoaded", init);