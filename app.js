const supabase = window.supabase.createClient(
  "https://lzfksuiftgmxwkhwhnhg.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6ZmtzdWlmdGdteHdraHdobmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NzczMDMsImV4cCI6MjA4MTM1MzMwM30.BHI8dTc18Jw3akhlRL7OZ8_0sYQwjb0-QaMGjKjUfYA"
);

// ---------- 공통 ----------
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- 메인 ----------
async function loadDashboard() {
  const { data } = await supabase.from("cranes").select("inspection_status");
  if (!data) return;

  let done=0, hold=0, fail=0, none=0;
  data.forEach(c => {
    if (c.inspection_status === "완료") done++;
    else if (c.inspection_status === "보류") hold++;
    else if (c.inspection_status === "미완") fail++;
    else none++;
  });

  document.getElementById("d_total").innerText = data.length;
  document.getElementById("d_done").innerText = done;
  document.getElementById("d_hold").innerText = hold;
  document.getElementById("d_fail").innerText = fail;
  document.getElementById("d_none").innerText = none;
}

async function saveInspection() {
  const crane_no = document.getElementById("i_crane_no").value.trim();
  if (!crane_no) return alert("크레인 번호 필수");

  const result = document.getElementById("i_result").value;
  const next_due = document.getElementById("i_next").value || null;
  const comment = document.getElementById("i_comment").value;

  await supabase.from("inspections").insert({
    crane_no,
    inspection_date: todayStr(),
    result,
    comment,
    next_due
  });

  await supabase.from("cranes")
    .update({ inspection_status: result, next_inspection_date: next_due })
    .neq("crane_no", "");

}

async function resetInspectionStatus() {
  if (!confirm("모든 점검 상태를 초기화합니다.")) return;
  await supabase.from("cranes")
    .update({ inspection_status: "미점검" })
    .neq("crane_no", "");
  loadDashboard();
}

// ---------- 새 창 ----------
function openCraneList(){ window.open("cranes.html"); }
function openRemarkList(){ window.open("remarks.html"); }
function openHoldList(){ window.open("hold.html"); }

// ---------- 리스트 ----------
async function loadCranes() {
  const { data } = await supabase.from("cranes").select("*").order("crane_no");
  const el = document.getElementById("craneList");
  if (!el) return;
  el.innerHTML = "";
  data.forEach(c => el.innerHTML += `<div>${c.crane_no} | ${c.inspection_status}</div>`);
}

async function loadRemarks(status="all") {
  let q = supabase.from("remarks").select("*");
  if (status !== "all") q = q.eq("status", status);
  const { data } = await q.order("created_at", { ascending:false });
  const el = document.getElementById("remarkList");
  if (!el) return;
  el.innerHTML = "";
  data.forEach(r => el.innerHTML += `<div>${r.crane_no} - ${r.content}</div>`);
}

function applyRemarkFilter(){
  const s = document.getElementById("filterStatus").value;
  loadRemarks(s);
}

async function loadHoldList() {
  const { data } = await supabase
    .from("cranes")
    .select("*")
    .eq("inspection_status", "보류");

  const el = document.getElementById("holdList");
  if (!el) return;
  el.innerHTML = "";
  data.forEach(c => el.innerHTML += `<div>${c.crane_no}</div>`);
}

// ---------- 초기 ----------
document.addEventListener("DOMContentLoaded", () => {
  loadDashboard();
  loadCranes();
  loadRemarks();
  loadHoldList();
});

window.saveInspection = saveInspection;
window.resetInspectionStatus = resetInspectionStatus;
async function addCrane() {
  const crane_no = document.getElementById("c_no").value.trim();
  if (!crane_no) return alert("크레인 번호는 필수입니다.");

  // 중복 체크
  const { data: exists } = await supabase
    .from("cranes")
    .select("id")
    .eq("crane_no", crane_no);

  if (exists && exists.length > 0) {
    alert("이미 등록된 크레인 번호입니다.");
    return;
  }

  const { error } = await supabase.from("cranes").insert({
    crane_no,
    ton: document.getElementById("c_ton").value,
    area: document.getElementById("c_area").value,
    location: document.getElementById("c_location").value,
    crane_type: document.getElementById("c_type").value,
    brand: document.getElementById("c_brand").value,
    inspection_status: "미점검"
  });

  if (error) {
    alert("등록 실패: " + error.message);
    return;
  }

  alert("크레인 등록 완료");
  loadCranes(); // 리스트 즉시 갱신
}

window.addCrane = addCrane;
document.addEventListener("DOMContentLoaded", () => {

  // 메인(index.html)에서만 대시보드 로드
  if (document.getElementById("dashboard")) {
    loadDashboard();
  }

  // 크레인 리스트 페이지에서만 실행
  if (document.getElementById("craneList")) {
    loadCranes();
  }

});
window.addCrane = addCrane;
