/* ============================================================
   Get-Well site logic: progress bar + live wishes wall
   ============================================================ */

/* ---------- Progress bar animation ---------- */
(function initProgress() {
  const el = document.querySelector(".progress");
  if (!el) return;
  const raised = Number(el.dataset.raised || 0);
  const goal = Number(el.dataset.goal || 1);
  const pct = Math.min(100, Math.round((raised / goal) * 100));
  requestAnimationFrame(() => {
    el.querySelector(".progress-fill").style.width = pct + "%";
  });
})();

/* ---------- Supabase wishes wall ---------- */
(function initWishes() {
  const cfg = window.GETWELL_CONFIG || {};
  const configured =
    cfg.SUPABASE_URL &&
    !cfg.SUPABASE_URL.includes("YOUR-PROJECT") &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_ANON_KEY.includes("YOUR-ANON");

  const wall = document.getElementById("wishes-wall");
  const empty = document.getElementById("wall-empty");
  const form = document.getElementById("wish-form");
  const nameEl = document.getElementById("wish-name");
  const msgEl = document.getElementById("wish-message");
  const statusEl = document.getElementById("wish-status");
  const submitBtn = document.getElementById("wish-submit");
  const charNow = document.getElementById("char-now");

  msgEl.addEventListener("input", () => (charNow.textContent = msgEl.value.length));

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = "wish-status" + (kind ? " " + kind : "");
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function timeAgo(iso) {
    const then = new Date(iso).getTime();
    const mins = Math.floor((Date.now() - then) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m ago";
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + "h ago";
    const days = Math.floor(hrs / 24);
    if (days < 30) return days + "d ago";
    return new Date(iso).toLocaleDateString();
  }

  function renderCard(w, prepend) {
    const card = document.createElement("div");
    card.className = "wish-card";
    card.innerHTML =
      '<p class="msg">' + esc(w.message) + "</p>" +
      '<div class="meta"><span class="from">— ' + esc(w.name) + "</span>" +
      '<span class="when">' + timeAgo(w.created_at) + "</span></div>";
    if (empty) empty.remove();
    if (prepend && wall.firstChild) wall.insertBefore(card, wall.firstChild);
    else wall.appendChild(card);
  }

  /* --- Demo mode: no Supabase yet, keep wishes in the browser so you can preview --- */
  if (!configured) {
    setStatus("⚠︎ Preview mode — add your Supabase keys in config.js to make wishes permanent (see README).", "");
    const demo = JSON.parse(localStorage.getItem("getwell_demo") || "[]");
    if (!demo.length && empty) empty.textContent = "No wishes yet. Be the first to leave one!";
    demo.forEach((w) => renderCard(w));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const w = { name: nameEl.value.trim(), message: msgEl.value.trim(), created_at: new Date().toISOString() };
      if (!w.name || !w.message) return;
      demo.unshift(w);
      localStorage.setItem("getwell_demo", JSON.stringify(demo));
      renderCard(w, true);
      form.reset();
      charNow.textContent = "0";
      setStatus("Saved locally (preview only). Connect Supabase to share it for real.", "success");
    });
    return;
  }

  /* --- Live mode: Supabase --- */
  const supa = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  const seen = new Set(); // dedupe so your own wish doesn't render twice (optimistic + realtime echo)
  const keyOf = (w) => (w.name || "") + "|" + (w.message || "");

  async function loadWishes() {
    const { data, error } = await supa
      .from("wishes")
      .select("name, message, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      if (empty) empty.textContent = "Couldn't load wishes right now.";
      console.error(error);
      return;
    }
    if (!data.length && empty) { empty.textContent = "No wishes yet. Be the first to leave one!"; return; }
    data.forEach((w) => { seen.add(keyOf(w)); renderCard(w); });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = nameEl.value.trim();
    const message = msgEl.value.trim();
    if (!name || !message) return;
    submitBtn.disabled = true;
    setStatus("Posting…", "");
    const { error } = await supa.from("wishes").insert({ name, message });
    submitBtn.disabled = false;
    if (error) {
      setStatus("Something went wrong — please try again.", "error");
      console.error(error);
      return;
    }
    form.reset();
    charNow.textContent = "0";
    setStatus("Thank you! Your wish is on the wall 💛", "success");
    // Show it immediately; mark as seen so the realtime echo won't duplicate it.
    seen.add(keyOf({ name, message }));
    renderCard({ name, message, created_at: new Date().toISOString() }, true);
  });

  // Live updates: new wishes from other people appear without refresh
  supa
    .channel("wishes-live")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "wishes" }, (payload) => {
      const k = keyOf(payload.new);
      if (seen.has(k)) return; // we already rendered this one optimistically
      seen.add(k);
      renderCard(payload.new, true);
    })
    .subscribe();

  loadWishes();
})();
