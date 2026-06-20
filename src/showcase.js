// showcase.js — a SEPARATE "asset gallery" area, far from the town, where new
// downloaded glTF assets can be viewed in-game without disturbing the existing
// world. A floating button teleports the player out here and back.
//
// Currently shows: the KayKit "Dungeon Remastered" modular kit (CC0) built into
// a little keep / throne room, plus the KayKit "Adventurers" characters — so you
// can judge the look in-engine (cel-shaded, real lighting) before we commit to
// re-skinning the real castle or NPCs.
//
// Self-contained: polls for window.eldenmoor (+ its assets pipeline) and boots
// itself; main.js only needs `import './showcase.js';`.

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';

const DUNGEON = './assets/models/kaykit_dungeon/';
const ORIGIN = new THREE.Vector3(120, 0, 0);   // flat world is 300×300, so this is clear of town
const loader = new GLTFLoader();

function load(name) {
  return new Promise((ok, err) => loader.load(DUNGEON + name + '.glb', (g) => ok(g.scene), undefined, err));
}

// Build the gallery structure out of dungeon pieces. Each unique piece is
// loaded ONCE (in parallel) then cloned for repeats — fast, since these are
// static meshes.
async function buildKeep(em) {
  const root = new THREE.Group();
  root.name = 'showcase-keep';
  root.position.copy(ORIGIN);
  em.scene.add(root);

  // Preload every unique piece we use, in parallel.
  const names = ['floor_tile_large', 'wall', 'wall_arched', 'wall_corner', 'pillar',
                 'stairs', 'chair', 'banner_red', 'banner_blue', 'torch',
                 'table_long', 'barrel_large', 'coin_stack_large'];
  const proto = {};
  await Promise.all(names.map(async (n) => { try { proto[n] = await load(n); } catch (e) {} }));

  const add = (name, x, y, z, ry = 0, s = 1) => {
    const src = proto[name]; if (!src) return null;
    const obj = src.clone(true);
    obj.position.set(x, y, z); obj.rotation.y = ry; obj.scale.setScalar(s);
    obj.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    root.add(obj);
    return obj;
  };

  // Grid unit from the floor tile's footprint.
  const bb = new THREE.Box3().setFromObject(proto.floor_tile_large);
  const size = new THREE.Vector3(); bb.getSize(size);
  const TILE = Math.max(size.x, size.z) || 4;
  const half = TILE / 2;

  // Floor grid (x:-2..2, z:-4..1)
  for (let i = -2; i <= 2; i++)
    for (let j = -4; j <= 1; j++) add('floor_tile_large', i * TILE, 0, j * TILE);

  // Back wall with a central arch
  for (let i = -2; i <= 2; i++)
    add(i === 0 ? 'wall_arched' : 'wall', i * TILE, 0, -4 * TILE - half, 0);
  // Side walls (front left open as the entrance)
  for (let j = -4; j <= 1; j++) {
    add('wall', -2 * TILE - half, 0, j * TILE, Math.PI / 2);
    add('wall',  2 * TILE + half, 0, j * TILE, -Math.PI / 2);
  }
  add('wall_corner', -2 * TILE - half, 0, -4 * TILE - half, 0);
  add('wall_corner',  2 * TILE + half, 0, -4 * TILE - half, Math.PI / 2);

  // Pillars lining the aisle
  for (let j = -3; j <= 0; j++) {
    add('pillar', -1 * TILE, 0, j * TILE, 0);
    add('pillar',  1 * TILE, 0, j * TILE, 0);
  }

  // Dais + throne + torches + banners
  add('stairs', 0, 0, -3 * TILE, 0);
  add('chair', 0, 0.6, -3.6 * TILE, 0, 1.5);
  add('banner_red',  -1 * TILE, 0, -4 * TILE - half + 0.3, 0);
  add('banner_blue',  1 * TILE, 0, -4 * TILE - half + 0.3, 0);
  add('torch', -1 * TILE, 0, -3.5 * TILE, 0);
  add('torch',  1 * TILE, 0, -3.5 * TILE, 0);

  // A little treasure near the entrance
  add('table_long', -1.4 * TILE, 0, 0.4 * TILE, Math.PI * 0.15);
  add('barrel_large', 1.6 * TILE, 0, 0.5 * TILE, 0);
  add('coin_stack_large', -1.0 * TILE, 0, 0.2 * TILE, 0);

  // Re-skin to the cel-shaded look so it reads as it would in-engine.
  if (em.applyToonTo) { try { em.applyToonTo(root); } catch (e) {} }
  return { root, TILE };
}

// A small floating button to teleport to / from the gallery.
function makeButton(em) {
  const btn = document.createElement('button');
  btn.id = 'showcase-btn';
  btn.textContent = '🏰 View new assets';
  btn.style.cssText =
    'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:30;' +
    'padding:8px 16px;cursor:pointer;font:600 13px Georgia,serif;color:#ffe9b8;' +
    'background:linear-gradient(#3a2a17,#1d1207);border:1px solid #b9892f;border-radius:8px;' +
    'box-shadow:0 2px 10px rgba(0,0,0,0.6),inset 0 0 8px rgba(255,200,110,0.15);';
  let atShowcase = false;
  let home = null;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const p = em.player;
    if (!atShowcase) {
      home = p.position.clone();
      p.position.set(ORIGIN.x, p.position.y, ORIGIN.z + 2);  // just inside the entrance
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
    if (em && em.scene && em.player && em.assets) {
      clearInterval(iv);
      makeButton(em);
      em.gotoShowcase = () => { em.player.position.set(ORIGIN.x, em.player.position.y, ORIGIN.z + 2); };
      try {
        await buildKeep(em);
        // The four KayKit adventurers, standing in the hall facing the entrance.
        const sp = em.assets.spawnCharacter;
        const z = ORIGIN.z - 7;
        await Promise.all([
          sp('Knight',    { position: [ORIGIN.x - 4.5, 0, z], rotationY: Math.PI, anim: 'Idle' }),
          sp('Barbarian', { position: [ORIGIN.x - 1.5, 0, z], rotationY: Math.PI, anim: 'Idle' }),
          sp('Rogue',     { position: [ORIGIN.x + 1.5, 0, z], rotationY: Math.PI, anim: 'Idle' }),
          sp('Mage',      { position: [ORIGIN.x + 4.5, 0, z], rotationY: Math.PI, anim: 'Idle' }),
        ]);
      } catch (err) { console.error('[showcase] build failed', err); }
    } else if (tries > 800) { clearInterval(iv); }
  }, 100);
})();
