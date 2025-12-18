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
  if (!tbody) return;

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
      <td>
        ${
          c.inspection_status === "보류"
            ? `
              <button onclick="releaseCraneHold(${c.id})">해제</button>
              <button onclick="editHoldReason(${c.id}, '${c.hold_reason || ""}')">사유수정</button>
            `
            : `<button onclick="setCraneHold(${c.id})">보류</button>`
        }
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* =========================
   크레인 등록
========================= */
async function addCrane(category = "일반") {
  const crane_no = document.getElementById("c_no")?.value?.trim();
  if (!crane_no) return alert("크레인 번호 필수");

  const { error } = await sb.from("cranes").insert({
    crane_no,
    area: document.getElementById("c_area")?.value || null,
    crane_type: document.getElementById("c_type")?.value || null,
    hoist_type: document.getElementById("c_hoist")?.value || null,
    brand: document.getElementById("c_brand")?.value || null,
    ton: document.getElementById("c_ton")?.value || null,
    group_name: document.getElementById("c_group")?.value || null,
    crane_category: category,
    inspection_status: "미완료"
  });

  if (error) return alert(error.message);

  alert("등록 완료");
  loadCranes();
}

/* =========================
   크레인 수정
========================= */
async function updateCrane(id) {
  const payload = {
    area: document.getElementById("c_area")?.value || null,
    crane_type: document.getElementById("c_type")?.value || null,
    hoist_type: document.getElementById("c_hoist")?.value || null,
    brand: document.getElementById("c_brand")?.value || null,
    ton: document.getElementById("c_ton")?.value || null,
    group_name: document.getElementById("c_group")?.value || null
  };

  const { error } = await sb.from("cranes")
    .update(payload)
    .eq("id", id);

  if (error) return alert(error.message);

  alert("수정 완료");
  loadCranes();
}

/* =========================
   크레인 삭제
========================= */
async function deleteCrane(id) {
  if (!confirm("정말 삭제할까요?")) return;

  const { error } = await sb.from("cranes")
    .delete()
    .eq("id", id);

  if (error) return alert(error.message);

  alert("삭제 완료");
  loadCranes();
}

/* =========================
   보류 처리
========================= */
async function setCraneHold(id) {
  const reason = prompt("보류 사유를 입력하세요");
  if (!reason) return;

  const { error } = await sb.from("cranes")
    .update({
      inspection_status: "보류",
      hold_reason: reason
    })
    .eq("id", id);

  if (error) return alert(error.message);

  alert("보류 처리 완료");
  loadCranes();
}

/* =========================
   보류 해제
========================= */
async function releaseCraneHold(id) {
  if (!confirm("보류를 해제하시겠습니까?")) return;

  const { error } = await sb.from("cranes")
    .update({
      inspection_status: "미완료",
      hold_reason: null
    })
    .eq("id", id);

  if (error) return alert(error.message);

  alert("보류 해제 완료");
  loadCranes();
}

/* =========================
   보류 사유 수정
========================= */
async function editHoldReason(id, currentReason) {
  const reason = prompt("보류 사유 수정", currentReason);
  if (!reason) return;

  const { error } = await sb.from("cranes")
    .update({ hold_reason: reason })
    .eq("id", id);

  if (error) return alert(error.message);

  alert("사유 수정 완료");
  loadCranes();
}

/* =========================
   자동 실행
========================= */
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("craneList")) {
    loadCranes();
  }
});

/* =========================
   페이지 이동
========================= */
function openCraneList() {
  window.open("cranes.html", "_blank");
}

function openRemarkList() {
  window.open("remarks.html", "_blank");
}

function openHoldList() {
  window.open("holds.html", "_blank");
}
function toggleHoistDetail() {
  const type = document.getElementById("c_hoist_type").value;

  const dia = document.getElementById("c_wire_dia");
  const len = document.getElementById("c_wire_len");
  const reeving = document.getElementById("c_reeving");

  if (type === "Wire") {
    dia.style.display = "block";
    len.style.display = "block";
    reeving.style.display = "block";
  } else if (type === "Chain") {
    dia.style.display = "none";
    len.style.display = "none";
    reeving.style.display = "block";
  } else {
    dia.style.display = "none";
    len.style.display = "none";
    reeving.style.display = "none";
  }
}

/* =========================
   전역 바인딩 (딱 1번)
========================= */
window.loadCranes = loadCranes;
window.addCrane = addCrane;
window.updateCrane = updateCrane;
window.deleteCrane = deleteCrane;
window.setCraneHold = setCraneHold;
window.releaseCraneHold = releaseCraneHold;
window.editHoldReason = editHoldReason;
window.toggleHoistDetail = toggleHoistDetail;
