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

  // ✅ 숫자 입력 시 C- 자동 보정
  if (/^\d+$/.test(crane_no)) {
    crane_no = `C-${crane_no}`;
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
    hoistSpec = parts.length ? parts.join(" ") : null;
  } else if (hoistType === "Chain") {
    hoistSpec = reeving || null;
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
   수정용 데이터 로드
========================= */
async function loadCraneToForm(id) {
  const { data, error } = await sb.from("cranes").select("*").eq("id", id).single();
  if (error) return alert(error.message);

  editingCraneId = id;

  document.getElementById("c_no").value = data.crane_no || "";
  document.getElementById("c_area").value = data.area || "";
  document.getElementById("c_type").value = data.crane_type || "";
  document.getElementById("c_brand").value = data.brand || "";
  document.getElementById("c_ton").value = data.ton ?? "";
  document.getElementById("c_group").value = data.group_name || "";
  document.getElementById("c_hoist_type").value = data.hoist_type || "";

  toggleHoistDetail();

  if (data.hoist_spec) {
    const parts = data.hoist_spec.split(" ");
    if (data.hoist_type === "Wire") {
      document.getElementById("c_wire_dia").value = parts[0]?.replace("Φ", "") || "";
      document.getElementById("c_wire_len").value = parts[1]?.replace("M", "") || "";
      document.getElementById("c_reeving").value = parts[2] || "";
    } else {
      document.getElementById("c_reeving").value = parts[0] || "";
    }
  }
}

/* =========================
   삭제
========================= */
async function deleteCrane(id) {
  if (!confirm("정말 삭제할까요?")) return;
  const { error } = await sb.from("cranes").delete().eq("id", id);
  if (error) return alert(error.message);
  loadCranes();
}

/* =========================
   보류 처리
========================= */
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
   메인 점검 완료 (오류 해결)
========================= */
async function saveInspection() {
  const input =
    document.getElementById("inspect_no") ||
    document.getElementById("i_no") ||
    document.getElementById("crane_no_input");

  if (!input) return alert("메인 크레인 번호 입력칸 id 확인 필요");
  let crane_no = input.value.trim();
  if (!crane_no) return alert("크레인 번호 입력");

  if (/^\d+$/.test(crane_no)) {
    crane_no = `C-${crane_no}`;
  }

  const today = new Date().toISOString().slice(0, 10);
  const next = new Date();
  next.setMonth(next.getMonth() + 3);
  const next_due = next.toISOString().slice(0, 10);

  const up = await sb.from("cranes").update({
    inspection_status: "완료",
    next_inspection_date: next_due
  }).eq("crane_no", crane_no);

  if (up.error) return alert(up.error.message);

  await sb.from("inspections").insert({
    crane_no,
    inspection_date: today,
    result: "완료",
    next_due
  });

  alert(`점검 완료: ${crane_no}`);
}

/* =========================
   UI 보조
========================= */
function toggleHoistDetail() {
  const type = document.getElementById("c_hoist_type")?.value;
  const dia = document.getElementById("c_wire_dia");
  const len = document.getElementById("c_wire_len");
  const reeving = document.getElementById("c_reeving");

  if (dia) dia.style.display = type === "Wire" ? "block" : "none";
  if (len) len.style.display = type === "Wire" ? "block" : "none";
  if (reeving) reeving.style.display = type ? "block" : "none";
}

function clearCraneForm() {
  [
    "c_no","c_area","c_type","c_brand","c_ton",
    "c_group","c_hoist_type","c_wire_dia",
    "c_wire_len","c_reeving"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

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

/* =========================
   자동 실행
========================= */
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("craneList")) loadCranes();
});
/* =========================
   크레인 번호 자동 C- 접두 (입력 종료 시)
========================= */
function autoCraneNoPrefix() {
  const el = document.getElementById("c_no");
  if (!el) return;

  let v = el.value.trim();
  if (!v) return;

  // 이미 C-로 시작하면 그대로
  if (v.toUpperCase().startsWith("C-")) return;

  // 숫자만 입력했을 때만 자동 접두
  if (/^\d+$/.test(v)) {
    el.value = `C-${v}`;
  }
}
window.autoCraneNoPrefix = autoCraneNoPrefix;
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
window.toggleHoistDetail = toggleHoistDetail;
window.openCraneList = openCraneList;
window.openRemarkList = openRemarkList;
window.openHoldList = openHoldList;

