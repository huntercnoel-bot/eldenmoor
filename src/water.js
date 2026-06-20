// water.js — a castle moat, branch canals and the pond (OSRS-style). Water is
// drawn as translucent blue slabs just above the ground; matching invisible
// colliders (pushed to scene.userData.colliders) stop you walking onto it. The
// gate is reached by a dry land causeway — the gap left at x -10..10 — so no
// drawbridge is needed. collision.js reads scene.userData.colliders.

import * as THREE from '../vendor/three.module.js';

const deco = (m) => { m.userData.noCollide = true; return m; };

function waterSlab(x0, z0, x1, z1) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(Math.abs(x1 - x0), 0.2, Math.abs(z1 - z0)),
    new THREE.MeshStandardMaterial({ color: 0x2f6ea5, roughness: 0.15, metalness: 0.25, transparent: true, opacity: 0.82 })
  );
  m.position.set((x0 + x1) / 2, 0.06, (z0 + z1) / 2);
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

  // stone embankment kerb along the island shore (decorative)
  const kerb = new THREE.MeshStandardMaterial({ color: 0x8f897d, roughness: 0.95 });
  const rim = (x0, z0, x1, z1) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.4, Math.abs(x1 - x0)), 0.4, Math.max(0.4, Math.abs(z1 - z0))), kerb);
    m.position.set((x0 + x1) / 2, 0.18, (z0 + z1) / 2); m.receiveShadow = true; g.add(deco(m));
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
