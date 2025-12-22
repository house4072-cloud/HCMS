// ===== Supabase 초기화 =====
const SUPABASE_URL = "https://lzfksuiftgmxwkhwhnhg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6ZmtzdWlmdGdteHdraHdobmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NzczMDMsImV4cCI6MjA4MTM1MzMwM30.BHI8dTc18Jw3akhlRL7OZ8_0sYQwjb0-QaMGjKjUfYA";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* =========================
   v3 FIX: 번호구분 필터 UI (cranes.html에서 호출)
========================= */
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

/* =========================
   공통 날짜 유틸
========================= */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addMonthsISO(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/* =========================
   v4 ADD: 날짜 키보드 입력 보정
   - YYYYMMDD 입력 시 YYYY-MM-DD로 자동 변환
========================= */
function normalizeDateValue(v) {
  if (!v) return "";
  const s = String(v).trim();
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  return s;
}

/* =========================
   크레인 리스트 로드
   v3 FIX:
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

  data.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.crane_no}</td>
      <td>${c.area || ""}</td>
      <td>${c.crane_type || ""}</td>
      <td>${c.brand || ""}</td>
      <td>${c.ton ?? ""}</td>
      <td>${c.hoist_type ? `${c.hoist_type} ${c.hoist_spec || ""}` : ""}</td>
      <td>${c.group_name || ""}</td>
      <td>${c.inspection_status || ""}</td>
      <td>
        <!-- ✅ v4 추가: 리스트에서 완료 처리 -->
        <button onclick="markCraneComplete('${c.id}','${c.crane_no}')">완료</button>

        ${
          c.inspection_status === "보류"
            ? `<button onclick="releaseCraneHold('${c.id}')">해제</button>`
            : `<button onclick="setCraneHold('${c.id}')">보류</button>`
        }
        <button onclick="loadCraneToForm('${c.id}')">수정</button>
        <button onclick="deleteCrane('${c.id}')">삭제</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* =========================
   ✅ v4 추가: 리스트 완료 처리 (번호없음도 가능)
   - cranes 업데이트 + inspections 로그 기록
========================= */
async function markCraneComplete(id, crane_no) {
  if (!confirm(`${crane_no} 완료 처리할까?`)) return;

  const next_due = addMonthsISO(3);

  const up = await sb.from("cranes").update({
    inspection_status: "완료",
    next_inspection_date: next_due || null
  }).eq("id", id);

  if (up.error) return alert(up.error.message);

  // inspections 로그 (date "" 방지)
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
   크레인 등록 / 수정
========================= */
let editingCraneId = null;

async function addCrane(category = "일반") {
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
   수정 / 삭제 / 보류
========================= */
async function loadCraneToForm(id) {
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
  if (!confirm("정말 삭제할까요?")) return;
  await sb.from("cranes").delete().eq("id", id);
  loadCranes();
}

async function setCraneHold(id) {
  const reason = prompt("보류 사유");
  if (!reason) return;
  await sb.from("cranes").update({
    inspection_status: "보류",
    hold_reason: reason
  }).eq("id", id);
  loadCranes();
}

async function releaseCraneHold(id) {
  await sb.from("cranes").update({
    inspection_status: "미완료",
    hold_reason: null
  }).eq("id", id);
  loadCranes();
}

/* =========================
   메인 점검 저장 (id 기준 / 안정본)
   ✅ date "" 오류 방지
   ✅ v4: TC- 입력은 그대로(타워는 TC-로 입력)
   ✅ v4: 코멘트 비었으면 자동 멘트
   ✅ v4: i_next 8자리 입력 보정
========================= */
async function saveInspection() {
  let crane_no = document.getElementById("i_crane_no")?.value?.trim();
  if (!crane_no) return alert("크레인 번호 입력");

  // ✅ 타워는 사용자가 TC- 붙여서 입력할 예정 (충돌 방지)
  // ✅ 소형은 숫자만 입력하면 C- 자동
  if (!/^TC-/i.test(crane_no) && /^\d+$/.test(crane_no)) {
    crane_no = `C-${crane_no}`;
  }

  const result = document.getElementById("i_result")?.value || "완료";

  // ✅ 날짜 키보드 입력 보정
  const dateEl = document.getElementById("i_next");
  if (dateEl) dateEl.value = normalizeDateValue(dateEl.value);

  let comment = document.getElementById("i_comment")?.value?.trim() || null;

  // ✅ 코멘트 자동 멘트(비었을 때만)
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

  alert("점검 저장 완료");
  loadDashboard();
  loadScheduleDashboard();
}

/* =========================
   대시보드 / 분기 리셋
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
   UI / 공통
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

/* =========================
   크레인 번호 자동 C- 접두
========================= */
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
   점검 예정 대시보드
   ✅ v4 FIX: 타워 판별 강화
   - crane_type === "타워" 또는 crane_no가 TC-로 시작하면 타워로 취급
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

  // ✅ 소형/서비스 = 타워 제외 10개
  const small = list.filter(c => !_isTowerCrane(c)).slice(0, 10);

  // ✅ 타워 = 타워로 판별되는 것 5개
  const tower = list.filter(c => _isTowerCrane(c)).slice(0, 5);

  const cardHTML = (c) => `
    <div class="schedule-card">
      <div class="sc-title">${c.crane_no}</div>
      <div class="sc-sub">${c.crane_type || ""} · ${_ddayLabel(c.dday)}</div>
      <div class="sc-btns">
        <button onclick="scheduleSetComplete('${c.id}')">완료</button>
        <button onclick="scheduleSetHold('${c.id}')">보류</button>
      </div>
    </div>
  `;

  small.forEach(c => smallBox.insertAdjacentHTML("beforeend", cardHTML(c)));
  tower.forEach(c => towerBox.insertAdjacentHTML("beforeend", cardHTML(c)));
}

async function scheduleSetComplete(id) {
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
   페이지 이동
========================= */
function openCraneList() { window.open("cranes.html", "_blank"); }
function openRemarkList() { window.open("remarks.html", "_blank"); }
function openHoldList() { window.open("holds.html", "_blank"); }
function openTowerCraneList() { window.open("tower_cranes.html", "_blank"); }

/* =========================
   자동 실행
========================= */
document.addEventListener("DOMContentLoaded", () => {
  // ✅ v4: 날짜 키보드 입력 보정 이벤트(i_next)
  const iNext = document.getElementById("i_next");
  if (iNext) {
    iNext.addEventListener("input", () => {
      const nv = normalizeDateValue(iNext.value);
      // type=date 환경에서는 중간 입력 간섭될 수 있어, 8자리 완성 시에만 적용
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

  if (document.getElementById("f_no_mode")) applyNoModeFilterUI();
  if (document.getElementById("craneList")) loadCranes();

  if (document.getElementById("dashboard")) {
    loadDashboard();
    loadScheduleDashboard();
  }
});

/* =========================
   전역 바인딩
========================= */
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

// ✅ v4 추가 바인딩(리스트 완료)
window.markCraneComplete = markCraneComplete;

window.loadScheduleDashboard = loadScheduleDashboard;
window.scheduleSetComplete = scheduleSetComplete;
window.scheduleSetHold = scheduleSetHold;

window.openCraneList = openCraneList;
window.openTowerCraneList = openTowerCraneList;
window.openRemarkList = openRemarkList;
window.openHoldList = openHoldList;
