// npc.js — shopkeepers, the castle court, and townsfolk. Builds simple figures
// with floating name labels, and registers them for clicking/right-clicking.

import * as THREE from '../vendor/three.module.js';

// Each NPC carries a `dialogue` array of in-character lines that the dialogue
// box (see src/dialogue.js, wired in main.js) pages through. `flavor` is kept as
// the one-line fallback used by the old game-message path. King Aldric carries a
// `quest: 'king'` marker so the talk handler routes him to the quest system.
const NPC_DEFS = [
  // --- shopkeepers (now standing behind the counter INSIDE each shop) ---
  { id: 'bramble', name: 'Bramble', role: 'General Store', x: -15, z: 16, robe: 0x3f6e44,
    type: 'shop', shop: 'general', examine: 'A cheerful general-store keeper.', flavor: 'Finest oddments in all Eldenmoor! Come in, come in.',
    dialogue: [
      'Welcome, welcome! Finest oddments in all Eldenmoor — buckets, rope, tinderboxes, the lot.',
      'If it isn\'t nailed down, I\'ll sell it to you. If it IS nailed down, I\'ll sell you the nails.',
      'Browsing\'s free, but a coin\'s a coin, eh? Right-click me to trade.',
    ] },
  { id: 'hilda', name: 'Hilda', role: "Hilda's Axes", x: 15, z: 16, robe: 0x6e3a3a,
    type: 'shop', shop: 'axes', examine: 'A burly axe merchant.', flavor: 'A sharp axe makes light work, love. Step inside.',
    dialogue: [
      'A sharp axe makes light work, love. Dull ones make for sore arms and bad language.',
      'Bronze for the young\'uns, steel when you\'ve grown into it. I\'ll not sell you above your station.',
      'Forged \'em myself. Well — most of \'em. Don\'t ask about the bronze ones.',
    ] },

  // --- castle court ---
  { id: 'king', name: 'King Aldric', role: 'the Crown', x: 0, z: 62, robe: 0x5e2a8a, crown: true, hair: 0xcfc4b0,
    type: 'royal', quest: 'king', examine: 'The sovereign of Eldenmoor, draped in royal purple.',
    flavor: 'Welcome to my hall, adventurer. Eldenmoor has need of brave souls like you.' },
  { id: 'duke', name: 'Duke Veylin', role: 'Royal Steward', x: 4, z: 61, robe: 0x274a7a,
    type: 'plain', examine: "The king's steward, keeper of the realm's affairs.",
    flavor: 'Seek the King if you crave purpose — and mind your manners in his hall.',
    dialogue: [
      'You stand in the great hall of His Majesty King Aldric. Comport yourself accordingly.',
      'If it is purpose you seek, the King has tasks aplenty. Speak with him directly.',
      'I keep the realm\'s ledgers, its grain stores, its taxes... someone must, while heroes go gallivanting.',
    ] },
  { id: 'guard_l', name: 'Royal Guard', role: 'Gatehouse Watch', x: -3.5, z: 26, robe: 0x565b62, guard: true,
    type: 'plain', examine: 'A steadfast guard in plate, watching the gate.', flavor: 'The gate stands open to honest folk.',
    dialogue: ['The gate stands open to honest folk. You look honest enough.', 'Move along. Nothing to see but me, standing here. All day.'] },
  { id: 'guard_r', name: 'Royal Guard', role: 'Gatehouse Watch', x: 3.5, z: 26, robe: 0x565b62, guard: true,
    type: 'plain', examine: 'A steadfast guard in plate, watching the gate.', flavor: 'Keep the peace within these walls, friend.',
    dialogue: ['Keep the peace within these walls, friend.', 'No, I will not let you try on the helmet. Everyone asks.'] },
  { id: 'guard_il', name: 'Royal Guard', role: 'Keep Watch', x: -4, z: 44, robe: 0x565b62, guard: true,
    type: 'plain', examine: 'A guard posted at the keep’s inner gate.', flavor: 'None pass to the King unannounced — but you seem alright.',
    dialogue: ['None pass to the King unannounced — but you seem alright. Go on.', 'The great hall\'s just ahead. Don\'t touch anything shiny.'] },
  { id: 'guard_ir', name: 'Royal Guard', role: 'Keep Watch', x: 4, z: 44, robe: 0x565b62, guard: true,
    type: 'plain', examine: 'A guard posted at the keep’s inner gate.', flavor: 'The great hall lies ahead. Tread proudly.',
    dialogue: ['The great hall lies ahead. Tread proudly — and quietly.', 'I\'ve stood this post eleven years. Eleven! Ask me anything about this wall.'] },
  { id: 'banker', name: 'Edra', role: 'Bank of Eldenmoor', x: 17, z: 38, robe: 0x3a5f3a,
    type: 'plain', examine: 'A sharp-eyed banker. (A proper bank is coming soon!)',
    flavor: 'Your coin is safe with the Bank of Eldenmoor. The vaults open shortly!',
    dialogue: [
      'Your coin is safe with the Bank of Eldenmoor. Safe as houses. Safer, honestly — houses burn down.',
      'The vaults open shortly! We\'re just... waiting on the locks. And the vault. And the gold.',
      'No, I can\'t hold your logs for you yet. Soon, as the scribes say.',
    ] },
  { id: 'cook', name: 'Bessa', role: 'Castle Cook', x: -18, z: 37, robe: 0xb08a5a, apron: true,
    type: 'plain', examine: 'The castle cook, flour to her elbows.', flavor: 'Mind the oven, dear — hot bread for the King’s table!',
    dialogue: [
      'Mind the oven, dear — that\'s hot bread for the King\'s own table.',
      'Flour to my elbows from dawn to dusk. His Majesty does love a fresh loaf.',
      'Burnt one batch last week. Told the King it was "rustic". He believed me, bless him.',
    ] },

  // --- townsfolk (the square) ---
  { id: 'tomas', name: 'Old Tomas', role: 'Townsfolk', x: 4, z: 11, robe: 0x6a5a3a, hair: 0xb9b2a4,
    type: 'plain', examine: 'A weathered old townsman, watching the square.',
    flavor: 'Grand town, this. The King keeps us safe behind those walls.',
    dialogue: [
      'Grand town, this. The King keeps us safe behind those walls, and we\'re grateful for it.',
      'Been watching this square sixty year. Seen it all, I have. Mostly pigeons.',
      'In my day, adventurers said please and thank you. You young\'uns just run everywhere.',
    ] },
  { id: 'mara', name: 'Mara', role: 'Market Trader', x: 4, z: 19, robe: 0x8a3a5a,
    type: 'plain', examine: 'A bright-eyed market trader.', flavor: 'Fresh wares at the stalls! Mind the fountain, love.',
    dialogue: [
      'Fresh wares at the stalls! Mind you don\'t fall in the fountain, love — last fellow did.',
      'Whatever you need, someone in this square sells it. Or knows someone who does.',
      'Trade\'s good when the roads are safe. Thank the King and his guards for that.',
    ] },
  { id: 'smith', name: 'Garrett', role: 'Blacksmith', x: 10, z: 6, robe: 0x4a4640, hair: 0x2a2018, apron: true,
    type: 'shop', shop: 'armoury', examine: 'A soot-streaked blacksmith with brawny arms.', flavor: 'Armour for the road? Step up to the anvil, friend.',
    dialogue: [
      'Armour for the road? Step up to the anvil, friend. I\'ll see you kitted out.',
      'Good steel between you and a goblin\'s blade — best coin you\'ll ever spend.',
      'Mind the sparks. And the heat. And the hammer. Honestly, just stand back a bit.',
    ] },
  { id: 'farmer', name: 'Pell', role: 'Farmer', x: 8, z: -9, robe: 0x6a7a3a, hair: 0xb9a06a,
    type: 'plain', examine: 'A cheerful farmer with hay on his boots.', flavor: 'Good harvest this year, thank the King. Mind the windmill yonder.',
    dialogue: [
      'Good harvest this year, thank the King! Wheat\'s up to my chest out yonder.',
      'See the windmill? Grinds our grain to flour for the castle ovens. Round and round it goes.',
      'A scarecrow scares crows. A Pell scares everything else off my field. Off you pop!',
    ] },
  { id: 'nun', name: 'Sister Adela', role: 'Chapel', x: -25, z: 13, robe: 0x4a4a5a, hair: 0xcccccc,
    type: 'plain', examine: 'A gentle sister tending the chapel grounds.', flavor: 'Light a candle within, traveller. The Light watches over Eldenmoor.',
    dialogue: [
      'Peace be with you, traveller. The Light watches over all of Eldenmoor.',
      'Light a candle within, if you\'ve a moment. A little warmth goes a long way.',
      'Even adventurers need rest for the soul. The chapel doors are always open to you.',
    ] },
  { id: 'child', name: 'Wren', role: 'Townsfolk', x: -3, z: 14, scale: 0.68, robe: 0x8a5a8a, hair: 0x6a4a2a,
    type: 'plain', examine: 'A small child darting about the square.', flavor: 'Wanna race to the fountain? Betcha can’t catch me!',
    dialogue: [
      'Wanna race to the fountain? Betcha can\'t catch me!',
      'When I grow up I\'m gonna be an adventurer like you! With a BIG axe!',
      'Old Saul at the tavern says there\'s GHOSTS in the cellar. I\'m not scared. ...Are YOU scared?',
    ] },
  { id: 'innkeep', name: 'Bram', role: 'The Prancing Stag', x: -16, z: -18.6, robe: 0x6a4a2a, hair: 0x3a2a1a, apron: true,
    type: 'plain', examine: 'The barrel-chested innkeeper, polishing a tankard.', flavor: 'Pull up a stool! Best ale this side of the moat.',
    dialogue: [
      'Pull up a stool! Best ale this side of the moat — and the only ale this side of the moat.',
      'The Prancing Stag\'s been in my family three generations. Stew\'s the same recipe, more\'s the pity.',
      'Saul\'s been "about to leave" since noon. Pay his ghost stories no mind.',
    ] },
  { id: 'patron1', name: 'Old Saul', role: 'Tavern Regular', x: -13, z: -11, robe: 0x4a5a6a, hair: 0xb9b2a4,
    type: 'plain', examine: 'A grizzled regular nursing a drink.', flavor: 'Gold in that cellar, they say… or maybe ghosts. Hic!',
    dialogue: [
      'Gold in that cellar, they say… or maybe ghosts. Hic!',
      'I seen \'em. Down in the dungeon. Pale things, moanin\'. Or that was the ale. One o\' the two.',
      'Buy old Saul a drink and I\'ll tell you where the treasure\'s buried. ...I forget. But I\'ll TELL you.',
    ] },
  { id: 'patron2', name: 'Edda', role: 'Tavern Regular', x: -19, z: -11, robe: 0x7a3a5a, hair: 0x6a4a2a,
    type: 'plain', examine: 'A traveller resting her feet by the fire.', flavor: 'Long road to Eldenmoor. The stew here makes it worth it.',
    dialogue: [
      'Long road to Eldenmoor. The stew here makes it worth it — barely.',
      'I\'ve walked from the eastern shires. Blisters on my blisters, I tell you.',
      'Word is the King\'s looking for able hands. You\'ve the look of someone who could use the coin.',
    ] },

  // --- upper floor (the royal apartments) ---
  { id: 'advisor', name: 'Lady Maelis', role: 'Royal Advisor', x: 2, z: 60, floor: 1, robe: 0x6e3a8a, hair: 0xb08a5a,
    type: 'plain', examine: 'The King’s trusted advisor, poring over the maps.', flavor: 'Up here we plan the realm’s future. Welcome to the royal floor.',
    dialogue: [
      'Welcome to the royal floor. Up here we plan the realm\'s future — over a great many maps.',
      'The King means well, but he\'d send a hero to fetch his slippers if I let him. I do not let him. ...Often.',
      'If His Majesty has set you a task, see it through. He remembers those who do.',
    ] },

  // --- basement (the cellar & dungeon) ---
  { id: 'jailer', name: 'Grix', role: 'Dungeon Keeper', x: -10, z: 52, floor: -1, robe: 0x3a3a30, hair: 0x2a2a22,
    type: 'plain', examine: 'A grim jailer with a heavy ring of keys.', flavor: 'Mind the cells. Some things down here are best left locked away.',
    dialogue: [
      'Mind the cells. Some things down here are best left locked away.',
      'Twenty-three keys on this ring. Don\'t ask me what twenty-two of \'em open. I forgot. Years ago.',
      'No, the prisoner\'s NOT innocent. They\'re all innocent, to hear \'em tell it.',
    ] },
  { id: 'prisoner', name: 'Old Hagen', role: 'Captive', x: -16, z: 55, floor: -1, robe: 0x7a6a5a, hair: 0xcfc8b6,
    type: 'plain', examine: 'A ragged prisoner behind the bars.', flavor: 'Psst… get me out of here, friend? No? …worth a try.',
    dialogue: [
      'Psst… get me out of here, friend? No? …worth a try.',
      'I\'m innocent, I am! Mostly. Partly. Look, the goat had it coming.',
      'Slip me Grix\'s keys and I\'ll make it worth your while. ...I won\'t. But I\'ll say I will.',
    ] },
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
    const rig = g.userData.rig;
    if (dist > 0.06) {
      const step = Math.min(dist, (d.id === 'child' ? 1.4 : 0.6) * dt);
      g.position.x += (dx / dist) * step; g.position.z += (dz / dist) * step;
      g.rotation.y = Math.atan2(dx, dz);
      g.position.y = Math.abs(Math.sin((clock + n._ph) * 8)) * 0.035;          // walking bob
      if (rig) { const sw = Math.sin((clock + n._ph) * 8) * 0.5; rig.legL.rotation.x = sw; rig.legR.rotation.x = -sw; rig.armL.rotation.x = -sw * 0.6; rig.armR.rotation.x = sw * 0.6; }  // swing legs + arms
    } else {
      g.position.y = 0;
      if (rig) for (const part of [rig.legL, rig.legR, rig.armL, rig.armR]) part.rotation.x *= 0.82;   // settle to a stand
    }
  }
}

const BEARDED = new Set(['king', 'duke', 'guard_l', 'guard_r', 'guard_il', 'guard_ir', 'smith', 'farmer', 'jailer', 'patron1', 'tomas']);
const SKINS = [0xf0c8a0, 0xe7b08a, 0xd9a06e, 0xc68a5a, 0xa9744a];
const HAIRS = [0x2a2018, 0x3a2a1a, 0x5b3f29, 0x8a6a3a, 0x9a9a9a, 0xb9b2a4, 0x6a4a2a];
const LONG_ROBE = new Set(['king', 'duke', 'advisor', 'nun', 'banker', 'jailer']);   // floor-length robe over the legs

// Build a smooth, rounded, organic NPC — same lathe/capsule/sphere language as
// the hero (see player.js): tapered limbs, a V-tapered torso, a soft characterful
// face, and per-role outfits expressed in smooth curves (no cubes, no flatShading).
function makeNpc(def) {
  const g = new THREE.Group();
  const M = (c, r = 0.85, mt = 0) => (c && c.isMaterial ? c : new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: mt }));
  const cap = (r, len, c) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 18), M(c));
  const ball = (r, c) => new THREE.Mesh(new THREE.SphereGeometry(r, 22, 16), M(c));
  const cyl = (rt, rb, h, c, s = 20) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), M(c));
  const cone = (r, h, c, s = 18) => new THREE.Mesh(new THREE.ConeGeometry(r, h, s), M(c));
  const ring = (r, t, c) => new THREE.Mesh(new THREE.TorusGeometry(r, t, 12, 28), M(c));
  // smooth lathe-of-revolution solid from [radius,height] profile points (soft caps)
  const lat = (profile, c, s = 22) => {
    const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), s);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, M(c));
  };
  const at = (o, x, y, z, rx = 0, ry = 0, rz = 0, sx, sy, sz) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); if (sx !== undefined) o.scale.set(sx, sy, sz); return o; };
  const add = (p, o) => { o.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } }); p.add(o); return o; };

  // deterministic per-NPC variety (seeded by id, so it's stable across reloads)
  let s = 2166136261; for (let i = 0; i < (def.id || '').length; i++) s = (Math.imul(s ^ def.id.charCodeAt(i), 16777619)) >>> 0;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const skinC = def.skin || SKINS[(rnd() * SKINS.length) | 0];
  const hairC = def.hair || HAIRS[(rnd() * HAIRS.length) | 0];
  const hairStyle = (rnd() * 3) | 0;          // 0 short · 1 long · 2 balding
  const build = 0.92 + rnd() * 0.18;          // body width
  const robeC = def.robe, pantsC = def.pants ?? 0x3a2f22, bootC = 0x33251a;
  const longRobe = LONG_ROBE.has(def.id);
  const steel = M(0x9aa0a8, 0.4, 0.6), gold = M(0xe9c33a, 0.25, 0.85), white = M(0xece6d6), dark = M(0x2a2620);

  // ---- legs (jointed: hip → knee; smooth tapered thigh & shin + rounded foot) ----
  const makeLeg = () => {
    const hip = new THREE.Group();
    add(hip, at(lat([[0.08, -0.36], [0.125, -0.24], [0.135, -0.12], [0.11, -0.02], [0.10, 0.05]], pantsC, 16), 0, 0, 0));
    const lo = new THREE.Group(); lo.position.set(0, -0.36, 0);
    add(lo, at(lat([[0.06, -0.34], [0.10, -0.22], [0.11, -0.08], [0.095, 0.0], [0.10, 0.04]], pantsC, 16), 0, 0, 0));
    const foot = add(lo, at(ball(0.125, bootC), 0, -0.36, 0.05)); foot.scale.set(1, 0.6, 1.55);
    add(lo, at(ball(0.095, bootC), 0, -0.35, -0.05, 0, 0, 0, 1, 0.7, 1));            // rounded heel
    hip.add(lo); hip.userData.lower = lo; return hip;
  };
  const legL = makeLeg(); legL.position.set(0.13 * build, 0.84, 0);
  const legR = makeLeg(); legR.position.set(-0.13 * build, 0.84, 0);
  g.add(legL, legR);

  // ---- torso: one smooth V-tapered lathe (pelvis → trim waist → broad chest) ----
  add(g, at(lat([
    [0.21 * build, 0.74], [0.245 * build, 0.86], [0.235 * build, 1.0], [0.215 * build, 1.12],   // pelvis → waist
    [0.255 * build, 1.28], [0.29 * build, 1.44], [0.275 * build, 1.56], [0.20 * build, 1.64],   // chest → shoulders
    [0.10, 1.68], [0.085, 1.72],                                                                // trapezius → neck
  ], robeC), 0, 0, 0));
  for (const sx of [-1, 1]) add(g, at(ball(0.135, robeC), sx * 0.255 * build, 1.5, 0, 0, 0, 0, 1.0, 0.95, 1.1));    // soft deltoids
  for (const sx of [-1, 1]) add(g, at(ball(0.12, robeC), sx * 0.11 * build, 1.4, 0.17, 0, 0, 0, 1.1, 0.85, 0.7));   // chest curve
  add(g, at(lat([[0.215 * build, -0.06], [0.245 * build, -0.02], [0.245 * build, 0.03], [0.225 * build, 0.07]], M(0x3a2a1a), 22), 0, 1.0, 0)); // rounded belt
  add(g, at(ball(0.058, M(0x9a7b34)), 0, 1.0, 0.235, 0, 0, 0, 1.4, 1.1, 0.6));       // buckle

  // ---- arms (jointed: shoulder → elbow; smooth biceps & forearm + rounded hand) ----
  const makeArm = () => {
    const sh = new THREE.Group();
    add(sh, at(lat([[0.07, -0.30], [0.09, -0.18], [0.095, -0.06], [0.078, 0.02], [0.085, 0.07]], robeC, 16), 0, 0, 0));
    const lo = new THREE.Group(); lo.position.set(0, -0.30, 0);
    add(lo, at(lat([[0.058, -0.28], [0.078, -0.16], [0.08, -0.04], [0.072, 0.02], [0.078, 0.05]], robeC, 16), 0, 0, 0));
    const palm = add(lo, at(ball(0.072, skinC), 0, -0.30, 0.02)); palm.scale.set(1.0, 1.2, 0.85);
    const thumb = add(lo, at(cap(0.024, 0.04, skinC), 0.05, -0.27, 0.05)); thumb.rotation.z = 0.6;
    sh.add(lo); sh.userData.lower = lo; return sh;
  };
  const armL = makeArm(); armL.position.set(0.29 * build, 1.5, 0); armL.rotation.z = 0.12;
  const armR = makeArm(); armR.position.set(-0.29 * build, 1.5, 0); armR.rotation.z = -0.12;
  g.add(armL, armR);

  // ---- neck + head + soft face ----
  add(g, at(lat([[0.075, -0.06], [0.085, -0.01], [0.09, 0.04], [0.105, 0.09]], skinC, 18), 0, 1.62, 0)); // neck flaring into jaw
  add(g, at(ball(0.235, skinC), 0, 1.83, 0, 0, 0, 0, 0.95, 1.07, 0.97));            // head
  add(g, at(ball(0.185, skinC), 0, 1.72, 0.04, 0, 0, 0, 0.96, 0.78, 1.0));          // soft rounded jaw
  for (const sx of [-1, 1]) { add(g, at(ball(0.04, 0x141414), sx * 0.1, 1.86, 0.195)); add(g, at(ball(0.055, skinC), sx * 0.23, 1.83, 0.01, 0, 0, 0, 0.7, 1.1, 0.9)); } // eyes, ears
  for (const sx of [-1, 1]) { const b = add(g, at(cap(0.026, 0.085, hairC), sx * 0.09, 1.93, 0.19)); b.rotation.set(Math.PI / 2, 0, sx * 0.25); }   // soft brows
  add(g, at(cap(0.036, 0.05, skinC), 0, 1.81, 0.21, 0.5, 0, 0));                     // soft nose
  add(g, at(ball(0.046, M(0x8a4a44)), 0, 1.71, 0.205, 0, 0, 0, 1.5, 0.45, 0.5));     // mouth

  // ---- hair / beard ----
  const bald = hairStyle === 2 && !def.crown && !def.guard;
  if (!def.guard && def.id !== 'nun') {
    if (!bald) {
      add(g, at(ball(0.25, hairC), 0, 1.93, -0.03, 0, 0, 0, 1.04, 0.86, 1.07));      // rounded hair cap
      add(g, at(lat([[0.0, 0], [0.17, 0.02], [0.23, 0.06], [0.19, 0.12], [0.0, 0.16]], hairC, 20), 0, 1.93, 0.12, 0, 0, 0, 1.15, 1.0, 0.8)); // swept fringe
    } else {
      add(g, at(lat([[0.0, 0.0], [0.18, 0.02], [0.24, -0.04], [0.255, -0.14]], hairC, 20), 0, 1.78, -0.02, 0, 0, 0, 1.05, 1.0, 1.07)); // balding ring
    }
    if (hairStyle === 1) add(g, at(lat([[0.10, 0.3], [0.26, 0.1], [0.28, -0.1], [0.24, -0.3], [0.12, -0.42]], hairC, 22), 0, 1.66, -0.16, 0, 0, 0, 1.0, 1.0, 0.7)); // long flowing hair
  }
  if (BEARDED.has(def.id)) {
    add(g, at(ball(0.185, hairC), 0, 1.62, 0.07, 0, 0, 0, 1.0, 0.95, 0.82));         // jaw beard (wraps the chin)
    add(g, at(lat([[0.12, 0.1], [0.1, 0.0], [0.06, -0.12], [0.0, -0.2]], hairC, 18), 0, 1.6, 0.11)); // tapered point under the chin
    add(g, at(cap(0.028, 0.13, hairC), 0, 1.74, 0.19, 0, 0, Math.PI / 2));           // moustache
    for (const sx of [-1, 1]) add(g, at(cap(0.028, 0.12, hairC), sx * 0.18, 1.72, 0.06)); // sideburns up to the ears
  }

  // ---- role-specific outfits & props ----
  if (longRobe) {
    const trimC = def.crown ? gold : M(0xcabf8a, 0.6, 0.15);                          // gold for the king, soft cream for the rest
    add(g, at(lat([[0.24 * build, 1.5], [0.27 * build, 1.2], [0.33, 0.8], [0.42, 0.4], [0.5, 0.1], [0.52, 0.03]], robeC, 26), 0, 0, 0)); // floor-length flowing robe over the legs
    add(g, at(ring(0.5, 0.032, trimC), 0, 0.06, 0, Math.PI / 2, 0, 0));               // hem trim
    for (const sx of [-1, 1]) add(g, at(cap(0.026, 0.95, trimC), sx * 0.1, 0.72, 0.27 * build)); // vertical placket bands
    add(g, at(lat([[0.30 * build, -0.05], [0.335 * build, 0.0], [0.32 * build, 0.05]], trimC, 24), 0, 1.0, 0)); // sash at the waist
  }
  if (def.crown) {
    add(g, at(lat([[0.0, 0.16], [0.24, 0.1], [0.34, -0.02], [0.34, -0.12], [0.28, -0.18]], white, 26), 0, 1.6, 0.02, 0, 0, 0, 1.2, 1.0, 1.0)); // ermine collar/mantle
    for (const dx of [-0.2, 0.2]) add(g, at(ball(0.05, dark), dx, 1.5, 0.26));        // ermine spots
    add(g, at(lat([[0.255, -0.07], [0.275, -0.03], [0.275, 0.04], [0.255, 0.08]], gold, 22), 0, 2.02, 0)); // smooth crown band
    add(g, at(ring(0.275, 0.022, M(0xf2d24a)), 0, 1.99, 0, Math.PI / 2, 0, 0));       // band lip
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; add(g, at(cone(0.045, 0.16, M(0xf2d24a), 12), Math.cos(a) * 0.2, 2.17, Math.sin(a) * 0.2)); } // crown points (ring)
    for (const dx of [-0.18, 0, 0.18]) add(g, at(new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), M(0x6fb3e0)), dx, 2.02, 0.2)); // crown jewels
    add(armR.userData.lower, at(cyl(0.026, 0.026, 0.56, gold, 14), 0, -0.3, 0.06));   // sceptre shaft
    add(armR.userData.lower, at(ball(0.065, M(0x6fb3e0)), 0, -0.02, 0.06));           // sceptre orb
    add(armR.userData.lower, at(ring(0.07, 0.016, gold), 0, -0.02, 0.06, Math.PI / 2, 0, 0)); // orb collar
  }
  if (def.guard) {
    const visorC = M(0x3a3f46, 0.5, 0.4);
    // --- smooth curved plate body (a trimmer cousin of the hero's cuirass) ---
    add(g, at(lat([[0.23, 1.1], [0.285, 1.2], [0.33, 1.34], [0.325, 1.48], [0.275, 1.58], [0.22, 1.64], [0.17, 1.68]], steel, 26), 0, 0, 0)); // breastplate shell
    for (const sx of [-1, 1]) add(g, at(ball(0.14, steel), sx * 0.12, 1.42, 0.19, 0, 0, 0, 1.1, 0.9, 0.7)); // pectoral swells
    add(g, at(ring(0.27, 0.03, gold), 0, 1.6, 0, Math.PI / 2, 0, 0));                 // collar trim
    add(g, at(lat([[0.27, 1.18], [0.31, 1.1], [0.34, 1.0], [0.33, 0.94]], steel, 26), 0, 0, 0)); // fauld skirt
    add(g, at(ring(0.33, 0.024, gold), 0, 1.0, 0, Math.PI / 2, 0, 0));                // fauld trim
    // --- flared gold-rimmed pauldrons (rounded domes, smaller than the hero's) ---
    for (const sx of [-1, 1]) {
      const pa = new THREE.Group();
      pa.add(at(lat([[0.0, 0.1], [0.14, 0.06], [0.22, -0.02], [0.24, -0.12], [0.18, -0.16]], steel, 22), 0, 0, 0, 0, 0, 0, 1.2, 1.0, 1.15)); // dome
      pa.add(at(ring(0.22, 0.032, gold), 0, -0.04, 0, Math.PI / 2, 0, 0));            // rim
      pa.add(at(cap(0.04, 0.14, steel), 0.1, 0.14, 0, 0, 0, -sx * 0.6));              // soft horn
      add(g, at(pa, sx * 0.32, 1.6, 0, 0, 0, -sx * 0.32));
    }
    // --- smooth full helm: domed skullcap + gold brow band + nasal + cheek guards + crest ---
    add(g, at(lat([[0.0, 0.27], [0.15, 0.23], [0.245, 0.14], [0.275, 0.02], [0.275, -0.08], [0.27, -0.14]], steel, 26), 0, 1.88, -0.01)); // dome
    add(g, at(ring(0.275, 0.028, gold), 0, 1.78, -0.01, Math.PI / 2, 0, 0));          // brow band
    add(g, at(cap(0.026, 0.16, steel), 0, 1.83, 0.235, Math.PI / 2 + 0.2, 0, 0));     // nasal bar
    add(g, at(cyl(0.255, 0.255, 0.13, visorC, 24), 0, 1.85, 0, 0, 0, 0, 1.0, 1.0, 1.04)); // recessed eye band
    for (const sx of [-1, 1]) add(g, at(lat([[0.0, 0.12], [0.085, 0.07], [0.095, -0.04], [0.06, -0.13], [0.0, -0.16]], steel, 18), sx * 0.225, 1.84, 0.05, 0, sx * 0.3, 0, 0.7, 1, 1.3)); // cheek guards
    add(g, at(lat([[0.0, -0.18], [0.045, -0.06], [0.055, 0.1], [0.028, 0.22], [0.0, 0.26]], M(0x8a2230), 12), 0, 2.14, -0.04, 0, 0, 0, 0.45, 1, 1)); // red plume crest fin
    // --- halberd, held to the side in the off hand ---
    add(g, at(cyl(0.03, 0.03, 2.3, M(0x6b4a2f), 14), 0.36, 1.25, 0.12, 0, 0, -0.06)); // shaft
    add(g, at(cone(0.085, 0.32, steel, 16), 0.43, 2.5, 0.12));                        // spear point
    add(g, at(lat([[0.0, -0.11], [0.22, -0.06], [0.26, 0.04], [0.2, 0.11], [0.0, 0.13]], steel, 16), 0.27, 2.18, 0.12, Math.PI / 2, 0, 0.3, 0.4, 1, 1)); // axe blade
  }
  if (def.apron) add(g, at(lat([[0.18, -0.4], [0.2, -0.1], [0.21, 0.1], [0.18, 0.32], [0.12, 0.36]], white, 20), 0, 1.32, 0.24, 0, 0, 0, 1, 1, 0.22)); // smooth curved apron
  if (def.id === 'cook') {                                                            // tall puffy chef's toque
    add(g, at(lat([[0.175, -0.08], [0.195, 0.0], [0.2, 0.08], [0.185, 0.16]], white, 22), 0, 1.98, 0)); // headband
    add(g, at(lat([[0.185, 0.0], [0.225, 0.12], [0.2, 0.24], [0.235, 0.32], [0.15, 0.4], [0.0, 0.42]], white, 22), 0, 2.14, 0)); // puffed crown
  }
  if (def.id === 'farmer') { add(g, at(cone(0.42, 0.16, M(0xcba15a), 18), 0, 2.0, 0)); add(g, at(lat([[0.17, -0.11], [0.18, 0.0], [0.17, 0.11]], M(0xb8924a), 20), 0, 2.06, 0)); } // straw hat
  if (def.id === 'nun') {                                                             // wimple that frames (not hides) the face
    const habit = M(0x33333f);
    add(g, at(ball(0.275, white), 0, 1.96, -0.04, 0, 0, 0, 1.08, 0.98, 1.0));         // white coif over the crown
    for (const sx of [-1, 1]) add(g, at(cap(0.05, 0.28, white), sx * 0.235, 1.78, 0.04)); // coif sides framing the face
    add(g, at(lat([[0.0, 0.08], [0.23, 0.04], [0.24, -0.04], [0.0, -0.08]], white, 22), 0, 1.62, 0.04, Math.PI / 2, 0, 0)); // wimple under the chin
    add(g, at(lat([[0.31, 0.4], [0.34, 0.1], [0.3, -0.2], [0.24, -0.4]], habit, 24), 0, 1.5, -0.12, 0, 0, 0, 1.1, 1.0, 0.85)); // dark veil draping down the back
  }
  if (def.id === 'innkeep') add(armR.userData.lower, at(cyl(0.065, 0.065, 0.16, M(0xb08038), 16), 0, -0.32, 0.08)); // tankard

  if (def.scale) g.scale.setScalar(def.scale);
  g.position.set(def.x, 0, def.z);
  g.userData = { kind: 'npc', def, rig: { legL, legR, armL, armR } };
  return g;
}
