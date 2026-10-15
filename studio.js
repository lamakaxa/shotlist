// studio.js — the set.a.light-style 3D studio core: lights, camera, mannequin, scoring.
import * as THREE from "three";
import { Mannequin } from "./mannequin.js";

const MODIFIERS = {
  softbox:  { name: "Софтбокс", cone: 55, feat: 0.72, sw: [1.4, 1.0], type: "rect" },
  octa:     { name: "Окто",     cone: 62, feat: 0.82, sw: [1.5, 1.5], type: "disc" },
  strip:    { name: "Стрип",    cone: 46, feat: 0.66, sw: [0.4, 1.7], type: "rect" },
  beauty:   { name: "Бьюти",    cone: 48, feat: 0.36, sw: [0.9, 0.9], type: "disc" },
  reflector:{ name: "Рефлектор",cone: 32, feat: 0.16, sw: [0.7, 0.7], type: "disc" },
  bg:       { name: "Фоновый",  cone: 60, feat: 0.6,  sw: [1.0, 1.0], type: "disc" },
};

function kelvinToRGB(k) {
  k /= 100; let r, g, b;
  if (k <= 66) { r = 255; g = 99.47 * Math.log(k) - 161.12; }
  else { r = 329.7 * Math.pow(k - 60, -0.1332); g = 288.12 * Math.pow(k - 60, -0.0755); }
  if (k >= 66) b = 255; else if (k <= 19) b = 0; else b = 138.5 * Math.log(k - 10) - 305.04;
  const cl = v => Math.min(255, Math.max(0, v)) / 255;
  return new THREE.Color(cl(r), cl(g), cl(b));
}

export class Studio {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c0c0b);

    // cameras
    const R = 6;
    this.R = R;
    this.camTop = new THREE.OrthographicCamera(-R, R, R, -R, 0.1, 100);
    this.camTop.position.set(0, 18, 0); this.camTop.lookAt(0, 1, 0); this.camTop.up.set(0, 0, -1);
    this.camShot = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.camFree = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    // free camera as full spherical orbit around a target (360° on both axes)
    this.camTarget = new THREE.Vector3(0, 1.3, 0);
    this.camAz = Math.PI * 0.18;   // azimuth around Y
    this.camPol = Math.PI * 0.42;  // polar angle from +Y (0=top, PI=bottom)
    this.camRad = 7.2;
    this._applyFreeCam();
    this.activeCam = this.camFree; this.viewMode = "free";

    // camera settings (affect exposure + DOF feel)
    this.cam = { iso: 200, shutter: 125, aperture: 4.0, focal: 85 };

    // ambient + room
    this.ambient = new THREE.AmbientLight(0xffffff, 0.025);
    this.scene.add(this.ambient);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x5e5e5e, roughness: 0.96 });
    this.floorMat = floorMat;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.scene.add(floor);
    const bgMat = new THREE.MeshStandardMaterial({ color: 0x5e5e5e, roughness: 1, side: THREE.DoubleSide });
    this.bgMat = bgMat;
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(40, 26), bgMat);
    backdrop.position.set(0, 13, -6); backdrop.receiveShadow = true; this.scene.add(backdrop);

    // mannequin
    this.man = new Mannequin();
    this.scene.add(this.man.root);

    this.lights = [];
    this.selId = null;
    this.uid = 0;

    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this._presetPlacements = [
      { r: 3.0, a: -35, h: 195 }, { r: 3.0, a: 35, h: 195 },
      { r: 3.4, a: 140, h: 200 }, { r: 3.4, a: -140, h: 200 },
      { r: 2.6, a: 0, h: 235 },
    ];
    this.onChange = null;
    this.resize();
  }

  // ---- lights ----
  addLight(kind) {
    const m = MODIFIERS[kind];
    const p = this._presetPlacements[this.lights.length % this._presetPlacements.length];
    const id = ++this.uid;
    const L = {
      id, kind, name: m.name, pw: 100, kelvin: kind === "bg" ? 6000 : 5500,
      feat: m.feat * 100, cone: m.cone, tilt: 0,
      r: p.r, a: p.a, h: kind === "bg" ? 90 : p.h,
    };
    const sl = new THREE.SpotLight(0xffffff, 1, 32, THREE.MathUtils.degToRad(m.cone / 2), m.feat, 1.4);
    sl.castShadow = true; sl.shadow.mapSize.set(1024, 1024); sl.shadow.bias = -0.0006;
    sl.target.position.set(0, 1.4, 0);
    this.scene.add(sl); this.scene.add(sl.target);

    const giz = new THREE.Group();
    const col = kelvinToRGB(L.kelvin);
    const faceMat = new THREE.MeshBasicMaterial({ color: col });
    let face;
    if (m.type === "rect") face = new THREE.Mesh(new THREE.PlaneGeometry(0.6 * m.sw[0], 0.6 * m.sw[1]), faceMat);
    else face = new THREE.Mesh(new THREE.CircleGeometry(0.34 * m.sw[0], 32), faceMat);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.4 * m.sw[0], 0.46 * m.sw[0], 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide }));
    giz.add(face); giz.add(ring);
    giz.userData.id = id;
    this.scene.add(giz);

    L.sl = sl; L.giz = giz; L.face = face;
    this.lights.push(L);
    this.selId = id;
    this._place(L);
    this._fire();
    return L;
  }

  _place(L) {
    const ar = THREE.MathUtils.degToRad(L.a);
    const x = Math.sin(ar) * L.r, z = Math.cos(ar) * L.r, y = L.h / 100;
    L.sl.position.set(x, y, z);
    L.giz.position.set(x, y, z);
    const tgt = new THREE.Vector3(0, 1.4 + L.tilt * 0.012, 0);
    L.sl.target.position.copy(tgt);
    L.giz.lookAt(tgt);
    const col = kelvinToRGB(L.kelvin);
    L.sl.color.copy(col);
    L.sl.intensity = (L.pw / 100) * 6.5;
    L.sl.angle = THREE.MathUtils.degToRad(L.cone / 2);
    L.sl.penumbra = L.feat / 100;
    L.face.material.color.copy(col).multiplyScalar(0.5 + L.pw / 200);
  }

  removeLight(id) {
    const i = this.lights.findIndex(l => l.id === id); if (i < 0) return;
    const L = this.lights[i];
    this.scene.remove(L.sl); this.scene.remove(L.sl.target); this.scene.remove(L.giz);
    this.lights.splice(i, 1);
    if (this.selId === id) this.selId = this.lights.length ? this.lights[this.lights.length - 1].id : null;
    this._fire();
  }

  clearLights() { [...this.lights].forEach(l => this.removeLight(l.id)); this.uid = 0; this.selId = null; }

  cur() { return this.lights.find(l => l.id === this.selId) || null; }

  setProp(prop, val) {
    const L = this.cur(); if (!L) return;
    L[prop] = +val; this._place(L); this._fire();
  }

  // ---- camera exposure model ----
  setCam(k, v) { this.cam[k] = +v; this._applyExposure(); this._fire(); }
  _applyExposure() {
    // EV from ISO/shutter/aperture relative to a 200 / 125 / 4.0 baseline
    const evIso = Math.log2(this.cam.iso / 200);
    const evShutter = Math.log2((1 / 125) / (1 / this.cam.shutter)); // longer = brighter
    const evAperture = Math.log2((4.0 * 4.0) / (this.cam.aperture * this.cam.aperture));
    this._camEV = evIso + evShutter + evAperture;
    this.renderer.toneMappingExposure = Math.min(2.4, Math.max(0.3, Math.pow(2, this._camEV)));
    if (this.camShot) {
      this.camShot.fov = 2 * Math.atan(18 / this.cam.focal) * 180 / Math.PI; // 36mm-ish frame
      this.camShot.updateProjectionMatrix();
    }
  }
  get exposureEV() { return this._camEV || 0; }

  // ---- views ----
  setView(mode) {
    this.viewMode = mode;
    this.activeCam = mode === "top" ? this.camTop : mode === "cam" ? this.camShot : this.camFree;
    if (mode === "cam") this._frameShot();
    this.resize();
  }
  _frameShot() {
    // spherical rig for the shot camera too (front default), fully orbitable
    if (this.shotAz === undefined) {
      this.shotTarget = new THREE.Vector3(0, 1.35, 0);
      this.shotAz = 0; this.shotPol = Math.PI * 0.5; this.shotRad = 4.2;
    }
    this._applyShotCam();
    this._applyExposure();
  }
  _applyShotCam() {
    const TAU = Math.PI * 2;
    this.shotAz = ((this.shotAz % TAU) + TAU) % TAU;
    this.shotPol = ((this.shotPol % TAU) + TAU) % TAU;
    const sp = Math.sin(this.shotPol), cp = Math.cos(this.shotPol);
    const x = this.shotTarget.x + this.shotRad * sp * Math.sin(this.shotAz);
    const y = this.shotTarget.y + this.shotRad * cp;
    const z = this.shotTarget.z + this.shotRad * sp * Math.cos(this.shotAz);
    this.camShot.position.set(x, y, z);
    const up = (this.shotPol > 0 && this.shotPol < Math.PI) ? 1 : -1;
    this.camShot.up.set(0, up, 0);
    this.camShot.lookAt(this.shotTarget);
  }

  // ---- mannequin proxies ----
  pose(name) { this.man.applyPose(name); this._fire(); }
  bodyTurn(d) { this.man.setBodyTurn(d); this._fire(); }
  headTurn(d) { this.man.setHeadTurn(d); this._fire(); }

  // ---- scoring against a brief target ----
  scoreAgainst(target, weights) {
    if (!this.lights.length) return { score: 0, hint: "nolight" };
    // identify key = strongest at subject
    const ranked = [...this.lights].map(L => ({ L, e: L.pw / (L.r * L.r) })).sort((a, b) => b.e - a.e);
    const key = ranked[0].L;
    const fill = ranked[1] ? ranked[1].L : null;
    const ratio = fill ? (ranked[0].e / ranked[1].e) : 6.0;
    const rimPresent = this.lights.some(l => Math.abs(((l.a % 360) + 360) % 360 - 180) < 55 && l.id !== key.id);

    const W = weights;
    const norm = (diff, scale) => Math.max(0, 1 - Math.abs(diff) / scale);
    let s = 0, wsum = 0, parts = {};
    const add = (name, val, w) => { s += val * w; wsum += w; parts[name] = val; };

    const keyA = ((key.a % 360) + 360) % 360;
    const tgtA = ((target.keyAngle % 360) + 360) % 360;
    let da = Math.abs(keyA - tgtA); if (da > 180) da = 360 - da;
    add("angle", norm(da, 70), W.angle);
    add("height", norm(key.h - target.keyHeight, 90), W.height);
    add("soft", norm(key.feat / 100 - target.keySoft, 0.6), W.soft);
    add("ratio", norm(ratio - target.ratio, 4.0), W.ratio);
    add("rim", (target.rim === rimPresent) ? 1 : 0, W.rim);
    add("exposure", norm(this.exposureEV - (target.exposure || 0), 1.6), W.exposure);
    const poseDiff = Math.abs(this.man.bodyTurnDeg - (target.bodyTurn || 0)) +
                     Math.abs(this.man.headTurnDeg - (target.headTurn || 0)) * 0.5;
    add("pose", norm(poseDiff, 60), W.pose);

    const score = s / wsum;
    // worst axis -> hint key
    let worst = null, worstVal = 2;
    for (const k in parts) { const wv = parts[k] * (W[k] || 1); if (parts[k] < worstVal) { worstVal = parts[k]; worst = k; } }
    let hint = "good";
    if (score >= 0.92) hint = "good";
    else if (score >= 0.8) hint = "close";
    else {
      switch (worst) {
        case "soft": hint = parts.soft < 0.5 && key.feat / 100 < target.keySoft ? "harder" : "softer"; break;
        case "ratio": hint = ratio < target.ratio ? "softer" : "harder"; break;
        case "rim": hint = "rim"; break;
        case "angle": hint = "key"; break;
        case "exposure": hint = "exposure"; break;
        case "pose": hint = "pose"; break;
        default: hint = "close";
      }
    }
    return { score, hint, key, ratio, rimPresent };
  }

  // ---- interaction ----
  pointerNDC(e) {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }

  pickAt(e) {
    this.pointerNDC(e);
    this.ray.setFromCamera(this.ndc, this.activeCam);
    // limbs first (handles), then lights
    const handleHit = this.ray.intersectObjects(this.man.handles, false)[0];
    if (handleHit) return { type: "limb", name: handleHit.object.userData.joint };
    const gizmos = this.lights.map(l => l.giz);
    const lightHit = this.ray.intersectObjects(gizmos, true)[0];
    if (lightHit) {
      let g = lightHit.object; while (g && g.userData.id === undefined) g = g.parent;
      if (g) { this.selId = g.userData.id; this._fire(); return { type: "light", id: g.userData.id }; }
    }
    return { type: "none" };
  }

  dragLightTo(e) {
    const L = this.cur(); if (!L) return;
    this.pointerNDC(e); this.ray.setFromCamera(this.ndc, this.activeCam);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(L.h / 100));
    const pt = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(plane, pt)) {
      L.r = Math.min(5.2, Math.max(0.9, Math.hypot(pt.x, pt.z)));
      L.a = THREE.MathUtils.radToDeg(Math.atan2(pt.x, pt.z));
      this._place(L); this._fire();
    }
  }

  dragLimbTo(e, name) {
    this.pointerNDC(e); this.ray.setFromCamera(this.ndc, this.activeCam);
    // intersect a plane facing the camera through the joint
    const j = this.man.joints[name]; if (!j) return;
    const jw = new THREE.Vector3(); j.getWorldPosition(jw);
    const n = new THREE.Vector3(); this.activeCam.getWorldDirection(n);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, jw);
    const pt = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(plane, pt)) { this.man.dragJoint(name, pt); this._fire(); }
  }

  _applyFreeCam() {
    const TAU = Math.PI * 2;
    // keep angles in range but never clamp — full 360° both axes
    this.camAz = ((this.camAz % TAU) + TAU) % TAU;
    this.camPol = ((this.camPol % TAU) + TAU) % TAU;
    const sp = Math.sin(this.camPol), cp = Math.cos(this.camPol);
    const sa = Math.sin(this.camAz), ca = Math.cos(this.camAz);
    const x = this.camTarget.x + this.camRad * sp * sa;
    const y = this.camTarget.y + this.camRad * cp;
    const z = this.camTarget.z + this.camRad * sp * ca; // sp on both x and z keeps radius constant
    this.camFree.position.set(x, y, z);
    // flip up vector when camera passes over the pole so the view never locks
    const up = (this.camPol > 0 && this.camPol < Math.PI) ? 1 : -1;
    this.camFree.up.set(0, up, 0);
    this.camFree.lookAt(this.camTarget);
  }
  orbit(dx, dy) {
    if (this.viewMode === "cam") {
      this.shotAz -= dx; this.shotPol -= dy; this._applyShotCam();
    } else {
      this.camAz -= dx; this.camPol -= dy; this._applyFreeCam();
    }
  }
  zoom(d) {
    if (this.viewMode === "cam") {
      this.shotRad = Math.min(14, Math.max(1.2, this.shotRad * (1 + d * 0.0009))); this._applyShotCam();
    } else if (this.viewMode === "free") {
      this.camRad = Math.min(16, Math.max(1.6, this.camRad * (1 + d * 0.0009))); this._applyFreeCam();
    }
  }
  // spherical orbit of the selected light around the model, 360° both axes
  orbitLight(dx, dy) {
    const L = this.cur(); if (!L) return;
    // derive current spherical angles from a,h,r
    const az = THREE.MathUtils.degToRad(L.a);
    const y = L.h / 100 - 1.4;               // relative to model centre (~1.4m)
    const horiz = L.r;
    let pol = Math.atan2(horiz, y);          // polar from +Y
    const rad = Math.hypot(horiz, y);
    let naz = az - dx;
    let npol = pol - dy;
    const TAU = Math.PI * 2;
    npol = Math.max(0.08, Math.min(Math.PI - 0.08, npol)); // avoid exact pole singularity
    naz = ((naz % TAU) + TAU) % TAU;
    const nHoriz = Math.sin(npol) * rad;
    const nY = Math.cos(npol) * rad;
    L.r = Math.max(0.9, Math.min(5.2, nHoriz));
    L.h = Math.max(20, Math.min(320, (nY + 1.4) * 100));
    L.a = THREE.MathUtils.radToDeg(naz);
    this._place(L); this._fire();
  }
  wheelHeight(d) {
    const L = this.cur(); if (L && this.viewMode === "top") { L.h = Math.min(320, Math.max(20, L.h - d * 0.12)); this._place(L); this._fire(); }
    else this.zoom(d);
  }
  resetView() {
    if (this.viewMode === "cam") {
      this.shotAz = 0; this.shotPol = Math.PI * 0.5; this.shotRad = 4.2; this._applyShotCam();
    } else {
      this.camAz = Math.PI * 0.18; this.camPol = Math.PI * 0.42; this.camRad = 7.2; this._applyFreeCam();
    }
  }

  setAmbient(v) { this.ambient.intensity = v / 100; this._fire(); }
  setBgTone(v) { const g = Math.round(v * 2.0 + 8); const c = new THREE.Color(g / 255, g / 255, g / 255); this.floorMat.color.copy(c); this.bgMat.color.copy(c); this._fire(); }

  resize() {
    const w = this.canvas.clientWidth || this.canvas.parentElement.clientWidth;
    const h = this.canvas.clientHeight || this.canvas.parentElement.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camShot.aspect = aspect; this.camShot.updateProjectionMatrix();
    this.camFree.aspect = aspect; this.camFree.updateProjectionMatrix();
    const v = this.R;
    this.camTop.left = -v * aspect; this.camTop.right = v * aspect; this.camTop.top = v; this.camTop.bottom = -v;
    this.camTop.updateProjectionMatrix();
  }

  render() { this.renderer.render(this.scene, this.activeCam); }
  _fire() { if (this.onChange) this.onChange(); }

  // capture current shot cam frame as data URL (for the 5-shot review)
  capture() {
    const prev = this.activeCam, prevMode = this.viewMode;
    this.setView("cam");
    this.render();
    const url = this.canvas.toDataURL("image/jpeg", 0.7);
    this.activeCam = prev; this.viewMode = prevMode; this.resize();
    return url;
  }
}
