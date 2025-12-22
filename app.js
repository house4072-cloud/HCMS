// ===== Supabase 초기화 =====
const SUPABASE_URL = "https://lzfksuiftgmxwkhwhnhg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6ZmtzdWlmdGdteHdraHdobmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NzczMDMsImV4cCI6MjA4MTM1MzMwM30.BHI8dTc18Jw3akhlRL7OZ8_0sYQwjb0-QaMGjKjUfYA";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const NO_NUMBER_LABEL = "번호없음";

/* =========================
   크레인 리스트 로드
========================= */
async function loadCranes() {
  let query = sb.from("cranes").select("*");

  const no = document.getElementById("f_no")?.value;
  const noMode = document.getElementById("f_no_mode")?.value; // (전체/번호있음/번호없음)
  const area = document.getElementById("f_area")?.value;
  const type = document.getElementById("f_type")?.value;      // ✅ 선택형 대응
  const brand = document.getElementById("f_brand")?.value;
  const ton = document.getElementById("f_ton")?.value;
  const status = document.getElementById("f_status")?.value;

  // ✅ 번호 필터 (번호없음/번호있음)
  if (noMode === "NONE") query = query.eq("crane_no", NO_NUMBER_LABEL);
  if (noMode === "HAS") query = query.neq("crane_no", NO_NUMBER_LABEL);

  if (no) query = query.ilike("crane_no", `%${no}%`);
  if (area) query = query.ilike("area", `%${area}%`);

  // ✅ 타입 필터: 기존엔 입력이었고 지금은 select일 수 있음 (둘 다 value로 처리됨)
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

function normalizeCraneNoFromForm() {
  const mode = document.getElementById("c_no_mode")?.value; // INPUT / NONE
  const el = document.getElementById("c_no");

  // 모드가 없으면 기존 동작 유지 (입력값 그대로 + 숫자면 C-)
  if (!mode) {
    let v = el?.value?.trim() || "";
    if (!v) return "";
    if (/^\d+$/.test(v)) v = `C-${v}`;
    return v;
  }

  // 번호없음 선택
  if (mode === "NONE") {
    return NO_NUMBER_LABEL;
  }

  // 번호입력 선택
  let v = el?.value?.trim() || "";
  if (!v) return "";
  if (/^\d+$/.test(v)) v = `C-${v}`;
  return v;
}

async function addCrane(category = "일반") {
  const crane_no = normalizeCraneNoFromForm();
  if (!crane_no) return alert("크레인 번호 필수 (또는 '번호없음' 선택)");

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
    hoist_type: hoistType || null,
    hoist_spec: hoistSpec || null,
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

  // ✅ 번호없음/번호입력 모드 반영 (있을 때만)
  const modeEl = document.getElementById("c_no_mode");
  const noEl = document.getElementById("c_no");
  if (modeEl && noEl) {
    if (data.crane_no === NO_NUMBER_LABEL) {
      modeEl.value = "NONE";
      noEl.value = "";
      noEl.disabled = true;
    } else {
      modeEl.value = "INPUT";
      noEl.disabled = false;
      noEl.value = data.crane_no || "";
    }
  } else {
    // 기존 폼이면 기존대로
    document.getElementById("c_no").value = data.crane_no || "";
  }

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

  const { error } = await sb.from("cranes").update({
    inspection_status: "보류",
    hold_reason: reason
  }).eq("id", id);

  if (error) return alert(error.message);
  loadCranes();
}

async function releaseCraneHold(id) {
  const { error } = await sb.from("cranes").update({
    inspection_status: "미완료",
    hold_reason: null
  }).eq("id", id);

  if (error) return alert(error.message);
  loadCranes();
}

/* =========================
   🔥 메인 점검 저장 (date "" 에러 FIX)
========================= */
async function saveInspection() {
  let crane_no = document.getElementById("i_crane_no")?.value?.trim();
  if (!crane_no) return alert("크레인 번호 입력");

  if (/^\d+$/.test(crane_no)) crane_no = `C-${crane_no}`;

  // ⚠️ 번호없음은 중복 가능해서 메인 점검 대상에서 제외(안전)
  if (crane_no === NO_NUMBER_LABEL) {
    return alert("번호없음 크레인은 메인 점검 입력에서 제외(식별 불가).");
  }

  const result = document.getElementById("i_result")?.value || "완료";
  const comment = document.getElementById("i_comment")?.value || null;

  let next_due = document.getElementById("i_next")?.value;

  // ✅ 핵심 FIX: ""(빈문자열) → null 로 정규화 (date 컬럼에 "" 보내면 에러)
  if (next_due === "") next_due = null;

  // 완료인데 다음 점검일 비어있으면 자동 +3개월
  if (!next_due && result === "완료") {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    next_due = d.toISOString().slice(0, 10);
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
    // ✅ null이면 컬럼에 null 들어감 ("" X)
    next_inspection_date: next_due
  };

  if (result === "보류") {
    craneUpdate.hold_reason = comment || "메인 입력 보류";
    // 보류인데 다음점검일 빈칸이면 null 유지 (이미 next_due null 처리됨)
  }

  const up = await sb
    .from("cranes")
    .update(craneUpdate)
    .eq("id", craneRow.id);

  if (up.error) return alert(up.error.message);

  // 3) inspections 로그
  const inspectionPayload = {
    crane_no,
    inspection_date: new Date().toISOString().slice(0, 10),
    result,
    comment: comment || null
  };

  // ✅ next_due도 "" 금지. 값 있을 때만 넣기
  if (next_due) inspectionPayload.next_due = next_due;

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
  if (error) return; // (권한/네트워크 이슈 대비)
  if (!data) return;

  let total = data.length, done = 0, hold = 0, fail = 0, none = 0;
  data.forEach(c => {
    if (c.inspection_status === "완료") done++;
    else if (c.inspection_status === "보류") hold++;
    else if (c.inspection_status === "미완") fail++;
    else none++;
  });

  // 안전 바인딩 (index.html에서만 존재)
  if (typeof d_total !== "undefined" && d_total) d_total.innerText = total;
  if (typeof d_done !== "undefined" && d_done) d_done.innerText = done;
  if (typeof d_hold !== "undefined" && d_hold) d_hold.innerText = hold;
  if (typeof d_fail !== "undefined" && d_fail) d_fail.innerText = fail;
  if (typeof d_none !== "undefined" && d_none) d_none.innerText = none;
}

async function resetInspectionStatus() {
  if (!confirm("분기 리셋 하시겠습니까?")) return;
  await sb.from("cranes").update({ inspection_status: "미점검" });
  loadDashboard();
}

/* =========================
   UI / 공통
========================= */
function toggleHoistDetail() {
  const type = document.getElementById("c_hoist_type")?.value;
  const diaEl = document.getElementById("c_wire_dia");
  const lenEl = document.getElementById("c_wire_len");
  const reevingEl = document.getElementById("c_reeving");

  if (diaEl) diaEl.style.display = type === "Wire" ? "block" : "none";
  if (lenEl) lenEl.style.display = type === "Wire" ? "block" : "none";
  if (reevingEl) reevingEl.style.display = type ? "block" : "none";
}

function clearCraneForm() {
  ["c_no","c_area","c_type","c_brand","c_ton","c_group","c_hoist_type","c_wire_dia","c_wire_len","c_reeving"]
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

  const modeEl = document.getElementById("c_no_mode");
  const noEl = document.getElementById("c_no");
  if (modeEl && noEl) {
    modeEl.value = "INPUT";
    noEl.disabled = false;
  }
}

// ✅ 번호 입력/번호없음 토글 (HTML에 있을 때만 동작)
function toggleCraneNoMode() {
  const modeEl = document.getElementById("c_no_mode");
  const noEl = document.getElementById("c_no");
  if (!modeEl || !noEl) return;

  if (modeEl.value === "NONE") {
    noEl.value = "";
    noEl.disabled = true;
  } else {
    noEl.disabled = false;
  }
}

/* =========================
   크레인 번호 자동 C- 접두 (입력 종료 시)
========================= */
function autoCraneNoPrefix() {
  const modeEl = document.getElementById("c_no_mode");
  if (modeEl && modeEl.value === "NONE") return;

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
  // index.html(메인)에서만 대시보드
  if (document.getElementById("dashboard")) loadDashboard();

  // cranes.html(리스트)에서만 로드
  if (document.getElementById("craneList")) loadCranes();

  // 번호모드 토글 초기 반영
  toggleCraneNoMode();
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
window.openCraneList = openCraneList;
window.openRemarkList = openRemarkList;
window.openHoldList = openHoldList;

window.toggleHoistDetail = toggleHoistDetail;
window.autoCraneNoPrefix = autoCraneNoPrefix;
window.toggleCraneNoMode = toggleCraneNoMode;
