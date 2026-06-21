// castleRoom_chapel.js — furnishes the castle CHAPEL (right-front of the keep).
//
// Self-contained module in the spirit of castleFurniture.js / banking.js: it polls
// window.eldenmoor until the keep's ground floor group exists, then builds ONE
// THREE.Group added as a child of scene.userData.keep.ground so it inherits the
// ground floor's show/hide visibility for free and lives in the castle's LOCAL
// space (gate -z, throne +z, floor y≈0).
//
// The chapel room already exists in buildings.js (right side rooms): tiled floor,
// outer wall x=22 with stained-glass slabs, inner divider x=10 with a doorway gap
// at z 8..11, a plain stone altar block at (16,*,19), a couple of rough pews and
// columns. This module DRESSES it reverently without blocking the doorway:
//   • a sculpted gilt-trimmed altar (GLB) crowned with a tall cross (GLB), backed
//     by candles and a glowing gilt icon halo
//   • two rows of carved wooden PEWS + kneelers facing the altar, central aisle
//   • tall candelabra flanking the altar (+ ONE warm PointLight)
//   • a hanging religious banner / tapestry and an elegant arched stained-glass
//     light on the outer wall (smooth glowing glass + gilt tracery)
//   • a prayer-rug runner up the aisle and a small stone font near the entrance
//
// Footprint kept within x∈[11,21], z∈[1,20]; nothing crosses the x=10 doorway.
// Every mesh is tagged __toonDone (skip cel-shade) + noCollide (decoration).

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';

const PROP_DIR = './assets/models/props/';

// These prop GLBs reference an EXTERNAL texture (Textures/colormap.png) that isn't
// shipped, which makes a vanilla GLTFLoader STALL forever waiting on the 404'd
// image. We give the loader a LoadingManager whose URL modifier swaps any such
// missing texture for a tiny 1px data-URI PNG, so the model resolves cleanly; we
// then re-tint its materials to warm stone below.
const PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const manager = new THREE.LoadingManager();
manager.setURLModifier((url) => {
  if (/colormap|Textures\//i.test(url)) return PIXEL_PNG;
  return url;
});
const loader = new GLTFLoader(manager);

// ---- materials (shared) -----------------------------------------------------
const M = {
  oak:    new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 0.7 }),
  oakDk:  new THREE.MeshStandardMaterial({ color: 0x382414, roughness: 0.8 }),
  gilt:   new THREE.MeshStandardMaterial({ color: 0xd8b24a, metalness: 0.5, roughness: 0.35 }),
  giltDk: new THREE.MeshStandardMaterial({ color: 0xb0863a, metalness: 0.5, roughness: 0.4 }),
  stone:  new THREE.MeshStandardMaterial({ color: 0xb9b3a4, roughness: 0.9 }),
  marble: new THREE.MeshStandardMaterial({ color: 0xe7e0cd, roughness: 0.6 }),
  wax:    new THREE.MeshStandardMaterial({ color: 0xf2e6c2, roughness: 0.6 }),
  flame:  new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb43a, emissiveIntensity: 1.8, roughness: 0.4 }),
  water:  new THREE.MeshStandardMaterial({ color: 0x6fa8c8, metalness: 0.2, roughness: 0.2, transparent: true, opacity: 0.85 }),
};

function tag(o) {
  o.traverse((m) => {
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
    m.userData.__toonDone = true;
    m.userData.noCollide = true;
  });
  return o;
}
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const cyl = (rt, rb, h, s, mat) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), mat);

// ---- small builders ---------------------------------------------------------

// A wax candle on a gilt cup with a glowing flame teardrop.
function candle(x, y, z, h = 0.34) {
  const g = new THREE.Group();
  const cup = cyl(0.07, 0.09, 0.08, 10, M.gilt); cup.position.y = 0.04;
  const stick = cyl(0.05, 0.055, h, 8, M.wax); stick.position.y = 0.08 + h / 2;
  const fl = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), M.flame);
  fl.scale.y = 1.9; fl.position.y = 0.08 + h + 0.07;
  g.add(cup, stick, fl);
  g.position.set(x, y, z);
  return g;
}

// A tall iron-and-gilt floor candelabra: a fluted column on a stepped foot with
// a tray of candles. ~2.4m tall. Smooth/sculpted, not blocky.
function candelabra(x, z) {
  const g = new THREE.Group();
  const foot = cyl(0.42, 0.5, 0.16, 16, M.giltDk); foot.position.y = 0.08;
  const foot2 = cyl(0.3, 0.42, 0.12, 16, M.gilt); foot2.position.y = 0.2;
  const shaft = cyl(0.07, 0.09, 1.9, 12, M.giltDk); shaft.position.y = 1.15;
  // a couple of decorative collars on the shaft
  const c1 = cyl(0.12, 0.12, 0.08, 12, M.gilt); c1.position.y = 0.7;
  const c2 = cyl(0.12, 0.12, 0.08, 12, M.gilt); c2.position.y = 1.5;
  const tray = cyl(0.45, 0.3, 0.07, 16, M.gilt); tray.position.y = 2.12;
  g.add(foot, foot2, shaft, c1, c2, tray);
  // a ring of candles on the tray + a tall centre candle
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    g.add(candle(Math.cos(a) * 0.34, 2.16, Math.sin(a) * 0.34, 0.26));
  }
  g.add(candle(0, 2.16, 0, 0.4));
  g.position.set(x, 0, z);
  return g;
}

// A carved wooden PEW with a back, end-cheeks and a kneeler rail. Faces +z toward
// the altar. ~2.4m long. (length runs along x; depth along z)
function pew(x, z, len = 2.4) {
  const g = new THREE.Group();
  const seat = box(len, 0.14, 0.5, M.oak); seat.position.set(0, 0.5, 0);
  const back = box(len, 0.6, 0.1, M.oak); back.position.set(0, 0.78, -0.26);
  // shaped end-cheeks (a bevelled top via a thin cap)
  for (const sx of [-1, 1]) {
    const cheek = box(0.1, 1.06, 0.56, M.oakDk); cheek.position.set(sx * (len / 2 - 0.05), 0.53, -0.02); g.add(cheek);
    const cap = box(0.16, 0.1, 0.62, M.gilt); cap.position.set(sx * (len / 2 - 0.05), 1.08, -0.02); g.add(cap);
  }
  // legs
  for (const sx of [-1, 1]) { const lg = box(0.12, 0.5, 0.4, M.oakDk); lg.position.set(sx * (len / 2 - 0.3), 0.25, 0); g.add(lg); }
  // padded kneeler rail in front (toward the altar)
  const kneel = box(len - 0.3, 0.1, 0.22, new THREE.MeshStandardMaterial({ color: 0x6e1f2f, roughness: 0.85 }));
  kneel.position.set(0, 0.18, 0.5); g.add(kneel);
  const krailL = box(0.08, 0.22, 0.08, M.oakDk); krailL.position.set(-(len / 2 - 0.4), 0.1, 0.5);
  const krailR = box(0.08, 0.22, 0.08, M.oakDk); krailR.position.set((len / 2 - 0.4), 0.1, 0.5);
  g.add(seat, back, krailL, krailR);
  g.position.set(x, 0, z);
  return g;
}

// A small stone holy-water FONT: a fluted pedestal under a shallow bowl of water.
function font(x, z) {
  const g = new THREE.Group();
  const base = cyl(0.4, 0.5, 0.18, 16, M.stone); base.position.y = 0.09;
  const stem = cyl(0.16, 0.22, 0.85, 14, M.stone); stem.position.y = 0.6;
  const bowl = cyl(0.46, 0.3, 0.26, 18, M.marble); bowl.position.y = 1.15;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.05, 8, 20), M.gilt); rim.rotation.x = Math.PI / 2; rim.position.y = 1.27;
  const w = cyl(0.4, 0.4, 0.04, 18, M.water); w.position.y = 1.25;
  g.add(base, stem, bowl, rim, w);
  g.position.set(x, 0, z);
  return g;
}

// The aisle PRAYER-RUG runner: deep red with a woven gold border (painted canvas).
let _runTex = null;
function runnerTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#6e1422'; x.fillRect(0, 0, 64, 256);
  x.fillStyle = '#5a0f1b'; for (let i = 0; i < 256; i += 16) x.fillRect(0, i, 64, 2);
  x.strokeStyle = '#cda23e'; x.lineWidth = 4; x.strokeRect(5, 0, 54, 256);
  x.lineWidth = 2; x.strokeRect(12, 0, 40, 256);
  x.fillStyle = '#cda23e';
  for (let i = 16; i < 256; i += 40) { x.beginPath(); x.moveTo(32, i); x.lineTo(40, i + 8); x.lineTo(32, i + 16); x.lineTo(24, i + 8); x.closePath(); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapT = THREE.RepeatWrapping; return t;
}
function runner(x, z, len, w = 1.7) {
  if (!_runTex) _runTex = runnerTexture();
  const tex = _runTex.clone(); tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, Math.max(1, Math.round(len / 4))); tex.needsUpdate = true;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.14, z); m.receiveShadow = true;
  return m;
}

// A hanging religious BANNER / tapestry: a painted cloth (a gilt chalice + halo on
// deep blue) under a gilt rod. Mounts flat against a wall facing -x (faceSign=-1)
// or +z. Smooth cloth, gilt trim.
let _banTex = null;
function bannerTexture() {
  const c = document.createElement('canvas'); c.width = 96; c.height = 200;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 200); g.addColorStop(0, '#26407a'); g.addColorStop(1, '#1a2c56');
  x.fillStyle = g; x.fillRect(0, 0, 96, 200);
  x.strokeStyle = '#cda23e'; x.lineWidth = 7; x.strokeRect(6, 6, 84, 188);
  x.lineWidth = 3; x.strokeRect(15, 15, 66, 170);
  // radiant halo
  x.fillStyle = 'rgba(231,200,120,0.35)';
  x.beginPath(); x.arc(48, 70, 34, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#e7c878'; x.lineWidth = 3;
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; x.beginPath(); x.moveTo(48 + Math.cos(a) * 30, 70 + Math.sin(a) * 30); x.lineTo(48 + Math.cos(a) * 42, 70 + Math.sin(a) * 42); x.stroke(); }
  // chalice
  x.fillStyle = '#d8b24a';
  x.beginPath(); x.moveTo(34, 60); x.lineTo(62, 60); x.lineTo(56, 86); x.lineTo(40, 86); x.closePath(); x.fill();
  x.fillRect(45, 86, 6, 18); x.fillRect(36, 104, 24, 6);
  // a downward cross emblem lower on the cloth
  x.fillStyle = '#e7c878'; x.fillRect(44, 130, 8, 46); x.fillRect(33, 144, 30, 8);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function banner(x, z, ry, h = 3.2, w = 1.5, top = 4.4) {
  if (!_banTex) _banTex = bannerTexture();
  const g = new THREE.Group();
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: _banTex, side: THREE.DoubleSide, roughness: 0.9 }));
  cloth.position.y = top - h / 2;
  const rod = cyl(0.05, 0.05, w + 0.3, 10, M.giltDk); rod.rotation.z = Math.PI / 2; rod.position.y = top;
  for (const sx of [-1, 1]) { const fin = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), M.gilt); fin.position.set(sx * (w / 2 + 0.15), top, 0); g.add(fin); }
  g.add(cloth, rod);
  g.position.set(x, 0, z); g.rotation.y = ry;
  return g;
}

// An elegant ARCHED stained-glass light on the outer wall: a single smooth sheet
// of softly-glowing coloured glass (radial warm-to-cool tint, painted figure) set
// behind slim gilt tracery — a half-round arch head, a vertical mullion and a
// transom. Mounts on the +x outer wall facing -x. NOT a blocky grid.
let _glassTex = null;
function glassTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const x = c.getContext('2d');
  // warm radiant centre fading to deep jewel tones at the edges
  const g = x.createRadialGradient(64, 150, 10, 64, 150, 170);
  g.addColorStop(0, '#fff0c0'); g.addColorStop(0.35, '#f0c25a'); g.addColorStop(0.7, '#9a4d8c'); g.addColorStop(1, '#2e3f8a');
  x.fillStyle = g; x.fillRect(0, 0, 128, 256);
  // a soft saintly halo + figure suggestion (no hard grid)
  x.fillStyle = 'rgba(255,245,210,0.5)'; x.beginPath(); x.arc(64, 90, 26, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(120,60,150,0.35)';
  x.beginPath(); x.moveTo(64, 118); x.bezierCurveTo(30, 150, 34, 230, 64, 246); x.bezierCurveTo(94, 230, 98, 150, 64, 118); x.fill();
  // gentle vertical light streaks for stained sheen
  x.globalAlpha = 0.12; x.fillStyle = '#ffffff';
  for (let i = 8; i < 128; i += 22) x.fillRect(i, 0, 4, 256);
  x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function archedGlass(x, z, sillY, w, h) {
  if (!_glassTex) _glassTex = glassTexture();
  const g = new THREE.Group();
  const glassMat = new THREE.MeshStandardMaterial({ map: _glassTex, emissive: 0xffffff, emissiveMap: _glassTex, emissiveIntensity: 0.6, roughness: 0.25, metalness: 0.05, side: THREE.DoubleSide });
  // rectangular body
  const body = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat);
  body.position.set(0, sillY + h / 2, 0); body.rotation.y = -Math.PI / 2;
  g.add(body);
  // half-round glowing head
  const head = new THREE.Mesh(new THREE.CircleGeometry(w / 2, 24, 0, Math.PI), glassMat);
  head.position.set(0, sillY + h, 0); head.rotation.y = -Math.PI / 2;
  g.add(head);
  // slim gilt tracery: arch frame (torus half), mullion, transom, sill
  const arch = new THREE.Mesh(new THREE.TorusGeometry(w / 2 + 0.04, 0.06, 8, 22, Math.PI), M.gilt);
  arch.position.set(0, sillY + h, 0); arch.rotation.y = Math.PI / 2; g.add(arch);
  const jamb = (sx) => { const j = cyl(0.05, 0.05, h, 8, M.gilt); j.position.set(0, sillY + h / 2, sx * (w / 2 + 0.04)); g.add(j); };
  jamb(-1); jamb(1);
  const mull = cyl(0.045, 0.045, h, 8, M.gilt); mull.position.set(0, sillY + h / 2, 0); g.add(mull);
  const transom = cyl(0.045, 0.045, w, 8, M.gilt); transom.rotation.x = Math.PI / 2; transom.position.set(0, sillY + h * 0.5, 0); g.add(transom);
  const sill = box(0.18, 0.16, w + 0.3, M.stone); sill.position.set(0, sillY - 0.05, 0); g.add(sill);
  g.position.set(x, 0, z);
  return g;
}

// A glowing gilt ICON / halo plaque to hang above the altar (behind the cross).
function iconHalo(x, y, z) {
  const g = new THREE.Group();
  const disc = cyl(0.55, 0.55, 0.08, 28, new THREE.MeshStandardMaterial({ color: 0xe7c878, emissive: 0xffcf6a, emissiveIntensity: 0.7, metalness: 0.5, roughness: 0.4 }));
  disc.rotation.x = Math.PI / 2;
  // radiating gilt rays
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const ray = box(0.06, 0.04, 0.28, M.gilt);
    ray.position.set(Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0);
    ray.rotation.z = a; g.add(ray);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.04, 8, 28), M.gilt); g.add(ring, disc);
  g.position.set(x, y, z);   // disc lies in the x-y plane, facing -z toward the room
  return g;
}

// A procedural fallback altar (sculpted stone mensa on a stepped base, gilt edges)
// used only if the GLB fails to load — so the chapel is never bare.
function fallbackAltar(x, z) {
  const g = new THREE.Group();
  const base = box(2.6, 0.3, 1.4, M.stone); base.position.y = 0.15;
  const body = box(2.0, 1.0, 1.0, M.marble); body.position.y = 0.7;
  const mensa = box(2.4, 0.16, 1.3, M.stone); mensa.position.y = 1.28;
  const trim = box(2.5, 0.05, 1.4, M.gilt); trim.position.y = 1.21;
  g.add(base, body, mensa, trim);
  g.position.set(x, 0, z);
  return g;
}

// A procedural standing CROSS (fallback if GLB cross fails).
function fallbackCross(x, y, z, h = 2.0) {
  const g = new THREE.Group();
  const v = box(0.16, h, 0.16, M.gilt); v.position.y = h / 2;
  const arm = box(0.9, 0.16, 0.16, M.gilt); arm.position.y = h * 0.7;
  g.add(v, arm); g.position.set(x, y, z);
  return g;
}

// ---- GLB loading ------------------------------------------------------------
// Resolves with the loaded scene, or null on error / a 7s stall (so the chapel
// always falls back to its procedural altar+cross rather than hanging).
function loadGLB(name) {
  return new Promise((ok) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; ok(v); } };
    setTimeout(() => finish(null), 7000);
    loader.load(PROP_DIR + name + '.glb', (gl) => finish(gl.scene), undefined, () => finish(null));
  });
}
// place a GLB so its feet sit at y0, scaled to ~targetH metres tall. Re-tints the
// model to a clean warm stone (its baked colormap texture isn't shipped).
function placeGLB(parent, src, x, z, targetH, ry = 0, yOff = 0, tint = 0xbdb6a6) {
  const o = src.clone(true);
  o.traverse((m) => { if (m.isMesh) { m.material = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.85, metalness: 0.05 }); } });
  o.rotation.y = ry;
  const b0 = new THREE.Box3().setFromObject(o);
  const size = new THREE.Vector3(); b0.getSize(size);
  const s = targetH / Math.max(0.001, size.y);
  o.scale.setScalar(s);
  const b = new THREE.Box3().setFromObject(o);
  o.position.set(x, -b.min.y + yOff, z);
  tag(o);
  parent.add(o);
  return o;
}

// ---- build ------------------------------------------------------------------
async function furnishChapel(ground) {
  const root = new THREE.Group(); root.name = 'castle-chapel';
  ground.add(root);

  const AX = 16;        // chapel centre x (aisle)
  const ALT_Z = 18.6;   // altar back of the room

  // Prayer-rug runner up the central aisle from the doorway toward the altar.
  root.add(tag(runner(AX, 11, 16, 1.7)));

  // Altar (GLB if available, else procedural) sitting just forward of the old
  // plain stone block at z19 so it reads as a sculpted dressed altar.
  const [altarGLB, crossGLB] = await Promise.all([loadGLB('graveyard_altar_stone'), loadGLB('graveyard_cross')]);
  if (altarGLB) placeGLB(root, altarGLB, AX, ALT_Z, 1.4, Math.PI, 0, 0xc7c0af);
  else root.add(tag(fallbackAltar(AX, ALT_Z)));

  // a marble mensa cloth/top + altar candles + altar cross on top
  const cloth = box(2.4, 0.06, 1.2, new THREE.MeshStandardMaterial({ color: 0xece3cf, roughness: 0.7 }));
  cloth.position.set(AX, 1.46, ALT_Z); root.add(tag(cloth));
  const giltEdge = box(2.5, 0.04, 1.3, M.gilt); giltEdge.position.set(AX, 1.44, ALT_Z); root.add(tag(giltEdge));
  for (const sx of [-1.5, -0.9, 0.9, 1.5]) root.add(tag(candle(AX + sx, 1.49, ALT_Z + 0.35, 0.4)));

  // tall standing cross rising from the altar top
  if (crossGLB) placeGLB(root, crossGLB, AX, ALT_Z - 0.05, 1.9, Math.PI, 1.49, 0xd8b24a);
  else root.add(tag(fallbackCross(AX, 1.49, ALT_Z - 0.05, 2.0)));

  // glowing gilt icon halo mounted on the back wall above the altar
  root.add(tag(iconHalo(AX, 4.3, 20.3)));

  // two rows of PEWS facing the altar with a clear central aisle (rug at x16).
  // pews sit either side of the aisle; nothing past z~16 (keep altar approach open)
  for (const z of [9.5, 12.5, 15.5]) {
    root.add(tag(pew(AX - 2.0, z, 2.4)));   // left bank
    root.add(tag(pew(AX + 2.0, z, 2.4)));   // right bank
  }

  // tall candelabra flanking the altar
  root.add(tag(candelabra(AX - 3.2, ALT_Z - 0.4)));
  root.add(tag(candelabra(AX + 3.2, ALT_Z - 0.4)));

  // a hanging religious banner on the inner divider wall (x≈10) — well clear of
  // the doorway gap (z 8..11): place at z≈14 and z≈4 facing into the room (+x).
  root.add(tag(banner(10.3, 14, Math.PI / 2, 3.0, 1.4, 4.3)));
  root.add(tag(banner(10.3, 4.5, Math.PI / 2, 3.0, 1.4, 4.3)));

  // elegant arched stained-glass lights on the outer wall (x≈22), facing -x.
  for (const z of [6, 12]) root.add(tag(archedGlass(21.8, z, 1.6, 1.9, 2.6)));

  // a small stone holy-water font near the chapel entrance (just inside doorway).
  root.add(tag(font(AX - 2.6, 5.0)));

  // ONE warm point light, low over the altar, to give the apse a reverent glow.
  const l = new THREE.PointLight(0xffc878, 6, 16, 2);
  l.position.set(AX, 3.2, ALT_Z - 1.5);
  root.add(l);
}

// ---- boot -------------------------------------------------------------------
(function boot() {
  let tries = 0;
  const iv = setInterval(async () => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.scene && em.scene.userData.keep && em.scene.userData.keep.ground) {
      clearInterval(iv);
      try { await furnishChapel(em.scene.userData.keep.ground); }
      catch (err) { console.error('[castleRoom_chapel] failed', err); }
    } else if (tries > 800) { clearInterval(iv); }
  }, 100);
})();
