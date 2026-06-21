// dungeon.js — Crypt of the Hollow King: an undead dungeon zone.
//
// Self-contained and self-initializing (the vfx.js / mining.js pattern): it
// polls for window.eldenmoor (set up by main.js once the game starts), then
// builds a visually distinct ruined-crypt area in the far NW corner of the map
// (well beyond the forest / snake fen), and lights it with a sickly green glow.
//
// The actual undead MONSTERS are owned by monsters.js — its SPAWN_CLUSTERS
// already place skeletons / skeleton warriors / zombies around this same
// (-105, 88) centre, so this module only owns the *set dressing*: the crypt
// mouth, a broken stone arch, tomb slabs, scattered bones, dead trees and the
// dim green torchlight + ground-fog that make it read as a haunted place.
//
// Geometry is built in the smooth toon/medieval style (capsules / boxes / cones
// / cylinders, smooth normals) and left for the global cel-shade pass to band +
// outline — EXCEPT the glowing emissive bits (torch flames, the green crypt
// glow, the rune sigils), which are tagged userData.__toonDone so the shader
// leaves their emissive look alone. Everything is pushed into
// scene.userData.outdoor so it hides when the player goes upstairs / underground.

import * as THREE from '../vendor/three.module.js';

// --- crypt placement: far NW corner of the 300x300 ground, clear of the forest
//     (range ~78) and the snake fen (-64,-52). The mouth faces roughly SE, back
//     into the map, so the player walks up to it across open ground.
const CX = -105, CZ = 88;          // crypt centre (matches monsters.js cluster)
const FACE = Math.PI * 0.78;       // yaw the whole crypt faces

// ---------------------------------------------------------------------------
//  small smooth-primitive helpers (match the monsters/world art style)
// ---------------------------------------------------------------------------
function mat(color, rough = 0.92, metal = 0.0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}
function emissiveMat(color, emissive, intensity = 1.0) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.0 });
  m.emissive = new THREE.Color(emissive); m.emissiveIntensity = intensity;
  m.userData.__toonDone = true;     // keep the glow — don't band/outline it
  return m;
}
const box = (w, h, d, m, x, y, z, ry = 0) => {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = true; o.receiveShadow = true; return o;
};
const cyl = (rt, rb, h, seg, m, x, y, z) => {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o;
};
const cone = (r, h, seg, m, x, y, z) => {
  const o = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), m);
  o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o;
};
const ball = (r, m, x, y, z) => {
  const o = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m);
  o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o;
};
const cap = (r, len, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
  const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), m);
  o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; o.receiveShadow = true; return o;
};

// A small bone scatter (a couple of capsule "long bones" + a domed skull) the
// player finds strewn around the crypt — pure decoration.
function buildBoneScatter() {
  const g = new THREE.Group();
  const bone = mat(0xd8cfb6, 0.85);
  for (let i = 0; i < 2 + ((Math.random() * 3) | 0); i++) {
    const b = cap(0.05, 0.28 + Math.random() * 0.18, bone,
      (Math.random() - 0.5) * 0.9, 0.06, (Math.random() - 0.5) * 0.9,
      0, Math.random() * Math.PI, Math.PI / 2);
    g.add(b);
  }
  if (Math.random() < 0.6) {
    const skull = ball(0.13, bone, (Math.random() - 0.5) * 0.6, 0.12, (Math.random() - 0.5) * 0.6);
    skull.scale.set(1, 0.95, 1.1);
    g.add(skull);
    // eye sockets
    const socket = mat(0x1a160f);
    g.add(ball(0.035, socket, skull.position.x - 0.05, skull.position.y + 0.02, skull.position.z + 0.11));
    g.add(ball(0.035, socket, skull.position.x + 0.05, skull.position.y + 0.02, skull.position.z + 0.11));
  }
  return g;
}

// A leaning bramble / dead tree — a bare twisted trunk with a few stub branches.
function buildDeadTree(scale = 1) {
  const g = new THREE.Group();
  const woodM = mat(0x3a3026, 0.95);
  const trunk = cyl(0.12 * scale, 0.22 * scale, 2.2 * scale, 7, woodM, 0, 1.1 * scale, 0);
  trunk.rotation.z = (Math.random() - 0.5) * 0.25;
  g.add(trunk);
  for (let i = 0; i < 4; i++) {
    const a = Math.random() * Math.PI * 2, len = (0.5 + Math.random() * 0.6) * scale;
    const br = cap(0.05 * scale, len, woodM,
      Math.cos(a) * 0.2 * scale, (1.3 + Math.random() * 0.7) * scale, Math.sin(a) * 0.2 * scale,
      -0.7 + Math.random() * 0.5, a, 0.4);
    g.add(br);
  }
  return g;
}

// A green crypt torch on a stone post: a brazier bowl with a flickering flame +
// a green point light. The flame is emissive (kept out of the toon pass).
function buildTorch() {
  const g = new THREE.Group();
  const stoneM = mat(0x55524b);
  g.add(cyl(0.1, 0.14, 1.4, 8, stoneM, 0, 0.7, 0));            // post
  g.add(cyl(0.22, 0.16, 0.22, 10, stoneM, 0, 1.5, 0));         // bowl
  // ghostly green flame (cone) + inner brighter core
  const flame = cone(0.16, 0.5, 8, emissiveMat(0x9affba, 0x4aff7a, 1.6), 0, 1.85, 0);
  flame.userData.__toonDone = true;
  g.add(flame);
  const core = cone(0.09, 0.32, 8, emissiveMat(0xe7ffe7, 0xaaffcc, 2.2), 0, 1.82, 0);
  core.userData.__toonDone = true;
  g.add(core);
  const light = new THREE.PointLight(0x6affa0, 2.6, 12, 2);
  light.position.set(0, 1.9, 0);
  g.add(light);
  g.userData.__flame = flame; g.userData.__core = core; g.userData.__light = light;
  g.userData.__phase = Math.random() * 10;
  return g;
}

// The crypt itself: a broken stone arch over a dark doorway set into a low
// mound, flanked by leaning pillars and crowned with a carved skull keystone.
function buildCryptMouth() {
  const g = new THREE.Group();
  const stone = mat(0x6b675e, 0.95);
  const darkStone = mat(0x47443d, 0.95);
  const moss = mat(0x4a5a38, 0.95);
  const voidM = mat(0x070906);            // the pitch-black doorway interior
  voidM.userData.__toonDone = true;

  // low earthen mound the crypt is set into
  const mound = new THREE.Mesh(new THREE.SphereGeometry(6.5, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), moss);
  mound.scale.set(1, 0.45, 0.8); mound.position.y = -0.1; mound.receiveShadow = true;
  g.add(mound);

  // doorway frame: two jambs + a lintel, around a black void plane
  g.add(box(0.7, 3.2, 0.9, stone, -1.6, 1.6, 0));
  g.add(box(0.7, 3.2, 0.9, stone, 1.6, 1.6, 0));
  g.add(box(4.0, 0.9, 0.9, stone, 0, 3.6, 0));
  // pitch-black doorway (slightly recessed)
  const doorway = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.2), voidM);
  doorway.position.set(0, 1.6, 0.36);
  g.add(doorway);

  // carved skull keystone over the lintel
  const skull = ball(0.5, mat(0xcfc7af, 0.9), 0, 4.2, 0.2);
  skull.scale.set(1, 1.05, 0.85);
  g.add(skull);
  const socket = mat(0x120f0a);
  g.add(ball(0.13, socket, -0.18, 4.25, 0.55));
  g.add(ball(0.13, socket, 0.18, 4.25, 0.55));
  g.add(box(0.1, 0.16, 0.1, socket, 0, 4.0, 0.6));  // nasal cavity

  // broken, leaning outer pillars flanking the entrance
  const pillarL = cyl(0.34, 0.4, 4.4, 9, darkStone, -3.4, 2.0, 0.4);
  pillarL.rotation.z = 0.12; g.add(pillarL);
  const pillarR = cyl(0.34, 0.4, 3.4, 9, darkStone, 3.5, 1.6, 0.2);
  pillarR.rotation.z = -0.16; g.add(pillarR);
  // a fallen capital block beside the right (shorter, broken) pillar
  g.add(box(0.9, 0.5, 0.9, darkStone, 3.9, 0.25, 1.4, 0.6));

  // a couple of leaning grave slabs / headstones in front
  for (const [sx, sz, lean] of [[-2.6, 3.2, 0.2], [2.4, 3.6, -0.3], [-0.8, 4.6, 0.12]]) {
    const slab = box(1.0, 1.4, 0.22, mat(0x5e5a51, 0.95), sx, 0.7, sz);
    slab.rotation.set(0.08, Math.random() * 0.6, lean);
    g.add(slab);
  }

  // faint green rune sigils glowing on the jambs (emissive quads)
  const runeMat = emissiveMat(0x153a20, 0x3fff7a, 1.3);
  for (const x of [-1.6, 1.6]) {
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), runeMat);
    rune.position.set(x, 2.2, 0.46);
    rune.userData.__toonDone = true;
    g.add(rune);
  }
  return g;
}

// ---------------------------------------------------------------------------
//  build + wire into the scene
// ---------------------------------------------------------------------------
function buildDungeon(em) {
  const { scene } = em;
  const root = new THREE.Group();
  root.name = 'dungeon-crypt';
  root.position.set(CX, 0, CZ);
  root.rotation.y = FACE;

  // the crypt mouth at the centre-back of the zone
  const crypt = buildCryptMouth();
  crypt.position.set(0, 0, -4);
  root.add(crypt);

  // two green torches flanking the doorway approach
  const torches = [];
  for (const tx of [-3.2, 3.2]) {
    const t = buildTorch(); t.position.set(tx, 0, -1.5); root.add(t); torches.push(t);
  }
  // a couple more torches further out along the approach
  for (const [tx, tz] of [[-5.5, 3.5], [5.5, 3.5]]) {
    const t = buildTorch(); t.position.set(tx, 0, tz); root.add(t); torches.push(t);
  }

  // dead trees ringing the clearing
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + Math.random() * 0.5;
    const r = 9 + Math.random() * 5;
    const tr = buildDeadTree(0.8 + Math.random() * 0.6);
    tr.position.set(Math.cos(a) * r, 0, Math.sin(a) * r + 1);
    tr.rotation.y = Math.random() * Math.PI * 2;
    root.add(tr);
  }

  // bone scatter strewn across the approach
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 8;
    const bs = buildBoneScatter();
    bs.position.set(Math.cos(a) * r, 0, Math.sin(a) * r + 2);
    bs.rotation.y = Math.random() * Math.PI * 2;
    root.add(bs);
  }

  // a darkened, scorched ground patch under the crypt so the green light reads
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(13, 28), mat(0x342f26, 1.0));
  scorch.rotation.x = -Math.PI / 2; scorch.position.set(0, 0.02, 1);
  scorch.receiveShadow = true;
  scorch.userData.__toonDone = true;   // flat ground tint; no outline
  root.add(scorch);

  // a soft green ambient fill over the whole zone (a wide, dim point light)
  const ambient = new THREE.PointLight(0x2f7a4a, 1.4, 38, 1.6);
  ambient.position.set(0, 6, 0);
  root.add(ambient);

  scene.add(root);

  // cel-shade the procedural stone/bone/tree work to match the scene (emissive
  // bits are already tagged __toonDone, so the pass skips them).
  if (em.applyToonTo) em.applyToonTo(root);

  // hide the whole zone when the player goes upstairs / underground
  (scene.userData.outdoor = scene.userData.outdoor || []).push(root);

  // ----- torch flicker loop ------------------------------------------------
  let last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = (now - last) / 1000; last = now;
    const t = now / 1000;
    for (const tr of torches) {
      const ph = tr.userData.__phase;
      const f = 0.8 + Math.sin(t * 9 + ph) * 0.12 + Math.sin(t * 23 + ph) * 0.06;
      if (tr.userData.__light) tr.userData.__light.intensity = 2.6 * f;
      if (tr.userData.__flame) { tr.userData.__flame.scale.y = 0.85 + f * 0.3; tr.userData.__flame.rotation.y += dt * 1.5; }
      if (tr.userData.__core) tr.userData.__core.scale.y = 0.9 + f * 0.25;
    }
  }
  requestAnimationFrame(tick);

  return { root, torches, center: { x: CX, z: CZ } };
}

// ----- self-initialize -------------------------------------------------------
(function boot() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.scene) {
      clearInterval(iv);
      try { em.dungeon = buildDungeon(em); }
      catch (err) { console.error('[dungeon] failed to build', err); }
    } else if (tries > 600) { clearInterval(iv); }
  }, 100);
})();
