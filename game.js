// game.js — orchestrates menu → board → studio → shoot → result. Solo, deterministic UI.
import { STR } from "./strings.js";
import { BRIEFS } from "./briefs.js";
import { Studio } from "./studio.js";

const $ = s => document.querySelector(s);
const el = id => document.getElementById(id);

/* ---------------- persistent-ish run state (in-memory; no browser storage) ---------------- */
const state = {
  money: 0,
  rep: 0,
  cleared: 0,            // how many briefs passed (career progress)
  freeMode: false,
  briefIndex: 0,
  shotsTaken: [],        // {url, score, hint}
  hintsUsed: 0,
};

/* ---------------- static text wiring ---------------- */
function fillStatic() {
  el("m_sub").textContent = STR.subtitle;
  el("m_tag").textContent = STR.tagline;
  el("m_new").textContent = STR.newGame;
  el("m_free").textContent = STR.studioFree;
  el("m_how").textContent = STR.howto;
  el("t_shelf").textContent = STR.shelf;
  el("t_lights").textContent = STR.shelf;
  el("t_amb").textContent = "Окруж. свет";
  el("t_bg").textContent = "Тон фона";
  el("t_pow").textContent = STR.power;
  el("t_temp").textContent = STR.temp;
  el("t_feat").textContent = STR.feather;
  el("t_cone").textContent = STR.cone;
  el("t_h").textContent = STR.height;
  el("t_tilt").textContent = STR.tilt;
  el("t_cam").textContent = STR.camera;
  el("t_sh").textContent = STR.shutter;
  el("t_ap").textContent = STR.aperture;
  el("t_fl").textContent = STR.focal;
  el("t_model").textContent = STR.model;
  el("t_poseL").textContent = STR.pose;
  el("t_bodyturn").textContent = STR.bodyTurn;
  el("t_headturn").textContent = STR.headTurn;
  el("lpEmpty").textContent = STR.noLight;
  el("lpTitle").textContent = STR.noLight;
  el("s_back").textContent = "‹ " + STR.backToBoard;
  el("hintBtn").textContent = "💡 " + STR.hint;
  el("b_title").textContent = STR.briefBoard;
  // shelf buttons
  const shelf = [
    ["softbox", "▭", STR.addSoftbox], ["octa", "⬡", STR.addOcta], ["strip", "▯", STR.addStrip],
    ["beauty", "◎", STR.addBeauty], ["reflector", "◗", STR.addReflector], ["bg", "◯", STR.addBg],
  ];
  el("shelf").innerHTML = shelf.map(([k, ic, n]) =>
    `<button class="add" data-add="${k}"><span class="ic">${ic}</span>${n}</button>`).join("");
  // view tabs
  el("vtabs").innerHTML = [["top", STR.viewTop], ["cam", STR.viewCam], ["free", STR.viewFree]]
    .map(([v, n], i) => `<button data-view="${v}" class="${v === 'free' ? 'on' : ''}">${n}</button>`).join("")
    + `<button data-reset title="Сбросить ракурс">⟲</button>`;
  // pose presets
  const poses = [["stand", STR.poseStand], ["contrapposto", STR.poseContrapposto],
    ["handsup", STR.poseHandsUp], ["sit", STR.poseSit], ["profile", STR.poseProfile]];
  el("poseSeg").innerHTML = poses.map(([k, n], i) =>
    `<button data-pose="${k}" class="${i === 0 ? 'on' : ''}">${n}</button>`).join("");
}

/* ---------------- screens ---------------- */
function show(id) {
  ["menu", "board", "studio"].forEach(s => el(s).classList.toggle("hidden", s !== id));
  if (id === "studio") setTimeout(() => studio && studio.resize(), 30);
}

/* ---------------- board ---------------- */
function renderBoard() {
  el("b_rep").innerHTML = STR.reputation + ": <b>" + state.rep + "</b>";
  el("b_money").innerHTML = "<b>" + state.money + "</b> ₪";
  el("b_list").innerHTML = BRIEFS.map((b, i) => {
    const done = i < state.cleared;
    const locked = i > state.cleared;
    const cls = done ? "done" : locked ? "locked" : "";
    const chan = b.channel === "pr" ? STR.pr : STR.agency;
    return `<div class="brief-card ${cls}" data-brief="${i}">
      <span class="chan ${b.channel}">${chan}</span>
      ${done ? `<span class="badge">✓ ${STR.passed}</span>` : ""}
      <h3>${b.title}</h3>
      <div class="who">${b.client}</div>
      <div class="teach">${b.teaches}</div>
      <div class="meta">
        <span>${STR.reqShots}: <b>${b.shots}</b></span>
        <span>${STR.reqMatch}: <b>${Math.round(b.threshold * 100)}%</b></span>
        <span>${STR.fee}: <b>${b.fee} ₪</b></span>
        <span>${STR.reputation}: <b>+${b.rep}</b></span>
      </div>
      ${!locked && !done ? `<button class="btn primary go" data-open="${i}">${STR.enterStudio}</button>` : ""}
      ${done ? `<button class="btn go" data-open="${i}" style="top:auto;bottom:18px;right:18px">${STR.reshoot}</button>` : ""}
    </div>`;
  }).join("");
}

el("b_list").addEventListener("click", e => {
  const open = e.target.closest("[data-open]");
  if (open) enterStudio(+open.dataset.open);
});

/* ---------------- studio session ---------------- */
let studio = null;
let session = null; // {brief, shotsLeft, shots:[]}

function ensureStudio() {
  if (studio) return;
  studio = new Studio(el("c3d"));
  studio.onChange = syncStudioUI;
  bindStudioControls();
  bindViewport();
  // default camera exposure
  studio._applyExposure();
  loop();
}

function enterStudio(briefIdx) {
  ensureStudio();
  state.freeMode = false;
  state.briefIndex = briefIdx;
  const brief = BRIEFS[briefIdx];
  session = { brief, shotsLeft: brief.shots, shots: [] };
  // reset studio
  studio.clearLights();
  studio.pose("stand");
  el("bodyTurn").value = 0; el("headTurn").value = 0;
  studio.bodyTurn(0); studio.headTurn(0);
  studio.setView("cam");
  setActiveViewTab("cam");
  // seed a key softbox so the studio isn't empty
  studio.addLight("softbox");
  el("s_brief").textContent = brief.title;
  el("briefchip").innerHTML = `<div class="t">${STR.brief}</div>${brief.teaches}`;
  el("shootInfo").innerHTML = `${STR.shotsLeft}: <b>${session.shotsLeft}</b> / ${brief.shots}`;
  el("shootBtn").textContent = STR.capture + " (" + session.shotsLeft + ")";
  if(el("mShootL")) el("mShootL").textContent = STR.capture + " " + session.shotsLeft;
  el("mHint").style.display = "";
  if (typeof closeSheet === "function") closeSheet();
  el("vhint").innerHTML = "Тяни <b>источник</b> — он облетает модель 360° · тяни <b>фон</b> — вращай камеру 360° · колесо — зум · конечности манекена тянутся";
  show("studio");
  syncStudioUI();
}

function enterFreeStudio() {
  ensureStudio();
  state.freeMode = true;
  session = null;
  studio.clearLights();
  studio.pose("stand");
  studio.addLight("softbox");
  studio.setView("free");
  setActiveViewTab("free");
  el("s_brief").textContent = STR.studioFree;
  el("briefchip").innerHTML = `<div class="t">${STR.studioFree}</div>Экспериментируй со светом свободно.`;
  el("shootInfo").textContent = STR.studioFree;
  el("shootBtn").textContent = "📸 " + STR.capture;
  el("mShootL").textContent = STR.capture;
  el("mHint").style.display = "none";
  el("hintBtn").classList.add("hidden");
  if (typeof closeSheet === "function") closeSheet();
  show("studio");
  syncStudioUI();
}

/* ---------------- studio UI sync ---------------- */
function fmtFeat(v) { return v < 33 ? "жёстко" : v < 70 ? "средне" : "мягко"; }
function syncStudioUI() {
  if (!studio) return;
  const S = studio;
  // light list
  const list = el("lightList");
  if (!S.lights.length) {
    list.innerHTML = `<div class="empty">Пусто. Добавь источник.</div>`;
  } else {
    list.innerHTML = S.lights.map(L => {
      const col = "#" + kelvinHex(L.kelvin);
      return `<div class="lt ${L.id === S.selId ? 'sel' : ''}" data-id="${L.id}">
        <div class="nm"><span class="sw" style="color:${col};background:${col}"></span>${L.name}</div>
        <div class="mt">${L.cone}° · ${L.kelvin}K · h${(L.h / 100).toFixed(2)}м</div>
        <span class="pw">${L.pw}%</span><span class="del" data-del="${L.id}">✕</span>
      </div>`;
    }).join("");
  }
  // selected light panel
  const L = S.cur();
  if (!L) { el("lpTitle").textContent = STR.noLight; el("lpEmpty").classList.remove("hidden"); el("lpBody").classList.add("hidden"); }
  else {
    el("lpTitle").textContent = L.name;
    el("lpEmpty").classList.add("hidden"); el("lpBody").classList.remove("hidden");
    el("pow").value = L.pw; el("powV").textContent = L.pw + "%";
    el("kelvin").value = L.kelvin; el("kV").textContent = L.kelvin + "K";
    el("feat").value = L.feat; el("featV").textContent = fmtFeat(L.feat);
    el("cone").value = L.cone; el("coneV").textContent = L.cone + "°";
    el("hgt").value = L.h; el("hV").textContent = Math.round(L.h) + " см";
    el("tilt").value = L.tilt; el("tiltV").textContent = L.tilt === 0 ? "авто" : (L.tilt > 0 ? "+" : "") + L.tilt + "°";
    // light axes
    const lp = S.lightPos(L);
    el("lx").value = lp.x; el("lxV").textContent = lp.x.toFixed(2);
    el("ly").value = lp.y; el("lyV").textContent = lp.y.toFixed(2);
    el("lz").value = lp.z; el("lzV").textContent = lp.z.toFixed(2);
    // light colour
    const custom = !!L.hsl;
    el("lcustom").checked = custom;
    el("colBody").classList.toggle("hidden", !custom);
    const hsl = S.lightHSL(L), rgb = S.lightRGB(L);
    el("lh").value = hsl[0]; el("lhV").textContent = hsl[0];
    el("ls").value = hsl[1]; el("lsV").textContent = hsl[1];
    el("ll").value = hsl[2]; el("llV").textContent = hsl[2];
    el("lr").value = rgb[0]; el("lg").value = rgb[1]; el("lb").value = rgb[2];
    el("lswatch").style.background = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  }
  // camera axes
  const cp = S.camPos();
  el("cx").value = cp.x; el("cxV").textContent = cp.x.toFixed(1);
  el("cy").value = cp.y; el("cyV").textContent = cp.y.toFixed(1);
  el("cz").value = cp.z; el("czV").textContent = cp.z.toFixed(1);
  // camera readouts
  el("isoV").textContent = S.cam.iso;
  el("shV").textContent = "1/" + S.cam.shutter;
  el("apV").textContent = "f/" + (S.cam.aperture).toFixed(1);
  el("flV").textContent = S.cam.focal + "mm";
  const ev = S.exposureEV;
  const tag = el("expoTag");
  let cls = "ok", txt = STR.ok;
  if (ev < -0.6) { cls = "under"; txt = STR.under; }
  else if (ev > 0.6) { cls = "over"; txt = STR.over; }
  tag.innerHTML = `<span class="expo ${cls}">${STR.exposure}: ${txt} (${ev >= 0 ? "+" : ""}${ev.toFixed(1)} EV)</span>`;
  // model
  el("btV").textContent = Math.round(S.man.bodyTurnDeg) + "°";
  el("htV").textContent = Math.round(S.man.headTurnDeg) + "°";
  // live match (career)
  if (session) {
    const r = S.scoreAgainst(session.brief.target, session.brief.weights);
    el("s_match").innerHTML = STR.matchScore + ": <b>" + Math.round(r.score * 100) + "%</b>";
  } else el("s_match").textContent = "";
}

function kelvinHex(k) {
  k /= 100; let r, g, b;
  if (k <= 66) { r = 255; g = 99.47 * Math.log(k) - 161.12; } else { r = 329.7 * Math.pow(k - 60, -0.1332); g = 288.12 * Math.pow(k - 60, -0.0755); }
  if (k >= 66) b = 255; else if (k <= 19) b = 0; else b = 138.5 * Math.log(k - 10) - 305.04;
  const cl = v => Math.min(255, Math.max(0, Math.round(v)));
  return [cl(r), cl(g), cl(b)].map(v => v.toString(16).padStart(2, "0")).join("");
}

/* ---------------- controls ---------------- */
function bindStudioControls() {
  el("shelf").addEventListener("click", e => { const b = e.target.closest("[data-add]"); if (b) studio.addLight(b.dataset.add); });
  el("lightList").addEventListener("click", e => {
    const del = e.target.closest("[data-del]"); if (del) { studio.removeLight(+del.dataset.del); return; }
    const it = e.target.closest("[data-id]"); if (it) { studio.selId = +it.dataset.id; syncStudioUI(); }
  });
  const sl = (id, prop) => el(id).addEventListener("input", e => studio.setProp(prop, e.target.value));
  sl("pow", "pw"); sl("kelvin", "kelvin"); sl("feat", "feat"); sl("cone", "cone"); sl("hgt", "h"); sl("tilt", "tilt");
  el("amb").addEventListener("input", e => { studio.setAmbient(+e.target.value); el("ambV").textContent = e.target.value + "%"; });
  el("bgTone").addEventListener("input", e => { studio.setBgTone(+e.target.value); el("bgV").textContent = +e.target.value < 15 ? "тёмный" : +e.target.value < 50 ? "серый" : "светлый"; });
  // camera
  el("iso").addEventListener("input", e => studio.setCam("iso", e.target.value));
  el("shutter").addEventListener("input", e => studio.setCam("shutter", e.target.value));
  el("aperture").addEventListener("input", e => studio.setCam("aperture", +e.target.value / 10));
  el("focal").addEventListener("input", e => studio.setCam("focal", e.target.value));
  // light position by axis
  el("lx").addEventListener("input", e => studio.setLightAxis("x", e.target.value));
  el("ly").addEventListener("input", e => studio.setLightAxis("y", e.target.value));
  el("lz").addEventListener("input", e => studio.setLightAxis("z", e.target.value));
  // light colour
  el("lcustom").addEventListener("change", e => {
    if (e.target.checked) { const h = studio.lightHSL(); studio.setLightHSL(h[0], h[1], h[2]); }
    else studio.clearLightHSL();
    syncStudioUI();
  });
  const hslIn = () => studio.setLightHSL(+el("lh").value, +el("ls").value, +el("ll").value);
  ["lh", "ls", "ll"].forEach(id => el(id).addEventListener("input", () => { el("lcustom").checked = true; hslIn(); }));
  const rgbIn = () => studio.setLightRGB(+el("lr").value, +el("lg").value, +el("lb").value);
  ["lr", "lg", "lb"].forEach(id => el(id).addEventListener("input", () => { el("lcustom").checked = true; rgbIn(); }));
  // camera position by axis
  el("cx").addEventListener("input", e => studio.setCamAxis("x", e.target.value));
  el("cy").addEventListener("input", e => studio.setCamAxis("y", e.target.value));
  el("cz").addEventListener("input", e => studio.setCamAxis("z", e.target.value));
  // pose
  el("poseSeg").addEventListener("click", e => {
    const b = e.target.closest("[data-pose]"); if (!b) return;
    el("poseSeg").querySelectorAll("button").forEach(x => x.classList.remove("on")); b.classList.add("on");
    studio.pose(b.dataset.pose);
    el("bodyTurn").value = Math.round(studio.man.bodyTurnDeg); el("headTurn").value = Math.round(studio.man.headTurnDeg);
  });
  el("bodyTurn").addEventListener("input", e => studio.bodyTurn(+e.target.value));
  el("headTurn").addEventListener("input", e => studio.headTurn(+e.target.value));
  // views
  el("vtabs").addEventListener("click", e => {
    const r = e.target.closest("[data-reset]");
    if (r) { studio.resetView(); return; }
    const b = e.target.closest("[data-view]"); if (!b) return;
    setActiveViewTab(b.dataset.view); studio.setView(b.dataset.view); updateVTag();
  });
  // back
  el("s_back").addEventListener("click", () => { closeSheet(); el("hintBtn").classList.remove("hidden"); show("board"); renderBoard(); });
  // shoot + hint
  el("shootBtn").addEventListener("click", onShoot);
  el("hintBtn").addEventListener("click", onHint);
  // mobile bottom-sheet nav
  bindMobileNav();
}

let openSheet = null;
function closeSheet() {
  if (!openSheet) return;
  document.querySelector(".panel." + openSheet)?.classList.remove("open");
  el("sheetBackdrop").classList.remove("show");
  el("mnav").querySelectorAll("[data-sheet]").forEach(b => b.classList.remove("on"));
  openSheet = null;
}
function toggleSheet(which) {
  if (openSheet === which) { closeSheet(); return; }
  closeSheet();
  const panel = document.querySelector(".panel." + which);
  if (!panel) return;
  panel.classList.add("open");
  el("sheetBackdrop").classList.add("show");
  el("mnav").querySelector(`[data-sheet="${which}"]`)?.classList.add("on");
  openSheet = which;
}
function bindMobileNav() {
  el("mnav").querySelectorAll("[data-sheet]").forEach(b =>
    b.addEventListener("click", () => toggleSheet(b.dataset.sheet)));
  el("sheetBackdrop").addEventListener("click", closeSheet);
  el("mShoot").addEventListener("click", () => { closeSheet(); onShoot(); });
  el("mHint").addEventListener("click", () => { onHint(); });
}

function setActiveViewTab(v) { el("vtabs").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.view === v)); updateVTag(); }
function updateVTag() {
  const m = studio ? studio.viewMode : "free";
  el("vtag").textContent = m === "top" ? STR.plan : m === "cam" ? STR.camFrame : STR.freeView;
}

/* ---------------- viewport interaction ---------------- */
function bindViewport() {
  const c = el("c3d");
  let mode = null, lastX = 0, lastY = 0, limbName = null;
  const down = e => {
    const pe = e.touches ? e.touches[0] : e;
    const hit = studio.pickAt(pe);
    lastX = pe.clientX; lastY = pe.clientY;
    if (hit.type === "limb") { mode = "limb"; limbName = hit.name; }
    else if (hit.type === "light") { mode = "light"; }      // orbit the light around the model
    else if (studio.viewMode === "free" || studio.viewMode === "cam") { mode = "orbit"; }
    syncStudioUI();
    if (e.cancelable) e.preventDefault();
  };
  const move = e => {
    if (!mode) return;
    const pe = e.touches ? e.touches[0] : e;
    const dx = (pe.clientX - lastX) * 0.01, dy = (pe.clientY - lastY) * 0.01;
    if (mode === "light") studio.orbitLight(dx, dy);
    else if (mode === "limb") studio.dragLimbTo(pe, limbName);
    else if (mode === "orbit") studio.orbit(dx, dy);
    lastX = pe.clientX; lastY = pe.clientY;
    if (e.cancelable) e.preventDefault();
  };
  const up = () => { mode = null; limbName = null; };
  c.addEventListener("pointerdown", down);
  c.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  c.addEventListener("touchstart", down, { passive: false });
  c.addEventListener("touchmove", move, { passive: false });
  window.addEventListener("touchend", up);
  c.addEventListener("wheel", e => { studio.wheelHeight(e.deltaY); e.preventDefault(); }, { passive: false });
  window.addEventListener("resize", () => studio && studio.resize());
}

/* ---------------- shooting a roll ---------------- */
function saveImage(url, name) {
  const a = document.createElement("a"); a.href = url; a.download = name || "shotlist-frame.jpg"; a.click();
}

function onShoot() {
  if (!studio) return;
  flashShutter();
  if (state.freeMode) {
    const url = studio.capture();
    showShotResult({ url, free: true });
    return;
  }
  if (!session || session.shotsLeft <= 0) return;
  const r = studio.scoreAgainst(session.brief.target, session.brief.weights);
  const url = studio.capture();
  const shot = { url, score: r.score, hint: r.hint };
  session.shots.push(shot);
  session.shotsLeft--;
  el("shootInfo").innerHTML = `${STR.shotsLeft}: <b>${session.shotsLeft}</b> / ${session.brief.shots}`;
  el("shootBtn").textContent = STR.capture + " (" + session.shotsLeft + ")";
  if (el("mShootL")) el("mShootL").textContent = STR.capture + " " + session.shotsLeft;
  setTimeout(() => showShotResult({ shot }), 180);
}

// show the just-taken frame with Save / Submit options
function showShotResult({ url, shot, free }) {
  if (free) {
    showModal(`
      <h2>Кадр готов</h2>
      <div class="sub">${STR.studioFree}</div>
      <div class="shotbig"><img src="${url}"></div>
      <div class="acts">
        <button class="btn" data-close>${STR.close}</button>
        <button class="btn primary" data-save>⤓ ${STR.save || "Сохранить"}</button>
      </div>`);
    el("modalMount").querySelector("[data-save]").addEventListener("click", () => saveImage(url, "shotlist-frame.jpg"));
    return;
  }
  const pass = shot.score >= session.brief.threshold;
  const left = session.shotsLeft;
  showModal(`
    <h2>Кадр ${session.brief.shots - left}/${session.brief.shots}</h2>
    <div class="sub">${session.brief.title}</div>
    <div class="shotbig"><img src="${shot.url}"><span class="shotpct ${pass ? 'ok' : ''}">${Math.round(shot.score * 100)}%</span></div>
    <div class="fbk">${hintText(shot.hint)}</div>
    <div class="acts">
      <button class="btn" data-save>⤓ ${STR.save || "Сохранить"}</button>
      ${left > 0 ? `<button class="btn ghost" data-more>📸 Ещё кадр (${left})</button>` : ""}
      <button class="btn ${pass ? 'primary' : ''}" data-submit ${pass ? '' : 'disabled'}>✓ ${STR.submit}</button>
    </div>
    ${!pass ? `<div class="tiny" style="margin-top:9px;color:var(--haze)">Порог сдачи ${Math.round(session.brief.threshold * 100)}% — дотяни свет и сними ещё.</div>` : ""}`);
  const mm = el("modalMount");
  mm.querySelector("[data-save]").addEventListener("click", () => saveImage(shot.url, "shotlist-shot.jpg"));
  const more = mm.querySelector("[data-more]");
  if (more) more.addEventListener("click", closeModal);
  const sub = mm.querySelector("[data-submit]");
  if (pass) sub.addEventListener("click", () => { closeModal(); finishBrief(shot.score); });
  // if no shots left and not passing, offer reshoot
  if (left <= 0 && !pass) {
    sub.insertAdjacentHTML("afterend", `<button class="btn" data-reshoot>${STR.reshoot}</button>`);
    mm.querySelector("[data-reshoot]").addEventListener("click", () => {
      closeModal(); session.shotsLeft = session.brief.shots; session.shots = [];
      el("shootInfo").innerHTML = `${STR.shotsLeft}: <b>${session.shotsLeft}</b> / ${session.brief.shots}`;
      el("shootBtn").textContent = STR.capture + " (" + session.shotsLeft + ")";
      if (el("mShootL")) el("mShootL").textContent = STR.capture + " " + session.shotsLeft;
    });
  }
}

function flashShutter() {
  const f = document.createElement("div");
  f.style.cssText = "position:fixed;inset:0;background:#fff;z-index:60;pointer-events:none;opacity:.0;transition:opacity .08s";
  document.body.appendChild(f); requestAnimationFrame(() => { f.style.opacity = ".55"; setTimeout(() => { f.style.opacity = "0"; setTimeout(() => f.remove(), 160); }, 60); });
}

function hintText(h) {
  return ({ harder: STR.hintHarder, softer: STR.hintSofter, rim: STR.hintRim, key: STR.hintKey,
    exposure: STR.hintExposure, pose: STR.hintPose, close: STR.hintClose, good: STR.hintGood })[h] || STR.hintClose;
}

function onHint() {
  if (!session) return;
  const r = studio.scoreAgainst(session.brief.target, session.brief.weights);
  state.hintsUsed++;
  showModal(`
    <h2>${STR.hint}</h2>
    <div class="sub">${session.brief.client}</div>
    <div class="fbk">${hintText(r.hint)}</div>
    <div class="acts"><button class="btn primary" data-close>${STR.close}</button></div>
  `);
}

/* ---------------- review + result ---------------- */
function showReview() {
  const best = session.shots.reduce((a, b) => b.score > a.score ? b : a, session.shots[0]);
  const bestScore = best.score;
  const pass = bestScore >= session.brief.threshold;
  const shotsHtml = session.shots.map((s, i) =>
    `<div class="shot ${s === best ? 'best' : ''}"><img src="${s.url}"><div class="sc">${Math.round(s.score * 100)}%</div></div>`).join("");
  showModal(`
    <h2>${STR.review}</h2>
    <div class="sub">${session.brief.title} — ${session.brief.client}</div>
    <div class="shots">${shotsHtml}</div>
    <div style="text-align:center;margin-bottom:6px">
      <div class="bigscore ${pass ? 'pass' : 'fail'}">${Math.round(bestScore * 100)}%</div>
      <div class="eyebrow">${STR.matchScore} · ${STR.reqMatch} ${Math.round(session.brief.threshold * 100)}%</div>
    </div>
    <div class="fbk">${hintText(best.hint)}</div>
    <div class="acts">
      <button class="btn" data-reshoot>${STR.reshoot}</button>
      <button class="btn ${pass ? 'primary' : ''}" data-submit ${pass ? '' : 'disabled'}>${STR.submit}</button>
    </div>
  `);
  el("modalMount").querySelector("[data-reshoot]").addEventListener("click", () => {
    closeModal(); session.shotsLeft = session.brief.shots; session.shots = [];
    el("shootInfo").innerHTML = `${STR.shotsLeft}: <b>${session.shotsLeft}</b> / ${session.brief.shots}`;
    el("shootBtn").textContent = STR.capture + " (" + session.shotsLeft + ")";
  if(el("mShootL")) el("mShootL").textContent = STR.capture + " " + session.shotsLeft;
  });
  if (pass) el("modalMount").querySelector("[data-submit]").addEventListener("click", () => finishBrief(bestScore));
}

function finishBrief(score) {
  closeModal();
  const b = session.brief;
  // bonus for exceeding threshold, penalty for hints
  const over = Math.max(0, score - b.threshold);
  const feeMult = 1 + over * 1.5 - Math.min(0.3, state.hintsUsed * 0.05);
  const fee = Math.round(b.fee * feeMult);
  state.money += fee;
  state.rep += b.rep;
  if (state.briefIndex === state.cleared) state.cleared++;
  state.hintsUsed = 0;
  const careerDone = state.cleared >= BRIEFS.length;
  showModal(`
    <h2>${STR.passed}</h2>
    <div class="sub">${b.client}</div>
    <div class="reward">
      <div><div class="v" style="color:var(--amber)">+${fee} ₪</div><div class="l">${STR.earned}</div></div>
      <div><div class="v" style="color:var(--cool)">+${b.rep}</div><div class="l">${STR.repUp}</div></div>
      <div><div class="v">${Math.round(score * 100)}%</div><div class="l">${STR.matchScore}</div></div>
    </div>
    ${careerDone ? `<div class="fbk"><b>${STR.careerDone}.</b><br>${STR.careerDoneSub}</div>` : ""}
    <div class="acts"><button class="btn primary" data-board>${STR.backToBoard}</button></div>
  `);
  el("modalMount").querySelector("[data-board]").addEventListener("click", () => { closeModal(); el("hintBtn").classList.remove("hidden"); show("board"); renderBoard(); });
}

/* ---------------- modal helper ---------------- */
function showModal(html) {
  if (typeof closeSheet === "function") closeSheet();
  el("modalMount").innerHTML = `<div class="modal"><div class="sheet scr">${html}</div></div>`;
  const c = el("modalMount").querySelector("[data-close]");
  if (c) c.addEventListener("click", closeModal);
}
function closeModal() { el("modalMount").innerHTML = ""; }

/* ---------------- how to play ---------------- */
function showHowto() {
  showModal(`
    <h2>${STR.howto}</h2>
    <div class="fbk" style="border-left-color:var(--cool)">
      <b>Цель:</b> повтори схему света из брифа. Чем точнее ключевой свет, контраст, контровой и поза совпадают с заданием — тем выше процент.<br><br>
      <b>Свет:</b> добавляй приборы слева, тяни их мышью в 3D-сцене, крути мощность/температуру/растушёвку справа.<br>
      <b>Модель:</b> выбирай позу или <b>тяни конечности манекена прямо в кадре</b>, доворачивай корпус и голову.<br>
      <b>Камера:</b> следи за экспозицией — ISO/выдержка/диафрагма влияют на яркость кадра.<br>
      <b>Съёмка:</b> у тебя серия из нескольких кадров. Сделай их, выбери лучший, сдай заказчику.<br><br>
      Виды: <b>${STR.viewCam}</b> — как ляжет кадр, <b>${STR.viewTop}</b> — план студии, <b>${STR.viewFree}</b> — орбита.
    </div>
    <div class="acts"><button class="btn primary" data-close>${STR.confirm}</button></div>
  `);
}

/* ---------------- render loop ---------------- */
let rafOn = false;
function loop() {
  if (rafOn) return; rafOn = true;
  const tick = () => { requestAnimationFrame(tick); if (studio && !el("studio").classList.contains("hidden")) studio.render(); };
  requestAnimationFrame(tick);
}

/* ---------------- boot ---------------- */
fillStatic();
el("m_new").addEventListener("click", () => { state.money = 0; state.rep = 0; state.cleared = 0; renderBoard(); show("board"); });
el("m_free").addEventListener("click", enterFreeStudio);
el("m_how").addEventListener("click", showHowto);
show("menu");
