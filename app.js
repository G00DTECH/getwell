/* ============================================================
   Get-Well site: the collaborative tile wall
   Each person paints (or uploads) a 400x400 tile that joins a
   growing mosaic. Works in preview mode without Supabase, and
   goes fully live once config.js has your keys.
   ============================================================ */

(function initWall() {
  const cfg = window.GETWELL_CONFIG || {};
  const configured =
    cfg.SUPABASE_URL &&
    !cfg.SUPABASE_URL.includes("YOUR-PROJECT") &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_ANON_KEY.includes("YOUR-ANON");

  const TILE = 400;

  // ---- elements ----
  const canvas = document.getElementById("paint");
  const ctx = canvas.getContext("2d");
  const nameEl = document.getElementById("tile-name");
  const msgEl = document.getElementById("tile-message");
  const submitBtn = document.getElementById("tile-submit");
  const statusEl = document.getElementById("tile-status");
  const swatchesEl = document.getElementById("swatches");
  const colorEl = document.getElementById("color");
  const sizeEl = document.getElementById("size");
  const eraserBtn = document.getElementById("eraser");
  const clearBtn = document.getElementById("clear");
  const undoBtn = document.getElementById("undo");
  const uploadEl = document.getElementById("upload");
  const mosaic = document.getElementById("mosaic");
  const zoomEl = document.getElementById("zoom");
  const overviewBtn = document.getElementById("overview");
  const countEl = document.getElementById("mosaic-count");
  let empty = document.getElementById("wall-empty");

  // ---- helpers ----
  function setStatus(t, kind) {
    statusEl.textContent = t;
    statusEl.className = "wish-status" + (kind ? " " + kind : "");
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  // ---- canvas / painting ----
  function resetCanvas() {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, TILE, TILE);
  }
  resetCanvas();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // ---- undo history (snapshot before each change, revert on undo) ----
  const history = [];
  const HISTORY_MAX = 30;
  function snapshot() {
    try {
      history.push(ctx.getImageData(0, 0, TILE, TILE));
      if (history.length > HISTORY_MAX) history.shift();
    } catch (e) { /* getImageData can fail if tainted; ignore */ }
    undoBtn.disabled = history.length === 0;
  }
  function undo() {
    if (!history.length) return;
    ctx.putImageData(history.pop(), 0, 0);
    pendingGif = null;
    undoBtn.disabled = history.length === 0;
  }
  function clearHistory() { history.length = 0; undoBtn.disabled = true; }
  undoBtn.addEventListener("click", undo);
  document.addEventListener("keydown", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return; // don't hijack text undo
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
  });

  let color = colorEl.value;
  let brush = Number(sizeEl.value);
  let erasing = false;
  let drawing = false;
  let last = null;

  // If the user uploads a GIF, we keep the original file and post it as-is so it
  // stays animated (the canvas only holds a still preview frame). Painting/clearing
  // cancels it and falls back to the canvas PNG.
  let pendingGif = null;
  const MAX_GIF_BYTES = 5 * 1024 * 1024;

  const palette = ["#2c2724", "#ffffff", "#e63946", "#e8a34a", "#f4d35e",
    "#3d7a5a", "#4d8fbf", "#8a4d78", "#c9682c", "#ec9ec4"];
  palette.forEach((c, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch" + (c === color ? " active" : "");
    b.style.background = c;
    b.title = c;
    b.addEventListener("click", () => {
      color = c; colorEl.value = c; erasing = false;
      eraserBtn.classList.remove("active");
      swatchesEl.querySelectorAll(".swatch").forEach((s) => s.classList.remove("active"));
      b.classList.add("active");
    });
    swatchesEl.appendChild(b);
  });

  colorEl.addEventListener("input", () => {
    color = colorEl.value; erasing = false;
    eraserBtn.classList.remove("active");
    swatchesEl.querySelectorAll(".swatch").forEach((s) => s.classList.remove("active"));
  });
  sizeEl.addEventListener("input", () => (brush = Number(sizeEl.value)));
  eraserBtn.addEventListener("click", () => {
    erasing = !erasing;
    eraserBtn.classList.toggle("active", erasing);
  });
  clearBtn.addEventListener("click", () => { snapshot(); resetCanvas(); pendingGif = null; });

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (TILE / r.width),
      y: (e.clientY - r.top) * (TILE / r.height),
    };
  }
  function paintDot(p) {
    ctx.fillStyle = erasing ? "#ffffff" : color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, brush / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  function paintLine(a, b) {
    ctx.strokeStyle = erasing ? "#ffffff" : color;
    ctx.lineWidth = brush;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  canvas.addEventListener("pointerdown", (e) => {
    snapshot(); // save state before this stroke so Undo can revert it
    pendingGif = null; // painting over a GIF means post the drawing instead
    drawing = true;
    last = pos(e);
    paintDot(last);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const p = pos(e);
    paintLine(last, p);
    last = p;
  });
  const stop = () => (drawing = false);
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);

  // ---- upload a photo into the tile (cover-fit) ----
  uploadEl.addEventListener("change", () => {
    const f = uploadEl.files && uploadEl.files[0];
    if (!f) return;
    const isGif = f.type === "image/gif";
    if (isGif && f.size > MAX_GIF_BYTES) {
      setStatus("That GIF is over 5 MB. Please pick a smaller one.", "error");
      uploadEl.value = "";
      return;
    }
    const img = new Image();
    img.onload = () => {
      snapshot(); // let Undo revert an accidental upload
      resetCanvas();
      const scale = Math.max(TILE / img.width, TILE / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (TILE - w) / 2, (TILE - h) / 2, w, h);
      URL.revokeObjectURL(img.src);
      if (isGif) {
        pendingGif = f; // post the animated original; canvas shows a still preview
        setStatus("GIF added. It'll animate on the wall. Add a name, then post it.", "");
      } else {
        pendingGif = null;
        setStatus("Photo added to your tile. Add a name, then post it!", "");
      }
    };
    img.onerror = () => setStatus("Couldn't read that image. Please try another.", "error");
    img.src = URL.createObjectURL(f);
    uploadEl.value = "";
  });

  // ---- full-wall zoom controls ----
  zoomEl.addEventListener("input", () => {
    mosaic.style.setProperty("--tile-min", zoomEl.value + "px");
    overviewBtn.classList.toggle("active", Number(zoomEl.value) <= 60);
  });
  overviewBtn.addEventListener("click", () => {
    const on = !overviewBtn.classList.contains("active");
    const v = on ? 40 : 120;
    zoomEl.value = v;
    mosaic.style.setProperty("--tile-min", v + "px");
    overviewBtn.classList.toggle("active", on);
  });

  // ---- live tile count ----
  let tileCount = 0;
  function updateCount(delta) {
    tileCount = Math.max(0, tileCount + delta);
    countEl.textContent = tileCount ? tileCount + (tileCount === 1 ? " tile" : " tiles") : "";
  }

  // ---- rendering tiles ----
  function renderTile(t, prepend) {
    if (empty) { empty.remove(); empty = null; }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tile";

    const img = document.createElement("img");
    img.loading = "lazy";
    img.alt = "Tile by " + t.name;
    // If the image is missing (e.g. deleted from Storage), drop the whole tile
    // instead of showing a blank card.
    img.addEventListener("error", () => { btn.remove(); updateCount(-1); });
    img.src = t.image_url;
    updateCount(1);

    const label = document.createElement("span");
    label.className = "tile-name";
    label.textContent = t.name;

    btn.append(img, label);
    btn.addEventListener("click", () => openLightbox(t));
    if (prepend && mosaic.firstChild) mosaic.insertBefore(btn, mosaic.firstChild);
    else mosaic.appendChild(btn);
  }

  // ---- lightbox ----
  const lb = document.getElementById("lightbox");
  const lbImg = document.getElementById("lightbox-img");
  const lbFrom = document.getElementById("lightbox-from");
  const lbMsg = document.getElementById("lightbox-msg");
  const lbClose = document.getElementById("lightbox-close");
  function openLightbox(t) {
    lbImg.src = t.image_url;
    lbFrom.textContent = "— " + t.name;
    lbMsg.textContent = t.message || "";
    lb.hidden = false;
  }
  function closeLightbox() { lb.hidden = true; lbImg.src = ""; }
  lbClose.addEventListener("click", closeLightbox);
  lb.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeLightbox(); });

  // ---- validate + get blob/dataURL from the canvas ----
  function validate() {
    const name = nameEl.value.trim();
    if (!name) { setStatus("Please add your name first.", "error"); nameEl.focus(); return null; }
    return { name, message: msgEl.value.trim() };
  }
  function resetCreator() {
    resetCanvas();
    clearHistory();
    pendingGif = null;
    nameEl.value = "";
    msgEl.value = "";
  }

  /* ============ PREVIEW MODE (no Supabase yet) ============ */
  if (!configured) {
    setStatus("Preview mode. Add your Supabase keys in config.js so everyone's tiles are saved and shared (see README).", "");
    const demo = JSON.parse(localStorage.getItem("getwell_tiles") || "[]");
    if (!demo.length && empty) empty.textContent = "No tiles yet. Be the first to add one!";
    demo.forEach((t) => renderTile(t));

    submitBtn.addEventListener("click", () => {
      const v = validate();
      if (!v) return;
      const image_url = pendingGif ? URL.createObjectURL(pendingGif) : canvas.toDataURL("image/png");
      const t = { name: v.name, message: v.message, image_url, created_at: new Date().toISOString() };
      demo.unshift(t);
      try { localStorage.setItem("getwell_tiles", JSON.stringify(demo)); }
      catch (e) { /* localStorage full in preview — ignore */ }
      renderTile(t, true);
      resetCreator();
      setStatus("Added (preview only). Connect Supabase to share it for real.", "success");
    });
    return;
  }

  /* ============ LIVE MODE (Supabase) ============ */
  const supa = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  const seen = new Set();

  async function loadTiles() {
    const { data, error } = await supa
      .from("tiles")
      .select("id, name, message, image_url, created_at")
      .order("created_at", { ascending: false });
    if (error) { if (empty) empty.textContent = "Couldn't load the wall right now."; console.error(error); return; }
    if (!data.length && empty) { empty.textContent = "No tiles yet. Be the first to add one!"; return; }
    data.forEach((t) => { seen.add(t.id); renderTile(t); });
  }

  function toBlob() {
    return new Promise((res) => canvas.toBlob(res, "image/png"));
  }

  submitBtn.addEventListener("click", async () => {
    const v = validate();
    if (!v) return;
    submitBtn.disabled = true;
    setStatus("Adding your tile…", "");
    try {
      // GIF: upload the original animated file. Otherwise: flatten the canvas to PNG.
      const blob = pendingGif || await toBlob();
      const ext = pendingGif ? "gif" : "png";
      const type = pendingGif ? "image/gif" : "image/png";
      const id = crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2);
      const fileName = id + "." + ext;
      const up = await supa.storage.from("tiles").upload(fileName, blob, { contentType: type, upsert: false });
      if (up.error) throw up.error;
      const { data: pub } = supa.storage.from("tiles").getPublicUrl(fileName);
      const ins = await supa.from("tiles").insert({ name: v.name, message: v.message, image_url: pub.publicUrl }).select("id").single();
      if (ins.error) throw ins.error;
      seen.add(ins.data.id);
      renderTile({ name: v.name, message: v.message, image_url: pub.publicUrl }, true);
      resetCreator();
      setStatus("Your tile is on the wall!", "success");
    } catch (err) {
      console.error(err);
      setStatus("Something went wrong adding your tile. Please try again.", "error");
    } finally {
      submitBtn.disabled = false;
    }
  });

  // live: other people's tiles appear without a refresh
  supa
    .channel("tiles-live")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "tiles" }, (payload) => {
      if (seen.has(payload.new.id)) return;
      seen.add(payload.new.id);
      renderTile(payload.new, true);
    })
    .subscribe();

  loadTiles();
})();
