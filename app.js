// ============================================================
// ASHA Family Tracker — app logic
// Uses Supabase (auth + Postgres) as the backend.
// ============================================================
 
const root = document.getElementById("root");
let sb = null;
let session = null;
 
const state = {
  tab: "add",
  families: [],        // [{id, house_no, house_name, address, area, description}]
  membersByFamily: {}, // { familyId: [member, ...] }
  editingFamilyId: null,
  addMemberDraftCount: 0,
  // view tab controls
  search: "",
  sortBy: "house_name_asc",
  filterArea: "",
  ageMin: "",
  ageMax: "",
  diseaseOnly: false,
  editingMemberKey: null, // `${familyId}:${memberId}`
  addingMemberFor: null,  // familyId currently adding a member to
};
 
const ROLE_OPTIONS = ["Ration Card Head", "Family Member"];
const GENDER_OPTIONS = ["Male", "Female", "Other"];
const AGE_PRESETS = [
  { label: "Infant (0–1)", min: 0, max: 1 },
  { label: "Child (1–18)", min: 1, max: 18 },
  { label: "Adult (19–40)", min: 19, max: 40 },
  { label: "Middle age (41–60)", min: 41, max: 60 },
  { label: "Senior (60+)", min: 60, max: 150 },
];
 
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
 
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
 
// ------------------------------------------------------------
// BOOTSTRAP
// ------------------------------------------------------------
function init() {
  if (!window.supabase || !SUPABASE_URL || SUPABASE_URL.startsWith("PASTE_")) {
    renderSetupNeeded();
    return;
  }
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
 
  sb.auth.getSession().then(({ data }) => {
    session = data.session;
    if (session) {
      loadData();
    } else {
      renderLogin();
    }
  });
 
  sb.auth.onAuthStateChange((_event, newSession) => {
    session = newSession;
    if (session) {
      loadData();
    } else {
      renderLogin();
    }
  });
}
 
function renderSetupNeeded() {
  root.innerHTML = `
    <div class="center-screen">
      <div class="auth-card">
        <h1>Almost there</h1>
        <p class="sub">This app needs to be connected to your Supabase project before it can store data.
        Open <code>config.js</code> and paste in your Project URL and anon public key
        (Supabase dashboard → Project Settings → API), then reload this page.
        See README.md for the full setup steps.</p>
      </div>
    </div>`;
}
 
// ------------------------------------------------------------
// AUTH SCREENS
// ------------------------------------------------------------
function renderLogin(mode = "login", errorMsg = "") {
  root.innerHTML = `
    <div class="center-screen">
      <div class="auth-card">
        <h1>ASHA Family Tracker</h1>
        <p class="sub">${mode === "login" ? "Sign in to view and manage your ward's records." : "Create an account to get started."}</p>
        <form id="auth-form">
          <div class="field">
            <label>Email</label>
            <input type="email" id="auth-email" required />
          </div>
          <div class="field">
            <label>Password</label>
            <input type="password" id="auth-password" required minlength="6" />
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;">
            ${mode === "login" ? "Sign in" : "Create account"}
          </button>
          ${errorMsg ? `<p class="auth-error">${escapeHtml(errorMsg)}</p>` : ""}
        </form>
        <div class="auth-toggle">
          ${mode === "login"
            ? `New here? <button id="to-signup">Create an account</button>`
            : `Already have an account? <button id="to-login">Sign in</button>`}
        </div>
      </div>
    </div>`;
 
  document.getElementById("auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    if (mode === "login") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) renderLogin("login", error.message);
    } else {
      const { error } = await sb.auth.signUp({ email, password });
      if (error) renderLogin("signup", error.message);
      else renderLogin("login", "Account created. If email confirmation is on, check your inbox, then sign in.");
    }
  });
 
  const toSignup = document.getElementById("to-signup");
  const toLogin = document.getElementById("to-login");
  if (toSignup) toSignup.addEventListener("click", () => renderLogin("signup"));
  if (toLogin) toLogin.addEventListener("click", () => renderLogin("login"));
}
 
// ------------------------------------------------------------
// DATA LOADING
// ------------------------------------------------------------
async function loadData() {
  root.innerHTML = `<div class="center-screen"><p>Loading your records…</p></div>`;
  const { data: families, error: famErr } = await sb
    .from("families")
    .select("*")
    .order("created_at", { ascending: false });
  const { data: members, error: memErr } = await sb
    .from("members")
    .select("*");
 
  if (famErr || memErr) {
    root.innerHTML = `<div class="center-screen"><div class="auth-card"><h1>Couldn't load data</h1><p class="sub">${escapeHtml((famErr || memErr).message)}</p></div></div>`;
    return;
  }
 
  state.families = families || [];
  state.membersByFamily = {};
  (members || []).forEach((m) => {
    if (!state.membersByFamily[m.family_id]) state.membersByFamily[m.family_id] = [];
    state.membersByFamily[m.family_id].push(m);
  });
 
  renderShell();
}
 
// ------------------------------------------------------------
// SHELL / NAV
// ------------------------------------------------------------
function renderShell() {
  root.innerHTML = `
    <div class="app-shell">
      <div class="sidebar">
        <div class="brand">ASHA Tracker<small>Household &amp; member records</small></div>
        <button class="nav-btn" data-tab="add">＋ Add family</button>
        <button class="nav-btn" data-tab="view">🔍 View &amp; manage</button>
        <button class="nav-btn" data-tab="export">⬇ Export data</button>
        <div class="sidebar-footer">
          <div style="margin-bottom:8px;">${escapeHtml(session?.user?.email || "")}</div>
          <button id="logout-btn">Sign out</button>
        </div>
      </div>
      <div class="main" id="main"></div>
    </div>`;
 
  document.querySelectorAll(".nav-btn").forEach((b) =>
    b.addEventListener("click", () => {
      state.tab = b.dataset.tab;
      renderShell();
    })
  );
  document.getElementById("logout-btn").addEventListener("click", async () => {
    await sb.auth.signOut();
  });
  document.querySelectorAll(".nav-btn").forEach((b) => {
    if (b.dataset.tab === state.tab) b.classList.add("active");
  });
 
  const main = document.getElementById("main");
  if (state.tab === "add") renderAddTab(main);
  else if (state.tab === "view") renderViewTab(main);
  else if (state.tab === "export") renderExportTab(main);
}
 
// ------------------------------------------------------------
// ADD FAMILY TAB
// ------------------------------------------------------------
function memberFormRow(idx, data = {}) {
  return `
    <div class="member-row" data-idx="${idx}">
      <button type="button" class="btn btn-danger btn-sm remove-member" data-idx="${idx}">Remove</button>
      <div class="field-grid">
        <div><label>Full name *</label><input type="text" name="m_name_${idx}" value="${escapeHtml(data.name)}" required /></div>
        <div><label>Role</label>
          <select name="m_role_${idx}">
            ${ROLE_OPTIONS.map((r) => `<option ${data.role === r ? "selected" : ""}>${r}</option>`).join("")}
          </select>
        </div>
        <div><label>Gender</label>
          <select name="m_gender_${idx}">
            <option value="">—</option>
            ${GENDER_OPTIONS.map((g) => `<option ${data.gender === g ? "selected" : ""}>${g}</option>`).join("")}
          </select>
        </div>
        <div><label>Age</label><input type="number" min="0" max="120" name="m_age_${idx}" value="${escapeHtml(data.age)}" /></div>
        <div><label>Phone number</label><input type="tel" name="m_phone_${idx}" value="${escapeHtml(data.phone)}" /></div>
        <div><label>Aadhar number</label><input type="text" name="m_aadhar_${idx}" value="${escapeHtml(data.aadhar)}" maxlength="14" /></div>
        <div><label>Job / occupation</label><input type="text" name="m_job_${idx}" value="${escapeHtml(data.job)}" /></div>
        <div><label>Disease / health condition</label><input type="text" name="m_disease_${idx}" value="${escapeHtml(data.disease)}" placeholder="None" /></div>
      </div>
    </div>`;
}
 
function renderAddTab(main) {
  if (!state.addMemberDraftCount) state.addMemberDraftCount = 1;
  main.innerHTML = `
    <h2 class="page-title">Add a family</h2>
    <p class="page-sub">Enter the household details, then add each family member.</p>
    <form id="family-form">
      <div class="panel">
        <h3>Household details</h3>
        <div class="field-grid">
          <div><label>House no *</label><input type="text" name="house_no" required /></div>
          <div><label>House name</label><input type="text" name="house_name" /></div>
          <div><label>Area / locality *</label><input type="text" name="area" required /></div>
          <div style="grid-column: 1 / -1;"><label>Address</label><input type="text" name="address" /></div>
          <div style="grid-column: 1 / -1;"><label>Description / notes</label><textarea name="description" placeholder="Anything worth noting about this household"></textarea></div>
        </div>
      </div>
      <div class="panel">
        <h3>Family members</h3>
        <div id="members-container">
          ${Array.from({ length: state.addMemberDraftCount }).map((_, i) => memberFormRow(i)).join("")}
        </div>
        <button type="button" id="add-member-row" class="btn btn-ghost btn-sm">＋ Add another member</button>
      </div>
      <button type="submit" class="btn btn-primary">Save family</button>
    </form>
  `;
 
  document.getElementById("add-member-row").addEventListener("click", () => {
    state.addMemberDraftCount += 1;
    document.getElementById("members-container").insertAdjacentHTML(
      "beforeend",
      memberFormRow(state.addMemberDraftCount - 1)
    );
    attachRemoveHandlers();
  });
  attachRemoveHandlers();
 
  function attachRemoveHandlers() {
    document.querySelectorAll(".remove-member").forEach((btn) => {
      btn.onclick = () => {
        const row = btn.closest(".member-row");
        if (document.querySelectorAll(".member-row").length > 1) row.remove();
      };
    });
  }
 
  document.getElementById("family-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const familyPayload = {
      house_no: fd.get("house_no")?.trim(),
      house_name: fd.get("house_name")?.trim() || null,
      area: fd.get("area")?.trim(),
      address: fd.get("address")?.trim() || null,
      description: fd.get("description")?.trim() || null,
    };
 
    const { data: famRows, error: famErr } = await sb
      .from("families")
      .insert(familyPayload)
      .select();
    if (famErr) { toast("Error saving household: " + famErr.message); return; }
    const familyId = famRows[0].id;
 
    const memberRows = [];
    document.querySelectorAll(".member-row").forEach((row) => {
      const idx = row.dataset.idx;
      const name = fd.get(`m_name_${idx}`)?.trim();
      if (!name) return;
      memberRows.push({
        family_id: familyId,
        name,
        role: fd.get(`m_role_${idx}`) || null,
        gender: fd.get(`m_gender_${idx}`) || null,
        age: fd.get(`m_age_${idx}`) ? parseInt(fd.get(`m_age_${idx}`), 10) : null,
        phone: fd.get(`m_phone_${idx}`)?.trim() || null,
        aadhar: fd.get(`m_aadhar_${idx}`)?.trim() || null,
        job: fd.get(`m_job_${idx}`)?.trim() || null,
        disease: fd.get(`m_disease_${idx}`)?.trim() || null,
      });
    });
 
    if (memberRows.length) {
      const { error: memErr } = await sb.from("members").insert(memberRows);
      if (memErr) { toast("Household saved, but members failed: " + memErr.message); }
    }
 
    toast("Family saved.");
    state.addMemberDraftCount = 1;
    await loadData();
    state.tab = "view";
    renderShell();
  });
}
 
// ------------------------------------------------------------
// VIEW & MANAGE TAB
// ------------------------------------------------------------
function getFilteredSortedFamilies() {
  const q = state.search.trim().toLowerCase();
  let list = state.families.filter((f) => {
    const members = state.membersByFamily[f.id] || [];
    if (state.filterArea && f.area !== state.filterArea) return false;
 
    if (state.ageMin !== "" || state.ageMax !== "") {
      const min = state.ageMin !== "" ? parseInt(state.ageMin, 10) : 0;
      const max = state.ageMax !== "" ? parseInt(state.ageMax, 10) : 999;
      const hasAgeMatch = members.some((m) => m.age !== null && m.age >= min && m.age <= max);
      if (!hasAgeMatch) return false;
    }
 
    if (state.diseaseOnly) {
      const hasDisease = members.some((m) => m.disease && m.disease.trim() && m.disease.trim().toLowerCase() !== "none");
      if (!hasDisease) return false;
    }
 
    if (q) {
      const haystack = [
        f.house_no, f.house_name, f.address, f.area, f.description,
        ...members.flatMap((m) => [m.name, m.phone, m.aadhar, m.job, m.disease]),
      ].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
 
  const cmp = {
    house_name_asc: (a, b) => (a.house_name || "").localeCompare(b.house_name || ""),
    house_name_desc: (a, b) => (b.house_name || "").localeCompare(a.house_name || ""),
    house_no_asc: (a, b) => (a.house_no || "").localeCompare(b.house_no || "", undefined, { numeric: true }),
    area_asc: (a, b) => (a.area || "").localeCompare(b.area || ""),
    newest: (a, b) => new Date(b.created_at) - new Date(a.created_at),
  }[state.sortBy];
  return list.sort(cmp);
}
 
function uniqueAreas() {
  return [...new Set(state.families.map((f) => f.area).filter(Boolean))].sort();
}
 
function renderViewTab(main) {
  const list = getFilteredSortedFamilies();
  const totalMembers = Object.values(state.membersByFamily).reduce((s, arr) => s + arr.length, 0);
  const diseasedCount = Object.values(state.membersByFamily).flat().filter(
    (m) => m.disease && m.disease.trim() && m.disease.trim().toLowerCase() !== "none"
  ).length;
 
  main.innerHTML = `
    <h2 class="page-title">View &amp; manage families</h2>
    <p class="page-sub">Search, sort, filter, or edit any household and its members.</p>
 
    <div class="stat-row">
      <div class="stat"><span class="num">${state.families.length}</span><span class="lbl">Households</span></div>
      <div class="stat"><span class="num">${totalMembers}</span><span class="lbl">People</span></div>
      <div class="stat"><span class="num">${diseasedCount}</span><span class="lbl">With a health condition</span></div>
      <div class="stat"><span class="num">${uniqueAreas().length}</span><span class="lbl">Areas</span></div>
    </div>
 
    <div class="panel">
      <div class="toolbar">
        <div class="field grow">
          <label>Search</label>
          <input type="text" id="f-search" placeholder="Name, house no, phone, area…" value="${escapeHtml(state.search)}" />
        </div>
        <div class="field">
          <label>Sort by</label>
          <select id="f-sort">
            <option value="house_name_asc" ${state.sortBy === "house_name_asc" ? "selected" : ""}>House name (A–Z)</option>
            <option value="house_name_desc" ${state.sortBy === "house_name_desc" ? "selected" : ""}>House name (Z–A)</option>
            <option value="house_no_asc" ${state.sortBy === "house_no_asc" ? "selected" : ""}>House no</option>
            <option value="area_asc" ${state.sortBy === "area_asc" ? "selected" : ""}>Area</option>
            <option value="newest" ${state.sortBy === "newest" ? "selected" : ""}>Newest first</option>
          </select>
        </div>
        <div class="field">
          <label>Area</label>
          <select id="f-area">
            <option value="">All areas</option>
            ${uniqueAreas().map((a) => `<option ${state.filterArea === a ? "selected" : ""}>${escapeHtml(a)}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Age min</label><input type="number" id="f-age-min" min="0" value="${escapeHtml(state.ageMin)}" /></div>
        <div class="field"><label>Age max</label><input type="number" id="f-age-max" min="0" value="${escapeHtml(state.ageMax)}" /></div>
        <div class="field">
          <label>&nbsp;</label>
          <label style="display:flex;align-items:center;gap:6px;text-transform:none;font-weight:400;">
            <input type="checkbox" id="f-disease" ${state.diseaseOnly ? "checked" : ""} style="width:auto;" /> Health condition only
          </label>
        </div>
        <div class="field"><button id="f-clear" class="btn btn-ghost btn-sm">Clear filters</button></div>
      </div>
    </div>
 
    <div id="family-list"></div>
  `;
 
  document.getElementById("f-search").addEventListener("input", (e) => { state.search = e.target.value; renderViewTab(main); });
  document.getElementById("f-sort").addEventListener("change", (e) => { state.sortBy = e.target.value; renderViewTab(main); });
  document.getElementById("f-area").addEventListener("change", (e) => { state.filterArea = e.target.value; renderViewTab(main); });
  document.getElementById("f-age-min").addEventListener("input", (e) => { state.ageMin = e.target.value; renderViewTab(main); });
  document.getElementById("f-age-max").addEventListener("input", (e) => { state.ageMax = e.target.value; renderViewTab(main); });
  document.getElementById("f-disease").addEventListener("change", (e) => { state.diseaseOnly = e.target.checked; renderViewTab(main); });
  document.getElementById("f-clear").addEventListener("click", () => {
    state.search = ""; state.filterArea = ""; state.ageMin = ""; state.ageMax = ""; state.diseaseOnly = false;
    renderViewTab(main);
  });
 
  const listEl = document.getElementById("family-list");
  if (!list.length) {
    listEl.innerHTML = `<div class="panel"><p style="margin:0;color:var(--ink-soft);">No households match. Try clearing filters, or add your first family.</p></div>`;
    return;
  }
  listEl.innerHTML = list.map((f) => renderFamilyCard(f)).join("");
  attachFamilyCardHandlers(main);
}
 
function renderFamilyCard(f) {
  const members = state.membersByFamily[f.id] || [];
  const isEditing = state.editingFamilyId === f.id;
 
  if (isEditing) {
    return `
      <div class="family-card">
        <div class="family-body" style="padding-top:16px;">
          <div class="field-grid">
            <div><label>House no</label><input type="text" class="ef-house_no" value="${escapeHtml(f.house_no)}" /></div>
            <div><label>House name</label><input type="text" class="ef-house_name" value="${escapeHtml(f.house_name)}" /></div>
            <div><label>Area</label><input type="text" class="ef-area" value="${escapeHtml(f.area)}" /></div>
            <div style="grid-column:1/-1;"><label>Address</label><input type="text" class="ef-address" value="${escapeHtml(f.address)}" /></div>
            <div style="grid-column:1/-1;"><label>Description</label><textarea class="ef-description">${escapeHtml(f.description)}</textarea></div>
          </div>
          <div style="margin-top:12px;display:flex;gap:8px;">
            <button class="btn btn-primary btn-sm save-family" data-id="${f.id}">Save changes</button>
            <button class="btn btn-ghost btn-sm cancel-edit-family">Cancel</button>
          </div>
        </div>
      </div>`;
  }
 
  return `
    <div class="family-card">
      <div class="family-head">
        <div>
          <h4>${escapeHtml(f.house_name) || "(no house name)"} <span style="font-weight:400;color:var(--ink-soft);">— House No. ${escapeHtml(f.house_no)}</span></h4>
          <div class="meta">${escapeHtml(f.address) || ""}</div>
          ${f.area ? `<span class="area-tag">${escapeHtml(f.area)}</span>` : ""}
          ${f.description ? `<div class="meta" style="margin-top:6px;">${escapeHtml(f.description)}</div>` : ""}
        </div>
        <div class="family-actions">
          <button class="btn btn-ghost btn-sm edit-family" data-id="${f.id}">Edit</button>
          <button class="btn btn-danger btn-sm delete-family" data-id="${f.id}">Delete</button>
        </div>
      </div>
      <div class="family-body">
        ${members.length ? `
        <table class="member-table">
          <thead><tr><th>Name</th><th>Role</th><th>Gender</th><th>Age</th><th>Phone</th><th>Aadhar</th><th>Job</th><th>Health condition</th><th></th></tr></thead>
          <tbody>
            ${members.map((m) => renderMemberRow(f.id, m)).join("")}
          </tbody>
        </table>` : `<p class="empty-note">No members added yet.</p>`}
        ${renderAddMemberInline(f.id)}
      </div>
    </div>`;
}
 
function renderMemberRow(familyId, m) {
  const key = `${familyId}:${m.id}`;
  if (state.editingMemberKey === key) {
    return `
      <tr>
        <td colspan="9">
          <div class="field-grid" style="margin:6px 0;">
            <div><label>Name</label><input type="text" class="em-name" value="${escapeHtml(m.name)}" /></div>
            <div><label>Role</label><select class="em-role">${ROLE_OPTIONS.map((r) => `<option ${m.role === r ? "selected" : ""}>${r}</option>`).join("")}</select></div>
            <div><label>Gender</label><select class="em-gender"><option value="">—</option>${GENDER_OPTIONS.map((g) => `<option ${m.gender === g ? "selected" : ""}>${g}</option>`).join("")}</select></div>
            <div><label>Age</label><input type="number" class="em-age" value="${escapeHtml(m.age)}" /></div>
            <div><label>Phone</label><input type="tel" class="em-phone" value="${escapeHtml(m.phone)}" /></div>
            <div><label>Aadhar</label><input type="text" class="em-aadhar" value="${escapeHtml(m.aadhar)}" /></div>
            <div><label>Job</label><input type="text" class="em-job" value="${escapeHtml(m.job)}" /></div>
            <div><label>Health condition</label><input type="text" class="em-disease" value="${escapeHtml(m.disease)}" /></div>
          </div>
          <button class="btn btn-primary btn-sm save-member" data-family="${familyId}" data-member="${m.id}">Save</button>
          <button class="btn btn-ghost btn-sm cancel-edit-member">Cancel</button>
        </td>
      </tr>`;
  }
  const hasDisease = m.disease && m.disease.trim() && m.disease.trim().toLowerCase() !== "none";
  return `
    <tr>
      <td>${escapeHtml(m.name)}</td>
      <td><span class="badge ${m.role === "Ration Card Head" ? "badge-head" : "badge-member"}">${escapeHtml(m.role) || "—"}</span></td>
      <td>${escapeHtml(m.gender) || "—"}</td>
      <td>${m.age ?? "—"}</td>
      <td>${escapeHtml(m.phone) || "—"}</td>
      <td>${escapeHtml(m.aadhar) || "—"}</td>
      <td>${escapeHtml(m.job) || "—"}</td>
      <td>${hasDisease ? `<span class="disease-flag">${escapeHtml(m.disease)}</span>` : "—"}</td>
      <td class="member-actions">
        <button class="btn btn-ghost btn-sm edit-member" data-family="${familyId}" data-member="${m.id}">Edit</button>
        <button class="btn btn-danger btn-sm delete-member" data-family="${familyId}" data-member="${m.id}">Delete</button>
      </td>
    </tr>`;
}
 
function renderAddMemberInline(familyId) {
  if (state.addingMemberFor !== familyId) {
    return `<button class="btn btn-ghost btn-sm add-member-btn" data-family="${familyId}" style="margin-top:10px;">＋ Add member to this family</button>`;
  }
  return `
    <div class="member-row" style="margin-top:12px;">
      <div class="field-grid">
        <div><label>Full name *</label><input type="text" id="nm-name" /></div>
        <div><label>Role</label><select id="nm-role">${ROLE_OPTIONS.map((r) => `<option>${r}</option>`).join("")}</select></div>
        <div><label>Gender</label><select id="nm-gender"><option value="">—</option>${GENDER_OPTIONS.map((g) => `<option>${g}</option>`).join("")}</select></div>
        <div><label>Age</label><input type="number" id="nm-age" /></div>
        <div><label>Phone</label><input type="tel" id="nm-phone" /></div>
        <div><label>Aadhar</label><input type="text" id="nm-aadhar" /></div>
        <div><label>Job</label><input type="text" id="nm-job" /></div>
        <div><label>Health condition</label><input type="text" id="nm-disease" /></div>
      </div>
      <div style="margin-top:10px;display:flex;gap:8px;">
        <button class="btn btn-primary btn-sm save-new-member" data-family="${familyId}">Save member</button>
        <button class="btn btn-ghost btn-sm cancel-new-member">Cancel</button>
      </div>
    </div>`;
}
 
function attachFamilyCardHandlers(main) {
  document.querySelectorAll(".edit-family").forEach((b) => b.addEventListener("click", () => {
    state.editingFamilyId = b.dataset.id; renderViewTab(main);
  }));
  document.querySelectorAll(".cancel-edit-family").forEach((b) => b.addEventListener("click", () => {
    state.editingFamilyId = null; renderViewTab(main);
  }));
  document.querySelectorAll(".save-family").forEach((b) => b.addEventListener("click", async () => {
    const card = b.closest(".family-card");
    const payload = {
      house_no: card.querySelector(".ef-house_no").value.trim(),
      house_name: card.querySelector(".ef-house_name").value.trim() || null,
      area: card.querySelector(".ef-area").value.trim(),
      address: card.querySelector(".ef-address").value.trim() || null,
      description: card.querySelector(".ef-description").value.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await sb.from("families").update(payload).eq("id", b.dataset.id);
    if (error) { toast("Error: " + error.message); return; }
    state.editingFamilyId = null;
    toast("Household updated.");
    await loadData();
  }));
  document.querySelectorAll(".delete-family").forEach((b) => b.addEventListener("click", async () => {
    if (!confirm("Delete this household and all its members? This cannot be undone.")) return;
    const { error } = await sb.from("families").delete().eq("id", b.dataset.id);
    if (error) { toast("Error: " + error.message); return; }
    toast("Household deleted.");
    await loadData();
  }));
 
  document.querySelectorAll(".edit-member").forEach((b) => b.addEventListener("click", () => {
    state.editingMemberKey = `${b.dataset.family}:${b.dataset.member}`; renderViewTab(main);
  }));
  document.querySelectorAll(".cancel-edit-member").forEach((b) => b.addEventListener("click", () => {
    state.editingMemberKey = null; renderViewTab(main);
  }));
  document.querySelectorAll(".save-member").forEach((b) => b.addEventListener("click", async () => {
    const row = b.closest("tr");
    const payload = {
      name: row.querySelector(".em-name").value.trim(),
      role: row.querySelector(".em-role").value,
      gender: row.querySelector(".em-gender").value || null,
      age: row.querySelector(".em-age").value ? parseInt(row.querySelector(".em-age").value, 10) : null,
      phone: row.querySelector(".em-phone").value.trim() || null,
      aadhar: row.querySelector(".em-aadhar").value.trim() || null,
      job: row.querySelector(".em-job").value.trim() || null,
      disease: row.querySelector(".em-disease").value.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await sb.from("members").update(payload).eq("id", b.dataset.member);
    if (error) { toast("Error: " + error.message); return; }
    state.editingMemberKey = null;
    toast("Member updated.");
    await loadData();
  }));
  document.querySelectorAll(".delete-member").forEach((b) => b.addEventListener("click", async () => {
    if (!confirm("Delete this person's record?")) return;
    const { error } = await sb.from("members").delete().eq("id", b.dataset.member);
    if (error) { toast("Error: " + error.message); return; }
    toast("Member deleted.");
    await loadData();
  }));
 
  document.querySelectorAll(".add-member-btn").forEach((b) => b.addEventListener("click", () => {
    state.addingMemberFor = b.dataset.family; renderViewTab(main);
  }));
  document.querySelectorAll(".cancel-new-member").forEach((b) => b.addEventListener("click", () => {
    state.addingMemberFor = null; renderViewTab(main);
  }));
  document.querySelectorAll(".save-new-member").forEach((b) => b.addEventListener("click", async () => {
    const name = document.getElementById("nm-name").value.trim();
    if (!name) { toast("Name is required."); return; }
    const payload = {
      family_id: b.dataset.family,
      name,
      role: document.getElementById("nm-role").value,
      gender: document.getElementById("nm-gender").value || null,
      age: document.getElementById("nm-age").value ? parseInt(document.getElementById("nm-age").value, 10) : null,
      phone: document.getElementById("nm-phone").value.trim() || null,
      aadhar: document.getElementById("nm-aadhar").value.trim() || null,
      job: document.getElementById("nm-job").value.trim() || null,
      disease: document.getElementById("nm-disease").value.trim() || null,
    };
    const { error } = await sb.from("members").insert(payload);
    if (error) { toast("Error: " + error.message); return; }
    state.addingMemberFor = null;
    toast("Member added.");
    await loadData();
  }));
}
 
// ------------------------------------------------------------
// EXPORT TAB
// ------------------------------------------------------------
function toCsvValue(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
 
function buildRows(families) {
  const rows = [];
  families.forEach((f) => {
    const members = state.membersByFamily[f.id] || [];
    if (!members.length) {
      rows.push({ f, m: {} });
    } else {
      members.forEach((m) => rows.push({ f, m }));
    }
  });
  return rows;
}
 
function downloadCsv(filename, rows) {
  const header = ["House No", "House Name", "Address", "Area", "Household Description",
    "Member Name", "Role", "Gender", "Age", "Phone", "Aadhar", "Job", "Health Condition"];
  const lines = [header.join(",")];
  rows.forEach(({ f, m }) => {
    lines.push([
      f.house_no, f.house_name, f.address, f.area, f.description,
      m.name, m.role, m.gender, m.age, m.phone, m.aadhar, m.job, m.disease,
    ].map(toCsvValue).join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
 
function renderExportTab(main) {
  const areas = uniqueAreas();
  main.innerHTML = `
    <h2 class="page-title">Export data</h2>
    <p class="page-sub">Download your ward's records as a CSV file (opens in Excel / Google Sheets).</p>
    <div class="export-grid">
      <div class="export-tile">
        <h4>All records — name A→Z</h4>
        <p>Every household and member, sorted by member name.</p>
        <button class="btn btn-teal btn-sm" id="exp-name-asc">Download</button>
      </div>
      <div class="export-tile">
        <h4>All records — name Z→A</h4>
        <p>Every household and member, reverse alphabetical.</p>
        <button class="btn btn-teal btn-sm" id="exp-name-desc">Download</button>
      </div>
      <div class="export-tile">
        <h4>By house no</h4>
        <p>Sorted by house number.</p>
        <button class="btn btn-teal btn-sm" id="exp-house-no">Download</button>
      </div>
      <div class="export-tile">
        <h4>Grouped by area</h4>
        <p>${areas.length} area(s) found: ${areas.map(escapeHtml).join(", ") || "none yet"}. Sorted by area, then name.</p>
        <select id="exp-area-pick" style="margin-bottom:8px;">
          <option value="">All areas (grouped)</option>
          ${areas.map((a) => `<option>${escapeHtml(a)}</option>`).join("")}
        </select>
        <button class="btn btn-teal btn-sm" id="exp-area">Download</button>
      </div>
      <div class="export-tile">
        <h4>By age group</h4>
        <p>Pick a preset or type a custom range.</p>
        <select id="exp-age-preset" style="margin-bottom:8px;">
          <option value="">Custom range below</option>
          ${AGE_PRESETS.map((p, i) => `<option value="${i}">${p.label}</option>`).join("")}
        </select>
        <div style="display:flex;gap:6px;margin-bottom:8px;">
          <input type="number" id="exp-age-min" placeholder="Min" style="width:80px;" />
          <input type="number" id="exp-age-max" placeholder="Max" style="width:80px;" />
        </div>
        <button class="btn btn-teal btn-sm" id="exp-age">Download</button>
      </div>
      <div class="export-tile">
        <h4>People with a health condition</h4>
        <p>Only members with a disease / condition noted.</p>
        <button class="btn btn-teal btn-sm" id="exp-disease">Download</button>
      </div>
      <div class="export-tile">
        <h4>Everything (raw)</h4>
        <p>Full unfiltered dataset, in current view order.</p>
        <button class="btn btn-primary btn-sm" id="exp-all">Download</button>
      </div>
    </div>
  `;
 
  document.getElementById("exp-name-asc").addEventListener("click", () => {
    const sorted = [...state.families].sort((a, b) => (a.house_name || "").localeCompare(b.house_name || ""));
    downloadCsv("families_name_asc.csv", buildRows(sorted));
  });
  document.getElementById("exp-name-desc").addEventListener("click", () => {
    const sorted = [...state.families].sort((a, b) => (b.house_name || "").localeCompare(a.house_name || ""));
    downloadCsv("families_name_desc.csv", buildRows(sorted));
  });
  document.getElementById("exp-house-no").addEventListener("click", () => {
    const sorted = [...state.families].sort((a, b) => (a.house_no || "").localeCompare(b.house_no || "", undefined, { numeric: true }));
    downloadCsv("families_by_house_no.csv", buildRows(sorted));
  });
  document.getElementById("exp-area").addEventListener("click", () => {
    const pick = document.getElementById("exp-area-pick").value;
    let fam = pick ? state.families.filter((f) => f.area === pick) : [...state.families];
    fam.sort((a, b) => (a.area || "").localeCompare(b.area || "") || (a.house_name || "").localeCompare(b.house_name || ""));
    downloadCsv(pick ? `area_${pick}.csv` : "families_by_area.csv", buildRows(fam));
  });
  document.getElementById("exp-age").addEventListener("click", () => {
    const presetIdx = document.getElementById("exp-age-preset").value;
    let min, max;
    if (presetIdx !== "") {
      min = AGE_PRESETS[presetIdx].min; max = AGE_PRESETS[presetIdx].max;
    } else {
      min = document.getElementById("exp-age-min").value ? parseInt(document.getElementById("exp-age-min").value, 10) : 0;
      max = document.getElementById("exp-age-max").value ? parseInt(document.getElementById("exp-age-max").value, 10) : 150;
    }
    const rows = [];
    state.families.forEach((f) => {
      (state.membersByFamily[f.id] || []).forEach((m) => {
        if (m.age !== null && m.age >= min && m.age <= max) rows.push({ f, m });
      });
    });
    downloadCsv(`age_${min}_to_${max}.csv`, rows);
  });
  document.getElementById("exp-disease").addEventListener("click", () => {
    const rows = [];
    state.families.forEach((f) => {
      (state.membersByFamily[f.id] || []).forEach((m) => {
        if (m.disease && m.disease.trim() && m.disease.trim().toLowerCase() !== "none") rows.push({ f, m });
      });
    });
    downloadCsv("health_conditions.csv", rows);
  });
  document.getElementById("exp-all").addEventListener("click", () => {
    downloadCsv("all_records.csv", buildRows(state.families));
  });
}
 
init();
