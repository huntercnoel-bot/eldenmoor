// showcase.js — a SEPARATE area, far from town, for viewing new assets in-game
// without disturbing the existing world. A floating button teleports you there
// and back.
//
// Builds a REALISTIC medieval village out of the BabylonJS village pack
// (detailed, non-cartoonish). Kept OUT of the global cel-shade pass (each mesh
// tagged __toonDone) so it renders with real PBR materials + the world's
// lighting — the look we're moving toward. (Castle: parked for later.)
//
// Self-contained: polls for window.eldenmoor and boots itself; main.js only
// needs `import './showcase.js';`.

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';

const VILLAGE = './assets/models/village/';
const ORIGIN = new THREE.Vector3(120, 0, 0);   // flat 300×300 world → clear of town
const loader = new GLTFLoader();
const cache = {};

async function proto(name) {
  if (!cache[name]) {
    cache[name] = await new Promise((ok, err) =>
      loader.load(VILLAGE + name + '.glb', (g) => ok(g.scene), undefined, err));
  }
  return cache[name];
}

// Build a proper medieval VILLAGE from the pack (no fake castle — that's parked
// for later). Pieces are cloned from cached prototypes; every mesh is tagged so
// the cel-shade pass skips it (realistic PBR look).
async function buildRealm(em) {
  const root = new THREE.Group();
  root.name = 'showcase-realm';
  root.position.copy(ORIGIN);
  em.scene.add(root);

  const names = ['inn', 'cottage', 'sawMill', 'waterwell', 'wagon', 'barrel',
                 'crateStack', 'crate1', 'fence', 'lightPost1', 'logSaw',
                 'tree1', 'tree2', 'rocks1'];
  await Promise.all(names.map((n) => proto(n).catch(() => {})));

  const add = (name, x, z, ry = 0, s = 1.2) => {
    const src = cache[name]; if (!src) return null;
    const o = src.clone(true);
    o.rotation.y = ry; o.scale.setScalar(s);
    o.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true; m.receiveShadow = true;
        m.userData.__toonDone = true;          // keep it OUT of the cel-shade pass
      }
    });
    o.position.set(x, 0, z);
    const minY = new THREE.Box3().setFromObject(o).min.y;
    o.position.set(x, -minY, z);               // plant on the ground
    root.add(o);
    return o;
  };

  // ---- Village square: a well at the centre, the inn anchoring the north ----
  add('inn', 0, -16, 0, 1.5);                  // tavern / centrepiece
  add('waterwell', 0, 0, 0, 1.1);              // central well
  add('wagon', 6, 4, 0.6);
  add('crateStack', -5, 4, 0.3);
  add('barrel', -6.5, 2.5, 0);
  add('crate1', 5.5, -2, 0.5);

  // Cottages ringing the square, each turned to face the centre
  add('cottage', -14, -6, Math.PI / 2);
  add('cottage', -13, 7, Math.PI / 2);
  add('cottage', 14, -6, -Math.PI / 2);
  add('cottage', 13, 8, -Math.PI / 2);
  add('cottage', -7, 16, Math.PI);
  add('cottage', 8, 17, Math.PI);

  // Working edge: sawmill + log saw
  add('sawMill', -20, -14, Math.PI * 0.5, 1.3);
  add('logSaw', -19, -6, 0.4, 1.2);

  // Lamp posts at the square corners
  add('lightPost1', -7, -7, 0, 1.2);
  add('lightPost1',  7, -7, 0, 1.2);
  add('lightPost1', -7,  9, 0, 1.2);
  add('lightPost1',  7,  9, 0, 1.2);

  // Fences + greenery around the rim
  add('fence', -3, 22, 0, 1.4);
  add('fence',  3, 22, 0, 1.4);
  add('tree1', 22, -2, 0, 1.7);
  add('tree2', -24, 4, 0.6, 1.6);
  add('tree1', -20, 18, 0.3, 1.5);
  add('tree2', 22, 16, 1.0, 1.6);
  add('rocks1', 18, 12, 0.3, 1.3);
  add('rocks1', -16, -2, 1.1, 1.2);

  return root;
}

// Floating teleport button.
function makeButton(em) {
  const btn = document.createElement('button');
  btn.id = 'showcase-btn';
  btn.textContent = '🏰 View new assets';
  btn.style.cssText =
    'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:30;' +
    'padding:8px 16px;cursor:pointer;font:600 13px Georgia,serif;color:#ffe9b8;' +
    'background:linear-gradient(#3a2a17,#1d1207);border:1px solid #b9892f;border-radius:8px;' +
    'box-shadow:0 2px 10px rgba(0,0,0,0.6),inset 0 0 8px rgba(255,200,110,0.15);';
  let atShowcase = false, home = null;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const p = em.player;
    if (!atShowcase) {
      home = p.position.clone();
      p.position.set(ORIGIN.x, p.position.y, ORIGIN.z + 13);  // at the village square
      p.rotation.y = Math.PI;
      btn.textContent = '← Back to town';
      atShowcase = true;
    } else {
      if (home) p.position.copy(home);
      btn.textContent = '🏰 View new assets';
      atShowcase = false;
    }
  });
  document.body.appendChild(btn);
}

// ----- self-initialize --------------------------------------------------------
(function boot() {
  let tries = 0;
  const iv = setInterval(async () => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.scene && em.player) {
      clearInterval(iv);
      makeButton(em);
      em.gotoShowcase = () => { em.player.position.set(ORIGIN.x, em.player.position.y, ORIGIN.z + 13); };
      try { await buildRealm(em); }
      catch (err) { console.error('[showcase] build failed', err); }
    } else if (tries > 800) { clearInterval(iv); }
  }, 100);
})();
