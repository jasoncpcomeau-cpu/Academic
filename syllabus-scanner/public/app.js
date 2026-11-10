// SyllaPlan front end: scan → review → plan. State lives in localStorage.

const STORAGE_KEY = "syllaplan.v1";
const COLORS = ["#4f46e5", "#0e9f6e", "#e5484d", "#d97706", "#0891b2", "#9333ea", "#db2777", "#65a30d"];
const EVENT_TYPES = ["assignment", "exam", "quiz", "project", "paper", "lab", "presentation", "reading", "deadline", "no_class", "other"];
const TYPE_LABEL = (t) => (t === "no_class" ? "no class" : t);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const todayISO = () => toISO(new Date());
function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
const fmtDate = (iso, opts = { weekday: "short", month: "short", day: "numeric" }) => parseISO(iso).toLocaleDateString(undefined, opts);
function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// ---------- state ----------
let state = load();
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* storage unavailable */ }
  return { courses: [] };
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}
const courseById = (id) => state.courses.find((c) => c.id === id);

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove("show"), 2600);
}

// ---------- navigation ----------
function show(view) {
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === view));
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
  render(view);
}
$$(".tab").forEach((t) => t.addEventListener("click", () => show(t.dataset.view)));

function render(view) {
  if (view === "upcoming") renderUpcoming();
  if (view === "calendar") renderCalendar();
  if (view === "courses") renderCourses();
  if (view === "grades") renderGrades();
}

// ---------- scan ----------
let pendingFiles = [];
const fileInput = $("#file-input");
const dropzone = $("#dropzone");

function renderFileList() {
  $("#file-list").innerHTML = pendingFiles
    .map((f, i) => `<li>${esc(f.name)} <button type="button" data-i="${i}" aria-label="Remove ${esc(f.name)}">×</button></li>`)
    .join("");
}
function addFiles(list) {
  pendingFiles = [...pendingFiles, ...list].slice(0, 10);
  renderFileList();
}
fileInput.addEventListener("change", () => { addFiles(fileInput.files); fileInput.value = ""; });
$("#file-list").addEventListener("click", (e) => {
  const i = e.target.dataset.i;
  if (i !== undefined) { pendingFiles.splice(Number(i), 1); renderFileList(); }
});
["dragenter", "dragover"].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("drag"); }));
["dragleave", "drop"].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove("drag"); }));
dropzone.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));

$("#scan-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("#paste-text").value.trim();
  const status = $("#scan-status");
  if (!pendingFiles.length && !text) {
    status.className = "status error";
    status.textContent = "Add a file or paste the syllabus text first.";
    return;
  }
  const fd = new FormData();
  pendingFiles.forEach((f) => fd.append("files", f));
  fd.append("text", text);
  fd.append("termStart", $("#term-start").value);

  const btn = $("#scan-btn");
  btn.disabled = true;
  status.className = "status";
  status.innerHTML = `<span class="spinner"></span>Reading your syllabus… this usually takes 20–60 seconds.`;
  try {
    const res = await fetch("/api/extract", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    status.textContent = data.mock ? "Showing sample data (server is in mock mode)." : "";
    openReview(fromExtraction(data.syllabus));
    pendingFiles = [];
    renderFileList();
    $("#paste-text").value = "";
  } catch (err) {
    status.className = "status error";
    status.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

function fromExtraction(s) {
  const used = new Set(state.courses.map((c) => c.color));
  return {
    id: uid(),
    color: COLORS.find((c) => !used.has(c)) ?? COLORS[state.courses.length % COLORS.length],
    course: s.course,
    grading: s.grading.map((g) => ({ ...g, id: uid() })),
    events: s.events.map((ev) => ({ ...ev, id: uid(), done: false })),
    policies: s.policies,
    scores: {},
    isNew: true,
  };
}

// ---------- review / edit ----------
let draft = null;

function openReview(course) {
  draft = structuredClone(course);
  show("scan");
  renderReview();
  $("#review").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderReview() {
  const el = $("#review");
  if (!draft) { el.classList.add("hidden"); return; }
  el.classList.remove("hidden");
  const c = draft.course;
  const total = draft.grading.reduce((s, g) => s + (Number(g.weight) || 0), 0);
  const unresolved = draft.events.filter((e) => !e.date).length;
  const catOptions = (sel) =>
    `<option value="">—</option>` + draft.grading.map((g) => `<option ${g.category === sel ? "selected" : ""}>${esc(g.category)}</option>`).join("");
  const sorted = [...draft.events].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));

  el.innerHTML = `
    <div class="card">
      <div class="review-head">
        <div>
          <h2>Review ${draft.isNew ? "what we found" : "course"}</h2>
          <p class="muted small">${draft.events.length} items · ${draft.grading.length} grading categories${unresolved ? ` · <span class="hint">${unresolved} without a date — fill them in or leave them undated</span>` : ""}</p>
        </div>
        <label class="check"><input type="color" id="r-color" value="${draft.color}" style="width:2.2rem;padding:0;height:2rem"> Color</label>
      </div>
      <div class="grid-2">
        ${field("Course title", "title", c.title)}
        ${field("Code", "code", c.code)}
        ${field("Instructor", "instructor", c.instructor)}
        ${field("Email", "email", c.email)}
        ${field("Term", "term", c.term)}
        ${field("Meets", "meeting_times", c.meeting_times)}
        ${field("Location", "location", c.location)}
        ${field("Office hours", "office_hours", c.office_hours)}
      </div>
    </div>

    <div class="card">
      <h3>Grading breakdown <span class="weights-total ${Math.abs(total - 100) > 0.5 ? "off" : ""}">(${round(total)}%)</span></h3>
      ${Math.abs(total - 100) > 0.5 && draft.grading.length ? `<p class="hint">Weights add up to ${round(total)}%, not 100%. Check the syllabus.</p>` : ""}
      <div class="table-wrap"><table>
        <thead><tr><th>Category</th><th>Weight %</th><th>Notes</th><th></th></tr></thead>
        <tbody>
          ${draft.grading.map((g) => `
            <tr data-gid="${g.id}">
              <td class="title-cell"><input data-g="category" value="${esc(g.category)}"></td>
              <td class="num-cell"><input data-g="weight" type="number" step="0.1" min="0" max="100" value="${g.weight ?? ""}"></td>
              <td><input data-g="notes" value="${esc(g.notes ?? "")}"></td>
              <td><button class="icon-btn" data-del-g="${g.id}" aria-label="Delete category">✕</button></td>
            </tr>`).join("")}
        </tbody>
      </table></div>
      <button class="btn small" id="add-cat" type="button">+ Add category</button>
    </div>

    <div class="card">
      <h3>Deadlines & dates</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Title</th><th>Type</th><th>Date</th><th>Time</th><th>Category</th><th></th></tr></thead>
        <tbody>
          ${sorted.map((ev) => `
            <tr data-eid="${ev.id}" class="${ev.date ? "" : "unresolved"}">
              <td class="title-cell"><input data-e="title" value="${esc(ev.title)}">
                ${!ev.date && ev.date_text ? `<div class="hint">Syllabus says: “${esc(ev.date_text)}”</div>` : ""}
                ${ev.notes ? `<div class="muted small">${esc(ev.notes)}</div>` : ""}</td>
              <td><select data-e="type">${EVENT_TYPES.map((t) => `<option value="${t}" ${t === ev.type ? "selected" : ""}>${TYPE_LABEL(t)}</option>`).join("")}</select></td>
              <td class="date-cell"><input data-e="date" type="date" value="${ev.date ?? ""}"></td>
              <td class="time-cell"><input data-e="time" type="time" value="${ev.time ?? ""}"></td>
              <td><select data-e="category">${catOptions(ev.category)}</select></td>
              <td><button class="icon-btn" data-del-e="${ev.id}" aria-label="Delete item">✕</button></td>
            </tr>`).join("")}
        </tbody>
      </table></div>
      <button class="btn small" id="add-ev" type="button">+ Add item</button>
    </div>

    ${draft.policies?.length ? `<div class="card"><h3>Policies to know</h3><ul class="policies">${draft.policies.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>` : ""}

    <div class="actions">
      <button class="btn" id="discard" type="button">${draft.isNew ? "Discard" : "Cancel"}</button>
      <button class="btn primary" id="save-course" type="button">${draft.isNew ? "Save course" : "Save changes"}</button>
    </div>`;
}

function field(label, key, value) {
  return `<label>${label}<input data-c="${key}" value="${esc(value ?? "")}"></label>`;
}
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

$("#review").addEventListener("input", (e) => {
  const t = e.target;
  if (!draft) return;
  if (t.id === "r-color") draft.color = t.value;
  if (t.dataset.c) draft.course[t.dataset.c] = t.value || null;
  if (t.dataset.g) {
    const g = draft.grading.find((x) => x.id === t.closest("tr").dataset.gid);
    const old = g.category;
    g[t.dataset.g] = t.dataset.g === "weight" ? (t.value === "" ? null : Number(t.value)) : t.value;
    if (t.dataset.g === "category") draft.events.forEach((ev) => { if (ev.category === old) ev.category = t.value; });
  }
  if (t.dataset.e) {
    const ev = draft.events.find((x) => x.id === t.closest("tr").dataset.eid);
    ev[t.dataset.e] = t.value || null;
    if (t.dataset.e === "date") t.closest("tr").classList.toggle("unresolved", !t.value);
  }
});
$("#review").addEventListener("change", (e) => {
  if (e.target.dataset.g === "weight" || e.target.dataset.g === "category") renderReview();
});
$("#review").addEventListener("click", (e) => {
  const t = e.target;
  if (t.dataset.delG) { draft.grading = draft.grading.filter((g) => g.id !== t.dataset.delG); renderReview(); }
  if (t.dataset.delE) { draft.events = draft.events.filter((x) => x.id !== t.dataset.delE); renderReview(); }
  if (t.id === "add-cat") { draft.grading.push({ id: uid(), category: "New category", weight: null, notes: null }); renderReview(); }
  if (t.id === "add-ev") {
    draft.events.push({ id: uid(), title: "New item", type: "assignment", date: todayISO(), time: null, date_text: null, category: null, weight: null, notes: null, done: false });
    renderReview();
  }
  if (t.id === "discard") { draft = null; renderReview(); }
  if (t.id === "save-course") {
    const wasNew = draft.isNew;
    delete draft.isNew;
    const i = state.courses.findIndex((c) => c.id === draft.id);
    if (i >= 0) state.courses[i] = draft; else state.courses.push(draft);
    save();
    draft = null;
    renderReview();
    toast(wasNew ? "Course saved." : "Changes saved.");
    show("upcoming");
  }
});

// ---------- upcoming ----------
function allEvents(courseId = "") {
  return state.courses
    .filter((c) => !courseId || c.id === courseId)
    .flatMap((c) => c.events.map((ev) => ({ ...ev, course: c })));
}
function courseSelect(el, includeAll) {
  const prev = el.value;
  el.innerHTML = (includeAll ? `<option value="">All courses</option>` : "") +
    state.courses.map((c) => `<option value="${c.id}">${esc(c.course.code || c.course.title)}</option>`).join("");
  if ([...el.options].some((o) => o.value === prev)) el.value = prev;
}
const emptyState = (msg) => `<div class="empty"><p>${msg}</p><button class="btn primary" data-goto="scan">Scan a syllabus</button></div>`;
document.addEventListener("click", (e) => { if (e.target.dataset.goto) show(e.target.dataset.goto); });

function renderUpcoming() {
  const sel = $("#upcoming-course");
  courseSelect(sel, true);
  const showDone = $("#show-done").checked;
  const today = todayISO();
  const list = $("#upcoming-list");
  if (!state.courses.length) { list.innerHTML = emptyState("No courses yet."); return; }

  const evs = allEvents(sel.value)
    .filter((ev) => ev.date && ev.type !== "no_class" && (showDone || !ev.done))
    .filter((ev) => showDone || ev.done || daysBetween(today, ev.date) >= -14)
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  const undated = allEvents(sel.value).filter((ev) => !ev.date && (showDone || !ev.done));

  if (!evs.length && !undated.length) { list.innerHTML = `<div class="empty">Nothing coming up. 🎉</div>`; return; }

  const groups = new Map();
  for (const ev of evs) {
    const d = daysBetween(today, ev.date);
    const label = d < 0 ? "Overdue" : d === 0 ? "Today" : d <= 7 ? "Next 7 days" : d <= 14 ? "Next 2 weeks" : fmtDate(ev.date, { month: "long", year: "numeric" });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(ev);
  }
  let html = "";
  for (const [label, items] of groups) html += `<div class="week-group"><h3>${label}</h3>${items.map(itemRow).join("")}</div>`;
  if (undated.length) html += `<div class="week-group"><h3>No date yet</h3>${undated.map(itemRow).join("")}</div>`;
  list.innerHTML = html;
}
function itemRow(ev) {
  const today = todayISO();
  let dueTxt = "", cls = "";
  if (ev.date) {
    const d = daysBetween(today, ev.date);
    dueTxt = d < 0 ? `${-d}d overdue` : d === 0 ? "Today" : d === 1 ? "Tomorrow" : `in ${d} days`;
    cls = ev.done ? "" : d < 0 ? "overdue" : d <= 3 ? "soon" : "";
  }
  return `<div class="item ${ev.done ? "done" : ""}">
    <input type="checkbox" data-done="${ev.course.id}:${ev.id}" ${ev.done ? "checked" : ""} aria-label="Mark ${esc(ev.title)} done">
    <span class="dot" style="background:${ev.course.color}"></span>
    <div class="body">
      <div class="title">${esc(ev.title)}</div>
      <div class="meta"><span>${esc(ev.course.course.code || ev.course.course.title)}</span><span class="badge ${ev.type}">${TYPE_LABEL(ev.type)}</span>${ev.date_text && !ev.date ? `<span>${esc(ev.date_text)}</span>` : ""}</div>
    </div>
    <div class="due ${cls}">${ev.date ? `${fmtDate(ev.date)}${ev.time ? ` · ${fmtTime(ev.time)}` : ""}<br><span class="small">${dueTxt}</span>` : ""}</div>
  </div>`;
}
$("#upcoming-list").addEventListener("change", (e) => {
  const key = e.target.dataset.done;
  if (!key) return;
  const [cid, eid] = key.split(":");
  const ev = courseById(cid)?.events.find((x) => x.id === eid);
  if (ev) { ev.done = e.target.checked; save(); renderUpcoming(); }
});
$("#upcoming-course").addEventListener("change", renderUpcoming);
$("#show-done").addEventListener("change", renderUpcoming);

// ---------- calendar ----------
let calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
function renderCalendar() {
  $("#cal-title").textContent = calMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const first = new Date(calMonth);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const byDate = new Map();
  for (const ev of allEvents()) {
    if (!ev.date) continue;
    if (!byDate.has(ev.date)) byDate.set(ev.date, []);
    byDate.get(ev.date).push(ev);
  }
  const today = todayISO();
  const dows = [...Array(7)].map((_, i) => new Date(2023, 0, 1 + i).toLocaleDateString(undefined, { weekday: "short" }));
  let html = dows.map((d) => `<div class="cal-dow">${d}</div>`).join("");
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = toISO(d);
    const evs = (byDate.get(iso) || []).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    html += `<div class="cal-day ${d.getMonth() !== calMonth.getMonth() ? "other" : ""} ${iso === today ? "today" : ""}">
      <span class="num">${d.getDate()}</span>
      ${evs.map((ev) => `<div class="cal-ev" title="${esc(`${ev.course.course.code || ev.course.course.title}: ${ev.title}${ev.time ? ` at ${fmtTime(ev.time)}` : ""}`)}"><span class="dot" style="background:${ev.course.color}"></span><span>${esc(ev.title)}</span></div>`).join("")}
    </div>`;
  }
  $("#calendar").innerHTML = html;
}
$("#cal-prev").addEventListener("click", () => { calMonth.setMonth(calMonth.getMonth() - 1); renderCalendar(); });
$("#cal-next").addEventListener("click", () => { calMonth.setMonth(calMonth.getMonth() + 1); renderCalendar(); });
$("#cal-today").addEventListener("click", () => { calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1); renderCalendar(); });

// ---------- courses ----------
function renderCourses() {
  const el = $("#course-list");
  $("#export-all-ics").classList.toggle("hidden", !state.courses.length);
  if (!state.courses.length) { el.innerHTML = emptyState("No courses yet."); return; }
  el.innerHTML = state.courses.map((c) => {
    const k = c.course;
    const rows = [["Instructor", k.instructor], ["Email", k.email], ["Term", k.term], ["Meets", k.meeting_times], ["Location", k.location], ["Office hours", k.office_hours]]
      .filter(([, v]) => v).map(([l, v]) => `<dt>${l}</dt><dd>${esc(v)}</dd>`).join("");
    const dated = c.events.filter((e) => e.date).length;
    return `<div class="card course-card">
      <div class="head">
        <div><h3><span class="dot" style="background:${c.color}"></span> ${esc(k.code ? `${k.code} · ${k.title}` : k.title)}</h3>
          <span class="muted small">${c.events.length} items (${dated} dated) · ${c.events.filter((e) => e.done).length} done</span></div>
        <div class="controls">
          <button class="btn small" data-edit="${c.id}">Edit</button>
          <button class="btn small" data-ics="${c.id}">Export .ics</button>
          <button class="btn small" data-csv="${c.id}">Export CSV</button>
          <button class="btn small danger" data-del="${c.id}">Delete</button>
        </div>
      </div>
      ${rows ? `<dl>${rows}</dl>` : ""}
      ${c.policies?.length ? `<ul class="policies small">${c.policies.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
    </div>`;
  }).join("");
}
$("#course-list").addEventListener("click", (e) => {
  const d = e.target.dataset;
  if (d.edit) openReview(courseById(d.edit));
  if (d.ics) downloadICS([courseById(d.ics)]);
  if (d.csv) downloadCSV(courseById(d.csv));
  if (d.del) {
    const c = courseById(d.del);
    if (confirm(`Delete ${c.course.code || c.course.title}? This removes its deadlines and grades.`)) {
      state.courses = state.courses.filter((x) => x.id !== d.del);
      save();
      renderCourses();
    }
  }
});
$("#export-all-ics").addEventListener("click", () => downloadICS(state.courses));

// ---------- exports ----------
function download(name, mime, text) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "course";
const icsEsc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => `\\${m}`);
function icsFold(line) {
  const out = [];
  while (line.length > 74) { out.push(line.slice(0, 74)); line = ` ${line.slice(74)}`; }
  out.push(line);
  return out.join("\r\n");
}
function downloadICS(courses) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SyllaPlan//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:SyllaPlan"];
  let n = 0;
  for (const c of courses) {
    const label = c.course.code || c.course.title;
    for (const ev of c.events) {
      if (!ev.date) continue;
      n++;
      const d = ev.date.replace(/-/g, "");
      lines.push("BEGIN:VEVENT", `UID:${c.id}-${ev.id}@syllaplan`, `DTSTAMP:${stamp}`);
      if (ev.time) {
        lines.push(`DTSTART:${d}T${ev.time.replace(":", "")}00`,
          `DURATION:${["exam", "quiz", "presentation", "lab"].includes(ev.type) ? "PT1H" : "PT15M"}`);
      } else {
        const next = new Date(parseISO(ev.date));
        next.setDate(next.getDate() + 1);
        lines.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${toISO(next).replace(/-/g, "")}`);
      }
      lines.push(`SUMMARY:${icsEsc(`${label}: ${ev.title}`)}`);
      const desc = [ev.type !== "other" && TYPE_LABEL(ev.type), ev.category && `Category: ${ev.category}`, ev.notes].filter(Boolean).join("\n");
      if (desc) lines.push(`DESCRIPTION:${icsEsc(desc)}`);
      if (c.course.location && ["exam", "quiz", "presentation"].includes(ev.type)) lines.push(`LOCATION:${icsEsc(c.course.location)}`);
      if (ev.type !== "no_class") {
        lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEsc(ev.title)}`, "TRIGGER:-P1D", "END:VALARM");
      }
      lines.push("END:VEVENT");
    }
  }
  lines.push("END:VCALENDAR");
  if (!n) { toast("No dated items to export."); return; }
  download(courses.length === 1 ? `${slug(courses[0].course.code || courses[0].course.title)}.ics` : "syllaplan.ics",
    "text/calendar", lines.map(icsFold).join("\r\n") + "\r\n");
  toast(`Exported ${n} events. Open the file to add them to your calendar.`);
}
function downloadCSV(c) {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Title", "Type", "Date", "Time", "Category", "Weight %", "Done", "Notes"].map(q).join(",")];
  for (const ev of c.events) rows.push([ev.title, TYPE_LABEL(ev.type), ev.date, ev.time, ev.category, ev.weight, ev.done ? "yes" : "", ev.notes].map(q).join(","));
  download(`${slug(c.course.code || c.course.title)}.csv`, "text/csv", rows.join("\n"));
}

// ---------- grades ----------
// For each grading category, scorable items are the course events linked to it, plus any rows the student adds.
function gradeRows(c, g) {
  c.scores ??= {};
  const s = (c.scores[g.id] ??= { items: {}, extra: [] });
  const linked = c.events
    .filter((ev) => ev.category === g.category && ev.type !== "no_class")
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"))
    .map((ev) => ({ key: `ev:${ev.id}`, name: ev.title, ...(s.items[ev.id] ?? {}) }));
  const extra = s.extra.map((x) => ({ key: `x:${x.id}`, ...x }));
  const rows = [...linked, ...extra];
  if (!rows.length) rows.push({ key: `ev:_overall`, name: `${g.category} (overall)`, ...(s.items._overall ?? {}) });
  return rows;
}
function computeGrades(c) {
  let earnedW = 0, completedW = 0, totalW = 0;
  const cats = c.grading.map((g) => {
    const w = Number(g.weight) || 0;
    const rows = gradeRows(c, g);
    const scored = rows.filter((r) => r.score !== undefined && r.score !== "" && r.max);
    const pct = scored.length ? scored.reduce((s, r) => s + Number(r.score), 0) / scored.reduce((s, r) => s + Number(r.max), 0) : null;
    const frac = rows.length ? scored.length / rows.length : 0;
    totalW += w;
    if (pct !== null) { earnedW += w * frac * pct; completedW += w * frac; }
    return { g, w, rows, pct, frac };
  });
  return { cats, current: completedW ? earnedW / completedW : null, earnedW, completedW, totalW };
}
function renderGrades() {
  const el = $("#grades");
  const sel = $("#grades-course");
  courseSelect(sel, false);
  if (!state.courses.length) { el.innerHTML = emptyState("Add a course to start tracking grades."); return; }
  const c = courseById(sel.value) ?? state.courses[0];
  sel.value = c.id;
  if (!c.grading.length) { el.innerHTML = `<div class="empty">This course has no grading breakdown. <button class="btn" data-edit-grades="${c.id}">Add one</button></div>`; return; }

  const { cats, current, earnedW, completedW, totalW } = computeGrades(c);
  c.target ??= 90;
  const remaining = totalW - completedW;
  const needed = remaining > 0 ? (c.target / 100 * totalW - earnedW) / remaining : null;
  const neededTxt = needed === null ? "—" : needed > 1 ? "Not reachable" : needed <= 0 ? "Locked in ✓" : `${round(needed * 100)}%`;

  el.innerHTML = `
    <div class="grade-summary">
      <div class="stat"><div class="label">Current grade</div><div class="value">${current === null ? "—" : `${round(current * 100)}%`}</div><div class="sub">${letter(current)}</div></div>
      <div class="stat"><div class="label">Graded so far</div><div class="value">${round(completedW)}%</div><div class="bar"><span style="width:${totalW ? (completedW / totalW) * 100 : 0}%"></span></div><div class="sub">of ${round(totalW)}% total weight</div></div>
      <div class="stat"><div class="label">Needed on the rest</div><div class="value">${neededTxt}</div>
        <div class="target-row sub">for <input type="number" id="target" min="0" max="100" value="${c.target}"> % final</div></div>
    </div>
    ${cats.map(({ g, w, rows, pct }) => `
      <div class="card">
        <div class="section-head" style="margin-bottom:.5rem">
          <h3>${esc(g.category)} <span class="muted small">· ${w}%${g.notes ? ` · ${esc(g.notes)}` : ""}</span></h3>
          <strong>${pct === null ? "—" : `${round(pct * 100)}%`}</strong>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Item</th><th>Score</th><th>Out of</th><th></th></tr></thead>
          <tbody>${rows.map((r) => `
            <tr data-gid="${g.id}" data-key="${r.key}">
              <td class="title-cell">${r.key.startsWith("x:") ? `<input data-s="name" value="${esc(r.name)}">` : esc(r.name)}</td>
              <td class="num-cell"><input data-s="score" type="number" step="0.01" min="0" value="${r.score ?? ""}" placeholder="—"></td>
              <td class="num-cell"><input data-s="max" type="number" step="0.01" min="0" value="${r.max ?? 100}"></td>
              <td>${r.key.startsWith("x:") ? `<button class="icon-btn" data-del-s aria-label="Remove">✕</button>` : ""}</td>
            </tr>`).join("")}
          </tbody>
        </table></div>
        <button class="btn small" data-add-s="${g.id}">+ Add score</button>
      </div>`).join("")}
    <p class="muted small">Items without a score count as not yet graded. “Needed on the rest” assumes each ungraded item in a category counts equally.</p>`;
}
function letter(p) {
  if (p === null) return "No scores yet";
  const x = p * 100;
  return x >= 93 ? "A" : x >= 90 ? "A−" : x >= 87 ? "B+" : x >= 83 ? "B" : x >= 80 ? "B−" : x >= 77 ? "C+" : x >= 73 ? "C" : x >= 70 ? "C−" : x >= 67 ? "D+" : x >= 60 ? "D" : "F";
}
function gradeStore(c, tr) {
  const s = c.scores[tr.dataset.gid];
  const [kind, id] = tr.dataset.key.split(":");
  if (kind === "ev") return (s.items[id] ??= {});
  return s.extra.find((x) => x.id === id);
}
$("#grades").addEventListener("change", (e) => {
  const c = courseById($("#grades-course").value);
  if (!c) return;
  if (e.target.id === "target") c.target = Number(e.target.value) || 0;
  const tr = e.target.closest("tr[data-key]");
  if (tr && e.target.dataset.s) {
    const rec = gradeStore(c, tr);
    const v = e.target.value;
    rec[e.target.dataset.s] = e.target.dataset.s === "name" ? v : v === "" ? undefined : Number(v);
    if (e.target.dataset.s === "score" && rec.max === undefined) rec.max = 100;
  }
  save();
  renderGrades();
});
$("#grades").addEventListener("click", (e) => {
  const c = courseById($("#grades-course").value);
  if (!c) return;
  if (e.target.dataset.addS) {
    c.scores[e.target.dataset.addS].extra.push({ id: uid(), name: "Extra score", max: 100 });
    save(); renderGrades();
  }
  if (e.target.hasAttribute("data-del-s")) {
    const tr = e.target.closest("tr");
    const s = c.scores[tr.dataset.gid];
    s.extra = s.extra.filter((x) => `x:${x.id}` !== tr.dataset.key);
    save(); renderGrades();
  }
  if (e.target.dataset.editGrades) openReview(courseById(e.target.dataset.editGrades));
});
$("#grades-course").addEventListener("change", renderGrades);

// ---------- boot ----------
show(state.courses.length ? "upcoming" : "scan");
