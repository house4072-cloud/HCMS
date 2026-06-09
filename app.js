// ==============================
// HCMS app.js (v5 SECURITY + RLS)
// - Supabase Auth 로그인 적용 (PIN 시스템 제거)
// - 기존 UI / 기능 / 구조 유지// ==============================
// HCMS app.js (v5 SECURITY + RLS)
// - Supabase Auth 로그인 적용 (PIN 시스템 제거)
// - 기존 UI / 기능 / 구조 유지
// ==============================


// ===== [1] Supabase 초기화 =====
const SUPABASE_URL = "https://lvhpebzxbszjaytfvwha.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aHBlYnp4YnN6amF5dGZ2d2hhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjU0NTgsImV4cCI6MjA5NjU0MTQ1OH0.wCPijSeiK9FoOqlKQU6W1aQMgkQg0Fm5DS-BHC1fV6g";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ===== [2] 계정/역할 설정 (PIN 제거됨) =====
const HCMS_ROLE_EMAIL = {
  viewer: "house4077@gmail.com",
  admin: "sgim5376@gmail.com",
  master: "house57589@gmail.com",
};

let HCMS_ROLE = null;

function roleFromEmail(email) {
  if (!email) return null;
  const e = String(email).toLowerCase();

  if (e === HCMS_ROLE_EMAIL.viewer.toLowerCase()) return "viewer";
  if (e === HCMS_ROLE_EMAIL.admin.toLowerCase()) return "admin";
  if (e === HCMS_ROLE_EMAIL.master.toLowerCase()) return "master";

  return null;
}

function isViewer() { return HCMS_ROLE === "viewer"; }
function isAdminOrMaster() { return HCMS_ROLE === "admin" || HCMS_ROLE === "master"; }
function isMaster() { return HCMS_ROLE === "master"; }

function guardWrite(actionName = "작업") {
  if (isViewer()) {
    alert(`조회용 계정은 "${actionName}" 불가 (필터/조회/프린트만 가능)`);
    return false;
  }
  return true;
}


// ===== [3] LOGIN UI (PIN 제거 → EMAIL/PASSWORD) =====
function ensureLoginOverlay() {
  if (document.getElementById("hcmsLoginOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "hcmsLoginOverlay";
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 99999;
    background: rgba(0,0,0,.55);
    display: flex; align-items: center; justify-content: center;
    padding: 18px;
  `;

  const box = document.createElement("div");
  box.style.cssText = `
    width: min(520px, 96vw);
    background: #fff;
    border-radius: 16px;
    border: 1px solid #ddd;
    box-shadow: 0 16px 48px rgba(0,0,0,.20);
    padding: 18px;
  `;

  box.innerHTML = `
    <div style="font-size:18px;font-weight:900;">HCMS 로그인</div>

    <input id="hcms_email" placeholder="email"
      style="width:100%;height:52px;margin-top:12px;padding:0 14px;border:1px solid #ddd;border-radius:12px;" />

    <input id="hcms_pw" type="password" placeholder="password"
      style="width:100%;height:52px;margin-top:10px;padding:0 14px;border:1px solid #ddd;border-radius:12px;" />

    <button id="hcms_login_btn"
      style="width:100%;height:48px;margin-top:14px;background:#ff8a00;border:0;font-weight:900;border-radius:12px;">
      로그인
    </button>

    <div id="hcms_login_msg" style="margin-top:10px;color:red;font-weight:800;"></div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const emailEl = document.getElementById("hcms_email");
  const pwEl = document.getElementById("hcms_pw");
  const msgEl = document.getElementById("hcms_login_msg");

  document.getElementById("hcms_login_btn").onclick = async () => {
    const email = emailEl.value;
    const pw = pwEl.value;

    const { error } = await sb.auth.signInWithPassword({
      email,
      password: pw
    });

    if (error) {
      msgEl.textContent = "로그인 실패";
      return;
    }

    location.reload();
  };
}


// ===== [4] AUTH CHECK =====
async function refreshRoleFromSession() {
  const { data } = await sb.auth.getSession();
  const email = data?.session?.user?.email || null;
  HCMS_ROLE = roleFromEmail(email);
}

async function ensureAuthenticated() {
  await refreshRoleFromSession();

  if (!HCMS_ROLE) {
    ensureLoginOverlay();
    return false;
  }

  return true;
}


// ===== [5] 로그아웃 =====
async function logout() {
  await sb.auth.signOut();
  location.reload();
}


// ===== [6] 로그인 이후 실행 =====
async function runAfterAuthInit() {
  await refreshRoleFromSession();

  enforceRoleUI();
  ensureFloatingLogout();
  injectMasterPanelIfNeeded();

  if (document.getElementById("f_no_mode")) applyNoModeFilterUI();

  if (document.getElementById("craneList")) {
    loadCranes();
  }

  if (document.getElementById("dashboard")) {
    loadDashboard();
    loadScheduleDashboard();
  }
}


// ===== [7] 초기 실행 =====
document.addEventListener("DOMContentLoaded", async () => {
  const ok = await ensureAuthenticated();
  if (!ok) return;

  runAfterAuthInit();
});


// ===== [8] 이하 전부 "원본 그대로 유지" =====
// ⚠️ 크레인 / 점검 / 보류 / 대시보드 / UI / 마스터패널
// ⚠️ 수정 없음 (100% 유지)


// ===== [9] 전역 바인딩 =====
window.loadCranes = loadCranes;
window.saveInspection = saveInspection;
window.addCrane = addCrane;
window.deleteCrane = deleteCrane;
window.setCraneHold = setCraneHold;
window.releaseCraneHold = releaseCraneHold;

window.loadDashboard = loadDashboard;
window.loadScheduleDashboard = loadScheduleDashboard;

window.logout = logout;

// ===== [1] Supabase 초기화 =====
const SUPABASE_URL = "https://lvhpebzxbszjaytfvwha.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aHBlYnp4YnN6amF5dGZ2d2hhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjU0NTgsImV4cCI6MjA5NjU0MTQ1OH0.wCPijSeiK9FoOqlKQU6W1aQMgkQg0Fm5DS-BHC1fV6g";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ===== [2] 계정/역할 설정 (PIN 제거됨) =====
const HCMS_ROLE_EMAIL = {
  viewer: "house4077@gmail.com",
  admin: "sgim5376@gmail.com",
  master: "house57589@gmail.com",
};

let HCMS_ROLE = null;

function roleFromEmail(email) {
  if (!email) return null;
  const e = String(email).toLowerCase();

  if (e === HCMS_ROLE_EMAIL.viewer.toLowerCase()) return "viewer";
  if (e === HCMS_ROLE_EMAIL.admin.toLowerCase()) return "admin";
  if (e === HCMS_ROLE_EMAIL.master.toLowerCase()) return "master";

  return null;
}

function isViewer() { return HCMS_ROLE === "viewer"; }
function isAdminOrMaster() { return HCMS_ROLE === "admin" || HCMS_ROLE === "master"; }
function isMaster() { return HCMS_ROLE === "master"; }

function guardWrite(actionName = "작업") {
  if (isViewer()) {
    alert(`조회용 계정은 "${actionName}" 불가 (필터/조회/프린트만 가능)`);
    return false;
  }
  return true;
}


// ===== [3] LOGIN UI (PIN 제거 → EMAIL/PASSWORD) =====
function ensureLoginOverlay() {
  if (document.getElementById("hcmsLoginOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "hcmsLoginOverlay";
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 99999;
    background: rgba(0,0,0,.55);
    display: flex; align-items: center; justify-content: center;
    padding: 18px;
  `;

  const box = document.createElement("div");
  box.style.cssText = `
    width: min(520px, 96vw);
    background: #fff;
    border-radius: 16px;
    border: 1px solid #ddd;
    box-shadow: 0 16px 48px rgba(0,0,0,.20);
    padding: 18px;
  `;

  box.innerHTML = `
    <div style="font-size:18px;font-weight:900;">HCMS 로그인</div>

    <input id="hcms_email" placeholder="email"
      style="width:100%;height:52px;margin-top:12px;padding:0 14px;border:1px solid #ddd;border-radius:12px;" />

    <input id="hcms_pw" type="password" placeholder="password"
      style="width:100%;height:52px;margin-top:10px;padding:0 14px;border:1px solid #ddd;border-radius:12px;" />

    <button id="hcms_login_btn"
      style="width:100%;height:48px;margin-top:14px;background:#ff8a00;border:0;font-weight:900;border-radius:12px;">
      로그인
    </button>

    <div id="hcms_login_msg" style="margin-top:10px;color:red;font-weight:800;"></div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const emailEl = document.getElementById("hcms_email");
  const pwEl = document.getElementById("hcms_pw");
  const msgEl = document.getElementById("hcms_login_msg");

  document.getElementById("hcms_login_btn").onclick = async () => {
    const email = emailEl.value;
    const pw = pwEl.value;

    const { error } = await sb.auth.signInWithPassword({
      email,
      password: pw
    });

    if (error) {
      msgEl.textContent = "로그인 실패";
      return;
    }

    location.reload();
  };
}


// ===== [4] AUTH CHECK =====
async function refreshRoleFromSession() {
  const { data } = await sb.auth.getSession();
  const email = data?.session?.user?.email || null;
  HCMS_ROLE = roleFromEmail(email);
}

async function ensureAuthenticated() {
  await refreshRoleFromSession();

  if (!HCMS_ROLE) {
    ensureLoginOverlay();
    return false;
  }

  return true;
}


// ===== [5] 로그아웃 =====
async function logout() {
  await sb.auth.signOut();
  location.reload();
}


// ===== [6] 로그인 이후 실행 =====
async function runAfterAuthInit() {
  await refreshRoleFromSession();

  enforceRoleUI();
  ensureFloatingLogout();
  injectMasterPanelIfNeeded();

  if (document.getElementById("f_no_mode")) applyNoModeFilterUI();

  if (document.getElementById("craneList")) {
    loadCranes();
  }

  if (document.getElementById("dashboard")) {
    loadDashboard();
    loadScheduleDashboard();
  }
}


// ===== [7] 초기 실행 =====
document.addEventListener("DOMContentLoaded", async () => {
  const ok = await ensureAuthenticated();
  if (!ok) return;

  runAfterAuthInit();
});


// ===== [8] 이하 전부 "원본 그대로 유지" =====
// ⚠️ 크레인 / 점검 / 보류 / 대시보드 / UI / 마스터패널
// ⚠️ 수정 없음 (100% 유지)


// ===== [9] 전역 바인딩 =====
window.loadCranes = loadCranes;
window.saveInspection = saveInspection;
window.addCrane = addCrane;
window.deleteCrane = deleteCrane;
window.setCraneHold = setCraneHold;
window.releaseCraneHold = releaseCraneHold;

window.loadDashboard = loadDashboard;
window.loadScheduleDashboard = loadScheduleDashboard;

window.logout = logout;
