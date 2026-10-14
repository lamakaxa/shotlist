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

  _build() {
    // pelvis
    const pelvis = this._joint("pelvis", this.root, 0, 0.95, 0);
    const hips = new THREE.Mesh(new THREE.CapsuleGeometry(0.20, 0.16, 8, 18), this.mat);
    hips.castShadow = true; hips.position.y = 0.02; pelvis.add(hips);

    // spine -> chest -> neck -> head
    const spine = this._joint("spine", pelvis, 0, 0.18, 0);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.235, 0.34, 8, 20), this.mat);
    torso.castShadow = true; torso.position.y = 0.28; spine.add(torso);

    const chest = this._joint("chest", spine, 0, 0.5, 0);
    const shoulders = new THREE.Mesh(new THREE.CapsuleGeometry(0.10, 0.40, 6, 16), this.matDark);
    shoulders.rotation.z = Math.PI / 2; shoulders.position.y = 0.0; shoulders.castShadow = true; chest.add(shoulders);

    const neck = this._joint("neck", chest, 0, 0.12, 0);
    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.14, 14), this.mat);
    neckMesh.position.y = 0.07; neckMesh.castShadow = true; neck.add(neckMesh);

    const head = this._joint("head", neck, 0, 0.14, 0);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.155, 28, 28), this.mat);
    skull.scale.set(1, 1.18, 1.05); skull.position.y = 0.16; skull.castShadow = true; head.add(skull);
    // small brow ridge so head orientation reads
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.05), this.matDark);
    brow.position.set(0, 0.17, 0.13); head.add(brow);
    this._handle("head", head, 0.16, 0.14);

    // arms: shoulder -> elbow -> hand, both sides
    for (const side of [-1, 1]) {
      const s = side === -1 ? "L" : "R";
      const sh = this._joint("shoulder" + s, chest, side * 0.27, 0.02, 0);
      const upper = this._seg(0.30, 0.075, 0.06); sh.add(upper);
      this._handle("shoulder" + s, sh, -0.15, 0.10);

      const el = this._joint("elbow" + s, sh, 0, -0.30, 0);
      const fore = this._seg(0.28, 0.06, 0.045); el.add(fore);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), this.mat);
      hand.position.y = -0.30; el.add(hand);
      this._handle("elbow" + s, el, -0.28, 0.12);
    }

    // legs: hip -> knee -> foot, both sides
    for (const side of [-1, 1]) {
      const s = side === -1 ? "L" : "R";
      const hip = this._joint("hip" + s, pelvis, side * 0.13, -0.02, 0);
      const thigh = this._seg(0.45, 0.10, 0.08); hip.add(thigh);
      this._handle("hip" + s, hip, -0.22, 0.11);

      const kn = this._joint("knee" + s, hip, 0, -0.45, 0);
      const shin = this._seg(0.45, 0.08, 0.055); kn.add(shin);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.26), this.matDark);
      foot.position.set(0, -0.46, 0.06); foot.castShadow = true; kn.add(foot);
      this._handle("knee" + s, kn, -0.45, 0.12);
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
