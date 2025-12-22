// ===== Supabase 초기화 =====
const SUPABASE_URL = "https://lzfksuiftgmxwkhwhnhg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6ZmtzdWlmdGdteHdraHdobmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NzczMDMsImV4cCI6MjA4MTM1MzMwM30.BHI8dTc18Jw3akhlRL7OZ8_0sYQwjb0-QaMGjKjUfYA";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* =========================
   크레인 리스트 로드
========================= */
async function loadCranes() {
  let query = sb.from("cranes").select("*");

  const no = document.getElementById("f_no")?.value;
  const area = document.getElementById("f_area")?.value;
  const type = document.getElementById("f_type")?.value;
  const brand = document.getElementById("f_brand")?.value;
  const ton = document.getElementById("f_ton")?.value;
  const status = document.getElementById("f_status")?.value;

  if (no) query = query.ilike("crane_no", `%${no}%`);
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

    // ✅ v3: 완료 버튼 추가(번호없는 크레인도 id로 처리 가능)
    // ⚠️ HTML 헤더(th)도 “완료/보류/수정/삭제” 들어갈 칸 폭만 맞추면 됨
    tr.innerHTML = `
      <td>${c.crane_no || "번호없음"}</td>
      <td>${c.area || ""}</td>
      <td>${c.crane_type || ""}</td>
      <td>${c.brand || ""}</td>
      <td>${c.ton ?? ""}</td>
      <td>${c.hoist_type ? `${c.hoist_type} ${c.hoist_spec || ""}` : ""}</td>
      <td>${c.group_name || ""}</td>
      <td>${c.inspection_status || ""}</td>
      <td>
        <button onclick="completeCrane('${c.id}')">완료</button>
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

  // (기준1에서 hoist_spec 파싱을 더 쓰고 싶으면 여기서 확장 가능)
}

async function deleteCrane(id) {
  if (!confirm("정말 삭제할까요?")) return;
  const del = await sb.from("cranes").delete().eq("id", id);
  if (del.error) return alert(del.error.message);
  loadCranes();
  loadDashboard();
}

async function setCraneHold(id) {
  const reason = prompt("보류 사유");
  if (!reason) return;

  // ✅ v3: 보류면 next_inspection_date는 무조건 null ("" 방지)
  const up = await sb.from("cranes").update({
    inspection_status: "보류",
    hold_reason: reason,
    next_inspection_date: null
  }).eq("id", id);

  if (up.error) return alert(up.error.message);
  loadCranes();
  loadDashboard();
}

async function releaseCraneHold(id) {
  // ✅ v3: 해제 시 미완으로 돌리고 날짜 null
  const up = await sb.from("cranes").update({
    inspection_status: "미완",
    hold_reason: null,
    next_inspection_date: null
  }).eq("id", id);

  if (up.error) return alert(up.error.message);
  loadCranes();
  loadDashboard();
}

/* =========================
   ✅ v3: 리스트에서 완료 처리 (번호없는 크레인 포함)
   - id 기준 업데이트 (가장 안전)
   - next_inspection_date = +3개월
   - inspections 로그도 남김
========================= */
async function completeCrane(id) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const next = new Date();
  next.setMonth(next.getMonth() + 3);
  const next_due = next.toISOString().slice(0, 10);

  // 1) cranes 업데이트
  const up = await sb.from("cranes").update({
    inspection_status: "완료",
    hold_reason: null,
    next_inspection_date: next_due
  }).eq("id", id);

  if (up.error) return alert(up.error.message);

  // 2) crane_no 조회해서 로그에 남김 (번호없음도 기록 가능)
  const { data: row, error: e2 } = await sb.from("cranes").select("crane_no").eq("id", id).single();
  const crane_no_for_log = (!e2 && row && row.crane_no) ? row.crane_no : "번호없음";

  const ins = await sb.from("inspections").insert({
    crane_no: crane_no_for_log,
    inspection_date: todayStr,
    result: "완료",
    comment: "리스트 완료",
    next_due
  });

  if (ins.error) return alert(ins.error.message);

  loadCranes();
  loadDashboard();
}

/* =========================
   🔥 메인 점검 저장 (id 기준 / v3 날짜오류 방지 포함)
========================= */
async function saveInspection() {
  let crane_no = document.getElementById("i_crane_no")?.value?.trim();
  if (!crane_no) return alert("크레인 번호 입력");
  if (/^\d+$/.test(crane_no)) crane_no = `C-${crane_no}`;

  const result = document.getElementById("i_result")?.value || "완료";
  const comment = document.getElementById("i_comment")?.value || null;

  // ✅ v3 핵심: date input은 빈 문자열이면 null로 바꿔서 DB에 "" 안 들어가게
  let next_due = document.getElementById("i_next")?.value;
  if (next_due === "") next_due = null;

  // 완료인데 next_due 비었으면 자동 +3개월
  if (!next_due && result === "완료") {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    next_due = d.toISOString().slice(0, 10);
  }

  // 완료가 아니면 next_due는 무조건 null (보류/미완/미점검 등)
  if (result !== "완료") {
    next_due = null;
  }

  // 1) crane_no → id 조회
  const { data: craneRow, error: findErr } = await sb
    .from("cranes")
    .select("id")
    .eq("crane_no", crane_no)
    .single();

  if (findErr || !craneRow) {
    return alert(`크레인 번호 없음: ${crane_no}`);
  }

  // 2) cranes 업데이트 (id 기준)
  const craneUpdate = {
    inspection_status: result,
    next_inspection_date: next_due
  };

  // 보류면 사유 저장, 그 외면 null
  if (result === "보류") {
    craneUpdate.hold_reason = comment || "메인 입력 보류";
  } else {
    craneUpdate.hold_reason = null;
  }

  const up = await sb
    .from("cranes")
    .update(craneUpdate)
    .eq("id", craneRow.id);

  if (up.error) return alert(up.error.message);

  // 3) inspections 로그 (✅ next_due는 null 허용)
  const inspectionPayload = {
    crane_no,
    inspection_date: new Date().toISOString().slice(0, 10),
    result,
    comment,
    next_due
  };

  const ins = await sb.from("inspections").insert(inspectionPayload);
  if (ins.error) return alert(ins.error.message);

  alert("점검 저장 완료");
  loadDashboard();
}

/* =========================
   대시보드 / 분기 리셋
========================= */
async function loadDashboard() {
  const { data, error } = await sb.from("cranes").select("inspection_status");
  if (error) return; // alert는 과하게 뜰 수 있어서 조용히

  if (!data) return;

  let total = data.length, done = 0, hold = 0, fail = 0, none = 0;
  data.forEach(c => {
    if (c.inspection_status === "완료") done++;
    else if (c.inspection_status === "보류") hold++;
    else if (c.inspection_status === "미완") fail++;
    else none++;
  });

  // (기준1 그대로: id가 있으면 반영)
  if (typeof d_total !== "undefined" && d_total) d_total.innerText = total;
  if (typeof d_done !== "undefined" && d_done) d_done.innerText = done;
  if (typeof d_hold !== "undefined" && d_hold) d_hold.innerText = hold;
  if (typeof d_fail !== "undefined" && d_fail) d_fail.innerText = fail;
  if (typeof d_none !== "undefined" && d_none) d_none.innerText = none;
}

async function resetInspectionStatus() {
  if (!confirm("분기 리셋 하시겠습니까?")) return;

  // ✅ v3: WHERE 없는 UPDATE가 400 나는 환경 방지 (조건 업데이트)
  const up = await sb.from("cranes").update({
    inspection_status: "미점검",
    next_inspection_date: null,
    hold_reason: null
  }).neq("inspection_status", "미점검");

  if (up.error) return alert(up.error.message);

  alert("분기 리셋 완료");
  loadDashboard();
  loadCranes();
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
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
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
   페이지 이동
========================= */
function openCraneList() { window.open("cranes.html", "_blank"); }
function openRemarkList() { window.open("remarks.html", "_blank"); }
function openHoldList() { window.open("holds.html", "_blank"); }

/* =========================
   자동 실행
========================= */
document.addEventListener("DOMContentLoaded", () => {
  // 메인(index.html) 대시보드
  loadDashboard();

  // cranes.html 리스트
  if (document.getElementById("craneList")) {
    loadCranes();
  }
});

/* =========================
   전역 바인딩 (✅ 빠짐없이)
========================= */
window.loadCranes = loadCranes;
window.addCrane = addCrane;
window.loadCraneToForm = loadCraneToForm;
window.deleteCrane = deleteCrane;
window.setCraneHold = setCraneHold;
window.releaseCraneHold = releaseCraneHold;

window.completeCrane = completeCrane; // ✅ v3 추가

window.saveInspection = saveInspection;
window.resetInspectionStatus = resetInspectionStatus;
window.loadDashboard = loadDashboard;

window.toggleHoistDetail = toggleHoistDetail;
window.clearCraneForm = clearCraneForm;

window.openCraneList = openCraneList;
window.openRemarkList = openRemarkList;
window.openHoldList = openHoldList;

window.autoCraneNoPrefix = autoCraneNoPrefix;
/* =====================================================
   🔥 점검 예정 대시보드 (신규 추가 v4)
   기존 코드 절대 수정 없음
===================================================== */

/* 날짜 차이 계산 */
function calcDDay(targetDate) {
  const today = new Date();
  today.setHours(0,0,0,0);

  const target = new Date(targetDate);
  target.setHours(0,0,0,0);

  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  return diff;
}

/* 카드 HTML 생성 */
function createScheduleCard(c) {
  const d = calcDDay(c.next_inspection_date);
  const dText = d >= 0 ? `D-${d}` : `D+${Math.abs(d)}`;

  return `
    <div class="schedule-card">
      <div class="sc-title">${c.crane_no || '번호없음'}</div>
      <div class="sc-sub">
        ${c.crane_type || ''} · ${c.area || ''}
      </div>
      <div class="sc-dday ${d < 0 ? 'over' : ''}">${dText}</div>
      <div class="sc-btns">
        <button onclick="scheduleDone('${c.id}')">완료</button>
        <button class="warn" onclick="scheduleHold('${c.id}')">보류</button>
      </div>
    </div>
  `;
}

/* 점검 예정 로드 */
async function loadScheduleDashboard() {
  const { data, error } = await sb
    .from("cranes")
    .select("id, crane_no, crane_type, area, next_inspection_date, inspection_status")
    .neq("inspection_status", "완료")
    .not("next_inspection_date", "is", null);

  if (error || !data) return;

  // 날짜순 정렬
  data.sort((a, b) =>
    new Date(a.next_inspection_date) - new Date(b.next_inspection_date)
  );

  const smallBox = document.getElementById("schedule-small");
  const towerBox = document.getElementById("schedule-tower");
  if (!smallBox || !towerBox) return;

  smallBox.innerHTML = "";
  towerBox.innerHTML = "";

  let smallCount = 0;
  let towerCount = 0;

  data.forEach(c => {
    if (c.crane_type === "Tower") {
      if (towerCount < 5) {
        towerBox.insertAdjacentHTML("beforeend", createScheduleCard(c));
        towerCount++;
      }
    } else {
      if (smallCount < 10) {
        smallBox.insertAdjacentHTML("beforeend", createScheduleCard(c));
        smallCount++;
      }
    }
  });
}

/* 예정 → 완료 */
async function scheduleDone(id) {
  const today = new Date();
  const next = new Date();
  next.setMonth(next.getMonth() + 3);

  await sb.from("cranes").update({
    inspection_status: "완료",
    next_inspection_date: next.toISOString().slice(0,10)
  }).eq("id", id);

  loadDashboard();
  loadScheduleDashboard();
}

/* 예정 → 보류 */
async function scheduleHold(id) {
  const reason = prompt("보류 사유 입력");
  if (!reason) return;

  await sb.from("cranes").update({
    inspection_status: "보류",
    hold_reason: reason
  }).eq("id", id);

  loadDashboard();
  loadScheduleDashboard();
}

/* 자동 실행 추가 */
document.addEventListener("DOMContentLoaded", () => {
  loadScheduleDashboard();
});
/* =========================
   🔔 점검 예정 대시보드 (v4)
   - 기존 로직 수정 ❌
   - 추가만 함 ⭕
========================= */

async function loadUpcomingInspections() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await sb
    .from("cranes")
    .select("id, crane_no, crane_type, crane_category, next_inspection_date, inspection_status")
    .not("next_inspection_date", "is", null)
    .in("inspection_status", ["완료", "보류", "미완"]);

  if (error || !data) return;

  const upcomingContainer = document.getElementById("upcomingList");
  if (!upcomingContainer) return;

  upcomingContainer.innerHTML = "";

  const items = data
    .map(c => {
      const due = new Date(c.next_inspection_date);
      due.setHours(0, 0, 0, 0);

      const diffDays = Math.floor((due - today) / (1000 * 60 * 60 * 24));

      return {
        ...c,
        diffDays
      };
    })
    // 예정 + 초과만
    .filter(c => c.diffDays <= 14)
    // 가까운 순
    .sort((a, b) => a.diffDays - b.diffDays);

  // 구분
  const small = items.filter(c =>
    c.crane_type !== "타워" && c.crane_category !== "타워크레인"
  ).slice(0, 10);

  const tower = items.filter(c =>
    c.crane_type === "타워" || c.crane_category === "타워크레인"
  ).slice(0, 5);

  [...small, ...tower].forEach(c => {
    const dText =
      c.diffDays > 0 ? `D-${c.diffDays}` :
      c.diffDays === 0 ? "D-Day" :
      `D+${Math.abs(c.diffDays)}`;

    const card = document.createElement("div");
    card.className = "upcoming-card";

    card.innerHTML = `
      <div class="up-title">
        ${c.crane_no || "번호없음"}
        <span class="badge">${c.crane_type || c.crane_category || ""}</span>
      </div>
      <div class="up-date">${dText}</div>
      <div class="up-actions">
        <button onclick="markUpcomingDone('${c.id}')">완료</button>
        <button onclick="markUpcomingHold('${c.id}')">보류</button>
      </div>
    `;

    upcomingContainer.appendChild(card);
  });
}

/* =========================
   예정 → 완료 처리
========================= */
async function markUpcomingDone(id) {
  const next = new Date();
  next.setMonth(next.getMonth() + 3);
  const nextDue = next.toISOString().slice(0, 10);

  await sb.from("cranes").update({
    inspection_status: "완료",
    next_inspection_date: nextDue
  }).eq("id", id);

  loadDashboard();
  loadUpcomingInspections();
}

/* =========================
   예정 → 보류 처리
========================= */
async function markUpcomingHold(id) {
  const reason = prompt("보류 사유 입력");
  if (!reason) return;

  await sb.from("cranes").update({
    inspection_status: "보류",
    hold_reason: reason
  }).eq("id", id);

  loadDashboard();
  loadUpcomingInspections();
}

/* =========================
   자동 실행 추가
========================= */
document.addEventListener("DOMContentLoaded", () => {
  loadUpcomingInspections();
});

/* =========================
   전역 바인딩 (추가)
========================= */
window.loadUpcomingInspections = loadUpcomingInspections;
window.markUpcomingDone = markUpcomingDone;
window.markUpcomingHold = markUpcomingHold;

/* 전역 바인딩 */
window.loadScheduleDashboard = loadScheduleDashboard;
window.scheduleDone = scheduleDone;
window.scheduleHold = scheduleHold;
