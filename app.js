// ===== Supabase 초기화 =====
const SUPABASE_URL = "https://lzfksuiftgmxwkhwhnhg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6ZmtzdWlmdGdteHdraHdobmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NzczMDMsImV4cCI6MjA4MTM1MzMwM30.BHI8dTc18Jw3akhlRL7OZ8_0sYQwjb0-QaMGjKjUfYA";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* =========================
   유틸: 빈 날짜("") -> null
   (🔥 invalid input syntax for type date: "" 방지)
========================= */
function normalizeDate(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

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
   🔥 메인 점검 저장 (id 기준 / 안정본)
   ✅ v2 수정: next_due "" -> null 처리
========================= */
async function saveInspection() {
  let crane_no = document.getElementById("i_crane_no")?.value?.trim();
  if (!crane_no) return alert("크레인 번호 입력");
  if (/^\d+$/.test(crane_no)) crane_no = `C-${crane_no}`;

  const result = document.getElementById("i_result")?.value || "완료";
  const comment = document.getElementById("i_comment")?.value || null;

  let next_due = normalizeDate(document.getElementById("i_next")?.value);

  // 완료인데 next_due 비어있으면 3개월 자동
  if (!next_due && result === "완료") {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    next_due = d.toISOString().slice(0, 10);
  }

  // 1) crane_no -> id 조회
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
    next_inspection_date: normalizeDate(next_due)
  };

  if (result === "보류") {
    craneUpdate.hold_reason = comment || "메인 입력 보류";
  }

  const up = await sb
    .from("cranes")
    .update(craneUpdate)
    .eq("id", craneRow.id);

  if (up.error) return alert(up.error.message);

  // 3) inspections 로그 (✅ v2 수정: next_due "" 넣지 않음)
  const inspectionPayload = {
    crane_no,
    inspection_date: new Date().toISOString().slice(0, 10),
    result,
    comment
  };

  // 완료일 때만 next_due 기록
  if (result === "완료") {
    inspectionPayload.next_due = normalizeDate(next_due);
  }

  const ins = await sb.from("inspections").insert(inspectionPayload);
  if (ins.error) return alert(ins.error.message);

  alert("점검 저장 완료");
  loadDashboard();
  loadScheduleDashboard(); // ✅ 추가
}

/* =========================
   대시보드 / 분기 리셋
========================= */
async function loadDashboard() {
  const { data, error } = await sb.from("cranes").select("inspection_status");
  if (error || !data) return;

  let total = data.length, done = 0, hold = 0, fail = 0, none = 0;
  data.forEach(c => {
    if (c.inspection_status === "완료") done++;
    else if (c.inspection_status === "보류") hold++;
    else if (c.inspection_status === "미완") fail++;
    else none++;
  });

  document.getElementById("d_total") && (d_total.innerText = total);
  document.getElementById("d_done") && (d_done.innerText = done);
  document.getElementById("d_hold") && (d_hold.innerText = hold);
  document.getElementById("d_fail") && (d_fail.innerText = fail);
  document.getElementById("d_none") && (d_none.innerText = none);
}

async function resetInspectionStatus() {
  if (!confirm("분기 리셋 하시겠습니까?")) return;

  // ✅ 기존 유지: 전체 미점검으로 변경
  const r = await sb.from("cranes").update({ inspection_status: "미점검" });
  if (r.error) return alert(r.error.message);

  loadDashboard();
  loadScheduleDashboard(); // ✅ 추가
}

/* ======================================================
   ✅ v2 신규: 점검 예정 대시보드 (소형/서비스 10대, 타워 5대)
   - next_inspection_date 기준, 가까운 순
   - D- / D+ 표시
   - 완료/보류 버튼
====================================================== */
async function loadScheduleDashboard() {
  const smallBox = document.getElementById("schedule-small");
  const towerBox = document.getElementById("schedule-tower");
  if (!smallBox || !towerBox) return; // index에 섹션 없으면 그냥 종료

  // 초기화
  smallBox.innerHTML = "";
  towerBox.innerHTML = "";

  const { data, error } = await sb
    .from("cranes")
    .select("id, crane_no, crane_type, crane_category, inspection_status, next_inspection_date")
    .not("next_inspection_date", "is", null);

  if (error || !data) return;

  const today = new Date();
  const list = data
    .map(c => {
      const due = new Date(c.next_inspection_date);
      const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
      return { ...c, diff };
    })
    .sort((a, b) => a.diff - b.diff);

  let smallCount = 0;
  let towerCount = 0;

  list.forEach(c => {
    // 완료는 예정에서 제외
    if (c.inspection_status === "완료") return;

    const isTower = (c.crane_type === "타워");
    const target = isTower ? towerBox : smallBox;

    if (!isTower && smallCount >= 10) return;
    if (isTower && towerCount >= 5) return;

    const dTxt = c.diff >= 0 ? `D-${c.diff}` : `D+${Math.abs(c.diff)}`;

    const row = document.createElement("div");
    row.className = "schedule-item";
    row.innerHTML = `
      <div class="schedule-left">
        <div class="schedule-no">${c.crane_no || "번호없음"}</div>
        <div class="schedule-d">${dTxt}</div>
      </div>
      <div class="schedule-right">
        <button class="btn-mini" onclick="scheduleSetStatus('${c.id}','미완')">미완</button>
        <button class="btn-mini warn" onclick="scheduleSetStatus('${c.id}','보류')">보류</button>
        <button class="btn-mini ok" onclick="scheduleSetStatus('${c.id}','완료')">완료</button>
      </div>
    `;
    target.appendChild(row);

    if (isTower) towerCount++;
    else smallCount++;
  });

  // 비어있으면 안내문
  if (smallBox.children.length === 0) {
    smallBox.innerHTML = `<div class="schedule-empty">표시할 예정 항목 없음</div>`;
  }
  if (towerBox.children.length === 0) {
    towerBox.innerHTML = `<div class="schedule-empty">표시할 예정 항목 없음</div>`;
  }
}

// 예정 대시보드에서 상태 변경(완료/보류/미완)
async function scheduleSetStatus(id, status) {
  const payload = { inspection_status: status };

  // 완료 시 다음 점검일 자동 +3개월 (기존 saveInspection과 동일 로직)
  if (status === "완료") {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    payload.next_inspection_date = d.toISOString().slice(0, 10);
  }

  const r = await sb.from("cranes").update(payload).eq("id", id);
  if (r.error) return alert(r.error.message);

  loadDashboard();
  loadScheduleDashboard();
}

/* =========================
   UI / 공통
========================= */
function toggleHoistDetail() {
  const type = document.getElementById("c_hoist_type")?.value;
  c_wire_dia && (c_wire_dia.style.display = type === "Wire" ? "block" : "none");
  c_wire_len && (c_wire_len.style.display = type === "Wire" ? "block" : "none");
  c_reeving && (c_reeving.style.display = type ? "block" : "none");
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
  if (/^\d+$/.test(v)) el.value = `C-${v}`;
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
  // 메인
  loadDashboard();
  loadScheduleDashboard();

  // 크레인리스트 페이지면 리스트 로드
  if (document.getElementById("craneList")) loadCranes();
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

window.loadScheduleDashboard = loadScheduleDashboard;
window.scheduleSetStatus = scheduleSetStatus;

window.toggleHoistDetail = toggleHoistDetail;
window.clearCraneForm = clearCraneForm;

window.openCraneList = openCraneList;
window.openRemarkList = openRemarkList;
window.openHoldList = openHoldList;

window.autoCraneNoPrefix = autoCraneNoPrefix;
