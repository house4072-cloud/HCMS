console.log("HCMS app loaded");

/* 🔧 Supabase 설정 */
const SUPABASE_URL = "https://lzfksuiftgmxwkhwhnhg.supabase.co";
const SUPABASE_KEY = "sb_publishable_uVUl0jrv8XbQacZaAQ7WZA_NMHyIuqA";

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
