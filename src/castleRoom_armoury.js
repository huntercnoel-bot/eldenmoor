// castleRoom_armoury.js — furnishes the castle's ARMOURY (left-BACK courtyard
// room of the ground floor) in OSRS x WoW-Classic style. Self-contained: polls
// window.eldenmoor until scene.userData.keep.ground exists, then builds ONE
// THREE.Group of arms-room props (wall weapon racks holding real weapon GLBs,
// armour stands with helms + breastplates, hung heraldic shields, a sharpening
// grindstone, crates/barrels of arms, a sturdy weapon-table, a straw training
// dummy, and banners) added as a CHILD of keep.ground so it inherits that floor's
// show/hide. Lives in the castle's LOCAL space (gate -z, throne +z, floor y~0).
//
// Footprint: x in [-22,-10], z in [-21,-11]. Existing buildings.js props here are
// the forge (-20.4,-19), anvil (-17.5,-18), two armour stands at x=-12.5, a spear
// rack on the back wall x=-22, shields on the back wall z=-21.5, and crates near
// (-12,-20.5). We dress the remaining floor without blocking the doorways
// (divider gap z -7..-4 at x=-10 and the cross-wall at z=-11).
//
// Everything is tagged __toonDone (skip cel-shade) + noCollide (walk-through).
// One import line is added to main.js.

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';

const WEAP = './assets/models/weapons/';
const loader = new GLTFLoader();
const wcache = {};
const wproto = {};

function loadWeapon(name) {
  if (!wcache[name]) {
    wcache[name] = new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      const t = setTimeout(() => finish(null), 8000);   // never let a hung load block boot
      loader.load(WEAP + name + '.glb',
        (g) => { clearTimeout(t); finish(g.scene); },
        undefined,
        () => { clearTimeout(t); finish(null); });
    });
  }
  return wcache[name];
}

// Place a cloned weapon/shield GLB at (x,y,z) local, with euler rotation + a
// uniform target HEIGHT in metres (we measure the prototype and scale to fit).
function placeWeapon(parent, name, x, y, z, rx = 0, ry = 0, rz = 0, targetH = 1.2) {
  const src = wproto[name];
  if (!src) return null;
  const o = src.clone(true);
  o.rotation.set(0, 0, 0); o.scale.setScalar(1);
  const b = new THREE.Box3().setFromObject(o);
  const h = Math.max(0.001, b.max.y - b.min.y);
  o.scale.setScalar(targetH / h);
  o.rotation.set(rx, ry, rz);
  o.position.set(x, y, z);
  o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.userData.__toonDone = true; m.userData.noCollide = true; } });
  o.userData.noCollide = true;
  parent.add(o);
  return o;
}

// ---- materials (warm forge/steel palette) ----------------------------------
const M = {
  oak:    new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 0.85 }),
  wood:   new THREE.MeshStandardMaterial({ color: 0x5a3d22, roughness: 0.88 }),
  iron:   new THREE.MeshStandardMaterial({ color: 0x55585e, metalness: 0.55, roughness: 0.5 }),
  steel:  new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.6, roughness: 0.42 }),
  silver: new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.55, roughness: 0.38 }),
  stone:  new THREE.MeshStandardMaterial({ color: 0x7d7a72, roughness: 0.95 }),
  grind:  new THREE.MeshStandardMaterial({ color: 0x6b6660, roughness: 0.95 }),
  rope:   new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.95 }),
  red:    new THREE.MeshStandardMaterial({ color: 0x8a1f2a, roughness: 0.85 }),
  gold:   new THREE.MeshStandardMaterial({ color: 0xc9a23e, metalness: 0.4, roughness: 0.5 }),
};

function box(w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true; m.receiveShadow = true;
  m.userData.__toonDone = true; m.userData.noCollide = true;
  return m;
}
function cyl(rt, rb, h, seg, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true; m.receiveShadow = true;
  m.userData.__toonDone = true; m.userData.noCollide = true;
  return m;
}

// ---- procedural heraldic shield texture (hung on the wall) ------------------
let _shieldTex = null;
function shieldTexture() {
  const c = document.createElement('canvas'); c.width = 96; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#7c1622'; x.fillRect(0, 0, 96, 128);
  x.fillStyle = '#2a3f72'; x.beginPath(); x.moveTo(48, 8); x.lineTo(90, 8); x.lineTo(90, 60);
  x.quadraticCurveTo(90, 110, 48, 124); x.closePath(); x.fill();
  x.fillStyle = '#cda23e'; x.beginPath(); x.moveTo(48, 30); x.lineTo(64, 64); x.lineTo(48, 98); x.lineTo(32, 64); x.closePath(); x.fill();
  x.strokeStyle = '#e8c45a'; x.lineWidth = 6;
  x.beginPath(); x.moveTo(6, 8); x.lineTo(90, 8); x.lineTo(90, 60); x.quadraticCurveTo(90, 112, 48, 126);
  x.quadraticCurveTo(6, 112, 6, 60); x.closePath(); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---- procedural banner texture (tall hanging cloth) ------------------------
let _bannerTex = null;
function bannerTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 160;
  const x = c.getContext('2d');
  x.fillStyle = '#5a1622'; x.fillRect(0, 0, 64, 160);
  x.strokeStyle = '#cda23e'; x.lineWidth = 5; x.strokeRect(4, 4, 56, 152);
  // crossed swords sigil
  x.strokeStyle = '#e8d8a8'; x.lineWidth = 4;
  x.beginPath(); x.moveTo(20, 50); x.lineTo(46, 110); x.moveTo(46, 50); x.lineTo(20, 110); x.stroke();
  x.fillStyle = '#cda23e'; x.beginPath(); x.moveTo(32, 30); x.lineTo(40, 46); x.lineTo(32, 60); x.lineTo(24, 46); x.closePath(); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---- straw training dummy texture ------------------------------------------
let _strawTex = null;
function strawTexture() {
  const c = document.createElement('canvas'); c.width = 48; c.height = 48;
  const x = c.getContext('2d');
  x.fillStyle = '#c9a24a'; x.fillRect(0, 0, 48, 48);
  for (let i = 0; i < 220; i++) {
    x.strokeStyle = ['#b8923c', '#d8b35a', '#a8842f'][i % 3];
    x.lineWidth = 1; const sx = Math.random() * 48, sy = Math.random() * 48;
    x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + (Math.random() * 6 - 3), sy + 6 + Math.random() * 6); x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 3); return t;
}

// A heraldic shield hung flat on a wall, facing into the room.
function addShield(root, x, y, z, ry) {
  if (!_shieldTex) _shieldTex = shieldTexture();
  const g = new THREE.Group();
  const face = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.2, 0.1),
    [M.steel, M.steel, M.steel, M.steel,
      new THREE.MeshStandardMaterial({ map: _shieldTex, roughness: 0.7, metalness: 0.15 }), M.steel]);
  g.add(face);
  // a crossed-spears mount behind it
  g.add(cyl(0.03, 0.03, 1.4, 6, M.wood, 0, 0, -0.06, 0, 0, 0.5));
  g.add(cyl(0.03, 0.03, 1.4, 6, M.wood, 0, 0, -0.06, 0, 0, -0.5));
  g.position.set(x, y, z); g.rotation.y = ry;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.__toonDone = true; o.userData.noCollide = true; } });
  g.userData.noCollide = true;
  root.add(g); return g;
}

// A tall hanging banner against a wall (cloth + rod), facing the room.
function addBanner(root, x, z, ry, top = 4.6, h = 3.6, w = 1.4) {
  if (!_bannerTex) _bannerTex = bannerTexture();
  const g = new THREE.Group();
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: _bannerTex, side: THREE.DoubleSide, roughness: 0.92 }));
  cloth.position.y = top - h / 2;
  cloth.castShadow = true;
  const rod = cyl(0.05, 0.05, w + 0.3, 8, M.oak, 0, top, 0, 0, 0, Math.PI / 2);
  g.add(cloth, rod);
  g.position.set(x, 0, z); g.rotation.y = ry;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.__toonDone = true; o.userData.noCollide = true; } });
  g.userData.noCollide = true;
  root.add(g); return g;
}

// A wall-mounted weapon rack: a wooden backing board with pegs that holds a row
// of weapon GLBs standing upright. `weapons` is a list of [glbName, targetH].
function addWeaponRack(root, x, y, z, ry, weapons) {
  const g = new THREE.Group();
  const n = weapons.length;
  const span = Math.max(1.6, n * 0.55);
  // backing board + top/bottom rails
  g.add(box(span + 0.4, 2.4, 0.12, M.oak, 0, 1.4, -0.12));
  g.add(box(span + 0.5, 0.14, 0.28, M.wood, 0, 2.5, -0.02));   // top rail
  g.add(box(span + 0.5, 0.14, 0.28, M.wood, 0, 0.55, 0.0));    // bottom rail (rest)
  // pegs + weapons evenly spread along the span
  for (let i = 0; i < n; i++) {
    const px = -span / 2 + (n === 1 ? span / 2 : (span * i / (n - 1)));
    g.add(box(0.06, 0.06, 0.22, M.iron, px, 2.05, 0.12));      // upper peg
    const [wn, th] = weapons[i];
    placeWeapon(g, wn, px, 0.55, 0.16, 0, 0, 0, th);           // weapon stands upright
  }
  g.position.set(x, y, z); g.rotation.y = ry;
  root.add(g); return g;
}

// An armour stand: a round plinth + post wearing a steel breastplate, pauldrons
// and a plumed helm. (Distinct from buildings.js's blockier "knight" stands.)
function addArmourStand(root, x, z, ry = 0) {
  const g = new THREE.Group();
  g.add(cyl(0.42, 0.5, 0.22, 16, M.stone, 0, 0.11, 0));        // round plinth
  g.add(cyl(0.08, 0.1, 1.5, 10, M.oak, 0, 0.9, 0));            // post
  g.add(box(0.78, 0.12, 0.32, M.iron, 0, 1.55, 0));            // shoulder bar
  g.add(box(0.66, 0.62, 0.34, M.steel, 0, 1.28, 0.02));        // breastplate
  g.add(box(0.5, 0.2, 0.36, M.silver, 0, 1.04, 0.04));         // fauld
  for (const sx of [-1, 1]) g.add(cyl(0.16, 0.18, 0.2, 12, M.silver, sx * 0.42, 1.5, 0.02, Math.PI / 2));  // pauldrons
  g.add(cyl(0.13, 0.15, 0.16, 10, M.iron, 0, 1.66, 0.02));     // neck
  g.add(cyl(0.22, 0.2, 0.34, 14, M.steel, 0, 1.86, 0.02));     // helm
  g.add(box(0.36, 0.22, 0.06, M.iron, 0, 1.84, 0.2));          // visor/brow
  g.add(box(0.06, 0.08, 0.34, M.iron, 0, 1.86, 0.22));         // nose guard
  for (let i = 0; i < 5; i++) g.add(box(0.05, 0.22 - i * 0.02, 0.05, M.red, 0, 2.12 + i * 0.02, -0.02 + i * 0.03));  // red plume
  g.position.set(x, 0, z); g.rotation.y = ry;
  root.add(g); return g;
}

// A sharpening grindstone: a round stone wheel on an A-frame trestle with a crank
// handle and a small water trough beneath.
function addGrindstone(root, x, z, ry = 0) {
  const g = new THREE.Group();
  const wheel = cyl(0.55, 0.55, 0.16, 28, M.grind, 0, 0.95, 0, 0, 0, Math.PI / 2);
  g.add(wheel);
  g.add(cyl(0.07, 0.07, 0.26, 12, M.iron, 0, 0.95, 0, 0, 0, Math.PI / 2));  // axle hub
  for (const sz of [-1, 1]) {
    g.add(box(0.1, 1.1, 0.1, M.oak, -0.5, 0.55, sz * 0.32, 0, 0, 0.45));
    g.add(box(0.1, 1.1, 0.1, M.oak, 0.5, 0.55, sz * 0.32, 0, 0, -0.45));
  }
  g.add(box(1.3, 0.1, 0.12, M.oak, 0, 0.18, 0.32));
  g.add(box(1.3, 0.1, 0.12, M.oak, 0, 0.18, -0.32));
  g.add(cyl(0.04, 0.04, 0.3, 8, M.iron, 0.2, 0.95, 0.5, Math.PI / 2));      // crank
  g.add(cyl(0.05, 0.05, 0.18, 8, M.wood, 0.34, 0.78, 0.5));                 // handle grip
  g.add(box(0.7, 0.2, 0.42, M.wood, 0, 0.62, 0));                          // water trough
  g.add(box(0.6, 0.04, 0.32, new THREE.MeshStandardMaterial({ color: 0x3a5a6a, roughness: 0.4, metalness: 0.2 }), 0, 0.72, 0));
  g.position.set(x, 0, z); g.rotation.y = ry;
  root.add(g); return g;
}

// A sturdy weapon-table (top + four legs + stretchers); arms are laid on it by
// the caller after the GLB prototypes load.
function addWeaponTable(root, x, z, ry = 0) {
  const g = new THREE.Group();
  g.add(box(2.6, 0.16, 1.1, M.oak, 0, 0.92, 0));               // top
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.16, 0.84, 0.16, M.oak, sx * 1.15, 0.42, sz * 0.42));
  g.add(box(2.4, 0.1, 0.1, M.wood, 0, 0.3, 0.42));             // stretchers
  g.add(box(2.4, 0.1, 0.1, M.wood, 0, 0.3, -0.42));
  g.userData.tableTop = 1.0;
  g.position.set(x, 0, z); g.rotation.y = ry;
  root.add(g); return g;
}

// A straw training dummy: a cross-post wrapped in straw with a sackcloth head,
// roped at the waist, on a cross base. A classic OSRS courtyard fixture.
function addDummy(root, x, z) {
  if (!_strawTex) _strawTex = strawTexture();
  const strawMat = new THREE.MeshStandardMaterial({ map: _strawTex, roughness: 0.95 });
  const g = new THREE.Group();
  g.add(box(1.4, 0.16, 0.3, M.wood, 0, 0.08, 0));              // cross base
  g.add(box(0.3, 0.16, 1.4, M.wood, 0, 0.08, 0));
  g.add(cyl(0.1, 0.12, 1.8, 10, M.wood, 0, 1.0, 0));           // central post
  g.add(box(1.5, 0.14, 0.14, M.wood, 0, 1.45, 0));             // arms crossbar
  g.add(cyl(0.34, 0.3, 0.95, 14, strawMat, 0, 1.2, 0));        // straw torso
  for (const sx of [-1, 1]) g.add(cyl(0.13, 0.11, 0.7, 10, strawMat, sx * 0.55, 1.45, 0, 0, 0, Math.PI / 2));  // straw arms
  for (const yy of [0.95, 1.35]) g.add(cyl(0.31, 0.31, 0.05, 14, M.rope, 0, yy, 0));  // binding ropes
  g.add(cyl(0.2, 0.18, 0.34, 12, new THREE.MeshStandardMaterial({ color: 0xb89b6a, roughness: 0.95 }), 0, 1.85, 0));  // head
  g.add(box(0.2, 0.2, 0.02, M.red, 0, 1.2, 0.31));             // target mark
  g.add(box(0.1, 0.1, 0.02, new THREE.MeshStandardMaterial({ color: 0xe8d8a8 }), 0, 1.2, 0.32));
  g.position.set(x, 0, z);
  root.add(g); return g;
}

// A barrel for stowing arms (spears/axes jut from the open top, placed by caller).
function addArmsBarrel(root, x, z) {
  const g = new THREE.Group();
  g.add(cyl(0.42, 0.46, 0.95, 16, M.wood, 0, 0.48, 0));
  for (const r of [0.2, 0.7]) g.add(cyl(0.47, 0.47, 0.06, 16, M.iron, 0, r, 0));   // hoops
  g.add(cyl(0.4, 0.4, 0.04, 16, new THREE.MeshStandardMaterial({ color: 0x3a2a18 }), 0, 0.97, 0));
  g.userData.barrelTop = 0.95;
  g.position.set(x, 0, z);
  root.add(g); return g;
}

// ---- assemble the armoury ---------------------------------------------------
function furnish(ground) {
  const root = new THREE.Group();
  root.name = 'castle-armoury';
  root.userData.noCollide = true;
  ground.add(root);

  // --- Wall-mounted weapon racks on the inner wall (x=-10), facing into the room. ---
  addWeaponRack(root, -10.4, 0, -19, Math.PI / 2, [['Sword', 1.0], ['Axe', 0.9], ['Claymore', 1.3], ['Sword_2', 1.0]]);
  addWeaponRack(root, -10.4, 0, -14, Math.PI / 2, [['Spear', 1.5], ['Sword_Big', 1.3], ['Dagger', 0.55], ['Axe', 0.9]]);

  // --- Hung heraldic shields on the inner & outer walls ---
  for (const z of [-20.5, -17.5]) addShield(root, -10.35, 2.4, z, -Math.PI / 2);
  addShield(root, -21.85, 2.4, -20.5, Math.PI / 2);

  // --- Banners against the cross-wall (z=-11) and the back-left wall ---
  addBanner(root, -13.5, -11.4, 0, 4.6, 3.4, 1.3);
  addBanner(root, -18.5, -11.4, 0, 4.6, 3.4, 1.3);
  addBanner(root, -21.7, -16.0, Math.PI / 2, 4.6, 3.0, 1.2);

  // --- Two new plumed armour stands (interior, distinct from buildings.js's) ---
  addArmourStand(root, -15.5, -19.5, 0);
  addArmourStand(root, -18.0, -13.5, Math.PI * 0.15);

  // --- Sharpening grindstone wheel (near the forge corner) ---
  addGrindstone(root, -19.5, -16.0, Math.PI / 2);

  // --- Sturdy weapon table in the middle, strewn with arms ---
  addWeaponTable(root, -15.5, -16.0, Math.PI / 2);
  placeWeapon(root, 'Sword', -15.5, 1.06, -15.4, Math.PI / 2, 0.4, 0, 0.95);
  placeWeapon(root, 'Dagger', -15.5, 1.06, -16.6, Math.PI / 2, -0.5, 0, 0.5);
  placeWeapon(root, 'Shield_Heater', -16.6, 1.06, -16.0, -Math.PI / 2, 0, 0, 0.7);
  root.add(box(0.3, 0.1, 0.16, M.grind, -14.7, 1.06, -16.3));   // whetstone block

  // --- Crates & arms barrels of weaponry (avoid buildings.js crates ~ -12,-20.5) ---
  const b1 = addArmsBarrel(root, -20.5, -13.0);
  const b2 = addArmsBarrel(root, -14.0, -20.0);
  placeWeapon(root, 'Spear', -20.5, b1.userData.barrelTop, -13.0, 0.18, 0.3, 0.0, 1.5);
  placeWeapon(root, 'Spear', -20.4, b1.userData.barrelTop, -13.1, -0.16, 1.1, 0.1, 1.5);
  placeWeapon(root, 'Axe', -14.0, b2.userData.barrelTop, -20.0, 0.12, 0.6, 0.05, 1.0);
  placeWeapon(root, 'Sword', -14.1, b2.userData.barrelTop, -20.1, -0.14, 1.4, 0.0, 1.0);
  root.add(box(0.95, 0.95, 0.95, M.wood, -17.5, 0.47, -20.5));  // weapon crates
  root.add(box(0.8, 0.8, 0.8, M.wood, -16.6, 0.4, -20.6, 0, 0.3, 0));
  placeWeapon(root, 'Shield_Round', -17.5, 0.55, -19.95, -0.25, 0, 0, 0.85);
  placeWeapon(root, 'Shield_Celtic_Golden', -19.0, 0.5, -20.6, -0.2, 0.3, 0, 0.8);

  // --- A straw training dummy (courtyard-armoury classic) ---
  addDummy(root, -12.5, -16.0);

  // --- ONE warm forge-glow PointLight over the grindstone/forge corner ---
  const light = new THREE.PointLight(0xffa040, 6, 18, 2);
  light.position.set(-18.5, 3.0, -16.5);
  root.add(light);

  return root;
}

async function boot(em) {
  const ground = em.scene.userData.keep && em.scene.userData.keep.ground;
  if (!ground) return;
  const names = ['Sword', 'Sword_2', 'Sword_Big', 'Axe', 'Spear', 'Claymore', 'Dagger',
                 'Shield_Heater', 'Shield_Round', 'Shield_Celtic_Golden'];
  // Resolve each load with an internal timeout so a hung GLB can never block the
  // room from being furnished (procedural props always appear regardless).
  const scenes = await Promise.all(names.map((n) => loadWeapon(n)));
  names.forEach((n, i) => { if (scenes[i]) wproto[n] = scenes[i]; });
  furnish(ground);
}

(function () {
  let tries = 0;
  const iv = setInterval(async () => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.scene && em.scene.userData.keep && em.scene.userData.keep.ground) {
      clearInterval(iv);
      try { await boot(em); } catch (err) { console.error('[castleRoom_armoury] failed', err); }
    } else if (tries > 800) { clearInterval(iv); }
  }, 100);
})();
