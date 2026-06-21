// town.js — the town that wraps the castle (Stormwind grandeur × Lumbridge cosiness):
// a paved square + approach road, lamp posts, a grand fountain, banner poles at the
// gate, market stalls, timber cottages, a chapel, fences, a signpost and props.
// The whole thing is pushed into scene.userData.buildings so collision.js makes
// the solid bits (cottages, fountain, fences, posts) block you automatically.

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';
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
        let mesh = null;
        gltf.scene.updateWorldMatrix(true, true);
        gltf.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
        if (!mesh) { reject(new Error('no mesh in ' + name)); return; }
        const geometry = mesh.geometry.clone();
        geometry.applyMatrix4(mesh.matrixWorld);
        geometry.computeBoundingBox();
        const bb = geometry.boundingBox;
        const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
        geometry.translate(-cx, -bb.min.y, -cz);    // centre XZ, base at y=0
        geometry.computeBoundingBox();
        geometry.computeVertexNormals();
        const material = mesh.material.isMaterial ? mesh.material : mesh.material[0];
        material.userData.__toonDone = true;
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

  // --- lamp posts ---
  const lampPost = (x, z) => {
    g.add(cyl(0.12, 0.16, 3.2, 8, dark, x, 1.6, z));
    g.add(cyl(0.28, 0.28, 0.12, 8, dark, x, 3.25, z));
    g.add(deco(box(0.34, 0.5, 0.34, lampMat, x, 3.55, z)));
    g.add(deco(box(0.16, 0.3, 0.16, dark, x, 3.9, z)));
  };
  for (const z of [2, 7, 12]) for (const sx of [-1, 1]) lampPost(sx * 4.5, z);
  for (const c of [[-8, 23], [8, 23], [-4, 10], [4, 10]]) lampPost(c[0], c[1]);

  // --- banner poles flanking the gate ---
  const bannerPole = (x, z, col) => {
    g.add(cyl(0.14, 0.16, 7, 8, dark, x, 3.5, z));
    g.add(deco(box(1.4, 3.0, 0.1, flat(col), x, 5.0, z + 0.12)));
    g.add(deco(box(0.6, 0.6, 0.12, flat(0xd8b24a), x, 5.0, z + 0.18)));
    g.add(deco(cyl(0.22, 0.22, 0.25, 8, flat(0xd8b24a), x, 7.1, z)));
  };
  bannerPole(-5, 23.5, 0x274a8a); bannerPole(5, 23.5, 0x274a8a);
  bannerPole(-9, 23.5, 0x6e2f2f); bannerPole(9, 23.5, 0x6e2f2f);

  // --- grand fountain (centrepiece) ---
  const fx = -6, fz = 16;   // off the central gate approach so click-to-move stays clear
  const water = new THREE.MeshStandardMaterial({ color: 0x2f6ea5, roughness: 0.2, metalness: 0.2, transparent: true, opacity: 0.85 });
  g.add(cyl(3.0, 3.3, 0.9, 16, stone, fx, 0.45, fz));            // basin (solid → blocks)
  g.add(deco(cyl(2.7, 2.7, 0.2, 16, water, fx, 0.85, fz)));
  g.add(deco(cyl(1.4, 1.6, 0.8, 12, stone, fx, 1.3, fz)));       // upper tier
  g.add(deco(cyl(1.1, 1.1, 0.15, 12, water, fx, 1.75, fz)));
  g.add(deco(cyl(0.3, 0.4, 1.6, 8, stone, fx, 2.4, fz)));
  g.add(deco(cyl(0.6, 0.0, 0.8, 8, flat(0xd8b24a), fx, 3.4, fz)));

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
  chapel(CHAPEL[0], CHAPEL[1]);

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
  windmill(30, -6);

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
  graveyard(-30, 4);

  // --- stable + horse ---
  const horse = (x, z) => {
    const h = flat(0x5a3a26), mane = flat(0x2a1c12);
    g.add(deco(box(1.7, 0.9, 0.7, h, x, 1.3, z)));
    for (const p of [[-0.6, -0.25], [0.6, -0.25], [-0.6, 0.25], [0.6, 0.25]]) g.add(deco(box(0.18, 1.0, 0.18, h, x + p[0], 0.5, z + p[1])));
    g.add(deco(box(0.42, 0.9, 0.5, h, x - 0.95, 1.7, z))); g.add(deco(box(0.5, 0.42, 0.42, h, x - 1.2, 2.05, z)));
    g.add(deco(box(0.1, 0.8, 0.5, mane, x - 0.8, 1.9, z))); g.add(deco(box(0.1, 0.7, 0.2, mane, x + 0.85, 1.5, z)));
  };
  const stable = (cx, cz) => {
    const barn = flat(0x8a5a32);
    g.add(box(0.3, 3, 5, barn, cx + 2.8, 1.5, cz)); g.add(box(5.6, 3, 0.3, barn, cx, 1.5, cz - 2.4)); g.add(box(5.6, 3, 0.3, barn, cx, 1.5, cz + 2.4));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.2, 8), mapped(T.shingle, 0x6e3a2a)); roof.scale.set(1, 1, 1.25); roof.position.set(cx, 4.1, cz); roof.rotation.y = Math.PI / 8; roof.castShadow = true; deco(roof); g.add(roof);
    g.add(deco(cyl(0.7, 0.7, 1.0, 10, flat(0xc9a24a), cx + 1.5, 0.5, cz + 1.6)));
    g.add(box(1.6, 0.5, 0.6, wood, cx - 1, 0.25, cz - 1.7));
    horse(cx, cz);
  };
  stable(26, 2);

  // --- hedges, flower beds, lanterns, notice board ---
  const hedge = (x0, z0, x1, z1) => { const dx = x1 - x0, dz = z1 - z0, n = Math.max(1, Math.round(Math.hypot(dx, dz) / 1.5)); for (let i = 0; i <= n; i++) { const t = i / n; g.add(box(1.0, 1.0, 1.0, flat(0x3f6e3a), x0 + dx * t, 0.5, z0 + dz * t)); } };
  hedge(-5, -10, -5, -2); hedge(5, -10, 5, -2);
  const flowerBed = (x, z) => { g.add(deco(box(2.0, 0.3, 1.2, flat(0x3a5a2a), x, 0.16, z))); const cols = [0xc0392b, 0xd4ac0d, 0x8e44ad, 0xe6e6e6]; for (let i = 0; i < 6; i++) g.add(deco(box(0.16, 0.3, 0.16, flat(cols[i % 4]), x - 0.8 + i * 0.32, 0.45, z + (i % 2 ? 0.3 : -0.3)))); };
  flowerBed(-8, -6); flowerBed(8, -6); flowerBed(-10, 22); flowerBed(10, 22);
  for (const z of [-8, -3]) for (const sx of [-1, 1]) { g.add(cyl(0.1, 0.13, 2.6, 8, dark, sx * 4.5, 1.3, z)); g.add(deco(box(0.3, 0.4, 0.3, lampMat, sx * 4.5, 2.8, z))); }
  g.add(cyl(0.1, 0.1, 2.0, 6, wood, -3, 1.0, -2)); g.add(cyl(0.1, 0.1, 2.0, 6, wood, -1.5, 1.0, -2));
  g.add(deco(box(2.0, 1.2, 0.12, flat(0x6b4a2c), -2.25, 1.7, -2)));
  for (const p of [[-2.8, 1.8], [-1.8, 1.9], [-2.4, 1.5]]) g.add(deco(box(0.4, 0.5, 0.14, flat(0xe6ddc8), p[0], p[1], -1.92)));

  // --- causeway railings flanking the gate approach (over the moat) ---
  for (let z = 19; z <= 23.5; z += 1.1) for (const sx of [-1, 1]) g.add(box(0.18, 0.95, 0.18, stone, sx * 9.6, 0.47, z));
  for (const sx of [-1, 1]) g.add(deco(box(0.25, 0.18, 4.8, stone, sx * 9.6, 1.0, 21.2)));

  scene.add(g);
  (scene.userData.buildings = scene.userData.buildings || []).push(g);
  (scene.userData.outdoor = scene.userData.outdoor || []).push(g);
  return g;
}
