// api/push-subscribe.js
// Save Push API subscription for the CURRENT authenticated Supabase user.
// Client sends: { endpoint, p256dh, auth } with Authorization: Bearer <access_token>
// Server validates token -> gets user.id -> upserts into public.push_subscriptions (by endpoint)

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE) {
      return res.status(500).json({ error: "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" });
    }

    const authz = req.headers?.authorization || "";
    const token = authz.startsWith("Bearer ") ? authz.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing access token" });

    // Validate token and get user
    const ures = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SERVICE },
    });

    if (!ures.ok) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const user = await ures.json();

    // Body parsing safety (Vercel usually parses JSON already)
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const endpoint = body.endpoint;
    const p256dh = body.p256dh;
    const kAuth = body.auth;

    if (!endpoint || !p256dh || !kAuth) {
      return res.status(400).json({ error: "Missing subscription fields (endpoint/p256dh/auth)" });
    }

    // Upsert by endpoint
    const upres = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?on_conflict=endpoint`,
      {
        method: "POST",
        headers: {
          apikey: SERVICE,
          Authorization: `Bearer ${SERVICE}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          user_id: user.id,
          endpoint,
          p256dh,
          auth: kAuth,
          is_active: true,
          updated_at: new Date().toISOString(),
        }),
      }
    );

    if (!upres.ok) {
      return res.status(500).json({ error: `DB upsert failed: ${upres.status} ${await upres.text()}` });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
};
