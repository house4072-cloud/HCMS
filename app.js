// ==============================
// HCMS app.js (v5 SECURITY + RLS)
// - Supabase Auth 로그인(PIN) + 역할(viewer/admin/master)
// - viewer: 조회/필터/프린트만 허용(수정/입력/상태변경 차단)
// ==============================


// ===== [1] Supabase 초기화 =====
const SUPABASE_URL = "https://lzfksuiftgmxwkhwhnhg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6ZmtzdWlmdGdteHdraHdobmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NzczMDMsImV4cCI6MjA4MTM1MzMwM30.BHI8dTc18Jw3akhlRL7OZ8_0sYQwjb0-QaMGjKjUfYA";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ===== [2] 계정/핀(비번) 설정 =====
const HCMS_ROLE_EMAIL = {
  viewer: "house4077@gmail.com",
  admin: "sgim5376@gmail.com",
  master: "house57589@gmail.com",
};

const HCMS_PINS_DEFAULT = {
  viewer: "0000",
  admin: "0071",
  master: "0823",
};

const HCMS_PIN_STORAGE_KEY = "HCMS_PINS_V1";

// 현재 로그인 역할
let HCMS_ROLE = null;
// 핀(비번) 로컬 저장값
let HCMS_PINS = loadPins();

// 핀 로드/저장
function loadPins() {
  try {
    const raw = localStorage.getItem(HCMS_PIN_STORAGE_KEY);
    if (!raw) return { ...HCMS_PINS_DEFAULT };
    const parsed = JSON.parse(raw);
    return {
      viewer: parsed.viewer || HCMS_PINS_DEFAULT.viewer,
      admin: parsed.admin || HCMS_PINS_DEFAULT.admin,
      master: parsed.master || HCMS_PINS_DEFAULT.master,
    };
  } catch {
    return { ...HCMS_PINS_DEFAULT };
  }
}
function savePins(pins) {
  HCMS_PINS = { ...pins };
  localStorage.setItem(HCMS_PIN_STORAGE_KEY, JSON.stringify(HCMS_PINS));
}

function roleFromEmail(email) {
  if (!email) return null;
  const e = String(email).toLowerCase();
  if (e === String(HCMS_ROLE_EMAIL.viewer).toLowerCase()) return "viewer";
  if (e === String(HCMS_ROLE_EMAIL.admin).toLowerCase()) return "admin";
  if (e === String(HCMS_ROLE_EMAIL.master).toLowerCase()) return "master";
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

// ===== [3] 로그인 UI(오버레이) =====
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
    padding: 18px 18px 14px;
    font-family: Arial, sans-serif;
  `;

  box.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
      <div style="font-size:18px;font-weight:900;">HCMS 로그인</div>
      <div style="font-size:12px;color:#666;">RLS 보안 적용</div>
    </div>

    <div style="margin-top:12px;color:#111;font-weight:800;">비밀번호(PIN) 입력</div>
    <input id="hcms_pin" type="password" inputmode="numeric" placeholder="예: 1234"
      style="margin-top:8px;width:100%;height:52px;font-size:18px;padding:0 14px;border-radius:12px;border:1px solid #ddd;outline:none;" />

    <div style="margin-top:10px;font-size:13px;color:#444;line-height:1.35;">
      · 조회용: 필터/조회/프린트만 가능<br/>
      · 관리자/마스터: 등록/수정/삭제/점검처리 가능
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
      <button id="hcmsLoginBtn"
        style="height:48px;padding:0 18px;border-radius:12px;border:0;background:#ff8a00;color:#000;font-weight:900;cursor:pointer;">
        로그인
      </button>
      <button id="hcmsLogoutBtn"
        style="height:48px;padding:0 18px;border-radius:12px;border:1px solid #ddd;background:#fff;color:#111;font-weight:900;cursor:pointer;">
        로그아웃
      </button>
      <div id="hcmsLoginMsg" style="flex:1;min-width:180px;align-self:center;color:#b00020;font-weight:800;"></div>
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const pinEl = document.getElementById("hcms_pin");
  const msgEl = document.getElementById("hcmsLoginMsg");
  const loginBtn = document.getElementById("hcmsLoginBtn");
  const logoutBtn = document.getElementById("hcmsLogoutBtn");

  const doLogin = async () => {
    msgEl.textContent = "";

    const pin = (pinEl.value || "").trim();
    if (!pin) {
      msgEl.textContent = "PIN을 입력하세요.";
      pinEl.focus();
      return;
    }

    // 핀으로 역할 판별(로컬저장 핀 기준)
    let role = null;
    if (pin === HCMS_PINS.viewer) role = "viewer";
    else if (pin === HCMS_PINS.admin) role = "admin";
    else if (pin === HCMS_PINS.master) role = "master";

    if (!role) {
      msgEl.textContent = "PIN이 틀렸습니다.";
      pinEl.focus();
      return;
    }

    const email = HCMS_ROLE_EMAIL[role];

    // Supabase Auth 로그인 (비번=PIN)
    const { error } = await sb.auth.signInWithPassword({
      email,
      password: pin,
    });

    if (error) {
      msgEl.textContent = `로그인 실패: ${error.message}`;
      return;
    }

    // 세션/역할 갱신
    await refreshRoleFromSession();

    // 오버레이 제거
    const ov = document.getElementById("hcmsLoginOverlay");
    if (ov) ov.remove();

    // 로그인 후 초기화 재실행
    runAfterAuthInit();
  };

  loginBtn.addEventListener("click", doLogin);
  pinEl.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });

  logoutBtn.addEventListener("click", async () => {
    await sb.auth.signOut();
    location.reload();
  });
}

async function refreshRoleFromSession() {
  const { data } = await sb.auth.getSession();
  const session = data?.session;
  const email = session?.user?.email || null;
  HCMS_ROLE = roleFromEmail(email);

  // 역할이 아예 못맞추면(다른계정 로그인) 강제 로그아웃
  if (!HCMS_ROLE) {
    await sb.auth.signOut();
    HCMS_ROLE = null;
  }
}

async function ensureAuthenticated() {
  await refreshRoleFromSession();
  if (!HCMS_ROLE) {
    ensureLoginOverlay();
    return false;
  }
  return true;
}

// 페이지 우측 하단 로그아웃 버튼(항상 표시)
function ensureFloatingLogout() {
  if (document.getElementById("hcmsFloatLogout")) return;
  const btn = document.createElement("button");
  btn.id = "hcmsFloatLogout";
  btn.textContent = "로그아웃";
  btn.style.cssText = `
    position: fixed; right: 16px; bottom: 16px; z-index: 9999;
    height: 44px; padding: 0 14px; border-radius: 12px;
    border: 1px solid #ddd; background: #fff; color:#111;
    font-weight: 900; cursor: pointer;
    box-shadow: 0 10px 24px rgba(0,0,0,.12);
  `;
  btn.addEventListener("click", async () => {
    await sb.auth.signOut();
    location.reload();
  });
  document.body.appendChild(btn);
}

// viewer면 화면에서 수정/등록 관련 요소를 비활성/숨김
function enforceRoleUI() {
  if (!isViewer()) return;

  // 등록/수정/삭제/상태변경 관련 버튼들 숨김 (onclick 기준)
  const blockFns = [
    "addCrane", "deleteCrane", "loadCraneToForm",
    "setCraneHold", "releaseCraneHold",
    "markCraneComplete",
    "saveInspection", "resetInspectionStatus",
    "scheduleSetComplete", "scheduleSetHold"
  ];

  document.querySelectorAll("button").forEach(btn => {
    const oc = btn.getAttribute("onclick") || "";
    if (blockFns.some(fn => oc.includes(fn))) {
      btn.style.display = "none";
    }
  });

  // 입력/등록 폼 입력들 disable
  const disableIdsPrefix = ["c_", "i_"];
  document.querySelectorAll("input, select, textarea").forEach(el => {
    const id = el.id || "";
    if (disableIdsPrefix.some(p => id.startsWith(p))) {
      // 필터(f_)는 허용
      if (!id.startsWith("f_")) {
        el.disabled = true;
      }
    }
  });
}


// ===== [4] v3 FIX: 번호구분 필터 UI (cranes.html에서 호출) =====
function applyNoModeFilterUI() {
  const mode = document.getElementById("f_no_mode")?.value || "";
  const noEl = document.getElementById("f_no");
  if (!noEl) return;

  if (mode === "none") {
    noEl.value = "";
    noEl.readOnly = true;
    noEl.placeholder = "번호없음 선택됨";
    noEl.style.background = "#f4f4f4";
  } else {
    noEl.readOnly = false;
    noEl.placeholder = "크레인 번호 (예: C-014)";
    noEl.style.background = "";
  }
}


// ===== [5] 공통 날짜 유틸 =====
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addMonthsISO(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

// ===== [6] v4 ADD: 날짜 키보드 입력 보정 =====
function normalizeDateValue(v) {
  if (!v) return "";
  const s = String(v).trim();
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  return s;
}


/* =========================
   [7] 크레인 리스트 로드
   - 번호구분(f_no_mode) 필터 동작
========================= */
async function loadCranes() {
  let query = sb.from("cranes").select("*");

  const noMode = document.getElementById("f_no_mode")?.value || "";
  let no = document.getElementById("f_no")?.value?.trim();
  const area = document.getElementById("f_area")?.value;
  const type = document.getElementById("f_type")?.value;
  const brand = document.getElementById("f_brand")?.value;
  const ton = document.getElementById("f_ton")?.value;
  const status = document.getElementById("f_status")?.value;

  if (noMode === "none") {
    query = query.eq("crane_no", "번호없음");
  } else if (noMode === "input") {
    query = query.neq("crane_no", "번호없음");
  }

  if (no && noMode !== "none") {
    if (/^\d+$/.test(no)) no = `C-${no}`;
    query = query.ilike("crane_no", `%${no}%`);
  }

  if (area) query = query.ilike("area", `%${area}%`);
  if (type) query = query.eq("crane_type", type);
  if (brand) query = query.ilike("brand", `%${brand}%`);
  if (ton) query = query.eq("ton", Number(ton));
  if (status) query = query.eq("inspection_status", status);

  const { data, error } = await query;
  if (error) return alert(error.message);

  const tbody = document.getElementById("craneList");
  if (!tbody) return;
  tbody.innerHTML = "";

  const canEdit = !isViewer();

  data.forEach(c => {
    const tr = document.createElement("tr");

    const manageHtml = canEdit
      ? `
        <button onclick="markCraneComplete('${c.id}','${c.crane_no}')">완료</button>
        ${
          c.inspection_status === "보류"
            ? `<button onclick="releaseCraneHold('${c.id}')">해제</button>`
            : `<button onclick="setCraneHold('${c.id}')">보류</button>`
        }
        <button onclick="loadCraneToForm('${c.id}')">수정</button>
        <button onclick="deleteCrane('${c.id}')">삭제</button>
      `
      : `<span style="font-weight:900;color:#666;">조회용</span>`;

    tr.innerHTML = `
      <td>${c.crane_no}</td>
      <td>${c.area || ""}</td>
      <td>${c.crane_type || ""}</td>
      <td>${c.brand || ""}</td>
      <td>${c.ton ?? ""}</td>
      <td>${c.hoist_type ? `${c.hoist_type} ${c.hoist_spec || ""}` : ""}</td>
      <td>${c.group_name || ""}</td>
      <td>${c.inspection_status || ""}</td>
      <td>${manageHtml}</td>
    `;
    tbody.appendChild(tr);
  });
}


/* =========================
   [8] 리스트 완료 처리 (번호없음도 가능)
========================= */
async function markCraneComplete(id, crane_no) {
  if (!guardWrite("완료 처리")) return;

  if (!confirm(`${crane_no} 완료 처리할까요?`)) return;

  const next_due = addMonthsISO(3);

  const up = await sb.from("cranes").update({
    inspection_status: "완료",
    next_inspection_date: next_due || null
  }).eq("id", id);

  if (up.error) return alert(up.error.message);

  const ins = await sb.from("inspections").insert({
    crane_no,
    inspection_date: todayISO(),
    result: "완료",
    comment: "리스트 완료 처리",
    next_due: next_due || null
  });

  if (ins.error) return alert(ins.error.message);

  loadCranes();
  loadDashboard();
  loadScheduleDashboard();
}


/* =========================
   [9] 크레인 등록 / 수정
========================= */
let editingCraneId = null;

async function addCrane(category = "일반") {
  if (!guardWrite("크레인 등록/수정")) return;

  let crane_no = document.getElementById("c_no")?.value?.trim();
  if (!crane_no) return alert("크레인 번호 필수");
  if (/^\d+$/.test(crane_no)) crane_no = `C-${crane_no}`;

  const hoistType =
    document.getElementById("c_hoist_type")?.value ||
    document.getElementById("c_hoist")?.value ||
    null;

  const reeving = document.getElementById("c_reeving")?.value || null;
  const diaRaw = document.getElementById("c_wire_dia")?.value || null;
  const lenRaw = document.getElementById("c_wire_len")?.value || null;

  let hoistSpec = null;
  if (hoistType === "Wire") {
    const parts = [];
    if (diaRaw) parts.push(`Φ${diaRaw}`);
    if (lenRaw) parts.push(`${lenRaw}M`);
    if (reeving) parts.push(reeving);
    hoistSpec = parts.join(" ");
  } else if (hoistType === "Chain") {
    hoistSpec = reeving;
  }

  const tonRaw = document.getElementById("c_ton")?.value;
  const ton = tonRaw ? Number(tonRaw) : null;

  const payload = {
    crane_no,
    area: document.getElementById("c_area")?.value || null,
    crane_type: document.getElementById("c_type")?.value || null,
    brand: document.getElementById("c_brand")?.value || null,
    ton,
    group_name: document.getElementById("c_group")?.value || null,
    hoist_type: hoistType,
    hoist_spec: hoistSpec,
    crane_category: category
  };

  const result = editingCraneId
    ? await sb.from("cranes").update(payload).eq("id", editingCraneId)
    : await sb.from("cranes").insert(payload);

  if (result.error) return alert(result.error.message);

  alert(editingCraneId ? "수정 완료" : "등록 완료");
  editingCraneId = null;
  clearCraneForm();
  loadCranes();
}


/* =========================
   [10] 수정 / 삭제 / 보류
========================= */
async function loadCraneToForm(id) {
  if (!guardWrite("수정")) return;

  const { data } = await sb.from("cranes").select("*").eq("id", id).single();
  if (!data) return;

  editingCraneId = id;
  document.getElementById("c_no").value = data.crane_no || "";
  document.getElementById("c_area").value = data.area || "";
  document.getElementById("c_type").value = data.crane_type || "";
  document.getElementById("c_brand").value = data.brand || "";
  document.getElementById("c_ton").value = data.ton ?? "";
  document.getElementById("c_group").value = data.group_name || "";
  document.getElementById("c_hoist_type").value = data.hoist_type || "";
  toggleHoistDetail();
}

async function deleteCrane(id) {
  if (!guardWrite("삭제")) return;

  if (!confirm("정말 삭제할까요?")) return;
  await sb.from("cranes").delete().eq("id", id);
  loadCranes();
}

async function setCraneHold(id) {
  if (!guardWrite("보류 설정")) return;

  const reason = prompt("보류 사유");
  if (!reason) return;
  await sb.from("cranes").update({
    inspection_status: "보류",
    hold_reason: reason
  }).eq("id", id);
  loadCranes();
}

async function releaseCraneHold(id) {
  if (!guardWrite("보류 해제")) return;

  await sb.from("cranes").update({
    inspection_status: "미완료",
    hold_reason: null
  }).eq("id", id);
  loadCranes();
}


/* =========================
   [11] 메인 점검 저장
   ✅ date "" 방지
   ✅ TC- 입력은 그대로(타워는 TC-로 입력)
   ✅ 코멘트 비었으면 자동 멘트
   ✅ i_next 8자리 입력 보정
========================= */
async function saveInspection() {
  if (!guardWrite("점검 저장")) return;

  let crane_no = document.getElementById("i_crane_no")?.value?.trim();
  if (!crane_no) return alert("크레인 번호 입력");

  // 타워는 TC- 붙여서 입력(충돌 방지)
  // 소형은 숫자만 입력하면 C- 자동
  if (!/^TC-/i.test(crane_no) && /^\d+$/.test(crane_no)) {
    crane_no = `C-${crane_no}`;
  }

  const result = document.getElementById("i_result")?.value || "완료";

  // 날짜 키보드 입력 보정
  const dateEl = document.getElementById("i_next");
  if (dateEl) dateEl.value = normalizeDateValue(dateEl.value);

  let comment = document.getElementById("i_comment")?.value?.trim() || null;

  // 코멘트 자동 멘트(비었을 때만)
  if (!comment) {
    comment = /^TC-/i.test(crane_no)
      ? "타워크레인 점검 (타워는 TC- 붙여서 입력)"
      : "소형 크레인 점검 (소형은 숫자만 입력 가능)";
  }

  let next_due = document.getElementById("i_next")?.value || null;

  if (!next_due && result === "완료") {
    next_due = addMonthsISO(3);
  }

  const { data: craneRow, error: findErr } = await sb
    .from("cranes")
    .select("id")
    .eq("crane_no", crane_no)
    .single();

  if (findErr || !craneRow) {
    return alert(`크레인 번호 없음: ${crane_no}`);
  }

  const craneUpdate = {
    inspection_status: result,
    next_inspection_date: next_due || null
  };

  if (result === "보류") {
    craneUpdate.hold_reason = comment || "메인 입력 보류";
  }

  const up = await sb
    .from("cranes")
    .update(craneUpdate)
    .eq("id", craneRow.id);

  if (up.error) return alert(up.error.message);

  const inspectionPayload = {
    crane_no,
    inspection_date: todayISO(),
    result,
    comment,
    next_due: next_due || null
  };

  const ins = await sb.from("inspections").insert(inspectionPayload);
  if (ins.error) return alert(ins.error.message);

  // 입력칸 원상복구(요청)
  const noEl = document.getElementById("i_crane_no");
  const nextEl = document.getElementById("i_next");
  const cmtEl = document.getElementById("i_comment");
  if (noEl) noEl.value = "";
  if (nextEl) nextEl.value = "";
  if (cmtEl) cmtEl.value = "";

  alert("점검 저장 완료");
  loadDashboard();
  loadScheduleDashboard();
}


/* =========================
   [12] 대시보드 / 분기 리셋
========================= */
async function loadDashboard() {
  const { data } = await sb.from("cranes").select("inspection_status");
  if (!data) return;

  let total = data.length, done = 0, hold = 0, fail = 0, none = 0;
  data.forEach(c => {
    if (c.inspection_status === "완료") done++;
    else if (c.inspection_status === "보류") hold++;
    else if (c.inspection_status === "미완") fail++;
    else none++;
  });

  if (typeof d_total !== "undefined") d_total.innerText = total;
  if (typeof d_done !== "undefined") d_done.innerText = done;
  if (typeof d_hold !== "undefined") d_hold.innerText = hold;
  if (typeof d_fail !== "undefined") d_fail.innerText = fail;
  if (typeof d_none !== "undefined") d_none.innerText = none;
}

async function resetInspectionStatus() {
  if (!guardWrite("분기 리셋")) return;

  if (!confirm("분기 리셋 하시겠습니까?")) return;

  const { error } = await sb
    .from("cranes")
    .update({ inspection_status: "미점검" })
    .eq("active", true);

  if (error) return alert(error.message);

  loadDashboard();
  loadScheduleDashboard();
}


/* =========================
   [13] UI / 공통
========================= */
function toggleHoistDetail() {
  const type = document.getElementById("c_hoist_type")?.value;
  const c_wire_dia = document.getElementById("c_wire_dia");
  const c_wire_len = document.getElementById("c_wire_len");
  const c_reeving = document.getElementById("c_reeving");

  if (c_wire_dia) c_wire_dia.style.display = type === "Wire" ? "block" : "none";
  if (c_wire_len) c_wire_len.style.display = type === "Wire" ? "block" : "none";
  if (c_reeving) c_reeving.style.display = type ? "block" : "none";
}

function clearCraneForm() {
  ["c_no","c_area","c_type","c_brand","c_ton","c_group","c_hoist_type","c_wire_dia","c_wire_len","c_reeving"]
    .forEach(id => document.getElementById(id) && (document.getElementById(id).value = ""));
}

function autoCraneNoPrefix() {
  const el = document.getElementById("c_no");
  if (!el) return;

  let v = el.value.trim();
  if (!v) return;

  if (v.toUpperCase().startsWith("C-")) return;

  if (/^\d+$/.test(v)) {
    el.value = `C-${v}`;
  }
}


/* =========================
   [14] 점검 예정 대시보드
   ✅ 타워 판별 강화:
   - crane_type === "타워" 또는 crane_no가 TC-로 시작하면 타워
========================= */
function _ddayLabel(days) {
  if (days >= 0) return `D-${days}`;
  return `D+${Math.abs(days)}`;
}
function _daysDiffFromToday(dateStr) {
  const t = new Date(todayISO());
  const d = new Date(dateStr);
  return Math.ceil((d - t) / (1000 * 60 * 60 * 24));
}
function _isTowerCrane(c) {
  const no = (c?.crane_no || "").toUpperCase();
  const type = (c?.crane_type || "").toLowerCase();
  return no.startsWith("TC-") || type === "타워" || type === "tower";
}

async function loadScheduleDashboard() {
  const smallBox = document.getElementById("schedule-small");
  const towerBox = document.getElementById("schedule-tower");
  if (!smallBox || !towerBox) return;

  smallBox.innerHTML = "";
  towerBox.innerHTML = "";

  const { data, error } = await sb
    .from("cranes")
    .select("id,crane_no,crane_type,inspection_status,next_inspection_date")
    .not("next_inspection_date", "is", null);

  if (error || !data) return;

  const list = data
    .map(c => ({ ...c, dday: _daysDiffFromToday(c.next_inspection_date) }))
    .filter(c => c.inspection_status !== "완료")
    .sort((a, b) => a.dday - b.dday);

  const small = list.filter(c => !_isTowerCrane(c)).slice(0, 10);
  const tower = list.filter(c => _isTowerCrane(c)).slice(0, 5);

  const canEdit = !isViewer();

  const cardHTML = (c) => `
    <div class="schedule-card">
      <div class="sc-title">${c.crane_no}</div>
      <div class="sc-sub">${c.crane_type || ""} · ${_ddayLabel(c.dday)}</div>
      ${
        canEdit
          ? `<div class="sc-btns">
               <button onclick="scheduleSetComplete('${c.id}')">완료</button>
               <button onclick="scheduleSetHold('${c.id}')">보류</button>
             </div>`
          : `<div style="margin-top:10px;font-weight:900;color:#666;">조회용</div>`
      }
    </div>
  `;

  small.forEach(c => smallBox.insertAdjacentHTML("beforeend", cardHTML(c)));
  tower.forEach(c => towerBox.insertAdjacentHTML("beforeend", cardHTML(c)));
}

async function scheduleSetComplete(id) {
  if (!guardWrite("예정 대시보드 완료")) return;

  const next_due = addMonthsISO(3);

  const { error } = await sb.from("cranes").update({
    inspection_status: "완료",
    next_inspection_date: next_due || null
  }).eq("id", id);

  if (error) return alert(error.message);

  loadDashboard();
  loadScheduleDashboard();
}

async function scheduleSetHold(id) {
  if (!guardWrite("예정 대시보드 보류")) return;

  const reason = prompt("보류 사유");
  if (!reason) return;

  const { error } = await sb.from("cranes").update({
    inspection_status: "보류",
    hold_reason: reason
  }).eq("id", id);

  if (error) return alert(error.message);

  loadDashboard();
  loadScheduleDashboard();
}


/* =========================
   [15] 페이지 이동
========================= */
function openCraneList() { window.open("cranes.html", "_blank"); }
function openRemarkList() { window.open("remarks.html", "_blank"); }
function openHoldList() { window.open("holds.html", "_blank"); }
function openTowerCraneList() { window.open("tower_cranes.html", "_blank"); }


// ===== [16] 마스터 패널(비번 변경) =====
function injectMasterPanelIfNeeded() {
  if (!isMaster()) return;
  const dash = document.getElementById("dashboard");
  if (!dash) return;

  const main = document.querySelector("main.container") || document.body;
  if (document.getElementById("hcmsMasterPanel")) return;

  const card = document.createElement("section");
  card.id = "hcmsMasterPanel";
  card.className = "card";
  card.innerHTML = `
    <h2>마스터 설정 (비밀번호 변경)</h2>
    <div style="display:grid;grid-template-columns:160px 1fr;gap:12px 12px;align-items:center;">
      <div style="font-weight:900;">조회용(viewer)</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <input id="mp_viewer" class="input" placeholder="새 PIN" style="max-width:240px;" />
        <button class="btn" id="btn_mp_viewer">변경</button>
      </div>

      <div style="font-weight:900;">관리자(admin)</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <input id="mp_admin" class="input" placeholder="새 PIN" style="max-width:240px;" />
        <button class="btn" id="btn_mp_admin">변경</button>
      </div>

      <div style="font-weight:900;">마스터(master)</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <input id="mp_master" class="input" placeholder="새 PIN" style="max-width:240px;" />
        <button class="btn" id="btn_mp_master">변경</button>
      </div>
    </div>

    <div style="margin-top:10px;color:#555;font-size:13px;font-weight:800;line-height:1.35;">
      · 변경 버튼을 누르면 Supabase Auth 비번(PIN)도 같이 변경됩니다.<br/>
      · 변경 후에는 새 PIN으로 로그인해야 합니다.
    </div>
  `;

  main.appendChild(card);

  const hook = (role, inputId, btnId) => {
    const inp = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    if (!inp || !btn) return;
    btn.addEventListener("click", async () => {
      const newPin = (inp.value || "").trim();
      if (!newPin) return alert("새 PIN을 입력하세요.");
      await masterChangeRolePassword(role, newPin);
      inp.value = "";
    });
  };

  hook("viewer", "mp_viewer", "btn_mp_viewer");
  hook("admin", "mp_admin", "btn_mp_admin");
  hook("master", "mp_master", "btn_mp_master");
}

async function masterChangeRolePassword(targetRole, newPin) {
  if (!isMaster()) return alert("마스터만 변경 가능합니다.");

  const targetEmail = HCMS_ROLE_EMAIL[targetRole];
  const targetOldPin = HCMS_PINS[targetRole];

  // 현재 마스터 복귀용
  const masterEmail = HCMS_ROLE_EMAIL.master;
  const masterPinBefore = HCMS_PINS.master;

  // 1) 타겟 계정으로 로그인
  let sign1 = await sb.auth.signInWithPassword({ email: targetEmail, password: targetOldPin });
  if (sign1.error) {
    return alert(`(${targetRole}) 기존 PIN 로그인 실패: ${sign1.error.message}\n(로컬에 저장된 기존 PIN이 실제 비번과 다를 수 있음)`);
  }

  // 2) 비번 변경(현재 로그인된 유저만 가능)
  let up = await sb.auth.updateUser({ password: newPin });
  if (up.error) {
    return alert(`(${targetRole}) 비번 변경 실패: ${up.error.message}`);
  }

  // 3) 핀 로컬 저장 갱신
  const pins = { ...HCMS_PINS };
  pins[targetRole] = newPin;
  savePins(pins);

  // 4) 마스터로 복귀 로그인
  // - 마스터 자체를 바꾼 경우: 새 핀으로 복귀
  const masterPinToUse = (targetRole === "master") ? newPin : masterPinBefore;

  await sb.auth.signInWithPassword({ email: masterEmail, password: masterPinToUse });

  await refreshRoleFromSession();
  alert(`(${targetRole}) PIN 변경 완료`);
}


// ===== [17] 로그인 이후 실행(기존 DOM 로직 유지용 래퍼) =====
async function runAfterAuthInit() {
  // viewer UI 제한 적용
  enforceRoleUI();
  // 로그아웃 버튼
  ensureFloatingLogout();
  // 마스터 패널(메인에서만)
  injectMasterPanelIfNeeded();

  // 날짜 키보드 입력 보정 이벤트(i_next)
  const iNext = document.getElementById("i_next");
  if (iNext) {
    iNext.addEventListener("input", () => {
      const nv = normalizeDateValue(iNext.value);
      if (/^\d{8}$/.test(String(iNext.value).trim())) {
        iNext.value = nv;
      }
    });
    iNext.addEventListener("blur", () => {
      iNext.value = normalizeDateValue(iNext.value);
    });
    iNext.addEventListener("keydown", (e) => {
      if (e.key === "Enter") iNext.value = normalizeDateValue(iNext.value);
    });
  }

  // 기존 자동 실행 로직(그대로)
  if (document.getElementById("f_no_mode")) applyNoModeFilterUI();
  if (document.getElementById("craneList")) loadCranes();

  if (document.getElementById("dashboard")) {
    loadDashboard();
    loadScheduleDashboard();
  }
}


// ===== [18] 자동 실행(보안 로그인 먼저) =====
document.addEventListener("DOMContentLoaded", async () => {
  const ok = await ensureAuthenticated();
  if (!ok) return; // 로그인 성공 시 runAfterAuthInit()이 호출됨
  runAfterAuthInit();
});


// ===== [19] 전역 바인딩 =====
window.loadCranes = loadCranes;
window.addCrane = addCrane;
window.loadCraneToForm = loadCraneToForm;
window.deleteCrane = deleteCrane;
window.setCraneHold = setCraneHold;
window.releaseCraneHold = releaseCraneHold;

window.saveInspection = saveInspection;
window.resetInspectionStatus = resetInspectionStatus;

window.toggleHoistDetail = toggleHoistDetail;
window.autoCraneNoPrefix = autoCraneNoPrefix;

window.applyNoModeFilterUI = applyNoModeFilterUI;
window.markCraneComplete = markCraneComplete;

window.loadScheduleDashboard = loadScheduleDashboard;
window.scheduleSetComplete = scheduleSetComplete;
window.scheduleSetHold = scheduleSetHold;

window.openCraneList = openCraneList;
window.openTowerCraneList = openTowerCraneList;
window.openRemarkList = openRemarkList;
window.openHoldList = openHoldList;
