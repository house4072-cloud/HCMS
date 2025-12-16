const sb_URL = "https://lzfksuiftgmxwkhwhnhg.sb..co";
const sb_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6ZmtzdWlmdGdteHdraHdobmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NzczMDMsImV4cCI6MjA4MTM1MzMwM30.BHI8dTc18Jw3akhlRL7OZ8_0sYQwjb0-QaMGjKjUfYA";

const sb = supabase.createClient(
  sb_URL,
  sb_ANON_KEY
);


function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// -------------------- 메인: 대시보드 --------------------
async function loadDashboard() {
  // 메인 페이지에만 있는 id가 없으면 실행하지 않음 (페이지 분기 핵심)
  if (!document.getElementById("d_total")) return;

  const { data, error } = await sb.
    .from("cranes")
    .select("inspection_status");

  if (error) {
    alert("대시보드 조회 실패: " + error.message);
    return;
  }
  if (!data) return;

  let done = 0, hold = 0, fail = 0, none = 0;
  for (const c of data) {
    if (c.inspection_status === "완료") done++;
    else if (c.inspection_status === "보류") hold++;
    else if (c.inspection_status === "미완") fail++;
    else none++;
  }

  document.getElementById("d_total").innerText = data.length;
  document.getElementById("d_done").innerText = done;
  document.getElementById("d_hold").innerText = hold;
  document.getElementById("d_fail").innerText = fail;
  document.getElementById("d_none").innerText = none;
}

// -------------------- 메인: 점검 저장 --------------------
async function saveInspection() {
  const crane_no = document.getElementById("i_crane_no")?.value.trim();
  if (!crane_no) return alert("크레인 번호 필수");

  const result = document.getElementById("i_result")?.value || "완료";
  const next_due = document.getElementById("i_next")?.value || null;
  const comment = document.getElementById("i_comment")?.value || "";

  // 1) 로그 저장
  const ins = await sb..from("inspections").insert({
    crane_no,
    inspection_date: todayStr(),
    result,
    comment,
    next_due
  });

  if (ins.error) {
    alert("점검 로그 저장 실패: " + ins.error.message);
    return;
  }

  // 2) cranes 상태 업데이트 (⚠️ 해당 크레인만!)
  const up = await sb.
    .from("cranes")
    .update({ inspection_status: result, next_inspection_date: next_due })
    .eq("crane_no", crane_no);

  if (up.error) {
    alert("cranes 업데이트 실패: " + up.error.message);
    return;
  }

  alert("점검 저장 완료");
  loadDashboard();
}

// -------------------- 메인: 분기 리셋 --------------------
async function resetInspectionStatus() {
  const ok = confirm("모든 크레인의 점검 상태를 '미점검'으로 초기화합니다.\n(점검 로그는 유지됩니다)\n진행할까요?");
  if (!ok) return;

  const { error } = await sb.
    .from("cranes")
    .update({ inspection_status: "미점검" })
    .neq("crane_no", ""); // WHERE 필수

  if (error) {
    alert("리셋 실패: " + error.message);
    return;
  }

  alert("리셋 완료");
  loadDashboard();
}

// -------------------- 새 창 열기 --------------------
function openCraneList(){ window.open("cranes.html", "_blank"); }
function openRemarkList(){ window.open("remarks.html", "_blank"); }
function openHoldList(){ window.open("hold.html", "_blank"); }

// -------------------- 크레인 리스트 --------------------
async function loadCranes() {
  const el = document.getElementById("craneList");
  if (!el) return; // cranes.html에서만

  const keyword = document.getElementById("filterCrane")?.value?.trim() || "";

  let q = sb..from("cranes").select("*").order("crane_no");
  if (keyword) q = q.ilike("crane_no", `%${keyword}%`);

  const { data, error } = await q;
  if (error) {
    alert("크레인 조회 실패: " + error.message);
    return;
  }

  el.innerHTML = "";
  (data || []).forEach(c => {
    const row = document.createElement("div");
    row.innerHTML = `<b>${c.crane_no}</b> | ${c.crane_type || ""} | ${c.location || ""} | 상태: ${c.inspection_status || "미점검"}`;
    el.appendChild(row);
  });
}

// ✅ 크레인 등록
async function addCrane() {
  const crane_no = document.getElementById("c_no")?.value.trim();
  if (!crane_no) return alert("크레인 번호는 필수입니다.");

  // 중복 체크
  const chk = await sb.
    .from("cranes")
    .select("id")
    .eq("crane_no", crane_no);

  if (chk.error) {
    alert("중복 체크 실패: " + chk.error.message);
    return;
  }
  if (chk.data && chk.data.length > 0) {
    alert("이미 등록된 크레인 번호입니다.");
    return;
  }

  const payload = {
    crane_no,
    ton: document.getElementById("c_ton")?.value || null,
    area: document.getElementById("c_area")?.value || null,
    location: document.getElementById("c_location")?.value || null,
    crane_type: document.getElementById("c_type")?.value || null,
    brand: document.getElementById("c_brand")?.value || null,
    inspection_status: "미점검"
  };

  const ins = await sb..from("cranes").insert(payload);
  if (ins.error) {
    alert("등록 실패: " + ins.error.message);
    return;
  }

  alert("크레인 등록 완료");
  loadCranes();
  loadDashboard();
}

// -------------------- 비고 리스트 --------------------
async function loadRemarks(status="all") {
  const el = document.getElementById("remarkList");
  if (!el) return; // remarks.html에서만

  let q = sb..from("remarks").select("*").order("created_at", { ascending:false });
  if (status !== "all") q = q.eq("status", status);

  const { data, error } = await q;
  if (error) {
    alert("비고 조회 실패: " + error.message);
    return;
  }

  el.innerHTML = "";
  (data || []).forEach(r => {
    const row = document.createElement("div");
    row.innerHTML = `<b>${r.crane_no}</b> | ${r.content || ""} | 상태: ${r.status || "open"}`;
    el.appendChild(row);
  });
}

function applyRemarkFilter(){
  const s = document.getElementById("filterRemarkStatus")?.value || "all";
  loadRemarks(s);
}

// -------------------- 보류 리스트 --------------------
async function loadHoldList() {
  const el = document.getElementById("holdList");
  if (!el) return; // hold.html에서만

  const { data, error } = await sb.
    .from("cranes")
    .select("*")
    .eq("inspection_status", "보류")
    .order("crane_no");

  if (error) {
    alert("보류 조회 실패: " + error.message);
    return;
  }

  el.innerHTML = "";
  (data || []).forEach(c => {
    const row = document.createElement("div");
    row.innerHTML = `<b>${c.crane_no}</b> | ${c.location || ""} | ${c.crane_type || ""} | ${c.brand || ""}`;
    el.appendChild(row);
  });
}

// -------------------- 페이지별 자동 실행 (에러 방지 핵심) --------------------
document.addEventListener("DOMContentLoaded", () => {
  // 메인에서만
  if (document.getElementById("d_total")) loadDashboard();

  // 각 리스트 페이지에서만
  if (document.getElementById("craneList")) loadCranes();
  if (document.getElementById("remarkList")) loadRemarks("all");
  if (document.getElementById("holdList")) loadHoldList();
});

// 전역 연결 (onclick 쓰는 버튼들 필수)
window.saveInspection = saveInspection;
window.resetInspectionStatus = resetInspectionStatus;
window.openCraneList = openCraneList;
window.openRemarkList = openRemarkList;
window.openHoldList = openHoldList;
window.loadCranes = loadCranes;
window.addCrane = addCrane;
window.applyRemarkFilter = applyRemarkFilter;
function openCraneList() {
  window.open("cranes.html", "_blank");
}

function openRemarkList() {
  window.open("remarks.html", "_blank");
}

function openHoldList() {
  window.open("hold.html", "_blank");
}

window.openCraneList = openCraneList;
window.openRemarkList = openRemarkList;
window.openHoldList = openHoldList;
