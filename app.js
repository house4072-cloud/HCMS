// ===== Supabase 초기화 (TEST) =====
const SUPABASE_URL = "https://lzfksuiftgmxwkhwhnhg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6ZmtzdWlmdGdteHdraHdobmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NzczMDMsImV4cCI6MjA4MTM1MzMwM30.BHI8dTc18Jw3akhlRL7OZ8_0sYQwjb0-QaMGjKjUfYA";

const sb = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/* =========================
   크레인 리스트 로드 (필터 포함)
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
  if (type) query = query.ilike("crane_type", `%${type}%`);
  if (brand) query = query.ilike("brand", `%${brand}%`);
  if (ton) query = query.eq("ton", ton);
  if (status) query = query.eq("inspection_status", status);

  const { data, error } = await query;
  if (error) return alert(error.message);

  const tbody = document.getElementById("craneList");
  tbody.innerHTML = "";

  data.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.crane_no}</td>
      <td>${c.area || ""}</td>
      <td>${c.crane_type || ""}</td>
      <td>${c.brand || ""}</td>
      <td>${c.ton || ""}</td>
      <td>${c.group_name || ""}</td>
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
  if (!crane_no) return alert("크레인 번호 필수");

  const { error } = await sb.from("cranes").insert({
    crane_no,
    area: document.getElementById("c_area").value,
    crane_type: document.getElementById("c_type").value,
    brand: document.getElementById("c_brand").value,
    ton: document.getElementById("c_ton").value,
    group_name: document.getElementById("c_group").value,
    inspection_status: "미점검"
  });

  if (error) return alert(error.message);

  alert("등록 완료");
  loadCranes();
}
// --- 페이지별 자동 실행 ---
document.addEventListener("DOMContentLoaded", () => {
  // cranes.html에만 있는 tbody id
  if (document.getElementById("craneList")) {
    loadCranes();
  }
});


window.loadCranes = loadCranes;
window.addCrane = addCrane;
function openCraneList() {
  location.href = "cranes.html";
}

function openRemarkList() {
  location.href = "remarks.html";
}

function openHoldList() {
  location.href = "holds.html";
}
async function addCrane(category = "일반") {
  await sb.from("cranes").insert({
    crane_no: c_no.value,
    area: c_area.value,
    crane_type: c_type.value,
    hoist_type: c_hoist.value,
    brand: c_brand.value,
    ton: c_ton.value,
    group_name: c_group.value,
    crane_category: category,
    inspection_status: "미점검"
  });
}
async function updateCrane(id) {
  await sb.from("cranes")
    .update({
      area,
      crane_type,
      hoist_type,
      brand,
      ton,
      group_name
    })
    .eq("id", id);
}
async function deleteCrane(id) {
  if (!confirm("정말 삭제할까요?")) return;
  await sb.from("cranes").delete().eq("id", id);
}
