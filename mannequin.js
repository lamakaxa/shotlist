// mannequin.js — neutral matte grey articulated mannequin with a real joint hierarchy.
// Built from primitives (STYLE FORMULA: 3D mannequin in neutral matte grey).
// Every limb is a THREE.Group joint; limbs are draggable via raycast handles.
import * as THREE from "three";

const GREY = 0xb8b6b0;       // neutral matte grey so light shapes read cleanly
const GREY_DARK = 0x9a988f;

export class Mannequin {
  constructor() {
    this.root = new THREE.Group();          // pelvis origin, stands on floor
    this.joints = {};                        // name -> THREE.Group
    this.handles = [];                       // draggable proxy meshes
    this.mat = new THREE.MeshStandardMaterial({ color: GREY, roughness: 0.72, metalness: 0.0 });
    this.matDark = new THREE.MeshStandardMaterial({ color: GREY_DARK, roughness: 0.75 });
    this._build();
    this.applyPose("stand");
  }

  _seg(len, rTop, rBot, mat) {
    const g = new THREE.Mesh(new THREE.CylinderGeometry(rBot, rTop, len, 18), mat || this.mat);
    g.castShadow = true; g.receiveShadow = true;
    g.position.y = -len / 2;       // hang downward from joint origin
    g.geometry.translate(0, 0, 0);
    return g;
  }

  _joint(name, parent, x, y, z) {
    const j = new THREE.Group();
    j.position.set(x, y, z);
    parent.add(j);
    this.joints[name] = j;
    return j;
  }

  _handle(name, joint, oy, r) {
    const h = new THREE.Mesh(
      new THREE.SphereGeometry(r || 0.12, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xe8a13a, transparent: true, opacity: 0.0, depthTest: true })
    );
    h.position.y = oy;
    h.userData.joint = name;
    joint.add(h);
    this.handles.push(h);
    return h;
  }

  _mesh(geo, mat) { const m = new THREE.Mesh(geo, mat || this.mat); m.castShadow = true; m.receiveShadow = true; return m; }

  _build() {
    // ---- pelvis / hips: wedge shape, wider at top ----
    const pelvis = this._joint("pelvis", this.root, 0, 0.95, 0);
    const hips = this._mesh(new THREE.CylinderGeometry(0.19, 0.16, 0.22, 24)); hips.position.y = 0.0; pelvis.add(hips);
    const glute = this._mesh(new THREE.SphereGeometry(0.17, 20, 16)); glute.scale.set(1.15, 0.8, 0.95); glute.position.set(0, -0.02, -0.03); pelvis.add(glute);

    // ---- spine: tapered waist → ribcage ----
    const spine = this._joint("spine", pelvis, 0, 0.14, 0);
    const waist = this._mesh(new THREE.CylinderGeometry(0.155, 0.17, 0.2, 24)); waist.position.y = 0.11; spine.add(waist);

    const chest = this._joint("chest", spine, 0, 0.26, 0);
    // ribcage: egg-shaped, broader at top
    const rib = this._mesh(new THREE.SphereGeometry(0.21, 24, 20)); rib.scale.set(1.06, 1.25, 0.78); rib.position.y = 0.12; chest.add(rib);
    // pectoral/collar line
    const collar = this._mesh(new THREE.CapsuleGeometry(0.055, 0.42, 6, 14), this.matDark);
    collar.rotation.z = Math.PI / 2; collar.position.set(0, 0.23, 0.03); chest.add(collar);
    // subtle trapezius into neck
    const trap = this._mesh(new THREE.SphereGeometry(0.12, 16, 12)); trap.scale.set(1.2, 0.6, 0.9); trap.position.set(0, 0.26, -0.02); chest.add(trap);

    // ---- neck ----
    const neck = this._joint("neck", chest, 0, 0.3, 0);
    const neckMesh = this._mesh(new THREE.CylinderGeometry(0.062, 0.078, 0.13, 18)); neckMesh.position.y = 0.06; neck.add(neckMesh);

    // ---- head: skull + jaw + nose + brow, clearly human ----
    const head = this._joint("head", neck, 0, 0.13, 0);
    const skull = this._mesh(new THREE.SphereGeometry(0.135, 32, 32)); skull.scale.set(0.95, 1.1, 1.08); skull.position.y = 0.15; head.add(skull);
    // jaw (tapered front-lower)
    const jaw = this._mesh(new THREE.SphereGeometry(0.1, 24, 20)); jaw.scale.set(0.9, 0.75, 1.0); jaw.position.set(0, 0.085, 0.02); head.add(jaw);
    // chin
    const chin = this._mesh(new THREE.SphereGeometry(0.05, 14, 12)); chin.scale.set(1, 0.8, 1); chin.position.set(0, 0.04, 0.085); head.add(chin);
    // nose
    const nose = this._mesh(new THREE.ConeGeometry(0.03, 0.08, 10)); nose.rotation.x = Math.PI / 2.1; nose.position.set(0, 0.13, 0.135); head.add(nose);
    // brow ridge
    const brow = this._mesh(new THREE.BoxGeometry(0.15, 0.025, 0.04), this.matDark); brow.position.set(0, 0.175, 0.11); head.add(brow);
    // ears
    for (const sx of [-1, 1]) { const ear = this._mesh(new THREE.SphereGeometry(0.028, 10, 10)); ear.scale.set(0.5, 1, 0.8); ear.position.set(sx * 0.125, 0.14, 0.01); head.add(ear); }
    this._handle("head", head, 0.15, 0.13);

    // ---- arms: deltoid → upper → elbow → forearm → hand ----
    for (const side of [-1, 1]) {
      const s = side === -1 ? "L" : "R";
      const sh = this._joint("shoulder" + s, chest, side * 0.2, 0.2, 0);
      const delt = this._mesh(new THREE.SphereGeometry(0.075, 16, 14)); delt.position.y = 0.0; sh.add(delt);
      const upper = this._seg(0.28, 0.07, 0.052); upper.position.y -= 0.02; sh.add(upper);
      this._handle("shoulder" + s, sh, -0.13, 0.095);

      const el = this._joint("elbow" + s, sh, 0, -0.30, 0);
      const fore = this._seg(0.26, 0.052, 0.038); el.add(fore);
      // hand: flattened palm
      const hand = this._mesh(new THREE.BoxGeometry(0.07, 0.13, 0.03)); hand.position.y = -0.33; el.add(hand);
      const thumb = this._mesh(new THREE.CapsuleGeometry(0.014, 0.04, 4, 8)); thumb.position.set(side * 0.04, -0.3, 0.01); thumb.rotation.z = side * 0.6; el.add(thumb);
      this._handle("elbow" + s, el, -0.28, 0.1);
    }

    // ---- legs: hip → thigh → knee → calf → ankle → foot ----
    for (const side of [-1, 1]) {
      const s = side === -1 ? "L" : "R";
      const hip = this._joint("hip" + s, pelvis, side * 0.1, -0.02, 0);
      const thigh = this._seg(0.45, 0.1, 0.07); hip.add(thigh);
      this._handle("hip" + s, hip, -0.22, 0.1);

      const kn = this._joint("knee" + s, hip, 0, -0.45, 0);
      const kneecap = this._mesh(new THREE.SphereGeometry(0.06, 14, 12)); kneecap.position.y = 0; kn.add(kneecap);
      const calf = this._seg(0.45, 0.07, 0.04); kn.add(calf);
      // ankle + foot (heel + arch)
      const ankle = this._mesh(new THREE.SphereGeometry(0.045, 12, 10)); ankle.position.y = -0.44; kn.add(ankle);
      const foot = this._mesh(new THREE.BoxGeometry(0.1, 0.05, 0.27)); foot.position.set(0, -0.47, 0.07); kn.add(foot);
      const toe = this._mesh(new THREE.BoxGeometry(0.1, 0.03, 0.06)); toe.position.set(0, -0.485, 0.2); kn.add(toe);
      this._handle("knee" + s, kn, -0.45, 0.11);
    }
  }

  // pose presets set joint euler rotations
  applyPose(name) {
    const J = this.joints;
    const set = (n, x, y, z) => { if (J[n]) J[n].rotation.set(x || 0, y || 0, z || 0); };
    // zero everything
    Object.keys(J).forEach(n => J[n].rotation.set(0, 0, 0));
    this.root.position.y = 0;
    switch (name) {
      case "stand":
        set("shoulderL", 0, 0, 0.18); set("shoulderR", 0, 0, -0.18);
        set("elbowL", 0.25, 0, 0.05); set("elbowR", 0.25, 0, -0.05);
        break;
      case "contrapposto":
        set("pelvis", 0, 0, 0.06); set("spine", 0, 0.12, -0.04); set("chest", 0, 0.06, 0);
        set("hipL", -0.12, 0, 0.05); set("hipR", 0.08, 0, -0.02);
        set("kneeL", 0.18, 0, 0); set("shoulderL", 0, 0, 0.32); set("shoulderR", 0, 0, -0.12);
        set("elbowL", 0.5, 0, 0.2); set("elbowR", 0.3, 0, -0.1);
        set("head", 0, 0.18, 0);
        break;
      case "handsup":
        set("shoulderL", -2.6, 0, 0.3); set("shoulderR", -2.6, 0, -0.3);
        set("elbowL", -0.4, 0, 0); set("elbowR", -0.4, 0, 0);
        break;
      case "sit":
        this.root.position.y = -0.42;
        set("hipL", -1.5, 0, 0.08); set("hipR", -1.5, 0, -0.08);
        set("kneeL", 1.5, 0, 0); set("kneeR", 1.5, 0, 0);
        set("shoulderL", 0, 0, 0.2); set("shoulderR", 0, 0, -0.2);
        set("elbowL", 0.7, 0, 0); set("elbowR", 0.7, 0, 0);
        break;
      case "profile":
        set("pelvis", 0, 1.2, 0);
        set("shoulderL", -0.3, 0, 0.18); set("shoulderR", 0.3, 0, -0.18);
        set("elbowL", 0.5, 0, 0); set("elbowR", 0.4, 0, 0);
        set("head", 0, -0.3, 0);
        break;
    }
  }

  setBodyTurn(deg) { if (this.joints.pelvis) this.joints.pelvis.rotation.y = THREE.MathUtils.degToRad(deg); }
  setHeadTurn(deg) { if (this.joints.head) this.joints.head.rotation.y = THREE.MathUtils.degToRad(deg); }

  // drag a limb: rotate its joint so the handle follows the target point on a sphere
  dragJoint(name, worldTarget) {
    const j = this.joints[name];
    if (!j) return;
    const parent = j.parent;
    const local = parent.worldToLocal(worldTarget.clone());
    // aim the joint's -Y axis (limb hangs down) toward local target
    const dir = local.clone().sub(j.position).normalize();
    // build rotation from default down-vector (0,-1,0) to dir
    const down = new THREE.Vector3(0, -1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(down, dir);
    j.quaternion.copy(q);
  }

  get bodyTurnDeg() { return THREE.MathUtils.radToDeg(this.joints.pelvis?.rotation.y || 0); }
  get headTurnDeg() { return THREE.MathUtils.radToDeg(this.joints.head?.rotation.y || 0); }
}
