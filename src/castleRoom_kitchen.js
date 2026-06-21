// castleRoom_kitchen.js — furnishes the castle's KITCHEN (ground floor, back-left
// room: castle-local x ∈ [-22,-10], z ∈ [-11,0]). A busy, lived-in medieval
// castle kitchen in the warm wood/stone OSRS×WoW palette: a great stone hearth /
// oven (real GLB, with a glowing firebox + a cauldron on a hook), a long scrubbed
// prep table laden with a cleaver, chopping board, bread, vegetables and a roast,
// a ceiling rack hung with pots, pans, ladles, dried herbs and sausages, barrels
// of ale, sacks of grain/flour, shelves of crockery and jugs, and a butcher's
// block.
//
// Self-contained: polls window.eldenmoor until the keep ground floor exists, then
// builds a THREE.Group added as a CHILD of scene.userData.keep.ground (castle
// local space; gate = -z, throne = +z, floor y≈0) so it inherits the ground
// floor's show/hide visibility for free. Every mesh is tagged __toonDone (no
// cel-shade) and noCollide (collision is auto-generated elsewhere — we add only
// decoration, and must never block the doorways).
//
// Wiring: one import line in main.js — `import './castleRoom_kitchen.js';`.

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

// ---- shared materials (warm wood / stone / iron / brass) --------------------
const M = {
  oak:    new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.82 }),
  darkOak:new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 0.85 }),
  plank:  new THREE.MeshStandardMaterial({ color: 0x7a5733, roughness: 0.8 }),
  stone:  new THREE.MeshStandardMaterial({ color: 0x8d877b, roughness: 0.95 }),
  stoneD: new THREE.MeshStandardMaterial({ color: 0x6c665b, roughness: 0.98 }),
  iron:   new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.6, metalness: 0.55 }),
  brass:  new THREE.MeshStandardMaterial({ color: 0xb98b3a, roughness: 0.45, metalness: 0.6 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xb5703a, roughness: 0.4, metalness: 0.65 }),
  cream:  new THREE.MeshStandardMaterial({ color: 0xe6dcc2, roughness: 0.55 }),
  clay:   new THREE.MeshStandardMaterial({ color: 0xb06a45, roughness: 0.7 }),
  sack:   new THREE.MeshStandardMaterial({ color: 0xc4ad7e, roughness: 0.95 }),
  bread:  new THREE.MeshStandardMaterial({ color: 0xc98a44, roughness: 0.8 }),
  roast:  new THREE.MeshStandardMaterial({ color: 0x8a4a2a, roughness: 0.7 }),
  cabbage:new THREE.MeshStandardMaterial({ color: 0x6f9b46, roughness: 0.8 }),
  carrot: new THREE.MeshStandardMaterial({ color: 0xd87a2a, roughness: 0.8 }),
  tomato: new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.7 }),
  herb:   new THREE.MeshStandardMaterial({ color: 0x5d7a3a, roughness: 0.9 }),
  sausage:new THREE.MeshStandardMaterial({ color: 0x8c3b2e, roughness: 0.75 }),
  ember:  new THREE.MeshStandardMaterial({ color: 0xff8a2a, emissive: 0xff5a00, emissiveIntensity: 2.2, roughness: 0.6 }),
  soup:   new THREE.MeshStandardMaterial({ color: 0x7a5a2a, roughness: 0.5 }),
};

// ---- tiny mesh helpers ------------------------------------------------------
function tag(m) { m.castShadow = true; m.receiveShadow = true; m.userData.__toonDone = true; m.userData.noCollide = true; return m; }
function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return tag(m); }
function cyl(rt, rb, h, seg, mat, x, y, z) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); return tag(m); }
function sph(r, mat, x, y, z) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat); m.position.set(x, y, z); return tag(m); }
function tor(r, t, mat, x, y, z) { const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 16), mat); m.position.set(x, y, z); return tag(m); }

// ---- composite props --------------------------------------------------------

// A cast-iron cauldron of soup on a swung crane, plus the firebox glow + grill.
// Used either inside a recess of the GLB oven, or as part of the procedural hearth.
function addCauldronAndFire(g, x, z, baseY) {
  // glowing embers + logs at the hearth floor
  g.add(box(1.2, 0.4, 0.35, M.ember, x, baseY + 0.25, z + 0.6));
  for (let i = -1; i <= 1; i++) g.add(cyl(0.08, 0.08, 0.9, 6, M.darkOak, x + i * 0.36, baseY + 0.35, z + 0.6));
  // iron crane swung over the fire with a cauldron
  g.add(cyl(0.05, 0.05, 1.7, 6, M.iron, x + 1.35, baseY + 0.85, z + 0.45));   // crane post
  g.add(box(1.0, 0.06, 0.06, M.iron, x + 0.9, baseY + 1.6, z + 0.45));        // swing arm
  const pot = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.7), M.iron);
  pot.position.set(x + 0.4, baseY + 0.55, z + 0.45); tag(pot); g.add(pot);
  g.add(cyl(0.41, 0.41, 0.04, 14, M.iron, x + 0.4, baseY + 0.9, z + 0.45));    // rim
  g.add(cyl(0.34, 0.34, 0.05, 14, M.soup, x + 0.4, baseY + 0.88, z + 0.45));   // soup
  g.add(cyl(0.03, 0.03, 0.6, 6, M.iron, x + 0.4, baseY + 1.3, z + 0.45));      // chain
  // ONE warm point light — the firebox glow (the only light this module adds)
  const fire = new THREE.PointLight(0xff7a20, 6, 12, 2);
  fire.position.set(x, baseY + 0.6, z + 0.9); fire.userData.__toonDone = true; fire.userData.noCollide = true; g.add(fire);
}

// A procedural fallback stone hearth/oven (used if the GLB fails to load).
function buildHearthProcedural(g, x, z) {
  g.add(box(3.6, 0.5, 1.5, M.stoneD, x, 0.25, z));
  g.add(box(3.4, 2.6, 1.3, M.stone, x, 1.55, z));
  g.add(box(1.7, 1.2, 0.4, M.iron, x, 0.95, z + 0.55));
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.16, 8, 16, Math.PI), M.stoneD);
  arch.position.set(x, 1.5, z + 0.62); tag(arch); g.add(arch);
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.9, 1.3, 4), M.stone);
  hood.rotation.y = Math.PI / 4; hood.position.set(x, 3.5, z + 0.1); tag(hood); g.add(hood);
  g.add(box(1.0, 1.2, 1.0, M.stone, x, 4.6, z));
  for (let i = -2; i <= 2; i++) g.add(cyl(0.03, 0.03, 1.1, 6, M.iron, x + i * 0.32, 0.95, z + 0.74));
  addCauldronAndFire(g, x, z, 0.5);
}

// Load the real GLB oven; drop its feet to y=0, face it +z into the room, then
// add the firebox glow + cauldron in front of it. Falls back to procedural.
function buildHearthGLB(g, x, z) {
  loader.load('./assets/models/props/Kitchen_Oven_Large.glb', (gltf) => {
    const o = gltf.scene;
    o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.userData.__toonDone = true; m.userData.noCollide = true; } });
    // scale to ~2.3m tall, drop feet to floor
    const b0 = new THREE.Box3().setFromObject(o);
    const sz = b0.getSize(new THREE.Vector3());
    const s = 2.3 / Math.max(sz.y, 0.001);
    o.scale.setScalar(s);
    o.rotation.y = Math.PI;                 // face the firebox toward +z (into the room)
    const b = new THREE.Box3().setFromObject(o);
    o.position.set(x, -b.min.y, z);
    o.userData.noCollide = true;
    g.add(o);
    // firebox glow + cauldron crane in front of the oven mouth (now facing +z)
    addCauldronAndFire(g, x, z + 0.4, 0.35);
  }, undefined, () => {
    // load error → procedural hearth so the room is never bare
    buildHearthProcedural(g, x, z);
  });
}

// A long scrubbed prep table laden with food + a cleaver and chopping board.
function buildPrepTable(g, x, z) {
  const topY = 1.0;
  g.add(box(4.2, 0.16, 1.3, M.plank, x, topY, z));        // table top
  for (const sx of [-1.9, 1.9]) for (const sz of [-0.5, 0.5]) g.add(box(0.18, topY, 0.18, M.oak, x + sx, topY / 2, z + sz)); // legs
  g.add(box(4.0, 0.1, 1.1, M.darkOak, x, topY - 0.2, z));  // lower stretcher shelf
  // chopping board + cleaver
  g.add(box(0.9, 0.07, 0.6, M.oak, x - 1.2, topY + 0.11, z - 0.15));
  g.add(box(0.5, 0.02, 0.22, M.iron, x - 1.0, topY + 0.16, z - 0.1));       // cleaver blade
  g.add(box(0.04, 0.04, 0.26, M.darkOak, x - 0.7, topY + 0.16, z - 0.1));    // cleaver handle
  // a roast on a platter
  g.add(cyl(0.42, 0.42, 0.04, 16, M.cream, x + 1.1, topY + 0.1, z - 0.1));   // platter
  const roast = sph(0.3, M.roast, x + 1.1, topY + 0.26, z - 0.1); roast.scale.set(1.3, 0.8, 1.0); g.add(roast);
  // loaves of bread
  for (let i = 0; i < 3; i++) { const b = sph(0.16, M.bread, x + 0.1 + i * 0.34, topY + 0.18, z + 0.35); b.scale.set(1.4, 0.7, 0.9); g.add(b); }
  // chopped vegetables
  for (let i = 0; i < 4; i++) g.add(cyl(0.05, 0.07, 0.18, 6, M.carrot, x - 1.6 + i * 0.18, topY + 0.18, z + 0.35));
  g.add(sph(0.16, M.cabbage, x + 1.7, topY + 0.18, z + 0.3));
  g.add(sph(0.13, M.cabbage, x + 1.4, topY + 0.16, z + 0.4));
  g.add(sph(0.1, M.tomato, x - 0.2, topY + 0.13, z + 0.1));
  g.add(sph(0.1, M.tomato, x - 0.05, topY + 0.13, z + 0.2));
  // a clay jug + a couple of bowls
  g.add(cyl(0.1, 0.13, 0.3, 10, M.clay, x + 1.8, topY + 0.26, z - 0.4));
  g.add(cyl(0.16, 0.12, 0.1, 12, M.cream, x - 0.5, topY + 0.15, z - 0.35));
}

// A butcher's block (thick round chopping stump) with a cleaver and a slab of meat.
function buildButcherBlock(g, x, z) {
  g.add(cyl(0.5, 0.55, 0.9, 14, M.oak, x, 0.45, z));
  g.add(cyl(0.52, 0.52, 0.12, 16, M.plank, x, 0.96, z));   // worn top
  g.add(box(0.4, 0.03, 0.18, M.iron, x + 0.1, 1.04, z));   // cleaver blade laid on top
  g.add(box(0.03, 0.03, 0.22, M.darkOak, x + 0.34, 1.04, z));
  g.add(box(0.4, 0.1, 0.3, M.roast, x - 0.15, 1.07, z + 0.05));   // slab of meat
}

// A ceiling rack hung with pots, pans, ladles, dried herbs and sausages.
function buildHangingRack(g, x, z, len) {
  const railY = 3.4;
  g.add(box(len, 0.12, 0.12, M.darkOak, x, railY, z));                 // the beam
  g.add(box(len, 0.05, 0.05, M.iron, x, railY - 0.1, z));              // iron hanging bar
  for (const sx of [-1, 1]) g.add(cyl(0.04, 0.04, 1.6, 6, M.iron, x + sx * (len / 2 - 0.2), railY + 0.8, z)); // chains to ceiling
  const n = Math.floor(len / 0.7);
  for (let i = 0; i < n; i++) {
    const hx = x - len / 2 + 0.5 + i * 0.7;
    g.add(cyl(0.02, 0.02, 0.18, 5, M.iron, hx, railY - 0.22, z));      // hook
    const kind = i % 4;
    if (kind === 0) {                                                  // a copper pot
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.26, 12), M.copper); p.position.set(hx, railY - 0.46, z); tag(p); g.add(p);
      g.add(tor(0.06, 0.015, M.iron, hx, railY - 0.3, z));
    } else if (kind === 1) {                                           // a frying pan (disc + handle)
      g.add(cyl(0.2, 0.2, 0.05, 14, M.iron, hx, railY - 0.5, z));
      g.add(box(0.04, 0.04, 0.34, M.darkOak, hx, railY - 0.5, z + 0.34));
    } else if (kind === 2) {                                           // a bundle of dried herbs
      for (let k = 0; k < 5; k++) g.add(cyl(0.012, 0.012, 0.45, 4, M.herb, hx + (k - 2) * 0.035, railY - 0.55, z));
      g.add(sph(0.06, M.darkOak, hx, railY - 0.3, z));
    } else {                                                           // a string of sausages
      for (let k = 0; k < 4; k++) { const s = sph(0.08, M.sausage, hx + (k % 2 ? 0.07 : -0.07), railY - 0.42 - k * 0.13, z); s.scale.y = 1.6; g.add(s); }
    }
  }
  // a couple of brass ladles
  g.add(cyl(0.01, 0.01, 0.4, 5, M.brass, x - len / 2 + 0.2, railY - 0.4, z));
  g.add(sph(0.07, M.brass, x - len / 2 + 0.2, railY - 0.62, z));
}

// A wall shelf-unit of crockery: jugs, plates and bowls.
function buildShelves(g, x, z, faceX) {
  // faceX: +1 means the unit's open face points toward +x.
  const shelfY = [0.8, 1.6, 2.4];
  g.add(box(0.3, 2.6, 1.8, M.darkOak, x, 1.3, z));        // backing/frame
  for (const sy of shelfY) g.add(box(0.5, 0.06, 1.8, M.plank, x + faceX * 0.18, sy, z));
  for (let s = 0; s < shelfY.length; s++) {
    const y = shelfY[s] + 0.03;
    for (let i = -1; i <= 1; i++) {
      const cz = z + i * 0.55;
      if (s === 0) { const p = cyl(0.18, 0.18, 0.04, 12, M.cream, x + faceX * 0.2, y + 0.2, cz); p.rotation.z = Math.PI / 2; g.add(p); } // plates on edge
      else if (s === 1) g.add(cyl(0.1, 0.13, 0.3, 10, M.clay, x + faceX * 0.2, y + 0.18, cz));   // jugs
      else g.add(cyl(0.15, 0.11, 0.12, 12, M.cream, x + faceX * 0.2, y + 0.08, cz));             // bowls
    }
  }
}

// A wooden barrel of ale (banded staves).
function buildBarrel(g, x, z, s = 1) {
  const h = 1.1 * s, r = 0.42 * s;
  g.add(cyl(r * 0.86, r * 0.86, h, 14, M.oak, x, h / 2, z));
  const mid = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h * 0.6, 14), M.oak); mid.position.set(x, h / 2, z); tag(mid); g.add(mid);
  for (const by of [0.18, 0.5, 0.82]) g.add(cyl(r * 0.92, r * 0.92, 0.06, 14, M.iron, x, h * by, z));
  g.add(cyl(r * 0.84, r * 0.84, 0.04, 14, M.darkOak, x, h - 0.02, z));   // lid
  g.add(cyl(0.06, 0.06, 0.1, 8, M.darkOak, x + r * 0.7, h * 0.42, z));   // tap bung
}

// A plump sack of grain/flour.
function buildSack(g, x, z, h = 0.9, col = M.sack) {
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, h, 10), col);
  body.position.set(x, h / 2, z); body.scale.x = 1.05; tag(body); g.add(body);
  g.add(sph(0.18, col, x, h, z));                                        // cinched top
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; g.add(box(0.06, 0.16, 0.04, col, x + Math.cos(a) * 0.16, h + 0.08, z + Math.sin(a) * 0.16)); }
}

// ---- the room ---------------------------------------------------------------
function furnishKitchen(ground) {
  const g = new THREE.Group();
  g.name = 'castle-kitchen';
  g.userData.noCollide = true;
  ground.add(g);

  // Room is castle-local x ∈ [-22,-10], z ∈ [-11,0]. Back/gate wall ≈ z=-11,
  // outer wall ≈ x=-22, inner divider ≈ x=-10 (doorway gap z -7..-4 — keep clear),
  // courtyard side ≈ z=0. Centre ≈ (-16, -5.5).

  // Great hearth/oven (real GLB) against the back (gate-side) wall.
  buildHearthGLB(g, -16, -10.0);

  // Long prep table down the middle of the room.
  buildPrepTable(g, -16, -5.5);

  // Butcher's block in the front-left corner.
  buildButcherBlock(g, -20.4, -2.0);

  // Ceiling rack of pots/herbs/sausages over the prep table.
  buildHangingRack(g, -16, -5.5, 4.0);

  // Crockery shelves against the outer wall (face into the room, +x).
  buildShelves(g, -21.7, -7.5, 1);

  // Ale barrels + grain sacks clustered in the back-left corner (clear of hearth).
  buildBarrel(g, -20.8, -9.5);
  buildBarrel(g, -19.7, -9.7, 0.92);
  buildSack(g, -21.3, -5.0, 0.95);
  buildSack(g, -20.6, -4.4, 0.8);
  buildSack(g, -21.4, -4.2, 0.7, M.cream);           // flour sack (lighter)

  // A small worktable with bowls near the front courtyard side (clear of doorway z -7..-4).
  g.add(box(1.5, 0.14, 0.9, M.plank, -20.4, 0.9, -0.6));
  for (const sx of [-0.6, 0.6]) for (const sz of [-0.3, 0.3]) g.add(box(0.12, 0.9, 0.12, M.oak, -20.4 + sx, 0.45, -0.6 + sz));
  g.add(cyl(0.18, 0.14, 0.16, 12, M.cream, -20.6, 1.05, -0.7));
  g.add(cyl(0.1, 0.13, 0.3, 10, M.clay, -20.1, 1.12, -0.5));

  // A couple of barrels, well clear of the doorway.
  buildBarrel(g, -12.5, -1.3, 0.95);
  buildBarrel(g, -12.4, -9.7, 0.9);

  return g;
}

// ---- boot -------------------------------------------------------------------
(function boot() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.scene && em.scene.userData.keep && em.scene.userData.keep.ground) {
      clearInterval(iv);
      try { furnishKitchen(em.scene.userData.keep.ground); }
      catch (err) { console.error('[castleRoom_kitchen] failed', err); }
    } else if (tries > 800) { clearInterval(iv); }
  }, 100);
})();
