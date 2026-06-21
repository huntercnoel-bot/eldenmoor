// collision.js — keeps the hero from walking through walls, towers, buildings,
// trees and rocks. Colliders are simple circles and axis-aligned rectangles in
// the world's XZ plane, resolved with wall-sliding. The castle has THREE floors
// (basement -1, ground 0, upper +1); each floor keeps its own collider set and
// only the active floor's set is used.

import * as THREE from '../vendor/three.module.js';

const PLAYER_R = 0.45;

export function createCollision(scene) {
  const sets = {};   // floor -> { circles, rects }
  const ensure = (f) => (sets[f] || (sets[f] = { circles: [], rects: [] }));
  const addCircle = (f, x, z, r) => ensure(f).circles.push({ x, z, r });
  const addRect = (f, x0, z0, x1, z1) => ensure(f).rects.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });

  const bb = new THREE.Box3();
  // Auto-generate rect colliders from a floor's solid meshes (walls, towers,
  // counters…). Flat floors/roads, overhead roofs/banners, low steps, and
  // noCollide-tagged decor are skipped — so doorways/gateways stay walkable.
  const addGroups = (f, groups) => {
    for (const grp of groups || []) {
      grp.updateWorldMatrix(true, true);
      grp.traverse((o) => {
        if (!o.isMesh || o.userData.noCollide) return;
        bb.setFromObject(o);
        const h = bb.max.y - bb.min.y;
        if (bb.max.y < 0.4) return;
        if (bb.min.y > 2.0) return;
        if (h < 0.7 && bb.min.y < 0.5) return;
        if ((bb.max.x - bb.min.x) > 60 || (bb.max.z - bb.min.z) > 60) return;
        addRect(f, bb.min.x, bb.min.z, bb.max.x, bb.max.z);
      });
    }
  };

  // Ground floor (0): castle + shops + town, plus round scenery + hand-placed water/town colliders.
  addGroups(0, scene.userData.buildings);
  for (const t of scene.userData.trees || []) addCircle(0, t.position.x, t.position.z, 0.42 * (t.scale.x || 1));
  for (const r of scene.userData.rocks || []) addCircle(0, r.position.x, r.position.z, 0.5 * Math.max(r.scale.x || 1, r.scale.z || 1));
  for (const c of scene.userData.colliders || []) { if (c.r != null) addCircle(0, c.x, c.z, c.r); else addRect(0, c.x0, c.z0, c.x1, c.z1); }
  // Upper (+1) and basement (-1) keeps.
  addGroups(1, scene.userData.upperBuildings);
  addGroups(-1, scene.userData.basementBuildings);

  // --- Spatial hash grid (built once per floor) -----------------------------
  // blocked() is called up to 4x per movement frame and used to do a linear scan
  // over EVERY collider on the active floor (hundreds). Instead we bucket each
  // collider into a uniform grid, expanding its footprint by PLAYER_R so a single
  // query POINT only needs to test the colliders in its own cell. This is exact:
  // any collider that could block at (x,z) overlaps the cell containing (x,z),
  // because we grew every footprint by the player radius before bucketing.
  const CELL = 4;                       // metres; comfortably larger than most colliders
  const key = (cx, cz) => cx * 73856093 ^ cz * 19349663;   // hash a cell coord pair
  for (const f of Object.keys(sets)) {
    const s = sets[f];
    const grid = new Map();
    const put = (cx, cz, item) => {
      const k = key(cx, cz);
      let bucket = grid.get(k);
      if (!bucket) grid.set(k, bucket = []);
      bucket.push(item);
    };
    // Insert an item into every cell its (player-radius-expanded) AABB overlaps.
    const insert = (minX, minZ, maxX, maxZ, item) => {
      const x0 = Math.floor((minX - PLAYER_R) / CELL), x1 = Math.floor((maxX + PLAYER_R) / CELL);
      const z0 = Math.floor((minZ - PLAYER_R) / CELL), z1 = Math.floor((maxZ + PLAYER_R) / CELL);
      for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) put(cx, cz, item);
    };
    for (const c of s.circles) insert(c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r, c);
    for (const r of s.rects) insert(r.x0, r.z0, r.x1, r.z1, r);
    s.grid = grid;
  }

  let active = 0;
  const setActiveFloor = (f) => { active = f; };

  function blocked(x, z) {
    const s = sets[active];
    if (!s) return false;
    const bucket = s.grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!bucket) return false;
    for (const c of bucket) {
      if (c.r != null) {                // circle collider
        const dx = x - c.x, dz = z - c.z, rr = c.r + PLAYER_R;
        if (dx * dx + dz * dz < rr * rr) return true;
      } else {                          // rect collider (AABB)
        const cx = Math.max(c.x0, Math.min(x, c.x1)), cz = Math.max(c.z0, Math.min(z, c.z1));
        const dx = x - cx, dz = z - cz;
        if (dx * dx + dz * dz < PLAYER_R * PLAYER_R) return true;
      }
    }
    return false;
  }

  function resolve(px, pz, nx, nz) {
    if (!blocked(nx, nz)) return { x: nx, z: nz };
    if (!blocked(nx, pz)) return { x: nx, z: pz };
    if (!blocked(px, nz)) return { x: px, z: nz };
    return { x: px, z: pz };
  }

  const count = Object.values(sets).reduce((n, s) => n + s.circles.length + s.rects.length, 0);
  return { resolve, blocked, setActiveFloor, count };
}
