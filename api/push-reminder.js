// /api/push-reminder.js
// Mengirim push reminder harian (disarankan dijadwalkan pukul 16:00 WIB)
// ke semua subscriber aktif (public.push_subscriptions).

const webpush = require("web-push");

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

async function sbPatch(path, body, serviceRoleKey, supabaseUrl) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase PATCH failed: ${res.status} ${await res.text()}`);
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
    const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
    const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return res.status(500).json({
        error: "Missing env vars",
        required: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"],
      });
    }

    webpush.setVapidDetails("mailto:admin@yaumiyyah.local", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const date_wib = getWIBDateString();

    const subs = await sbGet(
      `push_subscriptions?is_active=eq.true&select=id,endpoint,p256dh,auth`,
      SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_URL
    );

    const payload = JSON.stringify({
      title: "Pengingat Yaumiyyah",
      body: `Pukul 16.00 WIB — waktunya input amalan hari ini.\nTanggal: ${date_wib}`,
      url: "/dashboard.html",
    });

    let sent = 0;
    let failed = 0;

    for (const s of subs) {
      const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      try {
        await webpush.sendNotification(subscription, payload);
        sent++;
      } catch (e) {
        failed++;
        const status = e?.statusCode;
        if (status === 404 || status === 410) {
          try {
            await sbPatch(
              `push_subscriptions?id=eq.${s.id}`,
              { is_active: false },
              SUPABASE_SERVICE_ROLE_KEY,
              SUPABASE_URL
            );
          } catch (_) {}
        }
      }
    }

    return res.status(200).json({ ok: true, date_wib, type: "reminder_16wib", subscribers: subs.length, sent, failed });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
};
