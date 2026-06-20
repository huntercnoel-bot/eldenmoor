// villageModels.js — swaps the town's procedural cottages for realistic glTF
// houses from the BabylonJS village pack. town.js leaves invisible colliders at
// each cottage spot (so movement still blocks); this module drops the detailed
// model on top. Models are tagged __toonDone so the global cel-shade skips them
// (they render as realistic PBR, the look we're moving toward).
//
// Self-contained: polls for window.eldenmoor and boots itself; main.js only
// needs `import './villageModels.js';`.

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';
import { COTTAGES } from './town.js';

const VILLAGE = './assets/models/village/';
const loader = new GLTFLoader();
const cache = {};

async function proto(name) {
  if (!cache[name]) {
    cache[name] = await new Promise((ok, err) =>
      loader.load(VILLAGE + name + '.glb', (g) => ok(g.scene), undefined, err));
  }
  return cache[name];
}

// Clone a prototype, scale it to a target footprint width, plant it on the
// ground, tag it out of the cel-shade pass, and add it to a parent group.
function place(parent, name, x, z, ry, targetW) {
  const src = cache[name]; if (!src) return null;
  const o = src.clone(true);
  o.rotation.y = ry;
  // scale to target width
  const s0 = new THREE.Vector3(); new THREE.Box3().setFromObject(o).getSize(s0);
  const w = Math.max(s0.x, s0.z) || 1;
  o.scale.setScalar((targetW || 7) / w);
  o.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true; m.receiveShadow = true;
      m.userData.__toonDone = true;            // keep it OUT of the cel-shade pass
    }
  });
  o.position.set(x, 0, z);
  const minY = new THREE.Box3().setFromObject(o).min.y;
  o.position.set(x, -minY, z);                 // plant on the ground
  parent.add(o);
  return o;
}

async function buildVillage(em) {
  const root = new THREE.Group();
  root.name = 'village-models';
  em.scene.add(root);
  // hide it with the rest of the outdoor town when you go up/down a floor
  (em.scene.userData.outdoor = em.scene.userData.outdoor || []).push(root);

  await Promise.all([proto('cottage').catch(() => {}), proto('inn').catch(() => {})]);

  // One house per town cottage spot. The biggest two spots get the inn for
  // variety; the rest get cottages. Each turned to roughly face the square.
  COTTAGES.forEach(([x, z, rot], i) => {
    const big = (i === 2 || i === 3);          // the two back corners → inns
    const name = big ? 'inn' : 'cottage';
    const face = (x < 0 ? Math.PI / 2 : -Math.PI / 2) + rot;   // doorway toward centre
    place(root, name, x, z, face, big ? 9 : 7);
  });

  return root;
}

// ----- self-initialize --------------------------------------------------------
(function boot() {
  let tries = 0;
  const iv = setInterval(async () => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.scene && em.player) {
      clearInterval(iv);
      try { await buildVillage(em); }
      catch (err) { console.error('[villageModels] build failed', err); }
    } else if (tries > 800) { clearInterval(iv); }
  }, 100);
})();
