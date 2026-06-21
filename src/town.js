// town.js — the town that wraps the castle (Stormwind grandeur × Lumbridge cosiness):
// a paved square + approach road, lamp posts, a grand fountain, banner poles at the
// gate, market stalls, timber cottages, a chapel, fences, a signpost and props.
// The whole thing is pushed into scene.userData.buildings so collision.js makes
// the solid bits (cottages, fountain, fences, posts) block you automatically.

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js';
import { stoneTexture, plasterTexture, shingleTexture, pathTexture } from './textures.js';

// --- Low-poly GLB town props -------------------------------------------------
// The loose town props (barrels, crates, hay, fences, the well, the cart and the
// market stands) are real downloaded low-poly, vertex-coloured GLBs from the
// medieval_village pack. Repeated props are drawn as a single InstancedMesh per
// model (one draw call); unique props are simple clones. All are tagged
// __toonDone so the cel-shade pass skips them, and added into the town group so
// they hide with the rest of the outdoor town when changing floors. They are
// purely decorative (deco / noCollide), so collision is unaffected — the few
// solid props that block movement keep their existing invisible collider boxes.
const ENV = './assets/models/env/';
const propLoader = new GLTFLoader();
const propCache = {};   // name -> Promise<{ geometry, material, size }>

function loadProp(name) {
  if (!propCache[name]) {
    propCache[name] = new Promise((resolve, reject) => {
      propLoader.load(ENV + name + '.glb', (gltf) => {
        // Merge ALL primitives (these GLBs are one mesh / several primitives with
        // separate coloured materials) into one grouped geometry + material array,
        // so multi-part props/buildings don't lose pieces.
        gltf.scene.updateWorldMatrix(true, true);
        const geos = [], mats = [];
        gltf.scene.traverse((o) => {
          if (!o.isMesh) return;
          let g = o.geometry.clone();
          g.applyMatrix4(o.matrixWorld);
          for (const a of Object.keys(g.attributes)) { if (a !== 'position' && a !== 'normal') g.deleteAttribute(a); }
          if (g.index) g = g.toNonIndexed();
          geos.push(g);
          const m = o.material.isMaterial ? o.material : o.material[0];
          m.userData.__toonDone = true;
          mats.push(m);
        });
        if (!geos.length) { reject(new Error('no mesh in ' + name)); return; }
        const geometry = geos.length === 1 ? geos[0] : mergeGeometries(geos, true);
        const material = geos.length === 1 ? mats[0] : mats;
        geometry.computeBoundingBox();
        const bb = geometry.boundingBox;
        const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
        geometry.translate(-cx, -bb.min.y, -cz);    // centre XZ, base at y=0
        geometry.computeBoundingBox();
        resolve({ geometry, material, size: geometry.boundingBox.getSize(new THREE.Vector3()) });
      }, undefined, reject);
    });
  }
  return propCache[name];
}

// Drop many placements of a prop as one InstancedMesh into a parent group.
// placements: array of { x, z, ry, s }. Loaded async. Decorative (no collision).
function propScatter(parent, name, placements, { shadow = true, targetH } = {}) {
  if (!placements.length) return;
  loadProp(name).then(({ geometry, material, size }) => {
    const base = targetH ? targetH / (size.y || 1) : 1;
    const inst = new THREE.InstancedMesh(geometry, material, placements.length);
    inst.castShadow = shadow; inst.receiveShadow = true;
    inst.userData.__toonDone = true; inst.userData.noCollide = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(),
      p = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    placements.forEach((pl, i) => {
      q.setFromAxisAngle(up, pl.ry || 0);
      p.set(pl.x, pl.y || 0, pl.z);
      sc.setScalar(base * (pl.s || 1));
      m.compose(p, q, sc);
      inst.setMatrixAt(i, m);
    });
    inst.instanceMatrix.needsUpdate = true;
    parent.add(inst);
  }).catch((e) => console.error('[town] prop instance failed', name, e));
}

// Drop a single cloned prop, sized to a target height, into a parent group.
function propClone(parent, name, x, z, ry, { shadow = true, targetH, s = 1 } = {}) {
  loadProp(name).then(({ geometry, material, size }) => {
    const mesh = new THREE.Mesh(geometry, material);
    const base = targetH ? targetH / (size.y || 1) : 1;
    mesh.scale.setScalar(base * s);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = ry || 0;
    mesh.castShadow = shadow; mesh.receiveShadow = true;
    mesh.userData.__toonDone = true; mesh.userData.noCollide = true;
    parent.add(mesh);
  }).catch((e) => console.error('[town] prop clone failed', name, e));
}

let TX = null;
function tex() { if (!TX) TX = { road: stoneTexture(10), plaster: plasterTexture(), shingle: shingleTexture(4), wall: stoneTexture(3), path: pathTexture(7) }; return TX; }

const flat = (c, r = 0.95) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0, flatShading: true });
// Smooth-shaded variant for rounded/organic props (hedges, foliage, horse) so
// their silhouettes read soft instead of faceted. (toon.js later re-skins these.)
const smooth = (c, r = 0.9) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
const mapped = (m, c = 0xffffff, r = 0.92) => new THREE.MeshStandardMaterial({ map: m, color: c, roughness: r, metalness: 0 });
const deco = (m) => { m.userData.noCollide = true; return m; };
function box(w, h, d, mat, x, y, z, sh = true) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = sh; m.receiveShadow = true; return m; }
function cyl(rt, rb, h, seg, mat, x, y, z) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }

// An arched opening: a flat panel (door/glass) topped with a half-disc, framed by
// a slim surround — so doors/windows curve instead of being square holes. Decorative.
// Faces -z by default; `ry` rotates it. Returns a group placed at (x,y,z).
function archedOpening(w, h, panelMat, frameMat, x, y, z, ry = 0) {
  const g = new THREE.Group();
  const r = w / 2, fr = 0.13;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), panelMat); deco(panel); g.add(panel);          // straight panel
  const top = new THREE.Mesh(new THREE.CircleGeometry(r, 14, 0, Math.PI), panelMat);                          // half-disc head
  top.position.y = h / 2; deco(top); g.add(top);
  const jamb = (s) => { const m = new THREE.Mesh(new THREE.BoxGeometry(fr, h, fr * 1.4), frameMat); m.position.set(s * (r + fr * 0.5), 0, 0.03); return deco(m); };
  g.add(jamb(-1)); g.add(jamb(1));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r + fr * 0.25, fr * 0.7, 6, 16, Math.PI), frameMat);
  ring.position.set(0, h / 2, 0.03); deco(ring); g.add(ring);
  g.rotation.y = ry; g.position.set(x, y, z); return g;
}
// A smooth, steeply-swept roof: a many-sided cone (round silhouette) plus a small
// flared eave ring, so cottages/chapels get rounded rooflines, not 4-faced pyramids.
function sweptRoof(radius, height, mat, x, y, z, sides = 12) {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, height, sides), mat);
  cone.position.y = height / 2; cone.castShadow = true; deco(cone); g.add(cone);
  const eave = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.99, radius + 0.18, height * 0.12, sides), mat);
  eave.position.y = height * 0.06; deco(eave); g.add(eave);
  g.position.set(x, y, z); return g;
}

// A drifting chimney-smoke wisp: a short stack of softening, rising semi-transparent
// puffs. Cheap (a handful of low-seg spheres) and animated by a shared RAF tick so
// hearths/chimneys feel lived-in. Returns the group (added by the caller).
const _smokers = [];
function chimneySmoke(x, y, z, tint = 0xb9b2a6) {
  const g = new THREE.Group();
  const puffs = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.MeshStandardMaterial({ color: tint, transparent: true, opacity: 0.0, roughness: 1, metalness: 0, depthWrite: false });
    m.userData.__toonDone = true;
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), m);
    p.userData = { base: y, off: i / 5, seed: Math.random() * 6.28, sway: 0.18 + Math.random() * 0.14 };
    deco(p); g.add(p); puffs.push(p);
  }
  g.position.set(x, 0, z); g.userData.__puffs = puffs;
  _smokers.push(g);
  return g;
}
let _smokeRAF = false;
function startSmoke() {
  if (_smokeRAF) return; _smokeRAF = true;
  const tick = (now) => {
    requestAnimationFrame(tick);
    const t = now / 1000;
    for (const g of _smokers) for (const p of g.userData.__puffs) {
      const u = p.userData;
      const f = ((t * 0.22 + u.off) % 1);          // 0..1 rise cycle
      p.position.y = u.base + f * 3.2;
      p.position.x = Math.sin(t * 0.7 + u.seed) * u.sway * (0.4 + f);
      p.position.z = Math.cos(t * 0.6 + u.seed) * u.sway * (0.4 + f);
      const s = 0.6 + f * 1.8;
      p.scale.setScalar(s);
      p.material.opacity = Math.sin(f * Math.PI) * 0.32;   // fade in then out
    }
  };
  requestAnimationFrame(tick);
}

// Village house spots [x, z, rotation]. The visible buildings are realistic
// glTF models placed by villageModels.js; here we keep only invisible colliders.
export const COTTAGES = [
  [-24, 4, 0.1], [24, 4, -0.1], [-27, 13, 0.25], [27, 13, -0.25], [-12, -6, 0.1], [12, -6, -0.1],
];
const CHAPEL = [-28, 16];

// Footprints (world.js uses these so trees avoid the town).
export function townStructures() {
  const s = COTTAGES.map(([x, z]) => ({ x, z, r: 4.5 }));
  s.push({ x: CHAPEL[0], z: CHAPEL[1], r: 6 });
  s.push({ x: -6, z: 16, r: 5 });    // fountain
  s.push({ x: 30, z: -6, r: 3.5 });  // windmill
  s.push({ x: 26, z: 2, r: 4.5 });   // stable
  s.push({ x: -30, z: 4, r: 5 });    // graveyard
  return s;
}

export function buildTown(scene) {
  const T = tex();
  const g = new THREE.Group();
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe6a3, emissive: 0xffb142, emissiveIntensity: 1.4, roughness: 0.5 });
  const dark = flat(0x2a2622), wood = flat(0x6b4a2c), stone = mapped(T.wall);

  // --- worn dirt lanes: trodden earth connecting the square out to the chapel,
  // graveyard, stable and windmill, and a soft earthen apron hugging the paving
  // so the stone square meets the meadow through packed earth, not a hard edge.
  // Flat decorative planes laid just above the grass (below the stone paving).
  const laneMat = () => new THREE.MeshStandardMaterial({ map: T.path, roughness: 1, transparent: true, opacity: 0.95, depthWrite: false });
  const lane = (x, z, w, d, rot = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), laneMat());
    m.rotation.x = -Math.PI / 2; m.rotation.z = rot;
    m.position.set(x, 0.03, z); m.receiveShadow = true;
    g.add(deco(m));
  };
  // a soft earthen apron under and just around the market square
  lane(0, 16, 38, 20);
  // lane west to the chapel + graveyard quarter
  lane(-20, 12, 22, 5.5, Math.PI / 9);
  lane(-29, 9, 5, 12);
  // lane east to the stable + windmill quarter
  lane(20, 8, 22, 5.5, -Math.PI / 8);
  lane(29, -2, 5, 14, Math.PI / 16);
  // short spur south toward the spawn approach
  lane(0, 0, 9, 14);

  // --- paving: square + approach road (flat, walkable) ---
  g.add(deco(box(34, 0.16, 16, mapped(T.road, 0xc2b79a), 0, 0.04, 16, false)));
  g.add(deco(box(7, 0.16, 26, mapped(T.road, 0xb8ad90), 0, 0.05, 1, false)));

  // --- wrought-iron lamp posts (sculpted: stepped base, tapered shaft, a glass
  //     lantern cage with a warm glow + a small point light) ---
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffb142, emissiveIntensity: 1.0, roughness: 0.35, transparent: true, opacity: 0.7 });
  glassMat.userData.__toonDone = true;
  let _lampLights = 0;
  const lampPost = (x, z, light = false) => {
    g.add(deco(cyl(0.26, 0.32, 0.28, 10, dark, x, 0.14, z)));       // stepped base
    g.add(cyl(0.1, 0.15, 3.2, 8, dark, x, 1.6, z));                 // tapered shaft (collider)
    g.add(deco(cyl(0.22, 0.22, 0.14, 10, dark, x, 3.3, z)));        // collar
    g.add(deco(cyl(0.3, 0.22, 0.16, 10, dark, x, 3.45, z)));        // flared cradle
    g.add(deco(cyl(0.24, 0.26, 0.5, 8, glassMat, x, 3.78, z)));     // glass lantern body
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; g.add(deco(box(0.04, 0.5, 0.04, dark, x + Math.cos(a) * 0.24, 3.78, z + Math.sin(a) * 0.24))); }  // cage bars
    { const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.32, 8), dark); cap.position.set(x, 4.2, z); deco(cap); g.add(cap); }   // lantern cap
    g.add(deco(cyl(0.05, 0, 0.18, 6, flat(0xd8b24a), x, 4.45, z))); // gold finial
    if (light && _lampLights < 6) { const pl = new THREE.PointLight(0xffc46a, 3.2, 13, 2); pl.position.set(x, 3.8, z); g.add(pl); _lampLights++; }
  };
  for (const z of [2, 7, 12]) for (const sx of [-1, 1]) lampPost(sx * 4.5, z, z === 7);
  for (const c of [[-8, 23, true], [8, 23, true], [-4, 10, false], [4, 10, false]]) lampPost(c[0], c[1], c[2]);

  // --- banner poles flanking the gate (sculpted: stone foot, tapered pole, a
  //     heraldic swallow-tail banner with a gilt boss + ball finial) ---
  const gold = flat(0xd8b24a);
  const bannerPole = (x, z, col) => {
    g.add(deco(cyl(0.34, 0.42, 0.4, 10, stone, x, 0.2, z)));        // stone foot
    g.add(cyl(0.12, 0.18, 7, 10, dark, x, 3.5, z));                 // tapered pole (collider)
    g.add(deco(cyl(0.2, 0.2, 0.16, 10, gold, x, 6.7, z)));          // gilt collar
    g.add(deco(cyl(0.2, 0, 0.4, 10, gold, x, 7.1, z)));             // pole finial
    const banner = flat(col);
    g.add(deco(box(1.4, 3.2, 0.08, banner, x, 5.1, z + 0.12)));     // banner field
    for (const ss of [-1, 1]) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 3), banner); t.rotation.x = Math.PI; t.position.set(x + ss * 0.35, 3.35, z + 0.12); deco(t); g.add(t); }   // swallow-tail
    g.add(deco(cyl(0.45, 0.45, 0.1, 12, gold, x, 5.4, z + 0.17)));  // gilt boss
    g.add(deco(cyl(0.26, 0.26, 0.12, 12, flat(col === 0x274a8a ? 0x4a6db0 : 0x9a4a4a), x, 5.4, z + 0.22)));
  };
  bannerPole(-5, 23.5, 0x274a8a); bannerPole(5, 23.5, 0x274a8a);
  bannerPole(-9, 23.5, 0x6e2f2f); bannerPole(9, 23.5, 0x6e2f2f);

  // --- grand fountain (centrepiece) ---
  const fx = -6, fz = 16;   // off the central gate approach so click-to-move stays clear
  const water = new THREE.MeshStandardMaterial({ color: 0x3f8fc4, roughness: 0.15, metalness: 0.25, transparent: true, opacity: 0.86 });
  const waterTop = new THREE.MeshStandardMaterial({ color: 0x6fc0e0, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.7 });
  waterTop.userData.__toonDone = true;
  g.add(cyl(3.0, 3.3, 0.9, 20, stone, fx, 0.45, fz));            // basin (solid → blocks)
  g.add(deco(cyl(3.05, 3.05, 0.22, 20, stone, fx, 0.92, fz)));   // rounded coping rim
  g.add(deco(cyl(2.7, 2.7, 0.2, 20, water, fx, 0.84, fz)));      // lower pool
  g.add(deco(cyl(1.45, 1.7, 0.8, 16, stone, fx, 1.3, fz)));      // pedestal of the upper tier
  g.add(deco(cyl(1.35, 1.35, 0.6, 16, stone, fx, 1.85, fz)));    // upper basin
  g.add(deco(cyl(1.15, 1.15, 0.16, 16, waterTop, fx, 2.06, fz)));// upper pool
  g.add(deco(cyl(0.28, 0.4, 1.4, 10, stone, fx, 2.9, fz)));      // central column
  g.add(deco(cyl(0.65, 0.0, 0.7, 10, flat(0xd8b24a), fx, 3.85, fz)));   // gilt finial
  // four spouting cascades from the upper basin down to the pool
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + Math.PI / 4; g.add(deco(cyl(0.06, 0.1, 1.15, 6, waterTop, fx + Math.cos(a) * 1.0, 1.45, fz + Math.sin(a) * 1.0))); }

  // --- market stalls (low-poly GLB market stands) ---
  // Visible stand is the GLB model; an invisible box keeps the old table footprint
  // blocking movement so the square plays the same. Stalls face the square centre.
  const stall = (x, z, model) => {
    const body = box(2.8, 0.9, 1.6, wood, x, 0.45, z); body.visible = false; body.castShadow = false; g.add(body);
    const face = (x < 0 ? Math.PI / 2 : -Math.PI / 2);
    propClone(g, model, x, z, face, { targetH: 2.6 });
  };
  stall(6, 13, 'med_MarketStand_1'); stall(6, 20, 'med_MarketStand_2');
  stall(-6, 9, 'med_MarketStand_2'); stall(-6, 22, 'med_MarketStand_1');

  // --- cottages: invisible solid colliders only ---
  // The visible houses are realistic glTF models placed by villageModels.js. We
  // keep a hidden body box at each spot so collision still blocks the footprint
  // (and so it blocks immediately, before the async model finishes loading).
  COTTAGES.forEach(([x, z, rot]) => {
    const body = box(6, 3, 5, flat(0x3a2a1a), x, 1.5, z);   // collider footprint
    body.rotation.y = rot; body.visible = false; body.castShadow = false;
    g.add(body);
  });

  // --- chapel (Lumbridge-style church with a steeple) ---
  const chapel = (x, z) => {
    const c = new THREE.Group();
    const plaster = mapped(T.plaster, 0xd6cbb0), shingle = mapped(T.shingle, 0x5a4a6a), gold = flat(0xd8b24a);
    c.add(box(7, 4.5, 11, plaster, 0, 2.25, 0));                                       // nave body (collider)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.add(deco(cyl(0.4, 0.46, 4.5, 10, plaster, sx * 3.5, 2.25, sz * 5.5)));   // chamfered corner pilasters
    c.add(deco(cyl(4.0, 3.9, 0.4, 14, plaster, 0, 4.55, 0)));                          // rounded eave band
    // a long swept ridge roof: an octagonal cone stretched along z reads as a smooth gable
    { const roof = new THREE.Mesh(new THREE.ConeGeometry(5.4, 3.0, 8), shingle); roof.scale.set(1, 1, 1.4); roof.position.y = 6.0; roof.rotation.y = Math.PI / 8; roof.castShadow = true; deco(roof); c.add(roof); }
    // steeple: round drum tower + smooth octagonal spire
    c.add(cyl(1.4, 1.5, 7, 12, mapped(T.wall), 0, 3.5, -6.5));                          // round steeple tower (collider)
    c.add(deco(cyl(1.6, 1.5, 0.4, 12, mapped(T.wall), 0, 7.1, -6.5)));                  // corbel ring
    { const st = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3.2, 12), shingle); st.position.set(0, 8.9, -6.5); deco(st); c.add(st); }   // octagonal spire
    c.add(deco(cyl(0.13, 0, 0.5, 8, gold, 0, 10.7, -6.5)));                             // spire finial
    c.add(deco(box(0.22, 1.3, 0.22, gold, 0, 11.4, -6.5))); c.add(deco(box(0.9, 0.22, 0.22, gold, 0, 11.5, -6.5)));   // cross
    // arched chapel door + arched lancet windows
    c.add(archedOpening(1.6, 2.2, flat(0x4a3220), gold, 0, 1.25, 5.56));
    for (const sz of [-2.5, 0, 2.5]) c.add(archedOpening(1.0, 1.8, flat(0x9a6cff), gold, 3.56, 2.0, sz, Math.PI / 2));   // east windows
    for (const sz of [-2.5, 0, 2.5]) c.add(archedOpening(1.0, 1.8, flat(0x9a6cff), gold, -3.56, 2.0, sz, -Math.PI / 2)); // west windows
    c.position.set(x, 0, z); g.add(c);
  };
  // chapel — the GLB ships near-black materials, so recolour them to warm stone
  // / slate / oak / gilt as we place it (preserves the per-part variety, visible).
  loadProp('chapel').then(({ geometry, material, size }) => {
    const mats = Array.isArray(material) ? material : [material];
    const palette = [0xc9c2af, 0x6b5a73, 0x6b4a2c, 0xd8b24a];   // walls, roof, timber, gilt
    mats.forEach((m, i) => { m.color = new THREE.Color(palette[i % palette.length]); m.metalness = 0; m.roughness = 0.85; });
    const mesh = new THREE.Mesh(geometry, material);
    const s = 8.5 / (size.y || 1); mesh.scale.setScalar(s);
    mesh.position.set(CHAPEL[0], 0, CHAPEL[1]);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.__toonDone = true; mesh.userData.noCollide = true;
    g.add(mesh);
  }).catch((e) => console.error('[town] chapel', e));
  { const cl = new THREE.PointLight(0xfff0d0, 6, 28, 2); cl.position.set(CHAPEL[0], 6, CHAPEL[1] + 2); g.add(cl); }

  // --- fences along the road (low-poly GLB rails, instanced) ---
  // Visible rails are GLB fence segments (one InstancedMesh); each run keeps a
  // thin invisible collider box per post so movement still blocks like before.
  const fencePlace = [];
  const fenceRun = (x0, z0, x1, z1) => {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), n = Math.max(1, Math.round(len / 1.8));
    const ry = Math.atan2(dx, dz);   // align segment along the run
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const px = x0 + dx * t, pz = z0 + dz * t;
      fencePlace.push({ x: px, z: pz, ry, s: 1 });
      const col = box(0.2, 1.0, 0.2, wood, px, 0.5, pz); col.visible = false; col.castShadow = false; g.add(col);
    }
  };
  fenceRun(-7, 2, -7, 8); fenceRun(7, 2, 7, 8);
  propScatter(g, 'med_Fence', fencePlace, { targetH: 1.1 });

  // --- signpost near spawn (GLB banner stands in for the sign) ---
  g.add(cyl(0.12, 0.12, 2.2, 6, wood, 2, 1.1, 4));   // kept post (collider + visual base)
  propClone(g, 'medb_Banner', 2.9, 4, -Math.PI / 2, { targetH: 2.4 });

  // --- props: barrels / crates / hay (low-poly GLBs, instanced) ---
  propScatter(g, 'med_Barrel', [[5, 11], [-5, 11], [7, 21], [-3, 22]].map(([x, z]) => ({ x, z, ry: Math.random() * Math.PI * 2, s: 1 })), { targetH: 1.0 });
  propScatter(g, 'med_Crate', [[8, 23], [-8, 21], [3, 6]].map(([x, z]) => ({ x, z, ry: Math.random() * Math.PI * 2, s: 1 })), { targetH: 0.95 });
  propScatter(g, 'med_Hay', [[6, 5], [-6, 5]].map(([x, z]) => ({ x, z, ry: Math.random() * Math.PI * 2, s: 1 })), { targetH: 1.1 });

  // --- a well and a hand cart as new village character props ---
  propClone(g, 'med_Well', 11, 9, 0.4, { targetH: 2.2 });
  propClone(g, 'med_Cart', -10, 7, 1.2, { targetH: 1.6 });

  // --- windmill (Lumbridge-style) ---
  const windmill = (x, z) => {
    g.add(cyl(2.2, 2.6, 7, 12, stone, x, 3.5, z));
    g.add(deco(cyl(2.5, 2.4, 0.45, 12, stone, x, 7.0, z)));                                  // rounded eave ring
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.4, 12), mapped(T.shingle, 0x5a4a3a)); cap.position.set(x, 8.2, z); cap.castShadow = true; deco(cap); g.add(cap);
    g.add(archedOpening(1.2, 1.8, flat(0x4a3220), flat(0x6b4a2c), x, 0.95, z - 2.62));        // arched door
    const hub = new THREE.Group(); hub.position.set(x, 6.0, z - 2.7); hub.rotation.z = 0.3;
    hub.add(deco(cyl(0.3, 0.3, 0.4, 8, flat(0x4a3220), 0, 0, 0)));
    for (let i = 0; i < 4; i++) { const blade = new THREE.Group(); blade.rotation.z = i / 4 * Math.PI * 2; blade.add(deco(box(0.18, 3.6, 0.12, wood, 0, 1.9, 0.1))); blade.add(deco(box(0.7, 2.6, 0.06, flat(0xe6ddc8), 0.45, 2.3, 0.16))); hub.add(blade); }
    g.add(hub);
  };
  propClone(g, 'mill', 30, -6, 0, { targetH: 9.5 });   // real GLB windmill

  // --- graveyard beside the chapel ---
  const graveyard = (cx, cz) => {
    const gs = flat(0x8a8780), iron = flat(0x2a2622);
    for (let x = -4; x <= 4; x += 1) { g.add(box(0.1, 0.8, 0.1, iron, cx + x, 0.4, cz - 4)); g.add(box(0.1, 0.8, 0.1, iron, cx + x, 0.4, cz + 4)); }
    for (let z = -3; z <= 3; z += 1) { g.add(box(0.1, 0.8, 0.1, iron, cx - 4, 0.4, cz + z)); g.add(box(0.1, 0.8, 0.1, iron, cx + 4, 0.4, cz + z)); }
    for (const p of [[-2.5, -2], [0, -2.5], [2.5, -1.5], [-2, 1], [1.5, 1.5], [-1, 2.8]]) { g.add(deco(box(0.7, 1.0, 0.18, gs, cx + p[0], 0.5, cz + p[1]))); g.add(deco(cyl(0.35, 0.35, 0.18, 10, gs, cx + p[0], 1.0, cz + p[1]))); }
    g.add(box(1.4, 0.6, 2.2, gs, cx + 2.5, 0.3, cz + 2.6)); g.add(deco(box(1.6, 0.2, 2.4, gs, cx + 2.5, 0.65, cz + 2.6)));
    g.add(box(0.4, 2.6, 0.4, flat(0x3a2a1a), cx - 3, 1.3, cz + 3));
    for (const a of [0.6, -0.5, 0.2]) g.add(deco(box(0.16, 1.4, 0.16, flat(0x3a2a1a), cx - 3 + Math.sin(a) * 0.6, 2.4, cz + 3 + Math.cos(a) * 0.3)));
  };
  for (const gp of [[-32,2,0.3],[-30,1.5,-0.6],[-28,3,0.2],[-31,6,0.8],[-29,6.5,-0.3]]) propClone(g, gp[2]>0.5?'gravestone_rip':'gravestone', -30+(gp[0]+30), gp[1], gp[2], { targetH: 1.1 });
  propClone(g, 'crypt', -28.5, 6, 0.4, { targetH: 2.6 });

  // --- stable + horse ---
  // A smooth, rounded toon horse: capsule barrel, tapered smooth legs, an arched
  // neck and a soft muzzle, with a flowing mane + tail. No boxes — reads as a
  // shapely animal rather than a stack of crates. Faces -x (toward the yard).
  const horse = (x, z) => {
    const h = smooth(0x6b4326), hd = smooth(0x593521), mane = smooth(0x2a1c12);
    const grp = new THREE.Group(); grp.position.set(x, 0, z);
    const add = (mesh, px, py, pz) => { mesh.position.set(px, py, pz); mesh.castShadow = true; mesh.receiveShadow = true; deco(mesh); grp.add(mesh); return mesh; };
    // barrel (capsule lying along X)
    const barrel = new THREE.Mesh(new THREE.CapsuleGeometry(0.46, 1.0, 6, 14), h);
    barrel.rotation.z = Math.PI / 2; barrel.scale.set(1, 1, 0.92); add(barrel, 0, 1.32, 0);
    // haunch + chest fullness
    add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 12), h), 0.62, 1.34, 0).scale.set(0.9, 0.95, 0.92);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.46, 14, 12), h), -0.55, 1.34, 0).scale.set(0.95, 0.95, 0.9);
    // legs: tapered smooth cylinders with a slight knee, hooves
    for (const p of [[-0.62, -0.27], [0.6, -0.27], [-0.62, 0.27], [0.6, 0.27]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.09, 1.05, 9), h);
      add(leg, p[0], 0.55, p[1]);
      const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.16, 9), flat(0x1f1712));
      add(hoof, p[0], 0.08, p[1]);
    }
    // arched neck (tilted cylinder) + smooth head + tapered muzzle
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 0.95, 12), h);
    neck.rotation.z = 0.7; add(neck, -0.92, 1.78, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 12), h);
    head.scale.set(1.1, 0.9, 0.85); add(head, -1.26, 2.16, 0);
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.42, 10), hd);
    muzzle.rotation.z = -0.5; add(muzzle, -1.5, 2.0, 0);
    for (const e of [-0.13, 0.13]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 7), h); add(ear, -1.18, 2.42, e); }
    // eyes
    for (const e of [-0.16, 0.16]) add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 7, 6), flat(0x141414)), -1.4, 2.2, e);
    // mane: a soft crest of squashed blobs down the neck
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 7), mane);
      m.scale.set(0.6, 1.0, 1.1); add(m, -0.78 - i * 0.085, 2.18 - i * 0.06, 0);
    }
    // flowing tail
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.6, 4, 8), mane);
    tail.rotation.z = -0.5; add(tail, 0.92, 1.1, 0);
    g.add(grp);
    return grp;
  };
  propClone(g, 'stable', 26, 2, 0, { targetH: 4.5 });   // real GLB stable
  const stableHorse = horse(22.5, 4.5); if (stableHorse) stableHorse.rotation.y = -0.5;   // a smooth toon horse hitched outside

  // --- hedges, flower beds, lanterns, notice board ---
  // Smooth, leafy garden hedge: a low earthen trough topped by a run of overlapping
  // foliage blobs (two-tone, deformed spheres) so the silhouette reads as soft
  // clipped box-hedge instead of a row of bright cubes. Collision is preserved by
  // an invisible collider box; the leaves themselves are decorative (noCollide).
  const leafMat = smooth(0x3f6e3a), leafLit = smooth(0x549153), trough = flat(0x4a3526);
  const hedge = (x0, z0, x1, z1) => {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
    const n = Math.max(2, Math.round(len / 0.7));
    // earthen base trough running the length
    const base = box(0.9, 0.34, len + 0.5, trough, (x0 + x1) / 2, 0.17, (z0 + z1) / 2); base.rotation.y = ang; g.add(deco(base));
    for (let i = 0; i <= n; i++) {
      const bx = x0 + dx * (i / n), bz = z0 + dz * (i / n);
      // three stacked foliage blobs per station -> a rounded, slightly bumpy crown
      for (let k = 0; k < 3; k++) {
        const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), (i + k) % 2 ? leafLit : leafMat);
        const r = 0.46 + (((i * 7 + k * 13) % 5) - 2) * 0.018;   // gentle size variation
        blob.scale.set(r * 1.18, r * 0.92, r * 1.18);
        blob.position.set(bx + ((i % 2) - 0.5) * 0.06, 0.46 + k * 0.42, bz);
        blob.rotation.set((i % 3) * 0.4, i * 0.6, (k % 2) * 0.3);
        blob.castShadow = true; blob.receiveShadow = true; g.add(deco(blob));
      }
    }
    // invisible collider so you still can't walk through the hedge run
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.3, len + 0.3), new THREE.MeshBasicMaterial({ visible: false }));
    col.position.set((x0 + x1) / 2, 0.65, (z0 + z1) / 2); col.rotation.y = ang; g.add(col);
  };
  hedge(-5, -10, -5, -2); hedge(5, -10, 5, -2);
  // Flower bed: a rounded earthen mound (squashed dome) studded with little
  // cone-and-bloom flowers — soft and organic instead of a flat box of box-petals.
  const flowerBed = (x, z) => {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), flat(0x4a3526));
    mound.scale.set(1, 0.34, 0.62); mound.position.set(x, 0.05, z); mound.receiveShadow = true; g.add(deco(mound));
    const cols = [0xd23b2b, 0xe6bd2a, 0x9b59b6, 0xf2f2f2, 0xe67e22];
    for (let i = 0; i < 7; i++) {
      const fx = x - 0.78 + (i / 6) * 1.56, fz = z + Math.sin(i * 1.7) * 0.34;
      g.add(deco(cyl(0.025, 0.04, 0.36, 5, smooth(0x3a6e3a), fx, 0.34, fz)));   // stem
      const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), smooth(cols[i % cols.length]));
      bloom.scale.set(1, 0.7, 1); bloom.position.set(fx, 0.52, fz); bloom.castShadow = true; g.add(deco(bloom));
      g.add(deco(new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), smooth(0xf6d743)).translateX(fx).translateY(0.55).translateZ(fz)));  // golden centre
    }
  };
  flowerBed(-8, -6); flowerBed(8, -6); flowerBed(-10, 22); flowerBed(10, 22);
  for (const z of [-8, -3]) for (const sx of [-1, 1]) { g.add(cyl(0.1, 0.13, 2.6, 8, dark, sx * 4.5, 1.3, z)); g.add(deco(box(0.3, 0.4, 0.3, lampMat, sx * 4.5, 2.8, z))); }
  g.add(cyl(0.1, 0.1, 2.0, 6, wood, -3, 1.0, -2)); g.add(cyl(0.1, 0.1, 2.0, 6, wood, -1.5, 1.0, -2));
  g.add(deco(box(2.0, 1.2, 0.12, flat(0x6b4a2c), -2.25, 1.7, -2)));
  for (const p of [[-2.8, 1.8], [-1.8, 1.9], [-2.4, 1.5]]) g.add(deco(box(0.4, 0.5, 0.14, flat(0xe6ddc8), p[0], p[1], -1.92)));

  // --- causeway railings flanking the gate approach (over the moat) ---
  for (let z = 19; z <= 23.5; z += 1.1) for (const sx of [-1, 1]) g.add(box(0.18, 0.95, 0.18, stone, sx * 9.6, 0.47, z));
  for (const sx of [-1, 1]) g.add(deco(box(0.25, 0.18, 4.8, stone, sx * 9.6, 1.0, 21.2)));

  // --- lived-in chimney smoke drifting up over a few rooftops ---
  // Placed above cottage roof spots and the windmill cap so the village breathes.
  g.add(chimneySmoke(-24, 6.2, 4));     // west cottage
  g.add(chimneySmoke(24, 6.2, 4));      // east cottage
  g.add(chimneySmoke(-27, 6.4, 13));    // back-corner inn
  g.add(chimneySmoke(30, 9.6, -6, 0xa9a299));   // windmill cap
  startSmoke();

  scene.add(g);
  (scene.userData.buildings = scene.userData.buildings || []).push(g);
  (scene.userData.outdoor = scene.userData.outdoor || []).push(g);
  return g;
}
