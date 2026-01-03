// /api/push-now.js
// Manual trigger: redirect ke push-daily agar kirim konten hari ini. Supabase-only (mengandalkan push-daily.js).

module.exports = async (req, res) => {
  const cronKey = process.env.PUSH_CRON_KEY;
  if (cronKey) {
    const got = req.query?.key;
    if (got !== cronKey) return res.status(401).json({ error: "Unauthorized" });
  }

  return res.writeHead(302, { Location: `/api/push-daily?key=${encodeURIComponent(req.query.key || "")}` }).end();
};
