// castleRoom_treasury.js — furnishes the castle's TREASURY (ground floor, the
// back-right courtyard room: local x∈[11,21], z∈[-10,-1], walls x=10/x=22,
// cross-walls near z=-11 & z=0, inner doorway at x=10 over z -7..-4). It loads
// the real treasure GLBs (chests, coin piles, coin bags, pedestals) and adds
// procedural gold bars, gem displays, crowns, strongboxes and one warm candle
// light — opulent but tidy, so the room glitters with riches.
//
// Everything is added as a CHILD of scene.userData.keep.ground (castle local
// space, gate=-z / throne=+z, floor y≈0) so it inherits the ground floor's
// show/hide for free. Meshes are tagged __toonDone (skip cel-shade) and
// noCollide (purely decorative — never blocks doorways).
//
// Self-contained: polls window.eldenmoor and boots itself. Only external edit
// is one import line in main.js.

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';

const DIR = './assets/models/props/';
// These prop GLBs reference a shared external texture (assets/.../Textures/
// colormap.png) that isn't shipped. Its 404 — requested by many modules at
// once — saturates the connection pool and can wedge our loads for many
// seconds. The props carry NO usable map anyway (their colour is in the
// material), so redirect ANY image the loader asks for to a 1×1 data-URI: it
// resolves instantly with zero network, and we re-tint the gold props ourselves.
const BLANK_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const mgr = new THREE.LoadingManager();
mgr.setURLModifier((url) => (/\.(png|jpe?g|webp)(\?|$)/i.test(url) ? BLANK_PNG : url));
mgr.onError = () => {};
const loader = new GLTFLoader(mgr);
const cache = {};
const proto = {};

function load(name) {
  if (!cache[name]) cache[name] = new Promise((ok, err) => loader.load(DIR + name + '.glb', (g) => ok(g.scene), undefined, err));
  return cache[name];
}

// tag a mesh/group as decorative treasure (no collision, no cel-shade)
function tag(o) {
  o.traverse((m) => {
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
    m.userData.__toonDone = true;
    m.userData.noCollide = true;
  });
  return o;
}

// clone a cached GLB prototype into `parent`, scaled by `s`, feet on y=`y`
// (default: floor at y=0). `gold` (opt) re-tints the prop's materials into
// gleaming gold so coin piles / bags read unmistakably as treasure.
function put(parent, name, x, z, ry = 0, s = 1, y = null, gold = false) {
  const src = proto[name];
  if (!src) return null;
  const o = src.clone(true);
  o.rotation.y = ry;
  o.scale.setScalar(s);
  o.position.set(x, 0, z);
  if (gold) o.traverse((m) => {
    if (m.isMesh) {
      m.material = M.gold;                       // gleaming gold for coin props
    }
  });
  if (y == null) { const minY = new THREE.Box3().setFromObject(o).min.y; o.position.y = -minY; }
  else o.position.y = y;
  tag(o);
  parent.add(o);
  return o;
}

// top Y of a placed object (so we can stand a gem/crown on a pedestal)
function topY(o) { return o ? new THREE.Box3().setFromObject(o).max.y : 1.1; }

// ---- materials -------------------------------------------------------------
const M = {
  gold: new THREE.MeshStandardMaterial({ color: 0xf0c23a, metalness: 0.85, roughness: 0.28, emissive: 0x4a3200, emissiveIntensity: 0.25 }),
  iron: new THREE.MeshStandardMaterial({ color: 0x4a4e55, metalness: 0.7, roughness: 0.55 }),
  ironDark: new THREE.MeshStandardMaterial({ color: 0x2c3035, metalness: 0.6, roughness: 0.6 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 0.8 }),
  velvet: new THREE.MeshStandardMaterial({ color: 0x7e1322, roughness: 0.9 }),
  velvetBlue: new THREE.MeshStandardMaterial({ color: 0x223a6e, roughness: 0.9 }),
  ruby: new THREE.MeshStandardMaterial({ color: 0xc81f3a, metalness: 0.2, roughness: 0.1, emissive: 0x6a0a16, emissiveIntensity: 0.6 }),
  emerald: new THREE.MeshStandardMaterial({ color: 0x1fa861, metalness: 0.2, roughness: 0.1, emissive: 0x0a4a28, emissiveIntensity: 0.6 }),
  sapphire: new THREE.MeshStandardMaterial({ color: 0x2a6bd8, metalness: 0.2, roughness: 0.1, emissive: 0x0a2a6a, emissiveIntensity: 0.6 }),
  amethyst: new THREE.MeshStandardMaterial({ color: 0x8a3fd0, metalness: 0.2, roughness: 0.1, emissive: 0x3a1060, emissiveIntensity: 0.6 }),
  candle: new THREE.MeshStandardMaterial({ color: 0xffe6a3, emissive: 0xffcf6a, emissiveIntensity: 1.8, roughness: 0.5 }),
};

const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); return b; };
const cyl = (rt, rb, h, seg, m, x, y, z) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); c.position.set(x, y, z); return c; };

// A neat stack of gold ingots (brick-staggered), gleaming.
function goldBars(root, x, z, rows = 3, cols = 2, ry = 0) {
  const g = new THREE.Group();
  const bw = 0.44, bh = 0.16, bd = 0.22, gap = 0.02;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (bw / 2);
    const n = Math.max(1, cols - (r % 2));
    for (let c = 0; c < n; c++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(bd * 0.62, bd * 0.78, bw, 4), M.gold);
      bar.rotation.z = Math.PI / 2; bar.rotation.y = Math.PI / 4;
      bar.position.set(off + c * (bw + gap) - (n - 1) * (bw + gap) / 2, bh / 2 + r * bh, 0);
      g.add(bar);
    }
  }
  g.position.set(x, 0, z); g.rotation.y = ry;
  tag(g); root.add(g); return g;
}

// A scatter of loose gold coins around a centre — a glinting carpet of riches.
function coinScatter(root, cx, cz, radius, count) {
  const g = new THREE.Group();
  const coinGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.02, 10);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius;
    const c = new THREE.Mesh(coinGeo, M.gold);
    c.position.set(Math.cos(a) * r, 0.012, Math.sin(a) * r);
    c.rotation.set(Math.random() * 0.5 - 0.25, Math.random() * Math.PI, Math.random() * 0.5 - 0.25);
    g.add(c);
  }
  g.position.set(cx, 0, cz);
  tag(g); root.add(g); return g;
}

// A faceted glowing gem on a small gold foot (returns a tagged group).
function gem(mat, x, y, z, scale = 1) {
  const g = new THREE.Group();
  const foot = cyl(0.1, 0.13, 0.08, 12, M.gold, 0, 0.04, 0);
  const stone = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), mat);
  stone.position.y = 0.24; stone.scale.set(1, 1.4, 1);
  g.add(foot, stone);
  g.position.set(x, y, z); g.scale.setScalar(scale);
  return tag(g);
}

// A gilded crown: gold band, upright points, set gems, top orb.
function crown(x, y, z, scale = 1) {
  const g = new THREE.Group();
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 18, 1, true), M.gold);
  band.position.y = 0.07; g.add(band);
  g.add(cyl(0.235, 0.235, 0.04, 18, M.gold, 0, 0.14, 0));
  const gems = [M.ruby, M.sapphire, M.emerald, M.amethyst];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const pt = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 5), M.gold);
    pt.position.set(Math.cos(a) * 0.22, 0.22, Math.sin(a) * 0.22);
    g.add(pt);
    const j = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), gems[k % gems.length]);
    j.position.set(Math.cos(a) * 0.22, 0.09, Math.sin(a) * 0.22);
    g.add(j);
  }
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), M.gold).translateY(0.3));
  g.position.set(x, y, z); g.scale.setScalar(scale);
  return tag(g);
}

// A velvet cushion with gold corner tassels — bears a crown on display.
function cushion(x, y, z, mat = M.velvet) {
  const g = new THREE.Group();
  g.add(box(0.7, 0.18, 0.7, mat, 0, 0.09, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), M.gold).translateX(sx * 0.33).translateY(0.06).translateZ(sz * 0.33));
  }
  g.position.set(x, y, z);
  return tag(g);
}

// A locked iron strongbox — riveted bands, stout body, big gold padlock.
function strongbox(root, x, z, ry = 0, s = 1) {
  const g = new THREE.Group();
  g.add(box(0.9, 0.6, 0.6, M.iron, 0, 0.3, 0));
  g.add(box(0.94, 0.16, 0.64, M.ironDark, 0, 0.66, 0));
  for (const bx of [-0.32, 0.32]) g.add(box(0.08, 0.74, 0.64, M.ironDark, bx, 0.37, 0));
  g.add(box(0.94, 0.74, 0.08, M.ironDark, 0, 0.37, 0.31));
  g.add(box(0.18, 0.2, 0.06, M.gold, 0, 0.5, 0.34));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 14, Math.PI), M.gold).translateY(0.62).translateZ(0.34));
  g.position.set(x, 0, z); g.rotation.y = ry; g.scale.setScalar(s);
  tag(g); root.add(g); return g;
}

// ---- build the room --------------------------------------------------------
function furnishTreasury(floor) {
  const root = new THREE.Group();
  root.name = 'castle-treasury';
  floor.add(root);

  // ---- chests of riches (real GLBs) ----
  // Closed strong chests lining the outer wall (clear of the vault door @x21.9,z-8).
  put(root, 'Chest_Closed', 20.4, -4.5, -Math.PI / 2, 1.0);
  put(root, 'Chest_Closed', 20.4, -6.2, -Math.PI / 2, 1.0);
  // An open chest overflowing with gold — the centrepiece of the hoard.
  put(root, 'Chest_Open', 16.5, -8.6, 0, 1.15);
  put(root, 'Coin_Pile', 16.5, -7.6, 0, 1.3, null, true);            // coins brimming before it
  coinScatter(root, 16.5, -7.4, 0.9, 60);

  // ---- gold coin piles & bags strewn about ----
  put(root, 'Coin_Pile', 13.4, -9.0, 0.6, 1.1, null, true);
  put(root, 'Coin_Pile', 19.4, -9.0, 1.8, 1.0, null, true);
  put(root, 'Bag_Coins', 14.4, -8.4, 0.3, 1.1);
  put(root, 'Bag_Coins', 18.2, -8.8, 2.4, 1.0);
  put(root, 'Bag_Coins', 12.6, -3.4, 0.8, 1.0);
  put(root, 'Coin', 15.2, -8.0, 0, 1.0, null, true);
  coinScatter(root, 14.0, -8.8, 0.7, 30);
  coinScatter(root, 19.2, -8.8, 0.6, 24);

  // ---- stacked gold BARS ----
  goldBars(root, 12.4, -9.2, 4, 3, 0.2);   // tall stack in the back-left corner
  goldBars(root, 13.6, -8.6, 3, 2, -0.3);
  goldBars(root, 21.0, -8.8, 3, 2, Math.PI / 2);
  goldBars(root, 21.2, -3.2, 2, 2, Math.PI / 2);

  // ---- gem / crown displays on PEDESTALS ----
  // Kept off the central aisle so the back-wall hoard stays in view; the crowned
  // pedestal is the front-and-centre focal piece of the room.
  const p1 = put(root, 'Pedestal', 12.6, -5.5, 0, 1.0);
  root.add(gem(M.ruby, 12.6, topY(p1), -5.5, 1.0));
  const p2 = put(root, 'Pedestal2', 12.6, -7.6, 0, 1.0);
  root.add(gem(M.emerald, 12.6, topY(p2), -7.6, 1.1));
  const p3 = put(root, 'Pedestal', 19.6, -5.4, 0, 1.0);
  root.add(gem(M.sapphire, 19.6, topY(p3), -5.4, 1.0));
  const p4 = put(root, 'Pedestal2', 16.4, -2.6, 0, 1.0);   // the CROWN held high, front-centre
  root.add(crown(16.4, topY(p4), -2.6, 1.0));

  // ---- velvet cushion bearing a crown (low display table) ----
  const table = box(1.2, 0.7, 0.8, M.wood, 13.0, 0.35, -2.2); tag(table); root.add(table);
  const trim = box(1.26, 0.08, 0.86, M.gold, 13.0, 0.74, -2.2); tag(trim); root.add(trim);
  root.add(cushion(13.0, 0.78, -2.2, M.velvetBlue));
  root.add(crown(13.0, 0.96, -2.2, 0.85));

  // ---- locked iron strongboxes ----
  strongbox(root, 18.6, -2.0, -0.4, 1.0);
  strongbox(root, 20.6, -8.6, Math.PI / 2, 0.9);

  // ---- candlelight glinting off the gold (exactly ONE PointLight) ----
  const stand = cyl(0.06, 0.09, 0.9, 8, M.gold, 15.0, 0.45, -5.6); tag(stand); root.add(stand);
  const flame = box(0.16, 0.3, 0.16, M.candle, 15.0, 1.05, -5.6); tag(flame); root.add(flame);
  const light = new THREE.PointLight(0xffd27a, 6, 16, 2);
  light.position.set(16.0, 1.6, -5.6);
  root.add(light);
}

async function furnishAll(em) {
  const keep = em.scene.userData.keep;
  if (!keep || !keep.ground) return;
  const names = ['Chest_Closed', 'Chest_Open', 'Coin_Pile', 'Coin', 'Bag_Coins', 'Pedestal', 'Pedestal2'];
  await Promise.all(names.map((n) => load(n).catch(() => {})));
  for (const n of names) { try { proto[n] = await cache[n]; } catch (e) {} }
  furnishTreasury(keep.ground);
}

(function boot() {
  let tries = 0;
  const iv = setInterval(async () => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.scene && em.player && em.scene.userData.keep && em.scene.userData.keep.ground) {
      clearInterval(iv);
      try { await furnishAll(em); }
      catch (err) { console.error('[castleRoom_treasury] failed', err); }
    } else if (tries > 800) { clearInterval(iv); }
  }, 100);
})();
