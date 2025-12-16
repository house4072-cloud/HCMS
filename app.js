// ✅ Supabase 연결 (네 키 그대로 유지)
const supabase = supabase.createClient(
  "https://네프로젝트.supabase.co",
  "네 anon key"
);

/* =========================
   페이지 분기 자동 실행
========================= */
document.addEventListener("DOMContentLoaded", () => {

  if (document.getElementById("dashboard")) {
    loadDashboard();
  }

  if (document.getElementById("craneList")) {
    loadCranes();
  }

});

/* =========================
   대시보드
========================= */
async function loadDashboard() {
  const { data } = await supabase.from("cranes").select("inspection_status");

  document.getElementById("totalCount").innerText = data.length;
  document.getElementById("doneCount").innerText =
    data.filter(d => d.inspection_status === "완료").length;
  document.getElementById("pendingCount").innerText =
    data.filter(d => d.inspection_status === "미완료").length;
  document.getElementById("holdCount").innerText =
    data.filter(d => d.inspection_status === "보류").length;
}

/* =========================
   점검 저장
========================= */
async function saveInspection() {
  const craneNo = document.getElementById("inspectCraneNo").value.trim();
  if (!craneNo) return alert("번호 입력");

  const { error } = await supabase
    .from("cranes")
    .update({ inspection_status: "완료" })
    .eq("crane_no", craneNo);

  if (error) return alert(error.message);
  alert("점검 저장됨");
  loadDashboard();
}

/* =========================
   크레인 리스트
========================= */
async function loadCranes() {
  const { data } = await supabase.from("cranes").select("*");
  const tbody = document.getElementById("craneList");
  tbody.innerHTML = "";

  data.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.crane_no}</td>
      <td>${c.ton || ""}</td>
      <td>${c.area || ""}</td>
      <td>${c.crane_type || ""}</td>
      <td>${c.brand || ""}</td>
      <td>${c.inspection_status || ""}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* =========================
   크레인 등록
========================= */
async function addCrane() {
  const crane_no = document.getElementById("c_no").value.trim();
  if (!crane_no) return alert("번호 필수");

  const { error } = await supabase.from("cranes").insert({
    crane_no,
    ton: document.getElementById("c_ton").value,
    area: document.getElementById("c_area").value,
    crane_type: document.getElementById("c_type").value,
    brand: document.getElementById("c_brand").value,
    inspection_status: "미점검"
  });

  if (error) return alert(error.message);

  alert("등록 완료");
  loadCranes();
}

/* =========================
   이동
========================= */
function openCranes() {
  window.open("cranes.html", "_blank");
}

/* =========================
   전역 등록 (❗중요)
========================= */
window.saveInspection = saveInspection;
window.addCrane = addCrane;
window.openCranes = openCranes;
