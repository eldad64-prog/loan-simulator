(() => {
  const SUPABASE_URL = "https://ayqzwlvgxupbxhvrnrke.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_nNJXeUG4WyMpSXZEIKFDA_B_nY1gew";
  const DATA_KEY = "loan_portfolios_v3";
  const TABLE = "loan_portfolios";
  const BACKUP_TABLE = "loan_portfolio_backups";
  const SITE_URL = "https://eldad64-prog.github.io/loan-simulator/";

  let client = null;
  let syncing = false;
  let lastLocal = null;
  let debounceTimer = null;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const getLocalRaw = () => localStorage.getItem(DATA_KEY);
  const parseLocal = () => {
    try { return JSON.parse(getLocalRaw() || "null"); } catch { return null; }
  };
  const localIsEmpty = data => !data || !Array.isArray(data.agents) ||
    (data.agents.length === 0) ||
    (data.agents.length === 1 && data.agents[0] &&
      data.agents[0].name === "סוכן 1" &&
      Array.isArray(data.agents[0].clients) &&
      data.agents[0].clients.length === 0);

  const hash = value => {
    const s = typeof value === "string" ? value : JSON.stringify(value || null);
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  };

  function setStatus(text, mode="idle") {
    const el = document.getElementById("cloudStatus");
    if (!el) return;
    el.textContent = text;
    el.dataset.mode = mode;
    const colors = {
      idle: "#697386", ok: "#087344", warn: "#85530a",
      error: "#b42332", busy: "#1748a4"
    };
    el.style.color = colors[mode] || colors.idle;
  }

  function addStyles() {
    if (document.getElementById("cloudSyncStyles")) return;
    const style = document.createElement("style");
    style.id = "cloudSyncStyles";
    style.textContent = `
      #cloudSyncBar{position:fixed;left:12px;bottom:12px;z-index:4800;display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.96);border:1px solid #dbe2ec;border-radius:14px;padding:7px 9px;box-shadow:0 10px 30px rgba(20,30,50,.16);direction:rtl;font-family:Arial,sans-serif}
      #cloudStatus{font-size:12px;font-weight:800;white-space:nowrap}
      #cloudSyncBtn{min-height:36px;padding:7px 10px;border-radius:10px;background:#eaf1ff;color:#1748a4;font-weight:800;border:1px solid #cbdcff}
      #cloudSyncModal{display:none;position:fixed;inset:0;background:rgba(12,18,30,.62);z-index:6000;padding:16px;align-items:center;justify-content:center;direction:rtl;font-family:Arial,sans-serif}
      #cloudSyncModal .box{width:min(520px,100%);background:#fff;border-radius:22px;padding:22px;box-shadow:0 24px 80px #0005}
      #cloudSyncModal h2{margin:0 0 8px;font-size:23px}
      #cloudSyncModal p{color:#697386;line-height:1.55;margin:7px 0 14px}
      #cloudSyncModal input{width:100%;min-height:50px;border:1px solid #d7dce5;border-radius:12px;padding:0 13px;margin-bottom:10px;box-sizing:border-box}
      #cloudSyncModal .row{display:flex;gap:8px;flex-wrap:wrap}
      #cloudSyncModal button{min-height:45px;border:0;border-radius:11px;padding:9px 14px;font-weight:800;cursor:pointer}
      #cloudSyncModal .primary{background:#2563eb;color:#fff}
      #cloudSyncModal .soft{background:#eaf1ff;color:#1748a4}
      #cloudSyncModal .light{background:#f2f4f7;color:#303846}
      #cloudSyncModal .danger{background:#fff0f1;color:#b42332}
      #cloudSyncModal .notice{border-radius:12px;padding:10px 12px;margin:10px 0;font-size:13px;line-height:1.5}
      #cloudSyncModal .notice.warn{background:#fff7e8;border:1px solid #f6dfae;color:#85530a}
      #cloudSyncModal .notice.ok{background:#e8f8f0;border:1px solid #c5ecd7;color:#12653f}
      @media(max-width:480px){#cloudSyncBar{left:8px;bottom:8px}#cloudStatus{max-width:145px;overflow:hidden;text-overflow:ellipsis}}
    `;
    document.head.appendChild(style);
  }

  function addUI() {
    if (document.getElementById("cloudSyncBar")) return;
    addStyles();

    const bar = document.createElement("div");
    bar.id = "cloudSyncBar";
    bar.innerHTML = '<span id="cloudStatus">☁️ ענן: לא מחובר</span><button id="cloudSyncBtn" type="button">חיבור לענן</button>';
    document.body.appendChild(bar);

    const modal = document.createElement("div");
    modal.id = "cloudSyncModal";
    modal.innerHTML = `
      <div class="box">
        <h2 id="cloudModalTitle">☁️ שמירה מרכזית בענן</h2>
        <p id="cloudModalText">התחבר עם כתובת האימייל שלך. לאחר החיבור הנתונים יישמרו ב-Supabase ויהיו זמינים גם במכשיר אחר.</p>
        <div id="cloudAuthArea">
          <input id="cloudEmail" type="email" dir="ltr" autocomplete="email" placeholder="כתובת אימייל">
          <div class="row">
            <button class="primary" id="cloudSendLink">שלח קישור כניסה</button>
            <button class="light" id="cloudClose">ביטול</button>
          </div>
          <div class="notice warn">הקישור יגיע לאימייל. אין צורך לשלוח לי את כתובת האימייל או שום סיסמה.</div>
        </div>
        <div id="cloudConflictArea" style="display:none"></div>
      </div>`;
    document.body.appendChild(modal);

    document.getElementById("cloudSyncBtn").onclick = () => openCloudModal();
    document.getElementById("cloudClose").onclick = closeCloudModal;
    document.getElementById("cloudSendLink").onclick = sendMagicLink;
    modal.addEventListener("click", e => { if (e.target === modal) closeCloudModal(); });
  }

  function openCloudModal() {
    const m = document.getElementById("cloudSyncModal");
    if (!m) return;
    m.style.display = "flex";
    const email = localStorage.getItem("loan_cloud_email") || "";
    const input = document.getElementById("cloudEmail");
    if (input) { input.value = email; setTimeout(() => input.focus(), 50); }
  }

  function closeCloudModal() {
    const m = document.getElementById("cloudSyncModal");
    if (m) m.style.display = "none";
  }

  async function sendMagicLink() {
    if (!client) return;
    const email = document.getElementById("cloudEmail").value.trim();
    if (!email || !email.includes("@")) { alert("יש להזין כתובת אימייל תקינה."); return; }
    localStorage.setItem("loan_cloud_email", email);
    const btn = document.getElementById("cloudSendLink");
    btn.disabled = true;
    btn.textContent = "שולח...";
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: SITE_URL }
    });
    btn.disabled = false;
    btn.textContent = "שלח קישור כניסה";
    if (error) {
      setStatus("☁️ שגיאה בחיבור", "error");
      alert("לא ניתן לשלוח קישור כניסה: " + error.message);
      return;
    }
    document.getElementById("cloudModalText").textContent =
      "נשלח קישור כניסה לאימייל. פתח אותו במכשיר הזה כדי להשלים את החיבור לענן.";
    document.getElementById("cloudAuthArea").innerHTML =
      '<div class="notice ok">✓ הקישור נשלח. לאחר שתלחץ עליו, חזור לאפליקציה.</div><button class="light" id="cloudDone" type="button">סגור</button>';
    document.getElementById("cloudDone").onclick = closeCloudModal;
  }

  async function currentUser() {
    if (!client) return null;
    const { data } = await client.auth.getUser();
    return data?.user || null;
  }

  async function fetchCloudRow(table, userId) {
    const { data, error } = await client.from(table).select("owner_id,data,version,updated_at")
      .eq("owner_id", userId).maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function writeCloud(data) {
    const user = await currentUser();
    if (!user) return false;
    const raw = JSON.stringify(data);
    const now = new Date().toISOString();

    const existing = await fetchCloudRow(TABLE, user.id);
    const version = Number(existing?.version || 0) + 1;

    const main = { owner_id:user.id, data, version, updated_at:now };
    const backup = { owner_id:user.id, data, version, updated_at:now };

    const a = await client.from(TABLE).upsert(main, { onConflict:"owner_id" });
    if (a.error) throw a.error;
    const b = await client.from(BACKUP_TABLE).upsert(backup, { onConflict:"owner_id" });
    if (b.error) throw b.error;

    lastLocal = hash(raw);
    setStatus("☁️ נשמר בענן", "ok");
    return true;
  }

  async function pullCloud(row) {
    if (!row?.data) return false;
    localStorage.setItem(DATA_KEY, JSON.stringify(row.data));
    lastLocal = hash(JSON.stringify(row.data));
    setStatus("☁️ הנתונים נטענו מהענן", "ok");
    setTimeout(() => location.reload(), 250);
    return true;
  }

  async function initialSync() {
    const user = await currentUser();
    if (!user) {
      setStatus("☁️ לא מחובר", "idle");
      return;
    }
    setStatus("☁️ בודק נתונים...", "busy");

    const cloud = await fetchCloudRow(TABLE, user.id);
    const local = parseLocal();

    if (!cloud) {
      if (localIsEmpty(local)) {
        await writeCloud(local || {agents:[],nextAgent:1,nextClient:1,nextRepayment:1});
        return;
      }
      const ok = confirm("לא נמצאו עדיין נתונים בענן, אבל קיימים נתונים במכשיר הזה. להעלות עכשיו את הנתונים לענן?");
      if (ok) await writeCloud(local);
      else setStatus("☁️ מחובר — ממתין לסנכרון", "warn");
      return;
    }

    if (localIsEmpty(local)) {
      await pullCloud(cloud);
      return;
    }

    const same = hash(JSON.stringify(local)) === hash(JSON.stringify(cloud.data));
    if (same) {
      lastLocal = hash(JSON.stringify(local));
      setStatus("☁️ מסונכרן", "ok");
      return;
    }

    openConflict(cloud);
  }

  function openConflict(cloud) {
    const area = document.getElementById("cloudConflictArea");
    const auth = document.getElementById("cloudAuthArea");
    if (!area || !auth) return;
    auth.style.display = "none";
    area.style.display = "block";
    document.getElementById("cloudModalTitle").textContent = "☁️ נמצאו שני עותקים";
    document.getElementById("cloudModalText").textContent =
      "יש נתונים שונים במכשיר ובענן. כדי שלא נאבד מידע, לא נדרוס אף עותק אוטומטית.";
    area.innerHTML = `
      <div class="notice warn">בחר מאיפה לשמור את הנתונים. הבחירה תשמש רק עכשיו למיזוג הראשוני.</div>
      <div class="row">
        <button class="primary" id="useCloud">☁️ השתמש בנתוני הענן</button>
        <button class="soft" id="useDevice">📱 העלה את נתוני המכשיר לענן</button>
        <button class="light" id="confCancel">ביטול</button>
      </div>`;
    document.getElementById("useCloud").onclick = async () => {
      closeCloudModal();
      await pullCloud(cloud);
    };
    document.getElementById("useDevice").onclick = async () => {
      closeCloudModal();
      try { await writeCloud(parseLocal()); } catch(e) { setStatus("☁️ שגיאת שמירה", "error"); alert("שמירת הנתונים נכשלה: " + e.message); }
    };
    document.getElementById("confCancel").onclick = closeCloudModal;
    document.getElementById("cloudSyncModal").style.display = "flex";
  }

  async function scheduleSync() {
    if (syncing) return;
    if (!client) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const user = await currentUser();
      if (!user) return;
      const raw = getLocalRaw();
      if (!raw || hash(raw) === lastLocal) return;
      try {
        syncing = true;
        setStatus("☁️ שומר...", "busy");
        const data = JSON.parse(raw);
        await writeCloud(data);
      } catch (e) {
        setStatus("☁️ ממתין לחיבור", "warn");
      } finally {
        syncing = false;
      }
    }, 900);
  }

  function startWatcher() {
    lastLocal = hash(getLocalRaw() || "");
    setInterval(() => {
      const raw = getLocalRaw();
      const h = hash(raw || "");
      if (h !== lastLocal) scheduleSync();
    }, 1500);
    window.addEventListener("online", scheduleSync);
    window.addEventListener("beforeunload", () => {
      if (!client) return;
      const raw = getLocalRaw();
      if (raw && hash(raw) !== lastLocal) {
        navigator.sendBeacon?.("", "");
      }
    });
  }

  async function boot() {
    addUI();
    if (!window.supabase?.createClient) {
      setStatus("☁️ ספריית ענן לא נטענה", "error");
      return;
    }

    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
    });
    window.loanCloud = { client, syncNow: scheduleSync };

    client.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setStatus("☁️ מחובר", "busy");
        closeCloudModal();
        try { await initialSync(); } catch (e) {
          setStatus("☁️ שגיאת ענן", "error");
          console.error("Cloud sync error:", e);
        }
      } else if (event === "SIGNED_OUT") {
        setStatus("☁️ לא מחובר", "idle");
      }
    });

    const { data } = await client.auth.getSession();
    if (data?.session?.user) {
      try { await initialSync(); } catch (e) {
        setStatus("☁️ שגיאת ענן", "error");
        console.error("Cloud sync error:", e);
      }
    } else {
      setStatus("☁️ לא מחובר", "idle");
    }
    startWatcher();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 200));
  } else {
    setTimeout(boot, 200);
  }
})();