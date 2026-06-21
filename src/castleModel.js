// castleModel.js — swaps the home castle's exterior for a huge realistic glTF
// keep (The Long Roam castle). Like the stores: while you're OUT in the town you
// see the giant glTF castle; once you cross the gate the glTF hides and the
// procedural castle (throne room, King, the stairs up/down) takes over — so all
// the interior gameplay is untouched. The procedural walls keep colliding either
// way, so the gateway stays the only way in.
//
// Self-contained: polls for window.eldenmoor and boots itself; main.js only
// needs `import './castleModel.js';`.

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';

const URL = './assets/models/castle/castle.glb';
const CX = 0, CZ = 46;          // procedural castle centre
const TARGET_W = 52;            // match the procedural footprint (HW*2 = 46), a touch bigger
const GATE_ROT = Math.PI;       // the glTF gate/drawbridge faces -z (the town)
const loader = new GLTFLoader();

// "Inside the castle" = past the gate, within the curtain walls.
function isInside(p) {
  return p.position.x > -22 && p.position.x < 22 && p.position.z > 26 && p.position.z < 66;
}

async function swapCastle(em) {
  const keep = em.scene.userData.keep;
  if (!keep || !keep.ground) return;

  const g = await new Promise((ok, err) => loader.load(URL, (x) => ok(x.scene), undefined, err));
  const s0 = new THREE.Vector3(); new THREE.Box3().setFromObject(g).getSize(s0);
  g.scale.setScalar(TARGET_W / (Math.max(s0.x, s0.z) || 1));
  g.rotation.y = GATE_ROT;
  g.traverse((m) => {
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.userData.__toonDone = true; }
  });
  g.position.set(CX, 0, CZ); g.updateMatrixWorld(true);
  const minY = new THREE.Box3().setFromObject(g).min.y;
  g.position.set(CX, -minY, CZ);
  g.name = 'castle-model';
  em.scene.add(g);
  (em.scene.userData.outdoor = em.scene.userData.outdoor || []).push(g);

  let inside = null;
  function tick() {
    requestAnimationFrame(tick);
    const p = em.player; if (!p) return;
    const onGround = !em.getFloor || em.getFloor() === 0;
    if (!onGround) return;                 // upstairs/cellar: the floor system hides outdoor
    const ins = isInside(p);
    if (ins !== inside) {
      inside = ins;
      g.visible = !ins;                    // glТF keep outside, procedural inside
      keep.ground.visible = ins;
    }
  }
  tick();
}

// ----- self-initialize --------------------------------------------------------
(function boot() {
  let tries = 0;
  const iv = setInterval(async () => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.scene && em.player && em.scene.userData.keep) {
      clearInterval(iv);
      try { await swapCastle(em); }
      catch (err) { console.error('[castleModel] swap failed', err); }
    } else if (tries > 800) { clearInterval(iv); }
  }, 100);
})();
