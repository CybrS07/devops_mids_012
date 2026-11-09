/* =====================================================================
   Assignment Portal – frontend logic (no libraries, charts are inline SVG/CSS)
   Works with the existing FastAPI backend, no backend changes required.
   ===================================================================== */

// If the page is served by the backend itself (port 8000) use same-origin, else call the backend directly.
const API = location.protocol.startsWith("http") && location.port === "8000" ? "" : "http://127.0.0.1:8000";

/* ---------- small helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const enc = encodeURIComponent;
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const ICON = {
  grid: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  refresh: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  trend: '<path d="m23 6-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
};
const icon = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

const STATUS = {
  Approved: { cls: "approved", color: "#1f8a5b" },
  Pending: { cls: "pending", color: "#d99a1f" },
  Declined: { cls: "declined", color: "#c0392b" },
  "Not submitted": { cls: "none", color: "#8da9c4" },
};
const badge = (s) => `<span class="badge ${(STATUS[s] || STATUS["Not submitted"]).cls}">${esc(s)}</span>`;

function errorMessage(body, status) {
  const d = body && body.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d.length) {
    return d.map((e) => {
      const field = (e.loc || []).slice(-1)[0];
      return field === "submission_url" ? "The submission URL is not valid" : `${field}: ${e.msg}`;
    }).join("; ");
  }
  return `Request failed (${status})`;
}

async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(API + path, { headers: { "Content-Type": "application/json" }, ...options });
  } catch {
    throw new Error("Cannot reach the server. Is the backend running on port 8000?");
  }
  let body = null;
  try { body = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw new Error(errorMessage(body, res.status));
  return body;
}

function parseClasses(raw) {
  if (!raw) return [];
  try {
    return raw.trim().startsWith("[") ? JSON.parse(raw) : raw.split(",").map((s) => s.trim()).filter(Boolean);
  } catch { return [raw]; }
}
function getSession() {
  const role = localStorage.getItem("role");
  if (!role) return null;
  return { username: localStorage.getItem("username"), role, classes: parseClasses(localStorage.getItem("class_group")) };
}

const isValidUrl = (v) => { try { const u = new URL(v); return ["http:", "https:"].includes(u.protocol) && !!u.hostname; } catch { return false; } };
const safeHref = (v) => (isValidUrl(v) ? v : "#");
const shortUrl = (v) => { try { const u = new URL(v); const s = u.host + (u.pathname === "/" ? "" : u.pathname); return s.length > 34 ? s.slice(0, 33) + "…" : s; } catch { return v; } };
const initials = (n) => String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/* ---------- toast & modal ---------- */
function toast(msg, type = "info") {
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `${icon(type === "error" ? "x" : "check", 16)}<span>${esc(msg)}</span>`;
  $("#toasts").appendChild(t);
  setTimeout(() => t.classList.add("out"), 3200);
  setTimeout(() => t.remove(), 3600);
}
function openModal(title, bodyHtml) {
  $("#modalRoot").innerHTML = `
    <div class="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon("x")}</button></div>
        <div class="modal-body">${bodyHtml}</div>
      </div>
    </div>`;
  const first = $("#modalRoot input:not([readonly])");
  if (first) first.focus();
}
const closeModal = () => { $("#modalRoot").innerHTML = ""; };

/* =====================================================================
   LOGIN PAGE
   ===================================================================== */
function initLogin() {
  if (getSession()) { location.replace("dashboard.html"); return; }
  const err = $("#loginError"), btn = $("#loginBtn");

  $("#togglePw").addEventListener("click", () => {
    const input = $("#password"), show = input.type === "password";
    input.type = show ? "text" : "password";
    $("#togglePw").textContent = show ? "Hide" : "Show";
  });
  document.querySelectorAll("[data-demo]").forEach((chip) => chip.addEventListener("click", () => {
    $("#username").value = chip.dataset.user;
    $("#password").value = "password123";
  }));

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    err.hidden = true; btn.disabled = true; btn.textContent = "Signing in…";
    try {
      const d = await api("/api/login", { method: "POST", body: JSON.stringify({ username: $("#username").value.trim(), password: $("#password").value }) });
      localStorage.setItem("username", d.username);
      localStorage.setItem("role", d.role);
      localStorage.setItem("class_group", Array.isArray(d.class_group) ? JSON.stringify(d.class_group) : d.class_group || "");
      location.href = "dashboard.html";
    } catch (ex) {
      err.textContent = ex.message; err.hidden = false;
      btn.disabled = false; btn.textContent = "Sign in";
    }
  });
}

/* =====================================================================
   DASHBOARD
   ===================================================================== */
const state = { user: null, assignments: [], submissions: [], view: "overview", filters: { q: "", cls: "", assignment: "", status: "" } };

const NAV = {
  student: [{ id: "overview", label: "Overview", icon: "grid" }, { id: "assignments", label: "Assignments", icon: "book" }],
  teacher: [{ id: "overview", label: "Overview", icon: "grid" }, { id: "assignments", label: "Assignments", icon: "book" }, { id: "submissions", label: "Submissions", icon: "inbox" }],
};
const TITLES = {
  student: { overview: ["Overview", "Your progress across all assignments"], assignments: ["Assignments", "Submit your work and track its review status"] },
  teacher: { overview: ["Overview", "Review activity across your classes"], assignments: ["Assignments", "Publish assignments and monitor submissions"], submissions: ["Submissions", "Search, filter and review student submissions"] },
};

async function initDashboard() {
  const user = getSession();
  if (!user) { location.replace("index.html"); return; }
  state.user = user;
  bindGlobalEvents();
  renderChrome();
  await refresh();
}

async function loadData() {
  const u = state.user;
  if (u.role === "student") {
    const cls = u.classes[0] || "";
    const [a, s] = await Promise.all([api(`/api/assignments?class_group=${enc(cls)}`), api(`/api/submissions?teacher_classes=${enc(cls)}`)]);
    state.assignments = a;
    state.submissions = s.filter((x) => x.registration_number === u.username);
  } else {
    const q = enc(JSON.stringify(u.classes));
    const [a, s] = await Promise.all([api(`/api/assignments?teacher_classes=${q}`), api(`/api/submissions?teacher_classes=${q}`)]);
    state.assignments = a;
    state.submissions = s;
  }
}

async function refresh(manual = false) {
  try {
    await loadData();
    render();
    if (manual) toast("Data refreshed", "success");
  } catch (e) {
    $("#view").innerHTML = `<div class="card"><div class="empty"><b>Something went wrong</b>${esc(e.message)}<br><br><button class="btn btn-primary" data-action="refresh">Try again</button></div></div>`;
  }
}

function setView(v) { state.view = v; render(); window.scrollTo({ top: 0 }); }

/* ---------- chrome (sidebar + topbar) ---------- */
function renderChrome() {
  const u = state.user;
  const pending = u.role === "teacher" ? state.submissions.filter((s) => s.status === "Pending").length : 0;
  $("#sidebar").innerHTML = `
    <div class="brand"><div class="logo">AP</div><div><b>Assignment Portal</b><span>CSC418 · DevOps</span></div></div>
    <nav class="nav" aria-label="Main">
      ${NAV[u.role].map((n) => `<button class="${n.id === state.view ? "active" : ""}" data-action="nav" data-view="${n.id}">${icon(n.icon)}<span>${n.label}</span>${n.id === "submissions" && pending ? `<span class="pill">${pending}</span>` : ""}</button>`).join("")}
    </nav>
    <div class="sidebar-foot">
      <div class="user-card"><div class="avatar">${esc(initials(u.username))}</div><div style="min-width:0"><b>${esc(u.username)}</b><span>${esc(u.role)} · ${esc(u.classes.join(", ") || "—")}</span></div></div>
      <button class="logout" data-action="logout">${icon("logout")}<span>Sign out</span></button>
    </div>`;
  const [title, sub] = TITLES[u.role][state.view];
  $("#topbar").innerHTML = `
    <div><h1>${title}</h1><p>${sub}</p></div>
    <div class="right"><span class="date">${new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
      <button class="btn btn-ghost btn-sm" data-action="refresh">${icon("refresh", 15)} Refresh</button></div>`;
}

function render() {
  renderChrome();
  const u = state.user;
  const views = {
    student: { overview: studentOverview, assignments: studentAssignments },
    teacher: { overview: teacherOverview, assignments: teacherAssignments, submissions: teacherSubmissions },
  };
  $("#view").innerHTML = views[u.role][state.view]();
}

/* ---------- reusable UI pieces ---------- */
const stat = (label, value, sub, ic, tone = "blue") => `
  <div class="card stat"><div class="stat-icon ${tone}">${icon(ic, 21)}</div>
  <div><div class="stat-label">${label}</div><div class="stat-value">${value}</div>${sub ? `<div class="stat-sub">${sub}</div>` : ""}</div></div>`;

const empty = (title, text) => `<div class="empty"><b>${esc(title)}</b>${esc(text)}</div>`;

function donutChart(segments, centerValue, centerLabel) {
  const total = segments.reduce((n, s) => n + s.value, 0), r = 54, C = 2 * Math.PI * r;
  let acc = 0;
  const arcs = segments.filter((s) => s.value > 0).map((s) => {
    const len = (s.value / total) * C;
    const out = `<circle class="arc" cx="70" cy="70" r="${r}" fill="none" stroke="${s.color}" stroke-width="16" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-acc}" transform="rotate(-90 70 70)"><title>${esc(s.label)}: ${s.value}</title></circle>`;
    acc += len; return out;
  }).join("");
  const legend = segments.map((s) => `<li><i style="background:${s.color}"></i><span>${esc(s.label)}</span><b>${s.value}</b></li>`).join("");
  return `<div class="donut">
    <svg viewBox="0 0 140 140" role="img" aria-label="Status distribution chart">
      <circle cx="70" cy="70" r="${r}" fill="none" stroke="#e4ecf4" stroke-width="16"/>${arcs}
      <text x="70" y="70" text-anchor="middle" class="d-val">${centerValue}</text>
      <text x="70" y="88" text-anchor="middle" class="d-lbl">${esc(centerLabel)}</text>
    </svg><ul class="legend">${legend}</ul></div>`;
}

function stackedBars(rows) {
  if (!rows.length) return empty("No data yet", "Publish an assignment to see activity here.");
  const max = Math.max(1, ...rows.map((r) => r.Approved + r.Pending + r.Declined));
  const seg = (n, k, label) => (n ? `<span style="width:${(n / max) * 100}%;background:${STATUS[k].color}" title="${label}: ${n}"></span>` : "");
  return `<div class="bars">${rows.map((r) => `
    <div class="bar-row"><div class="bar-label"><b title="${esc(r.label)}">${esc(r.label)}</b><small>${esc(r.sub)}</small></div>
    <div class="bar-track">${seg(r.Approved, "Approved", "Approved")}${seg(r.Pending, "Pending", "Pending")}${seg(r.Declined, "Declined", "Declined")}</div>
    <div class="bar-total">${r.Approved + r.Pending + r.Declined}</div></div>`).join("")}</div>
    <div class="bar-legend">${["Approved", "Pending", "Declined"].map((k) => `<span><i style="background:${STATUS[k].color}"></i>${k}</span>`).join("")}</div>`;
}

const linkCell = (u) => `<a class="link" href="${esc(safeHref(u))}" target="_blank" rel="noopener noreferrer">${icon("link", 14)}${esc(shortUrl(u))}</a>`;

/* =====================================================================
   STUDENT VIEWS
   ===================================================================== */
function studentRows() {
  const rows = state.assignments.map((a) => {
    const s = state.submissions.find((x) => x.assignment_title === a.title);
    return { a, s, status: s ? s.status : "Not submitted" };
  });
  // also show submissions whose assignment is not (or no longer) in the published list
  state.submissions.forEach((s) => {
    if (!rows.some((r) => r.a.title === s.assignment_title)) {
      rows.push({ a: { title: s.assignment_title, target_group: s.class_group, created_by: "—" }, s, status: s.status });
    }
  });
  return rows;
}

function studentOverview() {
  const rows = studentRows();
  const n = (k) => rows.filter((r) => r.status === k).length;
  const counts = { Approved: n("Approved"), Pending: n("Pending"), Declined: n("Declined"), "Not submitted": n("Not submitted") };
  const todo = rows.filter((r) => r.status === "Not submitted" || r.status === "Declined");
  const segs = Object.keys(counts).map((k) => ({ label: k, value: counts[k], color: STATUS[k].color }));

  return `
    <div class="stats">
      ${stat("Assigned", rows.length, "for your class", "file")}
      ${stat("Approved", counts.Approved, "reviewed &amp; accepted", "check", "green")}
      ${stat("Pending review", counts.Pending, "waiting for teacher", "clock", "amber")}
      ${stat("Action needed", todo.length, "not submitted or declined", "x", "red")}
    </div>
    <div class="grid-2">
      <section class="card"><div class="card-head"><div><h2>Submission status</h2><small>All your assignments</small></div></div>
        <div class="card-body">${donutChart(segs, rows.length, "assignments")}</div></section>
      <section class="card"><div class="card-head"><div><h2>Action needed</h2><small>Assignments waiting for you</small></div></div>
        <div class="card-body">${todo.length ? `<ul class="todo">${todo.map((r) => `
          <li><div><b>${esc(r.a.title)}</b>${badge(r.status)}</div>
          <button class="btn btn-primary btn-sm" data-action="open-submit" data-title="${esc(r.a.title)}">${r.status === "Declined" ? "Resubmit" : "Submit"}</button></li>`).join("")}</ul>`
          : (rows.length ? empty("You're all caught up", "Nothing needs your attention right now.") : empty("No assignments yet", "Your teacher has not published anything for your class."))}</div></section>
    </div>`;
}

function studentAssignments() {
  const rows = studentRows();
  return `<section class="card"><div class="card-head"><div><h2>Your assignments</h2><small>${rows.length} published for ${esc(state.user.classes.join(", "))}</small></div></div>
    ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Assignment</th><th>Status</th><th>Submission</th><th class="right">Action</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td><b>${esc(r.a.title)}</b><br><small>Published by ${esc(r.a.created_by)}</small></td>
        <td>${badge(r.status)}</td><td>${r.s ? linkCell(r.s.submission_url) : '<span class="muted">—</span>'}</td>
        <td class="right"><button class="btn ${r.status === "Not submitted" || r.status === "Declined" ? "btn-primary" : "btn-ghost"} btn-sm" data-action="open-submit" data-title="${esc(r.a.title)}">${r.status === "Declined" ? "Resubmit" : r.status === "Not submitted" ? "Submit" : "View"}</button></td></tr>`).join("")}
      </tbody></table></div>` : empty("No assignments yet", "Your teacher has not published anything for your class.")}</section>`;
}

function openSubmitModal(title) {
  const u = state.user;
  const s = state.submissions.find((x) => x.assignment_title === title);
  const a = state.assignments.find((x) => x.title === title) || (s && { title, target_group: s.class_group });
  if (!a) return;

  if (s && s.status !== "Declined") {
    const msg = s.status === "Approved" ? "This submission has been approved and can no longer be changed." : "Your teacher has not reviewed this yet. You can resubmit only if it is declined.";
    openModal(title, `<div class="detail">
        <div><span>Status</span>${badge(s.status)}</div><div><span>Submitted as</span><b>${esc(s.name)}</b></div>
        <div><span>Registration no.</span><b>${esc(s.registration_number)}</b></div><div><span>Link</span>${linkCell(s.submission_url)}</div></div>
      <div class="note">${msg}</div><div class="modal-actions"><button class="btn btn-ghost" data-action="close-modal">Close</button></div>`);
    return;
  }

  openModal(s ? `Resubmit · ${title}` : `Submit · ${title}`, `
    ${s ? '<div class="note">Your previous submission was declined. Submit a corrected link below.</div>' : ""}
    <div class="alert" id="formError" hidden></div>
    <form id="submitForm" novalidate>
      <div class="field" id="f-name"><label for="subName">Full name</label><input id="subName" value="${esc(s ? s.name : "")}" placeholder="e.g. Muhammad Taha" autocomplete="name"></div>
      <div class="field"><label for="subReg">Registration number</label><input id="subReg" value="${esc(u.username)}" readonly></div>
      <div class="field"><label for="subTitle">Assignment</label><input id="subTitle" value="${esc(title)}" readonly></div>
      <div class="field" id="f-url"><label for="subUrl">Submission URL</label><input id="subUrl" type="url" value="${esc(s ? s.submission_url : "")}" placeholder="https://github.com/you/repository"></div>
      <div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary" id="subBtn">${s ? "Resubmit" : "Submit assignment"}</button></div>
    </form>`);

  const setErr = (id, msg) => { const f = $(id); f.classList.add("invalid"); f.insertAdjacentHTML("beforeend", `<div class="err">${esc(msg)}</div>`); };
  $("#submitForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    document.querySelectorAll("#submitForm .err").forEach((n) => n.remove());
    document.querySelectorAll("#submitForm .invalid").forEach((n) => n.classList.remove("invalid"));
    $("#formError").hidden = true;
    const name = $("#subName").value.trim(), url = $("#subUrl").value.trim();
    let ok = true;
    if (!name) { setErr("#f-name", "Full name is required"); ok = false; }
    if (!url) { setErr("#f-url", "Submission URL is required"); ok = false; }
    else if (!isValidUrl(url)) { setErr("#f-url", "Enter a valid link starting with http:// or https://"); ok = false; }
    if (!ok) return;

    const btn = $("#subBtn"); btn.disabled = true; btn.textContent = "Saving…";
    try {
      const r = await api("/api/submissions", { method: "POST", body: JSON.stringify({ name, registration_number: u.username, assignment_title: title, submission_url: url, class_group: a.target_group }) });
      closeModal(); toast(r.message || "Submitted", "success"); await refresh();
    } catch (ex) {
      $("#formError").textContent = ex.message; $("#formError").hidden = false;
      btn.disabled = false; btn.textContent = s ? "Resubmit" : "Submit assignment";
    }
  });
}

/* =====================================================================
   TEACHER VIEWS
   ===================================================================== */
function teacherCounts() {
  const c = { Approved: 0, Pending: 0, Declined: 0 };
  state.submissions.forEach((s) => { if (c[s.status] !== undefined) c[s.status]++; });
  return c;
}
function perAssignment() {
  // one row per published assignment, plus any submission group whose assignment is no longer in the list
  const groups = state.assignments.map((a) => ({ title: a.title, cls: a.target_group, a }));
  state.submissions.forEach((s) => {
    if (!groups.some((g) => g.title === s.assignment_title && g.cls === s.class_group)) {
      groups.push({ title: s.assignment_title, cls: s.class_group, a: { title: s.assignment_title, target_group: s.class_group, created_by: "—" } });
    }
  });
  return groups.map((g) => {
    const subs = state.submissions.filter((s) => s.assignment_title === g.title && s.class_group === g.cls);
    const n = (k) => subs.filter((s) => s.status === k).length;
    return { label: g.title, sub: `Class ${g.cls}`, a: g.a, Approved: n("Approved"), Pending: n("Pending"), Declined: n("Declined") };
  });
}
const reviewButtons = (s) => s.status === "Pending"
  ? `<span class="actions"><button class="btn btn-ok btn-sm" data-action="review" data-status="Approved" data-reg="${esc(s.registration_number)}" data-title="${esc(s.assignment_title)}">Approve</button><button class="btn btn-danger btn-sm" data-action="review" data-status="Declined" data-reg="${esc(s.registration_number)}" data-title="${esc(s.assignment_title)}">Decline</button></span>`
  : '<span class="muted">Reviewed</span>';

function submissionsTable(rows) {
  if (!rows.length) return empty("No submissions found", "Try changing the filters, or wait for students to submit.");
  return `<div class="table-wrap"><table><thead><tr><th>Student</th><th>Assignment</th><th>Class</th><th>Link</th><th>Status</th><th class="right">Review</th></tr></thead><tbody>
    ${rows.map((s) => `<tr>
      <td><div class="person"><span class="avatar sm">${esc(initials(s.name))}</span><div><b>${esc(s.name)}</b><small>${esc(s.registration_number)}</small></div></div></td>
      <td>${esc(s.assignment_title)}</td><td><span class="chip">${esc(s.class_group)}</span></td>
      <td>${linkCell(s.submission_url)}</td><td>${badge(s.status)}</td><td class="right">${reviewButtons(s)}</td></tr>`).join("")}
    </tbody></table></div>`;
}

function teacherOverview() {
  const c = teacherCounts(), total = state.submissions.length, reviewed = c.Approved + c.Declined;
  const rate = reviewed ? Math.round((c.Approved / reviewed) * 100) + "%" : "—";
  const segs = ["Approved", "Pending", "Declined"].map((k) => ({ label: k, value: c[k], color: STATUS[k].color }));
  const pending = state.submissions.filter((s) => s.status === "Pending");
  return `
    <div class="stats">
      ${stat("Assignments", state.assignments.length, `across ${state.user.classes.length} class(es)`, "book")}
      ${stat("Submissions", total, "received so far", "inbox")}
      ${stat("Awaiting review", c.Pending, "need your attention", "clock", "amber")}
      ${stat("Approval rate", rate, `${reviewed} reviewed`, "trend", "green")}
    </div>
    <div class="grid-2">
      <section class="card"><div class="card-head"><div><h2>Review status</h2><small>All submissions</small></div></div><div class="card-body">${donutChart(segs, total, "submissions")}</div></section>
      <section class="card"><div class="card-head"><div><h2>Submissions per assignment</h2><small>Stacked by review status</small></div></div><div class="card-body">${stackedBars(perAssignment())}</div></section>
    </div>
    <section class="card"><div class="card-head"><div><h2>Awaiting review</h2><small>${pending.length} pending submission(s)</small></div></div>
      ${pending.length ? submissionsTable(pending) : empty("Inbox zero", "Every submission has been reviewed.")}</section>`;
}

function teacherAssignments() {
  const rows = perAssignment();
  return `<section class="card"><div class="card-head"><div><h2>Published assignments</h2><small>${rows.length} in total</small></div>
      <button class="btn btn-primary" data-action="open-publish">${icon("plus", 16)} Publish assignment</button></div>
    ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Assignment</th><th>Class</th><th>Published by</th><th>Submissions</th><th>Progress</th><th class="right">Action</th></tr></thead><tbody>
      ${rows.map((r) => { const t = r.Approved + r.Pending + r.Declined; const w = (n) => (t ? (n / t) * 100 : 0);
        return `<tr><td><b>${esc(r.a.title)}</b></td><td><span class="chip">${esc(r.a.target_group)}</span></td><td>${esc(r.a.created_by)}</td><td><b>${t}</b> <small>(${r.Pending} pending)</small></td>
        <td><div class="mini-bar" title="Approved ${r.Approved} · Pending ${r.Pending} · Declined ${r.Declined}"><span style="width:${w(r.Approved)}%;background:${STATUS.Approved.color}"></span><span style="width:${w(r.Pending)}%;background:${STATUS.Pending.color}"></span><span style="width:${w(r.Declined)}%;background:${STATUS.Declined.color}"></span></div></td>
        <td class="right"><button class="btn btn-ghost btn-sm" data-action="review-assignment" data-title="${esc(r.a.title)}">View submissions</button></td></tr>`; }).join("")}
      </tbody></table></div>` : empty("Nothing published yet", "Click “Publish assignment” to create your first one.")}</section>`;
}

function filteredSubs() {
  const f = state.filters, q = f.q.toLowerCase();
  return state.submissions.filter((s) =>
    (!f.cls || s.class_group === f.cls) && (!f.assignment || s.assignment_title === f.assignment) && (!f.status || s.status === f.status) &&
    (!q || [s.name, s.registration_number, s.assignment_title].some((v) => String(v).toLowerCase().includes(q))));
}
function teacherSubmissions() {
  const f = state.filters;
  const titles = [...new Set(state.assignments.map((a) => a.title))];
  const opt = (v, cur) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(v)}</option>`;
  const rows = filteredSubs();
  return `<section class="card">
    <div class="toolbar">
      <input data-filter="q" value="${esc(f.q)}" placeholder="Search name, reg. no. or assignment…" aria-label="Search">
      <select data-filter="cls" aria-label="Class"><option value="">All classes</option>${state.user.classes.map((c) => opt(c, f.cls)).join("")}</select>
      <select data-filter="assignment" aria-label="Assignment"><option value="">All assignments</option>${titles.map((t) => opt(t, f.assignment)).join("")}</select>
      <select data-filter="status" aria-label="Status"><option value="">All statuses</option>${["Pending", "Approved", "Declined"].map((t) => opt(t, f.status)).join("")}</select>
      <span class="count" id="resultCount">${rows.length} result(s)</span>
    </div>
    <div id="subsTable" style="margin-top:16px">${submissionsTable(rows)}</div></section>`;
}

function openPublishModal() {
  openModal("Publish assignment", `
    <div class="alert" id="formError" hidden></div>
    <form id="publishForm" novalidate>
      <div class="field" id="f-title"><label for="astTitle">Assignment title</label><input id="astTitle" placeholder="e.g. DevOps Lab Mid"></div>
      <div class="field"><label for="astClass">Target class</label><select id="astClass">${state.user.classes.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}</select></div>
      <div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary" id="pubBtn">Publish</button></div>
    </form>`);
  $("#publishForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    document.querySelectorAll("#publishForm .err").forEach((n) => n.remove());
    const title = $("#astTitle").value.trim();
    if (!title) { $("#f-title").classList.add("invalid"); $("#f-title").insertAdjacentHTML("beforeend", '<div class="err">Title is required</div>'); return; }
    const btn = $("#pubBtn"); btn.disabled = true; btn.textContent = "Publishing…";
    try {
      await api("/api/assignments", { method: "POST", body: JSON.stringify({ title, target_group: $("#astClass").value, created_by: state.user.username }) });
      closeModal(); toast("Assignment published", "success"); await refresh();
    } catch (ex) {
      $("#formError").textContent = ex.message; $("#formError").hidden = false; btn.disabled = false; btn.textContent = "Publish";
    }
  });
}

async function review(reg, title, status) {
  try {
    await api("/api/submissions/status", { method: "POST", body: JSON.stringify({ registration_number: reg, assignment_title: title, status }) });
    toast(`Submission ${status.toLowerCase()}`, "success");
    await refresh();
  } catch (e) { toast(e.message, "error"); }
}

/* ---------- global events ---------- */
function bindGlobalEvents() {
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-backdrop")) return closeModal();
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const d = el.dataset;
    switch (d.action) {
      case "nav": setView(d.view); break;
      case "refresh": refresh(true); break;
      case "logout": localStorage.clear(); location.href = "index.html"; break;
      case "open-submit": openSubmitModal(d.title); break;
      case "open-publish": openPublishModal(); break;
      case "review": review(d.reg, d.title, d.status); break;
      case "review-assignment": state.filters = { q: "", cls: "", assignment: d.title, status: "" }; setView("submissions"); break;
      case "close-modal": closeModal(); break;
    }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  const onFilter = (e) => {
    const key = e.target.dataset && e.target.dataset.filter;
    if (!key) return;
    state.filters[key] = e.target.value;
    const rows = filteredSubs();
    $("#subsTable").innerHTML = submissionsTable(rows);
    $("#resultCount").textContent = `${rows.length} result(s)`;
  };
  document.addEventListener("input", onFilter);
  document.addEventListener("change", onFilter);
}

/* ---------- boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (page === "login") initLogin();
  else if (page === "dashboard") initDashboard();
});