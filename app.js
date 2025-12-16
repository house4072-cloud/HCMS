// ===== Supabase 초기화 (TEST) =====
const SUPABASE_URL = "https://lzfksuiftgmxwkhwhnhg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6ZmtzdWlmdGdteHdraHdobmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NzczMDMsImV4cCI6MjA4MTM1MzMwM30.BHI8dTc18Jw3akhlRL7OZ8_0sYQwjb0-QaMGjKjUfYA";

const sb = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

console.log("HCMS app loaded");
