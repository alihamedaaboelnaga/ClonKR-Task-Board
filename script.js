/* =========================================================
   SHARED TASK BOARD — script.js (v3)
   Optimistic updates + debounced realtime + safe controls
========================================================= */

/* ---------------------------------------------------------
   1. SUPABASE CONFIG
--------------------------------------------------------- */

const SUPABASE_URL = "https://ehmabwajvgjodptqnyqi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_3jVhLzBVSfGflE-h6ZWbdg_9AcUXvdM";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/* ---------------------------------------------------------
   2. CONSTANTS
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
   3. STATE
--------------------------------------------------------- */

let tasks = [];
let filterOwner = "all";
let tickerHandle = null;
let fetchDebounceHandle = null;

/* ---------------------------------------------------------
   4. DOM REFERENCES
--------------------------------------------------------- */

const els = {
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
   5. UTILITIES
--------------------------------------------------------- */

function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  // Fallback for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
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
    .map((o) => o.value.trim())
    .filter(Boolean);
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} · ${time}`;
}

function humanDuration(ms) {
  if (ms < 0) ms = 0;

  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);
  const months = Math.floor(days / 30);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min`;
  if (hours < 24) return `${hours} hr${hours > 1 ? "s" : ""}`;
  if (days < 30) return `${days} day${days > 1 ? "s" : ""}`;

  const extraDays = days - months * 30;
  return extraDays > 0
    ? `${months} mo ${extraDays} day${extraDays > 1 ? "s" : ""}`
    : `${months} mo`;
}

/* ---------------------------------------------------------
   6. DATABASE OPERATIONS
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
  return supabaseClient.from("tasks").insert([task]);
}

async function dbUpdateTask(id, updates) {
  return supabaseClient.from("tasks").update(updates).eq("id", id);
}

async function dbDeleteTask(id) {
  return supabaseClient.from("tasks").delete().eq("id", id);
}

/* Debounced fetch — avoids multiple rapid re-renders */
function scheduleFetch() {
  if (fetchDebounceHandle) clearTimeout(fetchDebounceHandle);
  fetchDebounceHandle = setTimeout(() => {
    fetchDebounceHandle = null;
    fetchTasks();
  }, 200);
}

/* ---------------------------------------------------------
   7. FILTERING
--------------------------------------------------------- */

function getVisibleTasks() {
  if (filterOwner === "all") return tasks;
  return tasks.filter((t) => t.owner === filterOwner);
}

/* ---------------------------------------------------------
   8. RENDERING
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
  startTicker();
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
      ? "No tasks yet"
      : `No tasks for ${filterOwner} yet`;
  return empty;
}

function createTaskCard(task) {
  const card = document.createElement("article");
  card.className = `task task--${task.status}`;
  card.dataset.id = task.id;

  /* -------- Top row -------- */
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

  /* -------- Notes -------- */
  if (task.notes && task.notes.trim()) {
    const notes = document.createElement("p");
    notes.className = "task-notes";
    notes.textContent = task.notes;
    card.appendChild(notes);
  }

  /* -------- Timeline -------- */
  const timeline = document.createElement("div");
  timeline.className = "task-timeline";

  /* Assigned */
  if (task.created_at) {
    timeline.appendChild(
      createTimelineRow({
        color: "blue",
        label: "Assigned",
        value: formatDateTime(task.created_at),
        hint:
          humanDuration(Date.now() - new Date(task.created_at).getTime()) +
          " ago",
      })
    );
  }

  /* In progress counter */
  if (task.status === "doing" && task.started_at) {
    const elapsedMs = Date.now() - new Date(task.started_at).getTime();
    timeline.appendChild(
      createTimelineRow({
        color: "amber",
        label: "In progress for",
        value: humanDuration(elapsedMs),
        hint: `since ${formatDate(task.started_at)}`,
        live: true,
        taskId: task.id,
      })
    );
  }

  /* Completed */
  if (task.status === "done" && task.completed_at) {
    const totalMs =
      new Date(task.completed_at).getTime() -
      new Date(task.created_at).getTime();

    timeline.appendChild(
      createTimelineRow({
        color: "green",
        label: "Completed",
        value: formatDateTime(task.completed_at),
        hint: `took ${humanDuration(totalMs)} total`,
      })
    );
  }

  card.appendChild(timeline);

  /* -------- Bottom row -------- */
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
  STATUSES.forEach((s) => {
    const option = document.createElement("option");
    option.value = s.value;
    option.textContent = s.label;
    option.selected = task.status === s.value;
    select.appendChild(option);
  });

  select.addEventListener("change", () => {
    handleStatusChange(task.id, select.value);
  });

  bottom.append(owner, select);
  card.appendChild(bottom);

  return card;
}

function createTimelineRow({ color, label, value, hint, live, taskId }) {
  const row = document.createElement("div");
  row.className = "timeline-row";

  const dot = document.createElement("span");
  dot.className = `timeline-dot dot-${color}`;

  const text = document.createElement("div");
  text.className = "timeline-text";

  const labelEl = document.createElement("span");
  labelEl.className = "timeline-label";
  labelEl.textContent = label;

  const valueEl = document.createElement("strong");
  valueEl.className = "timeline-value";
  valueEl.textContent = value;

  if (live && taskId) {
    valueEl.dataset.live = "duration";
    valueEl.dataset.taskId = taskId;
  }

  text.append(labelEl, valueEl);

  if (hint) {
    const hintEl = document.createElement("span");
    hintEl.className = "timeline-hint";
    hintEl.textContent = hint;
    text.appendChild(hintEl);
  }

  row.append(dot, text);
  return row;
}

/* ---------------------------------------------------------
   9. LIVE TICKER
--------------------------------------------------------- */

function startTicker() {
  if (tickerHandle) clearInterval(tickerHandle);

  tickerHandle = setInterval(() => {
    document.querySelectorAll('[data-live="duration"]').forEach((el) => {
      const task = tasks.find((t) => t.id === el.dataset.taskId);
      if (!task || !task.started_at) return;
      const ms = Date.now() - new Date(task.started_at).getTime();
      el.textContent = humanDuration(ms);
    });
  }, 30000);
}

/* ---------------------------------------------------------
   10. FILTER CHIPS
--------------------------------------------------------- */

function buildOwnerFilters() {
  els.ownerFilters.innerHTML = "";
  els.ownerFilters.appendChild(createChip("all", "All"));
  getOwners().forEach((o) => els.ownerFilters.appendChild(createChip(o, o)));
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
   11. ACTION HANDLERS  — optimistic + rollback on error
--------------------------------------------------------- */

async function handleAddTask(event) {
  event.preventDefault();

  const name = els.taskName.value.trim();
  if (!name) {
    els.taskName.focus();
    return;
  }

  /* -------- Optimistic insert -------- */
  const tempId = makeId();
  const nowIso = new Date().toISOString();

  const optimistic = {
    id: tempId,
    name,
    owner: els.taskOwner.value || "Unassigned",
    notes: els.taskNotes.value.trim(),
    status: "todo",
    date: nowIso.slice(0, 10),
    created_at: nowIso,
    started_at: null,
    completed_at: null,
  };

  tasks.unshift(optimistic);

  if (filterOwner !== "all" && optimistic.owner !== filterOwner) {
    filterOwner = "all";
    updateChipStates();
  }

  render();
  closeModal();

  /* -------- Persist -------- */
  const payload = {
    id: optimistic.id,
    name: optimistic.name,
    owner: optimistic.owner,
    notes: optimistic.notes,
    status: optimistic.status,
    date: optimistic.date,
  };

  const { error } = await dbInsertTask(payload);

  if (error) {
    console.error("Insert failed:", error.message);
    tasks = tasks.filter((t) => t.id !== tempId);
    render();
    alert("Could not save task: " + error.message);
  }
  // realtime will reconcile timestamps
}

async function handleStatusChange(id, status) {
  const task = tasks.find((t) => t.id === id);
  if (!task || task.status === status) return;

  /* Save previous values for rollback */
  const previous = {
    status: task.status,
    started_at: task.started_at,
    completed_at: task.completed_at,
  };

  /* Build updates based on transition */
  const updates = { status };

  if (status === "doing" && !task.started_at) {
    updates.started_at = new Date().toISOString();
  }
  if (status === "todo") {
    updates.started_at = null;
    updates.completed_at = null;
  }
  if (status === "done") {
    updates.completed_at = new Date().toISOString();
    if (!task.started_at) {
      updates.started_at = new Date().toISOString();
    }
  }
  if (status !== "done" && task.status === "done") {
    updates.completed_at = null;
  }

  /* -------- Optimistic update -------- */
  Object.assign(task, updates);
  render();

  /* -------- Persist -------- */
  const { error } = await dbUpdateTask(id, updates);

  if (error) {
    console.error("Update failed:", error.message);
    Object.assign(task, previous);
    render();
    alert("Could not update task: " + error.message);
  }
  // realtime will reconcile with server state
}

async function handleDelete(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  if (!window.confirm(`Delete "${task.name}"?`)) return;

  /* -------- Optimistic delete -------- */
  const index = tasks.indexOf(task);
  tasks.splice(index, 1);
  render();

  /* -------- Persist -------- */
  const { error } = await dbDeleteTask(id);

  if (error) {
    console.error("Delete failed:", error.message);
    tasks.splice(index, 0, task);
    render();
    alert("Could not delete task: " + error.message);
  }
}

/* ---------------------------------------------------------
   12. RESET UI
--------------------------------------------------------- */

function resetUI() {
  filterOwner = "all";
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
  if (filterOwner !== "all") els.taskOwner.value = filterOwner;
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

  els.modal.addEventListener("click", (e) => {
    if (e.target === els.modal) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.modal.classList.contains("hidden")) {
      closeModal();
    }
  });
}

/* ---------------------------------------------------------
   15. REALTIME SUBSCRIPTION  (debounced)
--------------------------------------------------------- */

function subscribeToChanges() {
  supabaseClient
    .channel("tasks-channel")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tasks" },
      () => scheduleFetch()
    )
    .subscribe();
}

/* ---------------------------------------------------------
   16. INIT
--------------------------------------------------------- */

async function init() {
  buildOwnerFilters();
  bindEvents();
  await fetchTasks();
  subscribeToChanges();
}

document.addEventListener("DOMContentLoaded", init);