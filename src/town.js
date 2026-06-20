// town.js — the town that wraps the castle (Stormwind grandeur × Lumbridge cosiness):
// a paved square + approach road, lamp posts, a grand fountain, banner poles at the
// gate, market stalls, timber cottages, a chapel, fences, a signpost and props.
// The whole thing is pushed into scene.userData.buildings so collision.js makes
// the solid bits (cottages, fountain, fences, posts) block you automatically.

import * as THREE from '../vendor/three.module.js';
import { stoneTexture, plasterTexture, shingleTexture } from './textures.js';

let TX = null;
function tex() { if (!TX) TX = { road: stoneTexture(10), plaster: plasterTexture(), shingle: shingleTexture(4), wall: stoneTexture(3) }; return TX; }

const flat = (c, r = 0.95) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0, flatShading: true });
const mapped = (m, c = 0xffffff, r = 0.92) => new THREE.MeshStandardMaterial({ map: m, color: c, roughness: r, metalness: 0 });
const deco = (m) => { m.userData.noCollide = true; return m; };
function box(w, h, d, mat, x, y, z, sh = true) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = sh; m.receiveShadow = true; return m; }
function cyl(rt, rb, h, seg, mat, x, y, z) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }

const COTTAGES = [
  [-24, 4, 0.1], [24, 4, -0.1], [-27, 13, 0.25], [27, 13, -0.25], [-12, -6, 0.1], [12, -6, -0.1],
];
const CHAPEL = [-28, 16];

// Footprints (world.js uses these so trees avoid the town).
export function townStructures() {
  const s = COTTAGES.map(([x, z]) => ({ x, z, r: 4.5 }));
  s.push({ x: CHAPEL[0], z: CHAPEL[1], r: 6 });
  s.push({ x: -6, z: 16, r: 5 });    // fountain
  s.push({ x: 30, z: -6, r: 3.5 });  // windmill
  s.push({ x: 26, z: 2, r: 4.5 });   // stable
  s.push({ x: -30, z: 4, r: 5 });    // graveyard
  return s;
}

export function buildTown(scene) {
  const T = tex();
  const g = new THREE.Group();
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe6a3, emissive: 0xffb142, emissiveIntensity: 1.4, roughness: 0.5 });
  const dark = flat(0x2a2622), wood = flat(0x6b4a2c), stone = mapped(T.wall);

  // --- paving: square + approach road (flat, walkable) ---
  g.add(deco(box(34, 0.16, 16, mapped(T.road, 0xc2b79a), 0, 0.04, 16, false)));
  g.add(deco(box(7, 0.16, 26, mapped(T.road, 0xb8ad90), 0, 0.05, 1, false)));

  // --- lamp posts ---
  const lampPost = (x, z) => {
    g.add(cyl(0.12, 0.16, 3.2, 8, dark, x, 1.6, z));
    g.add(cyl(0.28, 0.28, 0.12, 8, dark, x, 3.25, z));
    g.add(deco(box(0.34, 0.5, 0.34, lampMat, x, 3.55, z)));
    g.add(deco(box(0.16, 0.3, 0.16, dark, x, 3.9, z)));
  };
  for (const z of [2, 7, 12]) for (const sx of [-1, 1]) lampPost(sx * 4.5, z);
  for (const c of [[-8, 23], [8, 23], [-4, 10], [4, 10]]) lampPost(c[0], c[1]);

  // --- banner poles flanking the gate ---
  const bannerPole = (x, z, col) => {
    g.add(cyl(0.14, 0.16, 7, 8, dark, x, 3.5, z));
    g.add(deco(box(1.4, 3.0, 0.1, flat(col), x, 5.0, z + 0.12)));
    g.add(deco(box(0.6, 0.6, 0.12, flat(0xd8b24a), x, 5.0, z + 0.18)));
    g.add(deco(cyl(0.22, 0.22, 0.25, 8, flat(0xd8b24a), x, 7.1, z)));
  };
  bannerPole(-5, 23.5, 0x274a8a); bannerPole(5, 23.5, 0x274a8a);
  bannerPole(-9, 23.5, 0x6e2f2f); bannerPole(9, 23.5, 0x6e2f2f);

  // --- grand fountain (centrepiece) ---
  const fx = -6, fz = 16;   // off the central gate approach so click-to-move stays clear
  const water = new THREE.MeshStandardMaterial({ color: 0x2f6ea5, roughness: 0.2, metalness: 0.2, transparent: true, opacity: 0.85 });
  g.add(cyl(3.0, 3.3, 0.9, 16, stone, fx, 0.45, fz));            // basin (solid → blocks)
  g.add(deco(cyl(2.7, 2.7, 0.2, 16, water, fx, 0.85, fz)));
  g.add(deco(cyl(1.4, 1.6, 0.8, 12, stone, fx, 1.3, fz)));       // upper tier
  g.add(deco(cyl(1.1, 1.1, 0.15, 12, water, fx, 1.75, fz)));
  g.add(deco(cyl(0.3, 0.4, 1.6, 8, stone, fx, 2.4, fz)));
  g.add(deco(cyl(0.6, 0.0, 0.8, 8, flat(0xd8b24a), fx, 3.4, fz)));

  // --- market stalls ---
  const stall = (x, z, col) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0.08, 0.08, 2.0, 6, wood, x + sx * 1.3, 1.0, z + sz * 0.9));
    g.add(deco(box(3.2, 0.22, 2.4, flat(col), x, 2.2, z)));        // awning
    g.add(box(2.8, 0.9, 1.6, wood, x, 0.45, z));                   // table
    const produce = [0xc44536, 0xe3b04b, 0x6a8d3a, 0x8a1f1f, 0xd9822b];
    for (let i = 0; i < 5; i++) g.add(deco(box(0.4, 0.4, 0.4, flat(produce[i]), x - 1 + i * 0.5, 1.1, z)));
  };
  stall(6, 13, 0x8a1f1f); stall(6, 20, 0x274a8a); stall(-6, 9, 0x2f8a4a); stall(-6, 22, 0xc9a24a);

  // --- cottages (solid scenery) ---
  const cwalls = [0xcdb98c, 0xd8c49a, 0xc2a98a], croofs = [0x7a4a2a, 0x6e3a2a, 0x46586a];
  const cottage = (x, z, rot, wallc, roofc) => {
    const c = new THREE.Group();
    c.add(box(6, 3, 5, mapped(T.plaster, wallc), 0, 1.5, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.add(deco(box(0.3, 3, 0.3, flat(0x4a3220), sx * 3, 1.5, sz * 2.5)));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2.6, 4), mapped(T.shingle, roofc)); roof.position.y = 4.3; roof.rotation.y = Math.PI / 4; roof.castShadow = true; deco(roof); c.add(roof);
    c.add(deco(box(1.2, 2.0, 0.2, flat(0x4a3220), 0, 1.0, -2.55))); // door
    c.add(deco(box(1.0, 1.0, 0.16, flat(0x86bcd6), 1.8, 1.7, -2.55))); // window
    c.add(deco(box(0.7, 1.8, 0.7, stone, 2.0, 2.6, 1.8)));          // chimney
    c.position.set(x, 0, z); c.rotation.y = rot; g.add(c);
  };
  COTTAGES.forEach(([x, z, rot], i) => cottage(x, z, rot, cwalls[i % 3], croofs[i % 3]));

  // --- chapel (Lumbridge-style church with a steeple) ---
  const chapel = (x, z) => {
    const c = new THREE.Group();
    c.add(box(7, 4.5, 11, mapped(T.plaster, 0xd6cbb0), 0, 2.25, 0));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 3.0, 4), mapped(T.shingle, 0x5a4a6a)); roof.position.y = 6.0; roof.rotation.y = Math.PI / 4; roof.castShadow = true; deco(roof); c.add(roof);
    c.add(box(2.4, 7, 2.4, mapped(T.wall), 0, 3.5, -6.5));          // steeple tower
    const st = new THREE.Mesh(new THREE.ConeGeometry(1.9, 3.0, 4), mapped(T.shingle, 0x5a4a6a)); st.position.set(0, 8.5, -6.5); st.rotation.y = Math.PI / 4; deco(st); c.add(st);
    c.add(deco(box(0.25, 1.4, 0.25, flat(0xd8b24a), 0, 10.6, -6.5))); // cross
    c.add(deco(box(1.0, 0.25, 0.25, flat(0xd8b24a), 0, 10.4, -6.5)));
    c.add(deco(box(1.6, 2.6, 0.2, flat(0x4a3220), 0, 1.3, 5.55)));   // door
    for (const sz of [-2, 0, 2]) c.add(deco(box(0.18, 1.8, 1.0, flat(0x9a6cff), 3.55, 2.4, sz))); // stained glass
    c.position.set(x, 0, z); g.add(c);
  };
  chapel(CHAPEL[0], CHAPEL[1]);

  // --- fences along the road ---
  const fenceRun = (x0, z0, x1, z1) => {
    const dx = x1 - x0, dz = z1 - z0, n = Math.max(1, Math.round(Math.hypot(dx, dz) / 1.4));
    for (let i = 0; i <= n; i++) { const t = i / n; g.add(box(0.16, 1.0, 0.16, wood, x0 + dx * t, 0.5, z0 + dz * t)); }
    g.add(deco(box(Math.max(0.1, Math.abs(dx)) + 0.1, 0.12, Math.max(0.1, Math.abs(dz)) + 0.1, wood, (x0 + x1) / 2, 0.8, (z0 + z1) / 2)));
  };
  fenceRun(-7, 2, -7, 8); fenceRun(7, 2, 7, 8);

  // --- signpost near spawn ---
  g.add(cyl(0.12, 0.12, 2.2, 6, wood, 2, 1.1, 4));
  g.add(deco(box(1.8, 0.5, 0.16, flat(0x6b4a2c), 2.9, 1.9, 4)));

  // --- props ---
  for (const p of [[5, 11], [-5, 11], [7, 21], [-3, 22]]) g.add(cyl(0.4, 0.46, 0.95, 10, wood, p[0], 0.47, p[1])); // barrels
  for (const p of [[8, 23], [-8, 21], [3, 6]]) g.add(box(0.9, 0.9, 0.9, wood, p[0], 0.45, p[1]));                  // crates
  for (const p of [[6, 5], [-6, 5]]) g.add(cyl(0.7, 0.7, 1.0, 10, flat(0xc9a24a), p[0], 0.5, p[1]));               // hay bales

  // --- windmill (Lumbridge-style) ---
  const windmill = (x, z) => {
    g.add(cyl(2.2, 2.6, 7, 12, stone, x, 3.5, z));
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.2, 12), mapped(T.shingle, 0x5a4a3a)); cap.position.set(x, 8.0, z); cap.rotation.y = Math.PI / 4; cap.castShadow = true; deco(cap); g.add(cap);
    g.add(deco(box(1.2, 2.0, 0.2, flat(0x4a3220), x, 1.0, z - 2.5)));
    const hub = new THREE.Group(); hub.position.set(x, 6.0, z - 2.7); hub.rotation.z = 0.3;
    hub.add(deco(cyl(0.3, 0.3, 0.4, 8, flat(0x4a3220), 0, 0, 0)));
    for (let i = 0; i < 4; i++) { const blade = new THREE.Group(); blade.rotation.z = i / 4 * Math.PI * 2; blade.add(deco(box(0.18, 3.6, 0.12, wood, 0, 1.9, 0.1))); blade.add(deco(box(0.7, 2.6, 0.06, flat(0xe6ddc8), 0.45, 2.3, 0.16))); hub.add(blade); }
    g.add(hub);
  };
  windmill(30, -6);

  // --- graveyard beside the chapel ---
  const graveyard = (cx, cz) => {
    const gs = flat(0x8a8780), iron = flat(0x2a2622);
    for (let x = -4; x <= 4; x += 1) { g.add(box(0.1, 0.8, 0.1, iron, cx + x, 0.4, cz - 4)); g.add(box(0.1, 0.8, 0.1, iron, cx + x, 0.4, cz + 4)); }
    for (let z = -3; z <= 3; z += 1) { g.add(box(0.1, 0.8, 0.1, iron, cx - 4, 0.4, cz + z)); g.add(box(0.1, 0.8, 0.1, iron, cx + 4, 0.4, cz + z)); }
    for (const p of [[-2.5, -2], [0, -2.5], [2.5, -1.5], [-2, 1], [1.5, 1.5], [-1, 2.8]]) { g.add(deco(box(0.7, 1.0, 0.18, gs, cx + p[0], 0.5, cz + p[1]))); g.add(deco(cyl(0.35, 0.35, 0.18, 10, gs, cx + p[0], 1.0, cz + p[1]))); }
    g.add(box(1.4, 0.6, 2.2, gs, cx + 2.5, 0.3, cz + 2.6)); g.add(deco(box(1.6, 0.2, 2.4, gs, cx + 2.5, 0.65, cz + 2.6)));
    g.add(box(0.4, 2.6, 0.4, flat(0x3a2a1a), cx - 3, 1.3, cz + 3));
    for (const a of [0.6, -0.5, 0.2]) g.add(deco(box(0.16, 1.4, 0.16, flat(0x3a2a1a), cx - 3 + Math.sin(a) * 0.6, 2.4, cz + 3 + Math.cos(a) * 0.3)));
  };
  graveyard(-30, 4);

  // --- stable + horse ---
  const horse = (x, z) => {
    const h = flat(0x5a3a26), mane = flat(0x2a1c12);
    g.add(deco(box(1.7, 0.9, 0.7, h, x, 1.3, z)));
    for (const p of [[-0.6, -0.25], [0.6, -0.25], [-0.6, 0.25], [0.6, 0.25]]) g.add(deco(box(0.18, 1.0, 0.18, h, x + p[0], 0.5, z + p[1])));
    g.add(deco(box(0.42, 0.9, 0.5, h, x - 0.95, 1.7, z))); g.add(deco(box(0.5, 0.42, 0.42, h, x - 1.2, 2.05, z)));
    g.add(deco(box(0.1, 0.8, 0.5, mane, x - 0.8, 1.9, z))); g.add(deco(box(0.1, 0.7, 0.2, mane, x + 0.85, 1.5, z)));
  };
  const stable = (cx, cz) => {
    const barn = flat(0x8a5a32);
    g.add(box(0.3, 3, 5, barn, cx + 2.8, 1.5, cz)); g.add(box(5.6, 3, 0.3, barn, cx, 1.5, cz - 2.4)); g.add(box(5.6, 3, 0.3, barn, cx, 1.5, cz + 2.4));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 2.0, 4), mapped(T.shingle, 0x6e3a2a)); roof.position.set(cx, 4.0, cz); roof.rotation.y = Math.PI / 4; roof.castShadow = true; deco(roof); g.add(roof);
    g.add(deco(cyl(0.7, 0.7, 1.0, 10, flat(0xc9a24a), cx + 1.5, 0.5, cz + 1.6)));
    g.add(box(1.6, 0.5, 0.6, wood, cx - 1, 0.25, cz - 1.7));
    horse(cx, cz);
  };
  stable(26, 2);

  // --- hedges, flower beds, lanterns, notice board ---
  const hedge = (x0, z0, x1, z1) => { const dx = x1 - x0, dz = z1 - z0, n = Math.max(1, Math.round(Math.hypot(dx, dz) / 1.5)); for (let i = 0; i <= n; i++) { const t = i / n; g.add(box(1.0, 1.0, 1.0, flat(0x3f6e3a), x0 + dx * t, 0.5, z0 + dz * t)); } };
  hedge(-5, -10, -5, -2); hedge(5, -10, 5, -2);
  const flowerBed = (x, z) => { g.add(deco(box(2.0, 0.3, 1.2, flat(0x3a5a2a), x, 0.16, z))); const cols = [0xc0392b, 0xd4ac0d, 0x8e44ad, 0xe6e6e6]; for (let i = 0; i < 6; i++) g.add(deco(box(0.16, 0.3, 0.16, flat(cols[i % 4]), x - 0.8 + i * 0.32, 0.45, z + (i % 2 ? 0.3 : -0.3)))); };
  flowerBed(-8, -6); flowerBed(8, -6); flowerBed(-10, 22); flowerBed(10, 22);
  for (const z of [-8, -3]) for (const sx of [-1, 1]) { g.add(cyl(0.1, 0.13, 2.6, 8, dark, sx * 4.5, 1.3, z)); g.add(deco(box(0.3, 0.4, 0.3, lampMat, sx * 4.5, 2.8, z))); }
  g.add(cyl(0.1, 0.1, 2.0, 6, wood, -3, 1.0, -2)); g.add(cyl(0.1, 0.1, 2.0, 6, wood, -1.5, 1.0, -2));
  g.add(deco(box(2.0, 1.2, 0.12, flat(0x6b4a2c), -2.25, 1.7, -2)));
  for (const p of [[-2.8, 1.8], [-1.8, 1.9], [-2.4, 1.5]]) g.add(deco(box(0.4, 0.5, 0.14, flat(0xe6ddc8), p[0], p[1], -1.92)));

  // --- causeway railings flanking the gate approach (over the moat) ---
  for (let z = 19; z <= 23.5; z += 1.1) for (const sx of [-1, 1]) g.add(box(0.18, 0.95, 0.18, stone, sx * 9.6, 0.47, z));
  for (const sx of [-1, 1]) g.add(deco(box(0.25, 0.18, 4.8, stone, sx * 9.6, 1.0, 21.2)));

  scene.add(g);
  (scene.userData.buildings = scene.userData.buildings || []).push(g);
  (scene.userData.outdoor = scene.userData.outdoor || []).push(g);
  return g;
}
