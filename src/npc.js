// npc.js — shopkeepers, the castle court, and townsfolk. Builds simple figures
// with floating name labels, and registers them for clicking/right-clicking.

import * as THREE from '../vendor/three.module.js';

const NPC_DEFS = [
  // --- shopkeepers (now standing behind the counter INSIDE each shop) ---
  { id: 'bramble', name: 'Bramble', role: 'General Store', x: -15, z: 16, robe: 0x3f6e44,
    type: 'shop', shop: 'general', examine: 'A cheerful general-store keeper.', flavor: 'Finest oddments in all Eldenmoor! Come in, come in.' },
  { id: 'hilda', name: 'Hilda', role: "Hilda's Axes", x: 15, z: 16, robe: 0x6e3a3a,
    type: 'shop', shop: 'axes', examine: 'A burly axe merchant.', flavor: 'A sharp axe makes light work, love. Step inside.' },

  // --- castle court ---
  { id: 'king', name: 'King Aldric', role: 'the Crown', x: 0, z: 62, robe: 0x5e2a8a, crown: true, hair: 0xcfc4b0,
    type: 'royal', examine: 'The sovereign of Eldenmoor, draped in royal purple.',
    flavor: 'Welcome to my hall, adventurer. Eldenmoor has need of brave souls like you.' },
  { id: 'duke', name: 'Duke Veylin', role: 'Royal Steward', x: 4, z: 61, robe: 0x274a7a,
    type: 'plain', examine: "The king's steward, keeper of the realm's affairs.",
    flavor: 'Seek the King if you crave purpose — and mind your manners in his hall.' },
  { id: 'guard_l', name: 'Royal Guard', role: 'Gatehouse Watch', x: -3.5, z: 26, robe: 0x565b62, guard: true,
    type: 'plain', examine: 'A steadfast guard in plate, watching the gate.', flavor: 'The gate stands open to honest folk.' },
  { id: 'guard_r', name: 'Royal Guard', role: 'Gatehouse Watch', x: 3.5, z: 26, robe: 0x565b62, guard: true,
    type: 'plain', examine: 'A steadfast guard in plate, watching the gate.', flavor: 'Keep the peace within these walls, friend.' },
  { id: 'guard_il', name: 'Royal Guard', role: 'Keep Watch', x: -4, z: 44, robe: 0x565b62, guard: true,
    type: 'plain', examine: 'A guard posted at the keep’s inner gate.', flavor: 'None pass to the King unannounced — but you seem alright.' },
  { id: 'guard_ir', name: 'Royal Guard', role: 'Keep Watch', x: 4, z: 44, robe: 0x565b62, guard: true,
    type: 'plain', examine: 'A guard posted at the keep’s inner gate.', flavor: 'The great hall lies ahead. Tread proudly.' },
  { id: 'banker', name: 'Edra', role: 'Bank of Eldenmoor', x: 17, z: 38, robe: 0x3a5f3a,
    type: 'plain', examine: 'A sharp-eyed banker. (A proper bank is coming soon!)',
    flavor: 'Your coin is safe with the Bank of Eldenmoor. The vaults open shortly!' },
  { id: 'cook', name: 'Bessa', role: 'Castle Cook', x: -18, z: 37, robe: 0xb08a5a, apron: true,
    type: 'plain', examine: 'The castle cook, flour to her elbows.', flavor: 'Mind the oven, dear — hot bread for the King’s table!' },

  // --- townsfolk (the square) ---
  { id: 'tomas', name: 'Old Tomas', role: 'Townsfolk', x: 4, z: 11, robe: 0x6a5a3a, hair: 0xb9b2a4,
    type: 'plain', examine: 'A weathered old townsman, watching the square.',
    flavor: 'Grand town, this. The King keeps us safe behind those walls.' },
  { id: 'mara', name: 'Mara', role: 'Market Trader', x: 4, z: 19, robe: 0x8a3a5a,
    type: 'plain', examine: 'A bright-eyed market trader.', flavor: 'Fresh wares at the stalls! Mind the fountain, love.' },
  { id: 'smith', name: 'Garrett', role: 'Blacksmith', x: 10, z: 6, robe: 0x4a4640, hair: 0x2a2018, apron: true,
    type: 'shop', shop: 'armoury', examine: 'A soot-streaked blacksmith with brawny arms.', flavor: 'Armour for the road? Step up to the anvil, friend.' },
  { id: 'farmer', name: 'Pell', role: 'Farmer', x: 8, z: -9, robe: 0x6a7a3a, hair: 0xb9a06a,
    type: 'plain', examine: 'A cheerful farmer with hay on his boots.', flavor: 'Good harvest this year, thank the King. Mind the windmill yonder.' },
  { id: 'nun', name: 'Sister Adela', role: 'Chapel', x: -25, z: 13, robe: 0x4a4a5a, hair: 0xcccccc,
    type: 'plain', examine: 'A gentle sister tending the chapel grounds.', flavor: 'Light a candle within, traveller. The Light watches over Eldenmoor.' },
  { id: 'child', name: 'Wren', role: 'Townsfolk', x: -3, z: 14, scale: 0.68, robe: 0x8a5a8a, hair: 0x6a4a2a,
    type: 'plain', examine: 'A small child darting about the square.', flavor: 'Wanna race to the fountain? Betcha can’t catch me!' },
  { id: 'innkeep', name: 'Bram', role: 'The Prancing Stag', x: -16, z: -18.6, robe: 0x6a4a2a, hair: 0x3a2a1a, apron: true,
    type: 'plain', examine: 'The barrel-chested innkeeper, polishing a tankard.', flavor: 'Pull up a stool! Best ale this side of the moat.' },
  { id: 'patron1', name: 'Old Saul', role: 'Tavern Regular', x: -13, z: -11, robe: 0x4a5a6a, hair: 0xb9b2a4,
    type: 'plain', examine: 'A grizzled regular nursing a drink.', flavor: 'Gold in that cellar, they say… or maybe ghosts. Hic!' },
  { id: 'patron2', name: 'Edda', role: 'Tavern Regular', x: -19, z: -11, robe: 0x7a3a5a, hair: 0x6a4a2a,
    type: 'plain', examine: 'A traveller resting her feet by the fire.', flavor: 'Long road to Eldenmoor. The stew here makes it worth it.' },

  // --- upper floor (the royal apartments) ---
  { id: 'advisor', name: 'Lady Maelis', role: 'Royal Advisor', x: 2, z: 60, floor: 1, robe: 0x6e3a8a, hair: 0xb08a5a,
    type: 'plain', examine: 'The King’s trusted advisor, poring over the maps.', flavor: 'Up here we plan the realm’s future. Welcome to the royal floor.' },

  // --- basement (the cellar & dungeon) ---
  { id: 'jailer', name: 'Grix', role: 'Dungeon Keeper', x: -10, z: 52, floor: -1, robe: 0x3a3a30, hair: 0x2a2a22,
    type: 'plain', examine: 'A grim jailer with a heavy ring of keys.', flavor: 'Mind the cells. Some things down here are best left locked away.' },
  { id: 'prisoner', name: 'Old Hagen', role: 'Captive', x: -16, z: 55, floor: -1, robe: 0x7a6a5a, hair: 0xcfc8b6,
    type: 'plain', examine: 'A ragged prisoner behind the bars.', flavor: 'Psst… get me out of here, friend? No? …worth a try.' },
];

const _v = new THREE.Vector3();

export function buildNpcs(scene) {
  const npcs = [];
  for (const def of NPC_DEFS) {
    const group = makeNpc(def);
    group.userData.floor = def.floor || 0;
    group.visible = (def.floor || 0) === 0;   // only the active floor's NPCs are shown
    scene.add(group);
    const label = document.createElement('div');
    label.className = 'npc-label';
    label.textContent = def.name + '  ·  ' + def.role;
    document.body.appendChild(label);
    npcs.push({ def, group, label });
  }
  scene.userData.npcs = npcs.map((n) => n.group); // for raycasting (each group has userData.def)
  return npcs;
}

// Project each NPC's head to the screen and place its floating name there.
export function updateNpcLabels(npcs, camera) {
  for (const n of npcs) {
    if (!n.group.visible) { n.label.style.display = 'none'; continue; }
    _v.set(n.group.position.x, 2.4, n.group.position.z).project(camera);
    if (_v.z > 1 || _v.x < -1.1 || _v.x > 1.1) { n.label.style.display = 'none'; continue; }
    n.label.style.display = 'block';
    n.label.style.left = (_v.x * 0.5 + 0.5) * window.innerWidth + 'px';
    n.label.style.top = (-_v.y * 0.5 + 0.5) * window.innerHeight + 'px';
  }
}

// Show only the NPCs that belong to the given floor.
export function setNpcsFloor(npcs, floor) {
  for (const n of npcs) n.group.visible = (n.def.floor || 0) === floor;
}

// Gentle wandering: each NPC strolls within a small radius of its home spot and
// returns to its exact starting position roughly every ~100 seconds.
export function updateNpcs(npcs, dt, clock) {
  for (const n of npcs) {
    if (!n.group.visible) continue;
    const d = n.def, g = n.group;
    if (!n._home) { n._home = { x: d.x, z: d.z }; n._tgt = { x: d.x, z: d.z }; n._next = 0; n._homeAt = 0; n._ph = Math.random() * 10; }
    let radius = 1.2;
    if (d.type === 'shop' || d.guard || d.crown) radius = 0.55;   // shopkeepers / guards / king barely leave their post
    if (d.id === 'child') radius = 2.6;                            // the kid roams more
    if (clock >= n._next) {
      const h = n._home;
      if (clock - n._homeAt > 100) { n._tgt = { x: h.x, z: h.z }; n._homeAt = clock; }   // back to the exact spot
      else { const a = Math.random() * Math.PI * 2, r = Math.random() * radius; n._tgt = { x: h.x + Math.cos(a) * r, z: h.z + Math.sin(a) * r }; }
      n._next = clock + 2.5 + Math.random() * 4.5;                 // pause a few seconds at each spot
    }
    const dx = n._tgt.x - g.position.x, dz = n._tgt.z - g.position.z, dist = Math.hypot(dx, dz);
    if (dist > 0.06) {
      const step = Math.min(dist, (d.id === 'child' ? 1.4 : 0.6) * dt);
      g.position.x += (dx / dist) * step; g.position.z += (dz / dist) * step;
      g.rotation.y = Math.atan2(dx, dz);
      g.position.y = Math.abs(Math.sin((clock + n._ph) * 7)) * 0.04;   // little walking bob
    } else g.position.y = 0;
  }
}

const BEARDED = new Set(['king', 'duke', 'guard_l', 'guard_r', 'guard_il', 'guard_ir', 'smith', 'farmer', 'jailer', 'patron1', 'tomas']);
const SKINS = [0xf0c8a0, 0xe7b08a, 0xd9a06e, 0xc68a5a, 0xa9744a];
const HAIRS = [0x2a2018, 0x3a2a1a, 0x5b3f29, 0x8a6a3a, 0x9a9a9a, 0xb9b2a4, 0x6a4a2a];

function makeNpc(def) {
  const g = new THREE.Group();
  const sm = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0 });   // smooth-shaded
  const cap = (r, len, c, x, y, z) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), sm(c)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const ball = (r, c, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), sm(c)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const cyl = (rt, rb, h, c, x, y, z) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 14), sm(c)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const box = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), sm(c)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };

  // deterministic per-NPC variety (seeded by id, so it's stable across reloads)
  let s = 2166136261; for (let i = 0; i < (def.id || '').length; i++) s = (Math.imul(s ^ def.id.charCodeAt(i), 16777619)) >>> 0;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const skinC = def.skin || SKINS[(rnd() * SKINS.length) | 0];
  const hairC = def.hair || HAIRS[(rnd() * HAIRS.length) | 0];
  const hairStyle = (rnd() * 3) | 0;          // 0 short · 1 long · 2 balding
  const build = 0.9 + rnd() * 0.2;            // body width
  const bald = hairStyle === 2 && !def.crown;

  cyl(0.26 * build, 0.46 * build, 1.2, def.robe, 0, 0.6, 0);          // robe (flares at the hem)
  ball(0.2 * build, def.robe, 0, 1.22, 0);                            // chest / shoulders
  for (const sx of [-1, 1]) { cap(0.085, 0.42, def.robe, sx * 0.32 * build, 0.96, 0); ball(0.1, skinC, sx * 0.32 * build, 0.68, 0); }  // arms + hands
  cyl(0.09, 0.1, 0.14, skinC, 0, 1.46, 0);                           // neck
  const head = ball(0.25, skinC, 0, 1.67, 0); head.scale.set(0.95, 1.05, 0.96);
  for (const sx of [-1, 1]) { ball(0.045, 0x141414, sx * 0.1, 1.7, 0.2); const eb = box(0.1, 0.025, 0.04, hairC, sx * 0.1, 1.77, 0.21); ball(0.055, skinC, sx * 0.24, 1.67, 0.02); }  // eyes, brows, ears
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 8), sm(skinC)); nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.63, 0.23); g.add(nose);
  const mouth = ball(0.05, 0x8a4a44, 0, 1.55, 0.21); mouth.scale.set(1.5, 0.4, 0.5);     // mouth

  // hair styles
  if (!bald) { const hc = ball(0.27, hairC, 0, 1.76, -0.03); hc.scale.set(1.03, 0.82, 1.05); }
  else { const ring = ball(0.27, hairC, 0, 1.6, -0.04); ring.scale.set(1.04, 0.45, 1.06); }   // balding: side/back ring
  if (hairStyle === 1) { const bk = box(0.42, 0.5, 0.18, hairC, 0, 1.48, -0.2); }              // long hair down the back
  if (BEARDED.has(def.id)) { const b = ball(0.18, hairC, 0, 1.52, 0.13); b.scale.set(1.05, 1.0, 0.8); g.add(box(0.16, 0.06, 0.06, hairC, 0, 1.62, 0.22)); }  // beard + moustache

  if (def.crown) { cyl(0.27, 0.27, 0.14, 0xe9c33a, 0, 1.88, 0); for (const dx of [-0.16, 0, 0.16]) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 6), sm(0xf2d24a)); t.position.set(dx, 2.02, 0); g.add(t); } }
  if (def.guard) { const h = ball(0.27, 0x9aa0a8, 0, 1.73, 0); h.scale.set(1.05, 1.0, 1.05); box(0.12, 0.24, 0.05, 0x6d737b, 0, 1.63, 0.24); cyl(0.04, 0.04, 2.4, 0x6b4a2f, 0.46, 1.2, 0.05); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.34, 8), sm(0xc8ccd2)); tip.position.set(0.46, 2.5, 0.05); g.add(tip); }
  if (def.apron) box(0.42, 0.7, 0.06, 0xeae0c8, 0, 0.78, 0.24);

  if (def.scale) g.scale.setScalar(def.scale);
  g.position.set(def.x, 0, def.z);
  g.userData = { kind: 'npc', def };
  return g;
}
