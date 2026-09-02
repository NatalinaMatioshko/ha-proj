const DAYS = [
  { id: "mon", name: "Понеділок" },
  { id: "tue", name: "Вівторок" },
  { id: "wed", name: "Середа" },
  { id: "thu", name: "Четвер" },
  { id: "fri", name: "Пʼятниця" },
];

const MORNING_HINTS = [
  ["9.15", "10.00"],
  ["10.00", "10.45"],
];

const AFTERNOON_HINTS = [
  ["15.00", "15.45"],
  ["15.45", "16.30"],
];

const STORAGE_KEY = "umka-schedule-template-v2";

const emptySlot = () => ({ from: "", to: "", lesson: "" });

function defaultState() {
  const days = {};
  for (const day of DAYS) {
    days[day.id] = {
      morning: MORNING_HINTS.map(() => emptySlot()),
      afternoon: AFTERNOON_HINTS.map(() => emptySlot()),
    };
  }
  return { group: "", days };
}

function mergeState(parsed) {
  const base = defaultState();
  if (!parsed || typeof parsed !== "object") return base;
  return {
    group: parsed.group ?? "",
    days: { ...base.days, ...(parsed.days || {}) },
  };
}

function encodeShare(data) {
  return encodeURIComponent(JSON.stringify(data));
}

function decodeShare(raw) {
  return JSON.parse(decodeURIComponent(raw));
}

function stateFromHash() {
  const hash = location.hash.startsWith("#s=") ? location.hash.slice(3) : "";
  if (!hash) return null;
  try {
    return mergeState(decodeShare(hash));
  } catch {
    return null;
  }
}

function loadState() {
  const fromLink = stateFromHash();
  if (fromLink) return fromLink;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return mergeState(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

let state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const next = `${location.pathname}${location.search}#s=${encodeShare(state)}`;
  history.replaceState(null, "", next);
}

function formatTime(value) {
  const raw = String(value).replace(/[^\d.]/g, "");
  if (raw.includes(".")) {
    const [h = "", m = ""] = raw.split(".");
    const hour = h.slice(0, 2);
    const mins = m.slice(0, 2);
    if (raw.endsWith(".") && !mins) return `${hour}.`;
    return mins.length ? `${hour}.${mins}` : hour;
  }
  const digits = raw.slice(0, 4);
  if (digits.length <= 2) return digits;
  if (digits.length === 3) return `${digits[0]}.${digits.slice(1)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2)}`;
}

function slotRow(dayId, section, index, slot, hints) {
  const hint = hints[index] || [" ", " "];
  return `
    <div class="row" data-day="${dayId}" data-section="${section}" data-index="${index}">
      <div class="time">
        <input
          class="time-from"
          inputmode="numeric"
          maxlength="5"
          placeholder="${hint[0]}"
          value="${slot.from}"
          aria-label="Початок"
        >
        <span>-</span>
        <input
          class="time-to"
          inputmode="numeric"
          maxlength="5"
          placeholder="${hint[1]}"
          value="${slot.to}"
          aria-label="Кінець"
        >
      </div>
      <span class="bullet">•</span>
      <input
        class="lesson"
        type="text"
        maxlength="80"
        placeholder="Назва уроку"
        value="${slot.lesson.replace(/"/g, "&quot;")}"
        aria-label="Назва уроку"
      >
    </div>
  `;
}

function render() {
  const root = document.getElementById("schedule");
  root.innerHTML = DAYS.map((day) => {
    const data = state.days[day.id];
    return `
      <section class="day" data-day="${day.id}">
        <h2 class="day-name">${day.name}</h2>
        <div class="slots" data-section="morning">
          ${data.morning.map((slot, i) => slotRow(day.id, "morning", i, slot, MORNING_HINTS)).join("")}
          <button class="add-row" type="button" data-add="${day.id}:morning">+ додати урок</button>
        </div>
        <h3 class="half-title">2 половина дня:</h3>
        <div class="slots" data-section="afternoon">
          ${data.afternoon.map((slot, i) => slotRow(day.id, "afternoon", i, slot, AFTERNOON_HINTS)).join("")}
          <button class="add-row" type="button" data-add="${day.id}:afternoon">+ додати урок</button>
        </div>
      </section>
    `;
  }).join("");

  document.getElementById("groupName").value = state.group;
}

function bind() {
  const root = document.getElementById("schedule");

  document.getElementById("groupName").addEventListener("input", (e) => {
    state.group = e.target.value;
    saveState();
  });

  root.addEventListener("input", (e) => {
    const row = e.target.closest(".row");
    if (!row) return;
    const { day, section, index } = row.dataset;
    const slot = state.days[day][section][Number(index)];
    if (e.target.classList.contains("time-from") || e.target.classList.contains("time-to")) {
      const formatted = formatTime(e.target.value);
      e.target.value = formatted;
      if (e.target.classList.contains("time-from")) slot.from = formatted;
      else slot.to = formatted;
    } else if (e.target.classList.contains("lesson")) {
      slot.lesson = e.target.value;
    }
    saveState();
  });

  root.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (!add) return;
    const [dayId, section] = add.dataset.add.split(":");
    state.days[dayId][section].push(emptySlot());
    saveState();
    render();
  });

  document.getElementById("printBtn").addEventListener("click", () => window.print());
  document.getElementById("shareBtn").addEventListener("click", async () => {
    saveState();
    const hint = document.getElementById("shareHint");
    try {
      await navigator.clipboard.writeText(location.href);
      hint.hidden = false;
      hint.textContent = "Посилання скопійовано. Відкрий його на іншому комп’ютері — розклад буде той самий.";
    } catch {
      hint.hidden = false;
      hint.textContent = "Скопіюй адресу з рядка браузера і відкрий її на іншому комп’ютері.";
    }
  });
  document.getElementById("resetBtn").addEventListener("click", () => {
    if (!confirm("Очистити весь розклад?")) return;
    state = defaultState();
    saveState();
    render();
  });

  window.addEventListener("hashchange", () => {
    const fromLink = stateFromHash();
    if (!fromLink) return;
    state = fromLink;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  render();
  bind();
  saveState();
});
