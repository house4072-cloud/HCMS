// ===== Supabase 초기화 =====
const SUPABASE_URL = "https://lzfksuiftgmxwkhwhnhg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6ZmtzdWlmdGdteHdraHdobmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NzczMDMsImV4cCI6MjA4MTM1MzMwM30.BHI8dTc18Jw3akhlRL7OZ8_0sYQwjb0-QaMGjKjUfYA";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* =========================
   공통 유틸
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
   크레인 리스트 로드
   ✅ v2: 완료도 포함해서 "전부" 표시
   ✅ v2: 번호없음 필터 동작 (crane_no = '번호없음')
========================= */
async function loadCranes() {
  let query = sb.from("cranes").select("*");

  const no = document.getElementById("f_no")?.value;
  const area = document.getElementById("f_area")?.value;
  const type = document.getElementById("f_type")?.value;
  const brand = document.getElementById("f_brand")?.value;
  const ton = document.getElementById("f_ton")?.value;
  const status = document.getElementById("f_status")?.value;

  // ✅ v2: 번호구분 셀렉트(있으면 적용) - id가 달라도 최대한 잡아줌
  // 기대값 예시: "INPUT"(번호입력), "NONE"(번호없음), ""(전체)
  const noMode =
    document.getElementById("f_no_mode")?.value ||
    document.getElementById("f_no_kind")?.value ||
    document.getElementById("f_no_type")?.value ||
    "";

  // 번호 필터
  // - noMode가 NONE면: crane_no = '번호없음'
  // - noMode가 INPUT이면: crane_no != '번호없음' (번호있는 것만)
  if (noMode === "NONE") {
    query = query.eq("crane_no", "번호없음");
  } else if (noMode === "INPUT") {
    query = query.neq("crane_no", "번호없음");
    if (no) query = query.ilike("crane_no", `%${no}%`);
  } else {
    // 전체 모드일 때는 기존처럼 입력값 있으면 검색
    if (no) query = query.ilike("crane_no", `%${no}%`);
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
        <!-- ✅ v2: 리스트에서 바로 완료처리 가능 (번호없음도 가능) -->
        <button onclick="markCraneComplete('${c.id}')">완료</button>

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
   ✅ v2: 리스트에서 완료처리 (id 기준)
   - cranes 업데이트 + inspections 로그 기록
========================= */
async function markCraneComplete(id) {
  // 1) 크레인 정보 조회 (crane_no 필요)
  const { data: row, error: e1 } = await sb
    .from("cranes")
    .select("id,crane_no")
    .eq("id", id)
    .single();

  if (e1 || !row) return alert(e1?.message || "크레인 조회 실패");

  const next_due = addMonthsISO(3);

  // 2) cranes 업데이트
  const { error: e2 } = await sb
    .from("cranes")
    .update({
      inspection_status: "완료",
      next_inspection_date: next_due
    })
    .eq("id", id);

  if (e2) return alert(e2.message);

  // 3) inspections 로그
  const { error: e3 } = await sb.from("inspections").insert({
    crane_no: row.crane_no || "번호없음",
    inspection_date: todayISO(),
    result: "완료",
    comment: "리스트에서 완료처리",
    next_due: next_due || null
  });

  if (e3) return alert(e3.message);

  loadCranes();
  loadDashboard();
  loadScheduleDashboard();
}

/* =========================
   크레인 등록 / 수정
   ✅ 번호 입력 시 C- 자동
   ✅ 번호없음 등록은 crane_no='번호없음'으로 저장 (NOT NULL 대비)
========================= */
let editingCraneId = null;

async function addCrane(category = "일반") {
  let crane_no = document.getElementById("c_no")?.value?.trim();

  // ✅ 번호없음 모드(있으면 적용)
  const noMode =
    document.getElementById("c_no_mode")?.value ||
    document.getElementById("c_no_kind")?.value ||
    document.getElementById("c_no_type")?.value ||
    "";

  if (noMode === "NONE") {
    crane_no = "번호없음";
  } else {
    if (!crane_no) return alert("크레인 번호 필수");
    if (/^\d+$/.test(crane_no)) crane_no = `C-${crane_no}`;
  }

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
  document.getElementById("c_no") && (document.getElementById("c_no").value = data.crane_no || "");
  document.getElementById("c_area") && (document.getElementById("c_area").value = data.area || "");
  document.getElementById("c_type") && (document.getElementById("c_type").value = data.crane_type || "");
  document.getElementById("c_brand") && (document.getElementById("c_brand").value = data.brand || "");
  document.getElementById("c_ton") && (document.getElementById("c_ton").value = data.ton ?? "");
  document.getElementById("c_group") && (document.getElementById("c_group").value = data.group_name || "");
  document.getElementById("c_hoist_type") && (document.getElementById("c_hoist_type").value = data.hoist_type || "");
  toggleHoistDetail();
}

async function deleteCrane(id) {
  if (!confirm("정말 삭제할까요?")) return;
  const { error } = await sb.from("cranes").delete().eq("id", id);
  if (error) return alert(error.message);
  loadCranes();
}

async function setCraneHold(id) {
  const reason = prompt("보류 사유");
  if (!reason) return;

  const { error } = await sb.from("cranes").update({
    inspection_status: "보류",
    hold_reason: reason
  }).eq("id", id);

  if (error) return alert(error.message);

  loadCranes();
  loadDashboard();
  loadScheduleDashboard();
}

async function releaseCraneHold(id) {
  const { error } = await sb.from("cranes").update({
    inspection_status: "미완료",
    hold_reason: null
  }).eq("id", id);

  if (error) return alert(error.message);

  loadCranes();
  loadDashboard();
  loadScheduleDashboard();
}

/* =========================
   🔥 메인 점검 저장 (id 기준 / 안정본)
   ✅ date "" 오류 방지: 빈값이면 null
========================= */
async function saveInspection() {
  let crane_no = document.getElementById("i_crane_no")?.value?.trim();
  if (!crane_no) return alert("크레인 번호 입력");

  // 숫자면 C- 자동
  if (/^\d+$/.test(crane_no)) crane_no = `C-${crane_no}`;

  const result = document.getElementById("i_result")?.value || "완료";
  const comment = document.getElementById("i_comment")?.value || null;

  let next_due = document.getElementById("i_next")?.value || null;

  // 완료인데 날짜 비었으면 +3개월 자동
  if (!next_due && result === "완료") {
    next_due = addMonthsISO(3);
  }

  // 1) crane_no → id 조회
  // ✅ 번호없음이 여러개면 single() 에러 날 수 있으니 안전하게 처리
  const find = await sb
    .from("cranes")
    .select("id")
    .eq("crane_no", crane_no)
    .limit(1);

  if (find.error) return alert(find.error.message);
  const craneRow = find.data?.[0];
  if (!craneRow) return alert(`크레인 번호 없음: ${crane_no}`);

  // 2) cranes 업데이트 (id 기준)
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

  // 3) inspections 로그 (✅ 빈 문자열 date 금지: null)
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
   ✅ 400 방지: 전체 업데이트는 eq 조건으로 처리
========================= */
async function loadDashboard() {
  const { data, error } = await sb.from("cranes").select("inspection_status");
  if (error) return; // 알림 남발 방지
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
   크레인 번호 자동 C- 접두 (입력 종료 시)
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
   ✅ 점검 예정 대시보드
   - next_inspection_date 기준
   - 완료는 제외(예정대시보드만)
   - 소형/서비스(타워 제외) 10개
   - 타워 5개
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

async function loadScheduleDashboard() {
  const smallBox = document.getElementById("schedule-small");
  const towerBox = document.getElementById("schedule-tower");
  if (!smallBox || !towerBox) return; // index에만 존재

  smallBox.innerHTML = "";
  towerBox.innerHTML = "";

  const { data, error } = await sb
    .from("cranes")
    .select("id,crane_no,crane_type,inspection_status,next_inspection_date")
    .not("next_inspection_date", "is", null);

  if (error || !data) return;

  const list = data
    .map(c => ({ ...c, dday: _daysDiffFromToday(c.next_inspection_date) }))
    .filter(c => c.inspection_status !== "완료") // ✅ 예정대시보드에서만 완료 제외
    .sort((a, b) => a.dday - b.dday);

  const small = list.filter(c => c.crane_type !== "타워").slice(0, 10);
  const tower = list.filter(c => c.crane_type === "타워").slice(0, 5);

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
    next_inspection_date: next_due
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

// 타워크레인 리스트 열기
function openTowerCraneList() { window.open("tower_cranes.html", "_blank"); }

/* =========================
   자동 실행
========================= */
document.addEventListener("DOMContentLoaded", () => {
  // 크레인 리스트 페이지면 로드
  if (document.getElementById("craneList")) loadCranes();

  // 메인(index) 페이지면 대시보드 로드
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

window.markCraneComplete = markCraneComplete; // ✅ v2

window.saveInspection = saveInspection;
window.resetInspectionStatus = resetInspectionStatus;

window.toggleHoistDetail = toggleHoistDetail;
window.autoCraneNoPrefix = autoCraneNoPrefix;

window.loadScheduleDashboard = loadScheduleDashboard;
window.scheduleSetComplete = scheduleSetComplete;
window.scheduleSetHold = scheduleSetHold;

window.openCraneList = openCraneList;
window.openTowerCraneList = openTowerCraneList;
window.openRemarkList = openRemarkList;
window.openHoldList = openHoldList;
