// townBatch.js — static draw-call slasher for the TOWN (outside the castle).
//
// Profiling showed ~1500 draw calls standing in town: most are small static
// decorative props (lamp posts, banner poles, fountain tiers, graveyard stones,
// fences, signposts, hedges, flower beds, causeway railings, …). Each is its own
// THREE.Mesh — and the global cel-shade pass (toon.js) adds a second inverted-hull
// outline child to many of them, so the real cost is roughly DOUBLE the prop count.
//
// This self-contained module (added with ONE import line in main.js) waits for the
// world to finish loading, then walks the static town meshes and MERGES every
// cluster that shares a material into a single batched BufferGeometry — one draw
// call (plus one outline hull) per material group instead of one per prop. World
// position / rotation / scale are baked into the merged geometry, so nothing moves
// or changes appearance.
//
// SAFETY — it only touches meshes that are unambiguously decorative & static:
//   * userData.__toonDone === true   (already styled by the toon pass)
//   * userData.noCollide   === true   (no collider depends on this mesh)
//   * NOT an InstancedMesh / SkinnedMesh / outline hull / light / the player
//   * NOT inside the castle keep group (scene.userData.keep.*)
//   * NOT tagged userData.noMerge, NOT already userData.__merged
// Collision is baked once at startup (collision.js, synchronous) from a snapshot
// of the meshes, so replacing visible decor LATER cannot disturb colliders — but
// we still restrict ourselves to noCollide decor as a belt-and-braces guarantee.
//
// Each merged output is tagged __toonDone + noCollide + __merged so the toon pass
// and any future collider baker leave it alone. Outline hulls are rebuilt on the
// merged geometry so the cel-shade silhouette look is preserved.

import * as THREE from '../vendor/three.module.js';
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js';

// --- inverted-hull outline material (mirrors toon.js so merged props keep their
//     black silhouette). Constant screen-space thickness, depth-tested, BackSide. -
const OUTLINE_THICKNESS = 0.0042;
let _outlineMat = null;
function outlineMaterial() {
  if (_outlineMat) return _outlineMat;
  _outlineMat = new THREE.ShaderMaterial({
    uniforms: { uThickness: { value: OUTLINE_THICKNESS } },
    vertexShader: /* glsl */`
      uniform float uThickness;
      void main() {
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vec4 clipN = projectionMatrix * vec4(n, 0.0);
        clip.xy += normalize(clipN.xy) * uThickness * clip.w;
        gl_Position = clip;
      }
    `,
    fragmentShader: /* glsl */`
      void main() { gl_FragColor = vec4(0.02, 0.02, 0.03, 1.0); }
    `,
    side: THREE.BackSide,
    depthWrite: true,
    depthTest: true,
  });
  return _outlineMat;
}

// Build a stable signature for a material so visually-identical materials merge
// into ONE group sharing a single material instance. The toon pass swaps each
// ORIGINAL material into its own MeshToonMaterial, so meshes that shared a source
// material end up with distinct toon-material instances — grouping by UUID alone
// would barely coalesce. Grouping by visual signature coalesces them properly.
function materialSignature(mat) {
  if (!mat) return null;
  // We don't attempt to merge multi-material (array) meshes here — those carry
  // geometry groups and are far rarer among the loose town props. Skip them.
  if (Array.isArray(mat)) return null;
  const col = mat.color ? mat.color.getHexString() : 'none';
  const emi = mat.emissive ? mat.emissive.getHexString() : 'none';
  const emiI = mat.emissiveIntensity != null ? mat.emissiveIntensity : 1;
  const mapId = mat.map ? mat.map.uuid : 'none';
  const emiMapId = mat.emissiveMap ? mat.emissiveMap.uuid : 'none';
  const alphaMapId = mat.alphaMap ? mat.alphaMap.uuid : 'none';
  const gradId = mat.gradientMap ? mat.gradientMap.uuid : 'none';
  const type = mat.type || 'mat';
  return [
    type, col, emi, emiI, mapId, emiMapId, alphaMapId, gradId,
    mat.transparent ? 1 : 0,
    (mat.opacity != null ? mat.opacity : 1).toFixed(3),
    mat.side != null ? mat.side : 0,
    mat.vertexColors ? 1 : 0,
    mat.fog === false ? 0 : 1,
    mat.depthWrite === false ? 0 : 1,
  ].join('|');
}

// Normalise a geometry so a batch of them merges cleanly: bake the world matrix,
// keep only position + normal (uniform attribute set), ensure a normal attribute,
// and convert to non-indexed so every member matches. Returns null if it has no
// usable position data.
function bakeGeometry(mesh) {
  const src = mesh.geometry;
  if (!src || !src.attributes || !src.attributes.position) return null;
  let g = src.clone();
  if (!g.attributes.normal) g.computeVertexNormals();
  for (const a of Object.keys(g.attributes)) {
    if (a !== 'position' && a !== 'normal') g.deleteAttribute(a);
  }
  if (g.index) g = g.toNonIndexed();
  mesh.updateWorldMatrix(true, false);
  g.applyMatrix4(mesh.matrixWorld);     // bake world position/rotation/scale
  g.morphAttributes = {};               // keep merge inputs uniform
  return g;
}

// Is this mesh a safe, static, decorative town prop we may merge?
function isMergeable(o) {
  if (!o.isMesh) return false;
  if (o.isInstancedMesh || o.isSkinnedMesh) return false;   // 1 draw call already / animated
  if (!o.visible) return false;
  const ud = o.userData || {};
  if (ud.__toonOutline) return false;   // an outline hull (rebuilt, not merged)
  if (ud.__merged) return false;        // already merged output
  if (ud.noMerge) return false;         // explicit opt-out
  if (ud.__toonDone !== true) return false;   // not styled / not a finished prop
  if (ud.noCollide !== true) return false;    // a collider may depend on it
  const m = o.material;
  if (!m || Array.isArray(m)) return false;   // skip multi-material meshes
  if (!o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return false;
  return true;
}

function runBatch() {
  const em = window.eldenmoor;
  if (!em || !em.scene) return { ok: false };
  const scene = em.scene;

  // The castle keep subtree — never touch anything inside it.
  const keep = scene.userData.keep || {};
  const keepRoots = [keep.ground, keep.upper, keep.basement].filter(Boolean);
  const insideKeep = (o) => {
    let p = o;
    while (p) { if (keepRoots.indexOf(p) !== -1) return true; p = p.parent; }
    return false;
  };

  // Candidate roots: the town / outdoor groups. We collect unique top-level
  // groups so we have a place to re-parent the merged meshes (and we walk only
  // those, never the whole scene, so dynamic actors are never visited).
  const roots = [];
  const seen = new Set();
  for (const arr of [scene.userData.buildings, scene.userData.outdoor]) {
    for (const grp of arr || []) {
      if (grp && !seen.has(grp) && !insideKeep(grp)) { seen.add(grp); roots.push(grp); }
    }
  }
  if (!roots.length) return { ok: false };

  // Group mergeable meshes by material signature. We also remember a representative
  // material per group (we reuse one real material instance so the look is exact).
  const groups = new Map();   // signature -> { material, meshes: [] }
  let scanned = 0, candidates = 0;

  for (const root of roots) {
    const local = [];
    root.traverse((o) => {
      scanned++;
      if (insideKeep(o)) return;
      if (!isMergeable(o)) return;
      const sig = materialSignature(o.material);
      if (!sig) return;
      local.push({ mesh: o, sig });
    });
    for (const { mesh, sig } of local) {
      let entry = groups.get(sig);
      if (!entry) { entry = { material: mesh.material, meshes: [] }; groups.set(sig, entry); }
      entry.meshes.push(mesh);
      candidates++;
    }
  }

  // For each group of 2+ meshes, bake + merge into one Mesh, remove the originals.
  let mergedMeshes = 0, removed = 0, mergedGroups = 0;

  // Pick a parent group to host the merged meshes. Prefer the town buildings group
  // (it lives in scene.userData.outdoor too, so it hides with floor changes).
  const host = (scene.userData.buildings && scene.userData.buildings.find((g) => !insideKeep(g)))
    || roots[0];

  for (const entry of groups.values()) {
    const meshes = entry.meshes;
    if (meshes.length < 2) continue;   // nothing to gain from a single mesh

    const geos = [];
    const merging = [];
    let anyCast = false, anyReceive = false;
    for (const mesh of meshes) {
      const g = bakeGeometry(mesh);
      if (!g) continue;
      geos.push(g);
      merging.push(mesh);
      anyCast = anyCast || mesh.castShadow;
      anyReceive = anyReceive || mesh.receiveShadow;
    }
    if (geos.length < 2) { for (const g of geos) g.dispose(); continue; }

    let merged = null, mergeErr = null;
    try {
      merged = mergeGeometries(geos, false);   // single material -> no groups
    } catch (e) {
      mergeErr = e;
    }
    for (const g of geos) g.dispose();          // free the per-prop bakes
    if (!merged) { console.warn('[townBatch] merge failed for a group, skipping', mergeErr); continue; }

    merged.computeBoundingSphere();
    merged.computeBoundingBox();

    const out = new THREE.Mesh(merged, entry.material);
    out.castShadow = anyCast;
    out.receiveShadow = anyReceive;
    out.matrixAutoUpdate = false;               // geometry is already in world space
    out.updateMatrix();                          // identity local transform
    out.userData.__toonDone = true;             // toon pass: leave material alone
    out.userData.noCollide = true;              // no collider here
    out.userData.__merged = true;               // our own marker / re-entry guard
    out.frustumCulled = true;

    // Rebuild the cel-shade outline hull on the merged geometry so the silhouette
    // look is preserved (the originals' hulls are removed with their meshes below).
    const hull = new THREE.Mesh(merged, outlineMaterial());
    hull.userData.__toonOutline = true;
    hull.castShadow = false;
    hull.receiveShadow = false;
    hull.matrixAutoUpdate = false;
    hull.updateMatrix();
    hull.renderOrder = (out.renderOrder || 0) - 1;
    out.add(hull);

    host.add(out);
    mergedMeshes++;
    mergedGroups++;

    // Detach the originals (and their outline-hull children) from the scene graph.
    // We do NOT dispose the source geometries: some town props share a cached
    // geometry across clones (and outline hulls share their parent's geometry),
    // so disposing here could free a buffer still used by a mesh we didn't merge.
    // The merge baked CLONES, so the originals can simply be dropped; GC reclaims
    // any geometry that becomes truly unreferenced.
    for (const mesh of merging) {
      const kids = mesh.children.slice();
      for (const k of kids) { if (k.userData && k.userData.__toonOutline) mesh.remove(k); }
      if (mesh.parent) mesh.parent.remove(mesh);
      removed++;
    }
  }

  return { ok: true, scanned, candidates, mergedGroups, mergedMeshes, removed };
}

// --- boot: poll until the world exists, then wait for async props to settle. ---
// The town props (GLB clones/instances, chapel, mill, stable…) and the toon pass
// all run async after login. We hold off the merge until things are quiet so we
// don't merge a half-loaded town. A readiness gate plus a generous settle delay.
(function boot() {
  let tries = 0;
  const startedAt = Date.now();
  let firstSeen = 0;
  const iv = setInterval(() => {
    tries++;
    const em = window.eldenmoor;
    const ready = em && em.scene && em.renderer && em.player
      && em.scene.userData && (em.scene.userData.buildings || em.scene.userData.outdoor);
    if (ready) {
      if (!firstSeen) firstSeen = Date.now();
      // Settle window: ~10s after the world first appears, so async GLB props,
      // the chapel/mill/stable clones and the cel-shade pass have all landed.
      // (Overridable via window.__townBatchSettleMs for headless verification.)
      const settleMs = (typeof window.__townBatchSettleMs === 'number') ? window.__townBatchSettleMs : 10000;
      if (Date.now() - firstSeen >= settleMs) {
        clearInterval(iv);
        const info = em.renderer.info;
        const before = { calls: info.render.calls, triangles: info.render.triangles };
        let res;
        try { res = runBatch(); }
        catch (err) { console.error('[townBatch] failed', err); return; }
        // Force a render so renderer.info reflects the post-merge scene, then read.
        try { em.renderer.render(em.scene, em.camera); } catch (e) {}
        const after = { calls: info.render.calls, triangles: info.render.triangles };
        window.__townBatch = { before, after, ...res };
        console.log('[townBatch]', JSON.stringify({ before, after, ...res }));
      }
    } else if (Date.now() - startedAt > 60000) {
      clearInterval(iv);   // give up after a minute
    }
  }, 250);
})();
