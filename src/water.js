// water.js — a castle moat, branch canals and the pond (OSRS-style). Water is
// drawn as translucent blue slabs just above the ground; matching invisible
// colliders (pushed to scene.userData.colliders) stop you walking onto it. The
// gate is reached by a dry land causeway — the gap left at x -10..10 — so no
// drawbridge is needed. collision.js reads scene.userData.colliders.

import * as THREE from '../vendor/three.module.js';

const deco = (m) => { m.userData.noCollide = true; return m; };

// Shared water material: deep RuneScape blue with a real tiling water normal map
// (the canonical three.js waternormals) for moving ripples. One shared material +
// texture; per-slab UVs are scaled in waterSlab so the ripple size stays even
// across differently sized bands, and the offset is scrolled each frame below.
let _waterMat = null;
function waterMat() {
  if (_waterMat) return _waterMat;
  const nm = new THREE.TextureLoader().load('./assets/textures/water/waternormals.jpg');
  nm.wrapS = nm.wrapT = THREE.RepeatWrapping;
  _waterMat = new THREE.MeshStandardMaterial({
    color: 0x2f6ea5, roughness: 0.18, metalness: 0.35,
    transparent: true, opacity: 0.86,
    normalMap: nm, normalScale: new THREE.Vector2(0.45, 0.45),
  });
  // scroll the ripples
  (function ripple() {
    const tick = (now) => {
      requestAnimationFrame(tick);
      const t = (now || 0) * 0.00008;
      nm.offset.set(t % 1, (t * 0.7) % 1);
    };
    requestAnimationFrame(tick);
  })();
  return _waterMat;
}
const WATER_TILE = 7;   // world units per normal-map tile

// A water band drawn as a subtly rippled plane with smooth normals, so the
// surface catches light with a gentle undulation instead of reading as a flat
// slab. Stays cheap: a coarse grid, no per-frame work.
function waterSlab(x0, z0, x1, z1) {
  const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
  const geo = new THREE.PlaneGeometry(w, d, Math.max(2, Math.round(w / 4)), Math.max(2, Math.round(d / 4)));
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), py = p.getY(i);
    p.setZ(i, (Math.sin(px * 0.7) + Math.cos(py * 0.6)) * 0.04);  // gentle ripple
  }
  p.needsUpdate = true; geo.computeVertexNormals();
  // scale UVs so the shared normal map tiles at a consistent world size
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / WATER_TILE), uv.getY(i) * (d / WATER_TILE));
  uv.needsUpdate = true;
  const m = new THREE.Mesh(geo, waterMat());
  m.rotation.x = -Math.PI / 2;
  m.position.set((x0 + x1) / 2, 0.16, (z0 + z1) / 2);
  m.receiveShadow = false;
  return deco(m);
}

// Moat + canal bands (the castle is at z 24..68, side walls at x ±23).
const BANDS = [
  [23.5, 19, 28, 75],     // east moat
  [-28, 19, -23.5, 75],   // west moat
  [-28, 69.5, 28, 75],    // north moat (the back)
  [10, 19, 28, 23],       // front-east  (the central causeway gap = x -10..10)
  [-28, 19, -10, 23],     // front-west
  [28, 40, 46, 44],       // east canal into the fields
  [-46, 40, -28, 44],     // west canal
];

export function waterStructures() {
  return [
    { x: 26, z: 47, r: 27 }, { x: -26, z: 47, r: 27 },
    { x: 0, z: 72, r: 30 },
    { x: 18, z: 21, r: 12 }, { x: -18, z: 21, r: 12 },
    { x: 37, z: 42, r: 10 }, { x: -37, z: 42, r: 10 },
  ];
}

export function buildWater(scene) {
  const g = new THREE.Group();
  for (const [x0, z0, x1, z1] of BANDS) g.add(waterSlab(x0, z0, x1, z1));

  // stone embankment kerb along the island shore (decorative). A rounded,
  // half-buried mossy rim — a low capsule-like cylinder run along each edge so
  // the shoreline reads as a soft sculpted bank rather than a hard box kerb.
  const kerb = new THREE.MeshStandardMaterial({ color: 0x8f897d, roughness: 0.95 });
  const rim = (x0, z0, x1, z1) => {
    const w = Math.max(0.5, Math.abs(x1 - x0)), d = Math.max(0.5, Math.abs(z1 - z0));
    const long = Math.max(w, d), horiz = w >= d;
    // a rounded bar: a thin cylinder laid on its side gives a smooth domed rim
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, long, 12), kerb);
    m.rotation.z = Math.PI / 2;                          // lay it down
    if (!horiz) m.rotation.y = Math.PI / 2;              // orient along z for side shores
    m.position.set((x0 + x1) / 2, 0.16, (z0 + z1) / 2);
    m.castShadow = true; m.receiveShadow = true; g.add(deco(m));
  };
  rim(-23.5, 18.6, -10, 19); rim(10, 18.6, 23.5, 19);   // front shore (sides of the causeway)
  rim(-23.9, 19, -23.5, 69.5); rim(23.5, 19, 23.9, 69.5); // east/west shore
  rim(-23.5, 69.5, 23.5, 69.9);                          // back shore

  scene.add(g);
  (scene.userData.outdoor = scene.userData.outdoor || []).push(g);

  // colliders: the water bands (causeway gap stays open) + the pond circle
  const cols = BANDS.map(([x0, z0, x1, z1]) => ({ x0, z0, x1, z1 }));
  cols.push({ x: 22, z: -16, r: 6 });   // the pond (drawn in world.js)
  scene.userData.colliders = (scene.userData.colliders || []).concat(cols);
  return g;
}
