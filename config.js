// config.js (Supabase Auth-ready, idempotent)
(function () {
  // Supabase public (anon) key is safe in frontend; NEVER use service_role key here.
  window.SUPABASE_URL = window.SUPABASE_URL || 'https://iinprkhxulmpioqakdte.supabase.co';
  window.SUPABASE_KEY = window.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpbnBya2h4dWxtcGlvcWFrZHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NTkyNzAsImV4cCI6MjA4MjIzNTI3MH0.nVXeKEE5kiWV_Uvmd-H-5pTk48MLm981Njdmujtsq28';

  // Create client once
  if (!window.db) {
    const { createClient } = supabase;
    window.db = createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
  }

  // ===== Auth helpers =====
  window.requireAuth = async function requireAuth(redirectTo = 'index.html') {
    const { data: { session } } = await db.auth.getSession();
    if (!session) {
      window.location.href = redirectTo;
      return null;
    }
    return session.user; // { id, email, ... }
  };

  window.redirectIfAuthed = async function redirectIfAuthed(to = 'dashboard.html') {
    const { data: { session } } = await db.auth.getSession();
    if (session) window.location.href = to;
  };

  // Derive base URL folder (works on GitHub Pages subfolder)
  function baseFolderUrl() {
    const u = new URL(window.location.href);
    u.hash = '';
    u.search = '';
    u.pathname = u.pathname.replace(/[^/]*$/, '');
    return u.toString();
  }

  window.signUpEmail = async function signUpEmail(email, password) {
    const { data, error } = await db.auth.signUp({
      email: email,
      password: password,
      options: {
        emailRedirectTo: baseFolderUrl() + 'dashboard.html'
      }
    });
    if (error) throw error;
    return data;
  };

  window.signInEmail = async function signInEmail(email, password) {
    const { data, error } = await db.auth.signInWithPassword({ email: email, password: password });
    if (error) throw error;
    return data;
  };

  window.signOut = async function signOut() {
    await db.auth.signOut();
    window.location.href = 'index.html';
  };

  // Backward-compatible alias (old code calls logout())
  window.logout = window.signOut;

  // ===== Utility =====
  window.getIndoDate = function getIndoDate() {
    const d = new Date();
    return d.toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  };
  // ===== Push subscription upsert (AUTH SAFE) =====
  // Stores subscription via server endpoint /api/push-subscribe (uses SERVICE_ROLE on server),
  // so it works even with RLS and always attaches to the authenticated user.
  window.upsertPushSubscription = async function upsertPushSubscription(userId, sub) {
    try {
      if (!sub) return;

      // get access token
      const { data: { session } } = await window.db.auth.getSession();
      const token = session && session.access_token ? session.access_token : null;
      const uid = session && session.user && session.user.id ? session.user.id : userId;

      if (!token || !uid) return;

      // normalize subscription object (supports PushSubscription or JSON from toJSON())
      const endpoint = sub.endpoint;
      const keys = sub.keys || (sub.subscription && sub.subscription.keys) || {};
      const p256dh = keys.p256dh || null;
      const auth = keys.auth || null;

      if (!endpoint || !p256dh || !auth) return;

      const resp = await fetch("/api/push-subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ endpoint, p256dh, auth }),
      });

      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`push-subscribe failed: ${resp.status} ${t}`);
      }
    } catch (e) {
      console.warn("upsertPushSubscription failed:", e);
      throw e;
    }
  };
  // ===== Legacy overrides (optional) =====
  window.applyYaumiyyahOverrides = function applyYaumiyyahOverrides(items) {
    // Back-compat alias (old app name)
    window.applyYaumiyahOverrides = window.applyYaumiyahOverrides || window.applyYaumiyyahOverrides;
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const OV = {
      jamaah: { display_name: 'Shalat Jamaah', display_note: 'Min 5 kali', target_min: 5, input_type: 'number' },
      shalatjamaah: { display_name: 'Shalat Jamaah', display_note: 'Min 5 kali', target_min: 5, input_type: 'number' },
      sholatjamaah: { display_name: 'Shalat Jamaah', display_note: 'Min 5 kali', target_min: 5, input_type: 'number' },

      dzikirbadashalat: { display_name: "Dzikir Ba'da Shalat", display_note: 'Min 5 kali', target_min: 5, input_type: 'number' },
      dzikirbadasalat: { display_name: "Dzikir Ba'da Shalat", display_note: 'Min 5 kali', target_min: 5, input_type: 'number' },

      rawatib: { display_name: 'Shalat Rawatib', display_note: 'Min 6 rakaat', target_min: 6, input_type: 'number' },
      shalatrawatib: { display_name: 'Shalat Rawatib', display_note: 'Min 6 rakaat', target_min: 6, input_type: 'number' },
      sholatrawatib: { display_name: 'Shalat Rawatib', display_note: 'Min 6 rakaat', target_min: 6, input_type: 'number' },

      tahajjud: { display_name: 'Tahajjud', display_note: 'Min 2 rakaat', target_min: 2, input_type: 'number' },
      dhuha: { display_name: 'Dhuha', display_note: 'Min 2 rakaat', target_min: 2, input_type: 'number' },
      tilawah: { display_name: 'Tilawah', display_note: 'Min 1 juz', target_min: 1, input_type: 'number' },

      matsurat: { display_name: "Ma'tsurat", display_note: 'Min 1x', target_min: 1, input_type: 'number' },
      matsurot: { display_name: "Ma'tsurat", display_note: 'Min 1x', target_min: 1, input_type: 'number' },

      puasa: { display_name: 'Puasa', display_note: 'Min 1 kali/pekan', target_min: 1, input_type: 'bool', calc_mode: 'weekly' },
      olahraga: { display_name: 'Olahraga', display_note: 'Min 1 kali/pekan', target_min: 1, input_type: 'bool', calc_mode: 'weekly' },
    };

    (items || []).forEach((it) => {
      const k = norm(it.code);
      const o = OV[k];
      if (o) {
        if (o.display_name) it.display_name = o.display_name;
        if (o.display_note) it.display_note = o.display_note;
        it.target_min = o.target_min;
        it.input_type = o.input_type;
        if (o.calc_mode) it.calc_mode = o.calc_mode;
      } else {
        if (it.input_type === 'bool' && !it.display_note) it.display_note = 'Ya/Tidak';
      }
    });

    return items;
  };

  // Web Push (Public VAPID Key)
  window.APP_PUSH_PUBLIC_VAPID_KEY = window.APP_PUSH_PUBLIC_VAPID_KEY || "BAZKvBchATdERoL2vbim4a_QQvLGSYQhj9tYXoR5GpIbeZs2zs5kU5PP0UDQnHbzo58JJrToS_GdEyZKE7AhJ8w";
  window.PUBLIC_VAPID_KEY = window.PUBLIC_VAPID_KEY || window.APP_PUSH_PUBLIC_VAPID_KEY;
})();


// Auto logout jika aplikasi ditinggalkan (tab/app background) lebih dari N menit
// Panggil ini hanya di halaman yang butuh login (dashboard/rekap/stats)
function initAutoLogout(options = {}) {
  const minutes = Number(options.minutes ?? 5);
  const redirect = options.redirect ?? 'index.html';
  const key = 'yaumiyyah_hidden_at';
  const legacyKey = 'yaumiyah_hidden_at';
  const limitMs = minutes * 60 * 1000;

  async function doLogout() {
    try { await signOut(); } catch (e) {}
    try { window.location.href = redirect; } catch (e) {}
  }

  function markHidden() {
    try { localStorage.setItem(key, String(Date.now()));
      try { localStorage.setItem(legacyKey, String(Date.now())); } catch (e) {} } catch (e) {}
  }

  async function check() {
    let t = 0;
    try { t = Number(localStorage.getItem(key) || 0); } catch (e) {}
    if (t && (Date.now() - t > limitMs)) {
      try { localStorage.removeItem(key); } catch (e) {}
      await doLogout();
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) markHidden();
    else check();
  });

  window.addEventListener('focus', () => check());
  window.addEventListener('pageshow', () => check());
}
