// kingModel.js — seats KING ALDRIC on the throne in the castle's ground-floor
// great hall. The boxy procedural NPC body is hidden and replaced with a nicer,
// rounded TOON KING built here: a fur-trimmed royal robe, gloved hands resting on
// the throne's armrests, a full beard and a golden crown — clearly SEATED, facing
// down the hall (-z) toward the approaching player.
//
// This procedural king is the reliable, always-available figure. We ALSO try the
// detailed dwarf GLB, but only behind a short timeout: if it has not loaded in a
// few seconds (it can stall on texture decode in some environments) we keep the
// procedural king. Either way the King is seated correctly and the NPC group is
// preserved so the name label, click-to-talk and quest still work.
//
// Seat geometry is shared with castleFurniture's buildThrone:
//   throne seat top (castle-local y) = 1.55,  seat centre z = 18.7
//   castle group world position      = (0,0,46)  ->  seat world z = 64.7

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';

const DWARF_URL = './assets/models/dwarf/dwarf.gltf';
const DWARF_TIMEOUT = 6000;       // ms — past this we commit to the procedural king

// Seat placement, in WORLD space (the king group lives directly under the scene).
const SEAT = {
  z: 64.7,        // world z of the throne seat centre (castle z46 + local 18.7)
  seatY: 1.55,    // world y of the throne seat surface (king's hips rest here)
  face: Math.PI,  // yaw so the king looks down the hall toward the gate (-z)
};

function findBone(root, name) {
  let hit = null;
  root.traverse((o) => { if (!hit && o.isBone && o.name === name) hit = o; });
  return hit;
}

// ---------------------------------------------------------------------------
// The procedural seated TOON KING. Built facing +z locally; the group yaw
// (SEAT.face) turns him to look down the hall. Origin at floor level; the seated
// figure's hips rest at y = SEAT.seatY so he meets the throne cushion.
// ---------------------------------------------------------------------------
function buildToonKing() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8b48c, roughness: 0.6 });
  const robe = new THREE.MeshStandardMaterial({ color: 0x5e2a8a, roughness: 0.7 });       // royal purple
  const robeTrim = new THREE.MeshStandardMaterial({ color: 0xd8b24a, metalness: 0.4, roughness: 0.45 }); // gold trim
  const fur = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.95 });        // ermine collar
  const gold = new THREE.MeshStandardMaterial({ color: 0xe6c45a, metalness: 0.5, roughness: 0.35 });
  const beardM = new THREE.MeshStandardMaterial({ color: 0xded6c4, roughness: 0.85 });     // silver-white beard
  const sash = new THREE.MeshStandardMaterial({ color: 0x9e1b2e, roughness: 0.8 });        // red sash
  const boot = new THREE.MeshStandardMaterial({ color: 0x3a2415, roughness: 0.8 });

  const HIP = SEAT.seatY;              // hips at the seat surface

  // --- lap / thighs sitting forward off the seat, knees toward +z (the hall) ---
  const lap = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.42, 0.95), robe);
  lap.position.set(0, HIP + 0.18, 0.4); g.add(lap);
  for (const sx of [-1, 1]) {
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 1.25, 14), robe);
    shin.position.set(sx * 0.26, HIP - 0.45, 0.78); g.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.42), boot);
    foot.position.set(sx * 0.26, HIP - 1.02, 0.95); g.add(foot);
  }
  // robe hem skirt fanning over the seat front + gold hem ring
  const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.05, 0.8, 18), robe);
  hem.position.set(0, HIP - 0.05, 0.45); g.add(hem);
  const hemRing = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.06, 8, 20), robeTrim);
  hemRing.rotation.x = Math.PI / 2; hemRing.position.set(0, HIP - 0.42, 0.45); g.add(hemRing);

  // --- torso: a barrel chest leaning slightly back into the throne ---
  const torso = new THREE.Group(); torso.position.set(0, HIP + 0.4, 0.05); torso.rotation.x = 0.12; g.add(torso);
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 1.0, 18), robe);
  chest.position.y = 0.5; torso.add(chest);
  torso.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.0, 0.1), robeTrim).translateY(0.5).translateZ(0.46));   // placket
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.16, 18), robeTrim); belt.position.y = 0.08; torso.add(belt);
  const s = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.15, 0.08), sash); s.position.set(0, 0.5, 0.45); s.rotation.z = 0.5; torso.add(s);  // sash
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.16, 10, 22), fur); collar.position.y = 1.0; collar.rotation.x = Math.PI / 2; torso.add(collar);
  g.userData.torso = torso;

  // --- shoulders + arms, gloved hands resting forward on the armrests ---
  const armrestY = SEAT.seatY + 0.6, armrestX = 0.62, handZ = 0.95;
  for (const sx of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), robe);
    shoulder.position.set(sx * 0.5, HIP + 1.25, 0.05); g.add(shoulder);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.7, 12), robe);
    upper.position.set(sx * 0.6, HIP + 0.92, 0.2); upper.rotation.z = sx * 0.35; upper.rotation.x = -0.3; g.add(upper);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.65, 12), robe);
    fore.position.set(sx * armrestX, armrestY + 0.16, 0.55); fore.rotation.x = Math.PI / 2 - 0.15; g.add(fore);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 8, 16), robeTrim);
    cuff.rotation.x = Math.PI / 2; cuff.position.set(sx * armrestX, armrestY + 0.22, 0.25); g.add(cuff);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), new THREE.MeshStandardMaterial({ color: 0xe8e2d2, roughness: 0.7 }));
    hand.position.set(sx * armrestX, armrestY + 0.08, handZ); hand.scale.set(1, 0.8, 1.2); g.add(hand);
  }

  // --- head, beard, face, crown ---
  const head = new THREE.Group(); head.position.set(0, HIP + 1.78, 0.06); g.add(head); g.userData.head = head;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), skin);
  skull.scale.set(1, 1.08, 0.98); head.add(skull);
  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 16, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.6), beardM);
  beard.position.set(0, -0.12, 0.06); beard.scale.set(1.05, 1.5, 1.05); head.add(beard);
  const stache = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.1), beardM); stache.position.set(0, 0.04, 0.3); head.add(stache);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), new THREE.MeshStandardMaterial({ color: 0x2a2018 }));
    eye.position.set(sx * 0.12, 0.04, 0.31); head.add(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.04), beardM); brow.position.set(sx * 0.13, 0.13, 0.3); head.add(brow);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 8), skin); nose.rotation.x = Math.PI / 2; nose.position.set(0, -0.02, 0.34); head.add(nose);
  // crown: gold band, points + jewels
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.18, 20, 1, true), gold);
  band.position.set(0, 0.3, 0); head.add(band);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    const pt = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 6), gold);
    pt.position.set(Math.cos(a) * 0.3, 0.46, Math.sin(a) * 0.3); head.add(pt);
    const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), new THREE.MeshStandardMaterial({ color: k % 2 ? 0xc0392b : 0x2e86c1, emissive: k % 2 ? 0x5a0a06 : 0x0a2a4a, emissiveIntensity: 0.4, roughness: 0.3 }));
    jewel.position.set(Math.cos(a) * 0.33, 0.3, Math.sin(a) * 0.33); head.add(jewel);
  }

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.__toonDone = true; o.frustumCulled = false; } });
  g.userData.__toonDone = true;
  return g;
}

function boot() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const em = window.eldenmoor;
    const king = em && em.npcs && em.npcs.find((n) => n.def.id === 'king');
    if (em && em.scene && king) { clearInterval(iv); seatKing(em, king); }
    else if (tries > 1200) clearInterval(iv);
  }, 100);
}

function seatKing(em, king) {
  // hide the boxy procedural NPC body but keep the group (label / talk / quest)
  king.group.traverse((o) => { if (o.isMesh) o.visible = false; });

  // park the king group on the throne and freeze his wander for good
  king.group.position.set(0, 0, SEAT.z);
  king.group.rotation.y = 0;            // facing baked into the model below
  king._home = { x: 0, z: SEAT.z };
  king._tgt = { x: 0, z: SEAT.z };
  king._next = Infinity;

  // build + seat the reliable procedural toon king immediately
  const toon = buildToonKing();
  toon.rotation.y = SEAT.face;
  king.group.add(toon);
  em.kingToon = toon;

  // a soft warm key light so the king reads in the dim hall (child of the group,
  // so it only shines while the ground floor is shown)
  const key = new THREE.PointLight(0xffe2ad, 6, 10, 2); key.position.set(0, 3.0, -2.2); king.group.add(key);

  // a gentle breathing idle for the procedural king
  const clock = new THREE.Clock();
  let dwarfActive = false;
  const tick = () => {
    const t = clock.getElapsedTime();
    if (!dwarfActive && toon.userData.torso) {
      toon.userData.torso.rotation.x = 0.12 + Math.sin(t * 1.4) * 0.015;
      if (toon.userData.head) toon.userData.head.rotation.z = Math.sin(t * 0.6) * 0.03;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // OPTIONAL upgrade: try the detailed dwarf GLB behind a timeout; otherwise keep
  // the (already good) procedural king.
  tryDwarf(em, king, toon, (active) => { dwarfActive = active; });
}

function tryDwarf(em, king, toon, onActive) {
  let settled = false;
  const timer = setTimeout(() => { settled = settled || true; }, DWARF_TIMEOUT);
  const loader = new GLTFLoader();
  try {
    loader.load(DWARF_URL, (gltf) => {
      if (settled) return;             // too late — procedural king already committed
      settled = true; clearTimeout(timer);
      const dwarf = gltf.scene;
      const box = new THREE.Box3().setFromObject(dwarf);
      const s = 2.15 / ((box.max.y - box.min.y) || 1);
      dwarf.scale.setScalar(s);
      dwarf.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.__toonDone = true; o.frustumCulled = false; } });
      const grounded = -box.min.y * s;
      dwarf.position.set(0, grounded + 0.52, 0);
      dwarf.rotation.y = SEAT.face;
      toon.visible = false;            // hide procedural king, show the GLB
      king.group.add(dwarf);
      onActive(true);
      em.kingDwarf = dwarf;
      const bones = { upLegL: findBone(dwarf, 'UpLegL'), upLegR: findBone(dwarf, 'UpLegR'), legL: findBone(dwarf, 'LegL'), legR: findBone(dwarf, 'LegR'), spine: findBone(dwarf, 'Spine') };
      let mixer = null;
      if (gltf.animations && gltf.animations.length) { mixer = new THREE.AnimationMixer(dwarf); mixer.clipAction(gltf.animations[0]).play(); }
      const clock = new THREE.Clock();
      const tick = () => {
        if (mixer) mixer.update(clock.getDelta());
        if (bones.upLegL) bones.upLegL.rotation.x = -1.5;
        if (bones.upLegR) bones.upLegR.rotation.x = -1.5;
        if (bones.legL) bones.legL.rotation.x = 1.55;
        if (bones.legR) bones.legR.rotation.x = 1.55;
        if (bones.spine) bones.spine.rotation.x = -0.1;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, undefined, () => { settled = true; clearTimeout(timer); });
  } catch (e) { settled = true; clearTimeout(timer); }
}

boot();
