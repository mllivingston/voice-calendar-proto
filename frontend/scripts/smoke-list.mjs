const url = process.env.SMOKE_URL || "http://localhost:3000/api/calendar/list";
try {
  const res = await fetch(url, { headers: {} });
  const ok = res.ok;
  const data = await res.json().catch(() => ({}));
  if (!ok) {
    console.error("smoke-list failed:", res.status, data);
    process.exit(1);
  }
  const arr = Array.isArray(data) ? data : Array.isArray(data?.events) ? data.events : [];
  console.log("smoke-list ok, count:", arr.length);
  process.exit(0);
} catch (e) {
  console.error("smoke-list error:", e?.message || String(e));
  process.exit(1);
}
