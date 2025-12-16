console.log("HCMS app loaded");

/* 🔧 Supabase 설정 */
const SUPABASE_URL = "https://lzfksuiftgmxwkhwhnhg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6ZmtzdWlmdGdteHdraHdobmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NzczMDMsImV4cCI6MjA4MTM1MzMwM30.BHI8dTc18Jw3akhlRL7OZ8_0sYQwjb0-QaMGjKjUfYA";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

/* 🔹 비고 추가 */
async function addRemark() {
  const craneNo = document.getElementById("craneNo").value.trim();
  const text = document.getElementById("remarkText").value.trim();

  if (!craneNo || !text) {
    alert("크레인 번호와 비고 내용을 입력하세요.");
    return;
  }

  const { error } = await supabase.from("remarks").insert({
    crane_no: craneNo,
    content: text,
    status: "open"
  });

  if (error) {
    alert("저장 실패: " + error.message);
    return;
  }

  document.getElementById("remarkText").value = "";
  loadRemarks();
}

/* 🔹 비고 불러오기 */
async function loadRemarks() {
  const craneNo = document.getElementById("craneNo").value.trim();
  if (!craneNo) return;

  const { data, error } = await supabase
    .from("remarks")
    .select("*")
    .eq("crane_no", craneNo)
    .order("created_at", { ascending: false });

  if (error) {
    alert("조회 실패: " + error.message);
    return;
  }

  const list = document.getElementById("remarkList");
  list.innerHTML = "";

  data.forEach(r => {
    const div = document.createElement("div");
    div.style.border = "1px solid #333";
    div.style.padding = "8px";
    div.style.marginBottom = "6px";

    div.innerHTML = `
      <b>${r.crane_no}</b>
      <p>${r.content}</p>
      <small>상태: ${r.status}</small><br/>
      ${r.status === "open"
        ? `<button onclick="resolveRemark('${r.id}')">해결 처리</button>`
        : `<small>해결됨</small>`}
    `;
    list.appendChild(div);
  });
}

/* 🔹 비고 해결 처리 */
async function resolveRemark(id) {
  const { error } = await supabase
    .from("remarks")
    .update({
      status: "resolved",
      resolved_at: new Date()
    })
    .eq("id", id);

  if (error) {
    alert("해결 처리 실패: " + error.message);
    return;
  }

  loadRemarks();
}

// 🔽 HTML에서 접근 가능하게 전역 등록
window.addRemark = addRemark;
window.resolveRemark = resolveRemark;
window.loadRemarks = loadRemarks;

async function loadRemarks(filters = {}) {
  let query = supabase
    .from("remarks")
    .select("*")
    .order("created_at", { ascending: false });

  // 상태 필터
  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  // 크레인 번호 필터
  if (filters.crane_no) {
    query = query.ilike("crane_no", `%${filters.crane_no}%`);
  }

  const { data, error } = await query;
  if (error) {
    alert("리스트 로드 실패: " + error.message);
    return;
  }

  const list = document.getElementById("remarkList");
  list.innerHTML = ""; // ❗ 초기화는 여기서만

  if (data.length === 0) {
    list.innerHTML = "<p>표시할 비고가 없습니다.</p>";
    return;
  }

  data.forEach(r => {
    const d = document.createElement("div");
    d.className = "remark-item";
    d.innerHTML = `
      <b>${r.crane_no}</b>
      <span>(${r.status})</span>
      <div>${r.content}</div>
      ${
        r.status === "open"
          ? `<button onclick="resolveRemark('${r.id}')">해결 처리</button>`
          : ""
      }
    `;
    list.appendChild(d);
  });
}

async function resolveRemark(id) {
  const { error } = await supabase
    .from("remarks")
    .update({ status: "resolved", resolved_at: new Date() })
    .eq("id", id);

  if (error) {
    alert("해결 처리 실패: " + error.message);
    return;
  }

  applyFilters(); // 해결 후 재조회
}

function applyFilters() {
  const status = document.getElementById("filterStatus").value;
  const crane_no = document.getElementById("filterCrane").value.trim();

  loadRemarks({ status, crane_no });
}

// 초기 로드 + 버튼 연결
document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("applyFilterBtn")
    ?.addEventListener("click", applyFilters);

  loadRemarks(); // 처음엔 전체 조회
});

// 전역 등록
window.resolveRemark = resolveRemark;
