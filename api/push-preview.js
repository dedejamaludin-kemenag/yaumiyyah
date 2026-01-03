// /api/push-preview.js
// Supabase-only preview: menampilkan konten hari ini (WIB) dari tabel daily_content, tanpa mengirim notifikasi.

function getWIBDateString(d = new Date()) {
  const wibMs = d.getTime() + 7 * 60 * 60 * 1000;
  const wib = new Date(wibMs);
  const y = wib.getUTCFullYear();
  const m = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const day = String(wib.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function sbGet(path, serviceRoleKey, supabaseUrl) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Supabase GET failed: ${res.status} ${await res.text()}`);
  return res.json();
}

module.exports = async (req, res) => {
  try {
    const cronKey = process.env.PUSH_CRON_KEY;
    if (cronKey) {
      const got = req.query?.key;
      if (got !== cronKey) return res.status(401).json({ error: "Unauthorized" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" });
    }

    const date_wib = getWIBDateString();
    const rows = await sbGet(
      `daily_content?content_date=eq.${date_wib}&select=content_date,kind,title,body,source,url`,
      SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_URL
    );
    const row = rows?.[0];

    if (!row) {
      return res.status(200).json({ ok: true, date_wib, found: false, message: "Tidak ada konten untuk hari ini di tabel daily_content." });
    }

    const sourceLine = row.source ? `(${row.source})` : "(Sumber tidak tersedia)";

    return res.status(200).json({
      ok: true,
      date_wib,
      found: true,
      kind: row.kind,
      title: row.title,
      body: row.body,
      source: row.source,
      url: row.url || "/rekap.html",
      push_payload: { title: row.title, body: `${row.body}\n${sourceLine}`, url: row.url || "/rekap.html" },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
};
