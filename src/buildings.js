// buildings.js — the grand home-base CASTLE (Stormwind × Lumbridge) and the two
// big, walk-in shops. Built from low-poly shapes + procedural textures. Colliders
// are auto-generated from these meshes by collision.js (gaps = doors/gates), and
// shop roofs are hidden while you're inside (see main.js).

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js';
import { stoneTexture, greyStoneTexture, plasterTexture, dirtTexture, shingleTexture, woodFloorTexture, marbleTexture, tapestryTexture, carpetTexture, stainedGlassTexture, bookshelfTexture, heraldryBannerTexture, woodPanelTexture, tiledFloorTexture, rugTexture, signTexture, portraitTexture } from './textures.js';

// ---------------------------------------------------------------------------
// Modular dungeon GLB stone for the castle INTERIORS (ground/upper/basement).
// Quaternius pieces are one mesh of SEVERAL primitives (different materials), so
// GLTFLoader hands back a Group of child meshes. We bake each child's world
// matrix into a stripped (position+normal) non-indexed clone, then
// mergeGeometries(..., true) into ONE grouped geometry + material ARRAY, which
// feeds a single InstancedMesh per floor/wall run (one draw call). Measured at
// import time (node scale 100 is baked by GLTFLoader):
//   dpack_ModularFloor       -> 2.0 x 2.0 footprint, ~0.31 thick, lies in XY (Z up)
//   dpack_ModularStoneWall   -> 0.61 thick (X) x 2.05 tall (Y) x 2.04 wide (Z)
//   dpack_Column             -> 2.0 x 2.0 shaft, 4.92 long along +Z (base at Z~0)
//   dpack_Torch_wall         -> wall sconce, bracket points +X, ~1.1 wide, fire on top
// ---------------------------------------------------------------------------
const BUILD_DIR = './assets/models/build/';
const _gltf = new GLTFLoader();
const _protoCache = {};   // name -> Promise<{ geometry, materials }>

// Merge all child-mesh primitives of a loaded GLB into one grouped geometry.
function _bakeProto(root) {
  root.updateMatrixWorld(true);
  const geos = [], materials = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld);
    // strip to position + normal only so every primitive merges cleanly
    const keep = new THREE.BufferGeometry();
    keep.setAttribute('position', geo.getAttribute('position').clone());
    if (geo.getAttribute('normal')) keep.setAttribute('normal', geo.getAttribute('normal').clone());
    else keep.computeVertexNormals();
    geos.push(keep);
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    materials.push(mat);
  });
  const merged = mergeGeometries(geos, true);   // true -> keep per-geometry groups (material array)
  return { geometry: merged, materials };
}

function loadProto(name) {
  if (!_protoCache[name]) {
    _protoCache[name] = new Promise((ok, err) =>
      _gltf.load(BUILD_DIR + name + '.glb', (g) => ok(_bakeProto(g.scene)), undefined, err));
  }
  return _protoCache[name];
}

// Build an InstancedMesh for `proto` with the given per-instance matrices.
function instanced(proto, matrices) {
  const im = new THREE.InstancedMesh(proto.geometry, proto.materials, matrices.length);
  for (let i = 0; i < matrices.length; i++) im.setMatrixAt(i, matrices[i]);
  im.instanceMatrix.needsUpdate = true;
  im.castShadow = true; im.receiveShadow = true;
  im.userData.__toonDone = true; im.userData.noCollide = true;  // visuals only; colliders are explicit boxes
  return im;
}

// Place ONE GLB furniture clone, auto-scaled to `targetH` world height, centred
// on XZ with its base at y, then positioned + yawed. Visual only (noCollide).
function placeFurn(group, name, x, z, ry, targetH, y = 0) {
  loadProto(name).then((proto) => {
    proto.geometry.computeBoundingBox();
    const bb = proto.geometry.boundingBox, size = new THREE.Vector3(); bb.getSize(size);
    const s = targetH / (size.y || 1);
    const inner = new THREE.Mesh(proto.geometry, proto.materials);
    inner.scale.setScalar(s);
    inner.position.set(-((bb.min.x + bb.max.x) / 2) * s, -bb.min.y * s, -((bb.min.z + bb.max.z) / 2) * s);
    inner.castShadow = true; inner.receiveShadow = true; inner.userData.__toonDone = true;
    const wrap = new THREE.Group(); wrap.add(inner);
    wrap.position.set(x, y, z); wrap.rotation.y = ry; wrap.userData.noCollide = true;
    group.add(wrap);
  }).catch((e) => console.error('[buildings] furn ' + name, e));
}

// Measured native footprints (node-scale 100 baked in).
const FLOOR_TILE = 2.0;     // dpack_ModularFloor span in X and Y
const FLOOR_THICK = 0.337;  // native +Z extent = floor's top after rotateX(-90)
const WALL_W = 2.04;        // dpack_ModularStoneWall width (along Z natively)
const WALL_H = 2.05;        // wall height
const COL_LEN = 4.92;       // dpack_Column length along +Z natively

// Tile a modular floor across [-hw,hw] x [-hd,hd] (room local space), top at y=top.
// The floor GLB lies in XY (thickness +Z); rotateX(-90) lays it flat with Y up.
function buildGLBFloor(group, hw, hd, top = 0.02) {
  loadProto('dpack_ModularFloor').then((proto) => {
    const nx = Math.ceil((2 * hw) / FLOOR_TILE), nz = Math.ceil((2 * hd) / FLOOR_TILE);
    const m = new THREE.Matrix4(), rot = new THREE.Matrix4().makeRotationX(-Math.PI / 2), t = new THREE.Matrix4();
    const yLift = top - FLOOR_THICK;        // so the tile's top surface lands at `top`
    const mats = [];
    for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
      const x = -hw + FLOOR_TILE * (ix + 0.5), z = -hd + FLOOR_TILE * (iz + 0.5);
      t.makeTranslation(x, yLift, z);
      m.multiplyMatrices(t, rot);
      mats.push(m.clone());
    }
    group.add(instanced(proto, mats));
  }).catch((e) => console.error('[buildings] floor GLB failed', e));
}

// Line one straight wall run with stacked modular wall pieces. The run goes from
// (x0,z0)->(x1,z1) (must be axis-aligned), stacked to ~`wh` tall. The native wall
// width runs along +Z, thickness along X; we rotate so the width follows the run.
function buildGLBWall(group, x0, z0, x1, z1, wh) {
  loadProto('dpack_ModularStoneWall').then((proto) => {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
    if (len < 0.05) return;
    const ang = Math.atan2(dx, dz);          // rotate native +Z width toward the run direction
    const n = Math.max(1, Math.round(len / WALL_W));
    const rows = Math.max(1, Math.round(wh / WALL_H));
    const m = new THREE.Matrix4(), rot = new THREE.Matrix4().makeRotationY(ang), t = new THREE.Matrix4();
    const mats = [];
    for (let i = 0; i < n; i++) {
      const c = (i + 0.5) / n;
      const cx = x0 + dx * c, cz = z0 + dz * c;
      for (let r = 0; r < rows; r++) {
        const y = WALL_H * (r + 0.5);
        t.makeTranslation(cx, y, cz);
        m.multiplyMatrices(t, rot);
        mats.push(m.clone());
      }
    }
    group.add(instanced(proto, mats));
  }).catch((e) => console.error('[buildings] wall GLB failed', e));
}

// An invisible thin collider box matching a wall run's footprint, so collision
// stays identical after the procedural wall surface is replaced by GLB pieces.
function wallCollider(group, x0, z0, x1, z1, h, th) {
  const w = Math.max(th, Math.abs(x1 - x0)), d = Math.max(th, Math.abs(z1 - z0));
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
  m.visible = false;                 // never drawn, but still seen by collision.setFromObject
  group.add(m);
  return m;
}

// A GLB column clone standing on its base at (x,z), shaft scaled to height `h`.
function buildGLBColumn(group, x, z, h) {
  loadProto('dpack_Column').then((proto) => {
    const o = new THREE.Mesh(proto.geometry, proto.materials);
    o.scale.z = h / COL_LEN;         // scale the native length axis (+Z) BEFORE the rotation
    o.rotation.x = -Math.PI / 2;     // native length +Z -> stand up along +Y (base at y=0)
    o.position.set(x, 0, z);
    o.castShadow = true; o.receiveShadow = true;
    o.userData.__toonDone = true; o.userData.noCollide = true;
    group.add(o);
  }).catch((e) => console.error('[buildings] column GLB failed', e));
}

// A GLB wall torch sconce. The piece is modelled +Z-up (flame high in +Z) with
// the bracket reaching +X, so we stand it up (rotateX -90) inside a yawed wrapper
// that turns the bracket toward the room. `faceAng` is that yaw.
function buildGLBTorch(group, x, y, z, faceAng, lit = true) {
  loadProto('dpack_Torch_wall').then((proto) => {
    const wrap = new THREE.Group();
    wrap.rotation.y = faceAng;
    wrap.position.set(x, y, z);
    const o = new THREE.Mesh(proto.geometry, proto.materials);
    o.rotation.x = -Math.PI / 2;     // native +Z (flame) -> world up
    o.castShadow = true; o.receiveShadow = true;
    o.userData.__toonDone = true; o.userData.noCollide = true;
    wrap.add(o);
    group.add(wrap);
  }).catch((e) => console.error('[buildings] torch GLB failed', e));
  if (lit) { const pl = new THREE.PointLight(0xffa53a, 4, 14, 2); pl.position.set(x, y + 0.4, z); group.add(pl); }
}

// Footprints world.js uses to keep trees from growing inside things.
export const STRUCTURES = [
  { x: 0,   z: 46, r: 32 },  // castle
  { x: -15, z: 12, r: 8 },   // general store
  { x: 15,  z: 12, r: 8 },   // axe shop
];

let TX = null;
function tex() {
  if (!TX) TX = {
    wall: stoneTexture(2), floor: stoneTexture(5), road: stoneTexture(8),
    plaster: plasterTexture(), dirt: dirtTexture(4),
    shingle: shingleTexture(4), wood: woodFloorTexture(4), marble: marbleTexture(3),
    carpet: carpetTexture(6), tapestry: tapestryTexture('#6e1f2f', '#c9a24a'), tapestryB: tapestryTexture('#27406e', '#c9a24a'),
    stainedGlass: stainedGlassTexture(), bookshelf: bookshelfTexture(), heraldry: heraldryBannerTexture('#27406e'),
    woodPanel: woodPanelTexture(2), tiled: tiledFloorTexture(4), rug: rugTexture(), portrait: portraitTexture(),
    grey: greyStoneTexture(2), greyBig: greyStoneTexture(4),
  };
  return TX;
}

const flat = (color, rough = 0.95) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, flatShading: true });
const mapped = (map, color = 0xffffff, rough = 0.92) => new THREE.MeshStandardMaterial({ map, color, roughness: rough, metalness: 0 });
const deco = (m) => { m.userData.noCollide = true; return m; };

function box(w, h, d, material, x, y, z, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; return m;
}
function cyl(rt, rb, h, seg, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
// A merlon (battlement tooth) chamfered on top instead of a raw cube — a short
// prism with a small pyramidal cap, so the parapet reads sculpted. Centred on
// (x,y,z) where y is the merlon's mid-height.
function merlon(w, h, d, material, x, y, z) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.72, d), material);
  body.position.y = -h * 0.14; body.castShadow = true; body.receiveShadow = true; grp.add(body);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.30, w * 0.6, h * 0.34, 4), material);
  cap.rotation.y = Math.PI / 4; cap.position.y = h * 0.39; cap.castShadow = true; grp.add(cap);
  grp.position.set(x, y, z); return grp;
}
// A chamfered coping rail (slab + a pyramidal crown) — caps wall tops so the
// masonry reads rounded rather than raw-cut. Centred at (x,y,z).
function coping(w, h, d, material, x, y, z) {
  const grp = new THREE.Group();
  const lip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, h * 0.5, d + 0.2), material);
  lip.position.y = -h * 0.12; lip.castShadow = true; lip.receiveShadow = true; grp.add(lip);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.3, w * 0.62, h * 0.6, 4), material); // chamfered crown
  top.rotation.y = Math.PI / 4; top.position.y = h * 0.3; top.castShadow = true; grp.add(top);
  grp.position.set(x, y, z); return grp;
}
// A semicircular arched opening surround: two jambs + a torus voussoir arch,
// for doors/windows so openings curve instead of being square holes.
function archFrame(width, jambH, depth, material, x, y, z, ry = 0) {
  const grp = new THREE.Group();
  const r = width / 2, jw = depth;
  for (const s of [-1, 1]) {
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(jw, jambH, depth), material);
    jamb.position.set(s * (r + jw * 0.5 - 0.05), jambH / 2, 0); jamb.castShadow = true; grp.add(jamb);
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(r + jw * 0.15, jw * 0.5, 8, 18, Math.PI), material);
  arch.position.set(0, jambH, 0); arch.castShadow = true; grp.add(arch);
  grp.rotation.y = ry; grp.position.set(x, y, z); return grp;
}

// ---------------------------------------------------------------------------
// A big walk-in shop with a hideable roof. opts: { wall, roof, wares }
// ---------------------------------------------------------------------------
function makeShop(opts) {
  const T = tex();
  const g = new THREE.Group();
  const HW = 6, HD = 5, H = 3.4, TH = 0.4, DOOR = 1.6;
  const wallMat = mapped(T.plaster, opts.wall), beam = flat(0x4a3220),
        floorMat = mapped(T.wood), woodMat = flat(0x6b4a2c), stoneMat = mapped(T.wall);
  const glass = new THREE.MeshStandardMaterial({ color: 0x86bcd6, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.55 });

  g.add(deco(box(HW * 2, 0.2, HD * 2, floorMat, 0, 0.06, 0, false)));            // wood floor
  g.add(deco(box(DOOR * 2 + 1, 0.18, 1.2, mapped(T.road), 0, 0.05, -HD - 0.6, false))); // doorstep

  // The exterior shell (walls, windows, door frame) lives in its own group so a
  // glTF building can replace it: storeModels.js hides the shell + roof when you
  // stand outside and shows them again when you step in (the walls still collide
  // even while hidden, so the doorway stays a doorway).
  const shell = new THREE.Group();
  const wallSeg = (x0, z0, x1, z1) => {
    const w = Math.max(TH, Math.abs(x1 - x0)), d = Math.max(TH, Math.abs(z1 - z0));
    shell.add(box(w, H, d, wallMat, (x0 + x1) / 2, H / 2, (z0 + z1) / 2));
  };
  wallSeg(-HW, HD, HW, HD); wallSeg(-HW, -HD, -HW, HD); wallSeg(HW, -HD, HW, HD); // back + sides
  wallSeg(-HW, -HD, -DOOR, -HD); wallSeg(DOOR, -HD, HW, -HD);                     // front (door gap)
  for (const sx of [-1, 1]) shell.add(box(0.3, 2.6, 0.5, beam, sx * DOOR, 1.3, -HD)); // door frame
  shell.add(box(DOOR * 2 + 0.6, 0.4, 0.5, beam, 0, 2.6, -HD));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) shell.add(box(0.3, H, 0.3, beam, sx * HW, H / 2, sz * HD)); // corner posts
  for (const sz of [-1, 1]) shell.add(deco(box(HW * 2, 0.25, 0.32, beam, 0, H - 0.5, sz * HD)));                 // timber band
  for (const sz of [-2.2, 2.2]) for (const sx of [-1, 1]) {
    const wx = sx * (HW - 0.02);
    shell.add(deco(box(0.18, 1.3, 1.5, glass, wx, 1.9, sz)));                                                 // glass
    shell.add(deco(box(0.16, 0.14, 1.9, beam, wx, 2.6, sz))); shell.add(deco(box(0.16, 0.14, 1.9, beam, wx, 1.2, sz)));   // lintel + sill
    for (const ss of [-1, 1]) { shell.add(deco(box(0.16, 1.5, 0.14, beam, wx, 1.9, sz + ss * 0.85))); shell.add(deco(box(0.1, 1.3, 0.42, flat(0x5a3a22), wx + sx * 0.1, 1.9, sz + ss * 0.6))); }  // jambs + open shutters
    shell.add(deco(box(0.22, 0.16, 1.0, flat(0x4a3018), wx + sx * 0.12, 1.18, sz)));                          // flower box
    for (let i = 0; i < 4; i++) shell.add(deco(box(0.1, 0.18, 0.1, flat([0xc0392b, 0xd4ac0d, 0x8e44ad, 0xe6e6e6][i]), wx + sx * 0.18, 1.34, sz - 0.36 + i * 0.24)));  // blooms
  }
  g.add(shell); g.userData.shell = shell;

  // hideable roof
  const roof = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), mapped(T.shingle, opts.roof));
  cone.scale.set(HW + 1.3, 3.4, HD + 1.3); cone.position.y = H + 1.6; cone.rotation.y = Math.PI / 4; cone.castShadow = true; deco(cone); roof.add(cone);
  roof.add(deco(box(HW * 2 + 1.6, 0.35, HD * 2 + 1.6, beam, 0, H + 0.05, 0)));   // eaves
  roof.add(deco(box(0.8, 2.4, 0.8, stoneMat, HW - 1.4, H + 1.7, HD - 1.4)));      // chimney
  roof.add(deco(cyl(0.05, 0.05, 0.6, 8, flat(0x3a2418), 0, H + 3.5, 0)));         // finial post
  { const finial = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 8), flat(0xd8b24a)); finial.position.set(0, H + 3.9, 0); deco(finial); roof.add(finial); }  // gold finial
  g.add(roof);

  // interior — real GLB furniture in place of the procedural boxes
  placeFurn(g, 'house_Shelf_1', 0, HD - 1.5, 0, 1.05);                            // shop counter at the back
  for (const sx of [-1, 1]) placeFurn(g, 'house_Bookshelf', sx * (HW - 0.6), -0.5, sx < 0 ? Math.PI / 2 : -Math.PI / 2, 2.4); // wall shelving
  placeFurn(g, 'med_Crate', -HW + 1.5, -HD + 1.6, 0.3, 1.0);
  placeFurn(g, 'med_Crate', -HW + 1.5, -HD + 2.8, 0.0, 0.85);
  placeFurn(g, 'med_Crate', 1.7, -HD + 1.7, 0.5, 0.95);
  placeFurn(g, 'med_Barrel', HW - 1.5, -HD + 1.7, 0, 1.1);
  placeFurn(g, 'med_Barrel', HW - 1.5, -HD + 3.0, 0, 1.1);
  g.add(deco(box(0.34, 0.42, 0.34, new THREE.MeshStandardMaterial({ color: 0xffe6a3, emissive: 0xffb142, emissiveIntensity: 1.3, roughness: 0.5 }), 0, 2.6, -HD + 1.4))); // lantern glow

  g.userData.roof = roof; g.userData.hw = HW + 0.8; g.userData.hd = HD + 0.8;
  return g;
}

// ---------------------------------------------------------------------------
// The castle. Local: front (gate) = -z, throne at the back (+z).
// ---------------------------------------------------------------------------
function makeCastle() {
  const T = tex();
  const g = new THREE.Group();
  const HW = 23, HD = 22, WH = 6, TH = 0.9;
  const stone = mapped(T.wall), grey = mapped(T.grey), greyBig = mapped(T.greyBig),
        floorMat = mapped(T.floor, 0xb6b1a6), marble = mapped(T.marble),
        roofMat = mapped(T.shingle, 0x5d6e82), roofMatDk = mapped(T.shingle, 0x46566a),
        wood = flat(0x4a3320), gold = flat(0xd8b24a, 0.4),
        red = flat(0x8a1f1f), purple = flat(0x4a2c6e);
  const ember = new THREE.MeshStandardMaterial({ color: 0xff7a1e, emissive: 0xff5500, emissiveIntensity: 1.1, roughness: 0.7 });
  const flameMat = new THREE.MeshStandardMaterial({ color: 0xffb33a, emissive: 0xff7b00, emissiveIntensity: 1.7, roughness: 0.5 });
  const glassCols = [0x3a6ea5, 0x8a1f1f, 0x2f8a4a, 0xc9a24a, 0x6e3a8a];

  const merlons = (x0, z0, x1, z1, y, step = 1.7) => {
    const dx = x1 - x0, dz = z1 - z0, n = Math.max(1, Math.round(Math.hypot(dx, dz) / step));
    for (let i = 0; i <= n; i++) { const t = i / n; g.add(deco(merlon(0.72, 0.95, 0.72, stone, x0 + dx * t, y, z0 + dz * t))); }
  };
  const wallSeg = (x0, z0, x1, z1, h = WH, th = TH, cren = true) => {
    const w = Math.max(th, Math.abs(x1 - x0)), d = Math.max(th, Math.abs(z1 - z0));
    g.add(box(w, h, d, stone, (x0 + x1) / 2, h / 2, (z0 + z1) / 2));
    if (cren) {                                                        // chamfered coping + sculpted merlons
      g.add(deco(coping(w + 0.1, 0.4, d + 0.1, stone, (x0 + x1) / 2, h + 0.1, (z0 + z1) / 2)));
      merlons(x0, z0, x1, z1, h + 0.6);
    }
  };
  const tower = (tx, tz, r = 2.8, h = 18, mat = grey, roof = roofMat) => {
    g.add(cyl(r, r + 0.4, h, 16, mat, tx, h / 2, tz));
    g.add(deco(cyl(r + 0.55, r + 0.55, 0.7, 16, mat, tx, h + 0.05, tz)));            // machicolation corbel ring
    g.add(deco(cyl(r + 0.35, r + 0.55, 0.9, 16, mat, tx, h - 0.65, tz)));            // corbel underside
    const mr = r + 0.55, mn = Math.max(12, Math.round(mr * 3.4));                    // battlement merlons
    for (let k = 0; k < mn; k++) { const a = k / mn * Math.PI * 2; const m = merlon(0.6, 1.0, 0.6, mat, tx + Math.cos(a) * (mr - 0.2), h + 0.85, tz + Math.sin(a) * (mr - 0.2)); m.rotation.y = a; deco(m); g.add(m); }
    const cone = new THREE.Mesh(new THREE.ConeGeometry(mr + 0.6, r * 2.0 + 1.4, 16), roof); cone.position.set(tx, h + 1.4 + (r + 0.7), tz); cone.castShadow = true; deco(cone); g.add(cone);
    const ringY = h + 1.4;
    g.add(deco(cyl(mr + 0.65, mr + 0.65, 0.35, 16, gold, tx, ringY, tz)));           // gilt eave ring
    g.add(deco(box(0.14, 2.8, 0.14, wood, tx, h + (r * 2.0 + 1.4) + 2.7, tz)));      // flag pole
    g.add(deco(cyl(0.16, 0, 0.4, 8, gold, tx, h + (r * 2.0 + 1.4) + 4.2, tz)));      // pole finial
    g.add(deco(box(1.5, 0.85, 0.05, red, tx + 0.82, h + (r * 2.0 + 1.4) + 2.9, tz)));// pennant
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + Math.PI / 4; g.add(deco(box(0.25, 1.3, 0.6, mat, tx + Math.cos(a) * (r + 0.05), h * 0.55, tz + Math.sin(a) * (r + 0.05)))); } // arrow-slit reveals
  };
  const brazier = (x, z, light = false) => {
    g.add(cyl(0.35, 0.22, 0.8, 8, stone, x, 0.4, z));
    g.add(deco(box(0.5, 0.3, 0.5, flameMat, x, 1.0, z)));
    if (light) { const pl = new THREE.PointLight(0xffa53a, 7, 16, 2); pl.position.set(x, 1.4, z); g.add(pl); }
  };
  const column = (x, z, h = WH + 3.2) => {
    g.add(deco(box(1.7, 0.5, 1.7, stone, x, 0.25, z)));             // stepped base
    g.add(deco(box(1.4, 0.4, 1.4, stone, x, 0.65, z)));
    buildGLBColumn(g, x, z, h - 0.5);                               // soaring GLB shaft (atop the base)
    g.add(deco(cyl(0.95, 0.65, 0.7, 14, stone, x, h - 0.3, z)));    // flared capital
    g.add(deco(box(1.7, 0.55, 1.7, stone, x, h + 0.1, z)));         // abacus
    g.add(deco(box(1.4, 0.35, 1.4, gold, x, h + 0.45, z)));         // gilt band
  };
  const statue = (x, z) => {
    g.add(box(1.4, 1.0, 1.4, stone, x, 0.5, z));                 // pedestal (solid)
    g.add(deco(cyl(0.3, 0.4, 1.6, 8, marble, x, 1.8, z)));
    g.add(deco(box(0.5, 0.5, 0.45, marble, x, 2.8, z)));
    g.add(deco(box(0.12, 1.4, 0.12, marble, x + 0.35, 2.2, z)));
  };

  // floors + carpet — base flagstones are now tiled modular GLB stone (top ~0.02)
  buildGLBFloor(g, HW, HD, 0.02);
  g.add(deco(box(20, 0.16, HD - 1, marble, 0, 0.0, HD / 2 + 0.5, false)));            // central hall marble (top ~0.08)
  g.add(deco(box(6, 0.06, 19, mapped(T.carpet), 0, 0.11, 9.5, false)));               // royal aisle carpet

  // curtain walls — modular GLB stone, with invisible colliders matching the old
  // procedural footprint (gate gap at front, local x[-2.5..2.5]).
  const VWH = WH + 4.5;   // visual walls rise to the great-hall ceiling (HALLH≈WH+3.2); colliders stay at WH
  buildGLBWall(g, -HW, -HD, -2.5, -HD, VWH); wallCollider(g, -HW, -HD, -2.5, -HD, WH, TH);
  buildGLBWall(g, 2.5, -HD, HW, -HD, VWH);   wallCollider(g, 2.5, -HD, HW, -HD, WH, TH);
  buildGLBWall(g, -HW, HD, HW, HD, VWH);     wallCollider(g, -HW, HD, HW, HD, WH, TH);
  buildGLBWall(g, -HW, -HD, -HW, HD, VWH);   wallCollider(g, -HW, -HD, -HW, HD, WH, TH);
  buildGLBWall(g, HW, -HD, HW, HD, VWH);     wallCollider(g, HW, -HD, HW, HD, WH, TH);
  // keep a sculpted chamfered parapet on top of the GLB curtain so the silhouette
  // still reads as crenellated battlements above the modular wall.
  const crenRun = (x0, z0, x1, z1) => {
    g.add(deco(coping(Math.max(TH, Math.abs(x1 - x0)) + 0.1, 0.4, Math.max(TH, Math.abs(z1 - z0)) + 0.1, stone, (x0 + x1) / 2, WH + 0.1, (z0 + z1) / 2)));
    merlons(x0, z0, x1, z1, WH + 0.6);
  };
  crenRun(-HW, -HD, -2.5, -HD); crenRun(2.5, -HD, HW, -HD);
  crenRun(-HW, HD, HW, HD); crenRun(-HW, -HD, -HW, HD); crenRun(HW, -HD, HW, HD);

  // towers: 4 grand corner drum-towers (front pair tallest), 2 side-mids,
  // and 2 grey gatehouse drums flanking the gate
  tower(-HW, -HD, 3.2, 22); tower(HW, -HD, 3.2, 22);                       // front corners (tallest)
  tower(-HW, HD, 3.0, 20); tower(HW, HD, 3.0, 20);                         // back corners
  tower(-HW, 0, 2.6, 17); tower(HW, 0, 2.6, 17);                           // side-mids
  tower(-7, -HD, 2.4, 21, greyBig, roofMatDk); tower(7, -HD, 2.4, 21, greyBig, roofMatDk);  // gatehouse drums (grey)

  // ---- grand gatehouse: arch, raised portcullis, machicolated parapet ----
  g.add(deco(box(14, 2.0, 2.2, greyBig, 0, WH + 1.0, -HD)));               // gatehouse block over the arch
  g.add(deco(box(15.4, 0.7, 2.6, greyBig, 0, WH + 2.1, -HD)));             // corbelled machicolation
  for (let k = -3; k <= 3; k++) g.add(deco(merlon(0.72, 1.0, 0.72, greyBig, k * 2.0, WH + 2.85, -HD)));   // parapet merlons
  for (const sx of [-1, 1]) g.add(deco(box(0.9, 4.6, 1.0, greyBig, sx * 3.0, WH - 0.7, -HD - 0.2))); // arch jambs
  { const arch = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.55, 8, 10, Math.PI), greyBig); arch.position.set(0, WH - 0.9, -HD - 0.25); deco(arch); g.add(arch); } // round arch voussoir
  for (let i = -2; i <= 2; i++) g.add(deco(box(0.22, 2.0, 0.22, flat(0x2a2c30), i * 0.9, WH - 1.6, -HD - 0.1)));  // raised portcullis teeth
  for (let i = 0; i < 5; i++) g.add(deco(box(4.5, 0.2, 0.2, flat(0x2a2c30), 0, WH - 0.7 + i * 0.0, -HD - 0.1)));  // portcullis rail
  g.add(deco(box(5.0, 0.25, 0.3, flat(0x2a2c30), 0, WH - 0.5, -HD - 0.1)));
  for (const sx of [-1, 1]) g.add(deco(box(2.6, 4.4, 0.18, mapped(T.heraldry), sx * 5.0, WH - 0.4, -HD - 0.45)));  // banners on the gatehouse face

  // ===================== raised causeway + barbican over the front moat =====================
  // The moat's front gap is local x[-10..10], z[-27..-23]; this bridge is decorative
  // (the player walks on terrain) and keeps the gate (local x±2.5) clear.
  const bridgeMat = greyBig, bridgeY = 0.02;
  g.add(deco(box(8.0, 0.5, 6.2, bridgeMat, 0, bridgeY, -25.6, false)));            // causeway deck
  g.add(deco(box(8.6, 0.35, 1.2, bridgeMat, 0, 0.45, -22.9, false)));              // threshold lip at the gate
  for (const sx of [-1, 1]) {                                                       // parapet rails + posts down the bridge
    g.add(deco(box(0.5, 1.5, 6.4, bridgeMat, sx * 3.7, 0.75, -25.6)));
    for (const pz of [-23.1, -25.6, -28.1]) g.add(deco(box(0.85, 1.95, 0.85, bridgeMat, sx * 3.7, 0.9, pz)));  // newel posts
  }
  // barbican: a forward stone arch at the outer (moat) edge, flanked by twin turrets
  for (const sx of [-1, 1]) {
    g.add(deco(cyl(1.5, 1.7, 9.0, 12, bridgeMat, sx * 4.4, 4.5, -28.5)));           // turret
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; const m = merlon(0.42, 0.66, 0.42, bridgeMat, sx * 4.4 + Math.cos(a) * 1.7, 9.25, -28.5 + Math.sin(a) * 1.7); m.rotation.y = a; deco(m); g.add(m); }
    const tc = new THREE.Mesh(new THREE.ConeGeometry(2.1, 3.4, 12), roofMatDk); tc.position.set(sx * 4.4, 11.0, -28.5); deco(tc); g.add(tc);
    g.add(deco(box(0.1, 1.7, 0.1, wood, sx * 4.4, 13.4, -28.5))); g.add(deco(box(1.0, 0.6, 0.05, red, sx * 4.4 + 0.55, 13.6, -28.5)));
  }
  g.add(deco(box(11.0, 2.2, 1.6, bridgeMat, 0, 8.0, -28.5)));                       // barbican arch span
  g.add(deco(box(12.0, 0.7, 1.9, bridgeMat, 0, 9.2, -28.5)));                       // machicolation
  for (let k = -2; k <= 2; k++) g.add(deco(merlon(0.72, 0.95, 0.72, bridgeMat, k * 2.2, 9.95, -28.5)));   // merlons
  { const arch = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.5, 8, 10, Math.PI), bridgeMat); arch.position.set(0, 4.6, -28.4); deco(arch); g.add(arch); }
  g.add(deco(box(11.6, 4.2, 0.2, mapped(T.heraldry, 0x27406e), 0, 5.2, -29.0)));    // big banner over the outer arch (smaller-tiled look)
  // approach statues + braziers guarding the causeway mouth
  statue(-6.5, -26.0); statue(6.5, -26.0);
  brazier(-4.2, -23.6, true); brazier(4.2, -23.6, true);
  brazier(-4.2, -28.0, true); brazier(4.2, -28.0, true);

  // inner dividing wall (courtyard | keep) with a grand arch
  wallSeg(-HW, 0, -3, 0, 5, 0.7); wallSeg(3, 0, HW, 0, 5, 0.7);
  g.add(deco(box(7.5, 1.6, 1.2, stone, 0, 5.3, 0)));

  // great-hall columns (central aisle stays clear) — a soaring four-column colonnade
  const HALLH = WH + 3.2;
  for (const sx of [-1, 1]) for (const z of [5.5, 16.5]) column(sx * 9, z);   // hall colonnade (clear of doorways)
  // semicircular ribbed arches link the columns along each side (cathedral feel)
  const sideArch = (sx) => {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.4, 8, 14, Math.PI), stone);
    arch.position.set(sx * 9, HALLH + 0.3, 11); arch.rotation.y = Math.PI / 2; deco(arch); g.add(arch);
    g.add(deco(box(1.0, 0.7, 12.5, stone, sx * 9, HALLH + 0.9, 11)));         // entablature beam over the colonnade
    g.add(deco(box(1.2, 0.4, 12.7, gold, sx * 9, HALLH + 1.35, 11)));         // gilt cornice band
  };
  sideArch(-1); sideArch(1);
  // tall clerestory beam spanning the nave + hanging banners between the columns
  for (const sx of [-1, 1]) for (const z of [5.5, 16.5]) g.add(deco(box(0.12, 3.6, 1.6, mapped(T.heraldry), sx * 8.3, HALLH - 2.0, z)));

  // throne room (back) — the dais; the throne itself + furnishings are real glTF
  // models placed by castleFurniture.js (the old box-throne lived here).
  g.add(deco(box(12, 0.4, 5, marble, 0, 0.32, HD - 3, false)));   // dais step 1
  g.add(deco(box(8, 0.4, 3.5, marble, 0, 0.6, HD - 3, false)));   // dais step 2
  const sgThrone = new THREE.MeshStandardMaterial({ map: T.stainedGlass, emissive: 0xffffff, emissiveMap: T.stainedGlass, emissiveIntensity: 0.55, roughness: 0.3 });
  for (let i = 0; i < 5; i++) g.add(deco(box(2.2, 3.8, 0.2, sgThrone, -8 + i * 4, 4.3, HD - 0.6)));  // stained glass
  for (const sx of [-1, 1]) g.add(deco(box(2.4, 5.0, 0.12, mapped(T.heraldry), sx * 5.5, 4.0, HD - 0.7)));  // heraldic banners
  brazier(-3.5, HD - 3.2, true); brazier(3.5, HD - 3.2, true);

  brazier(-6, 6); brazier(6, 6); brazier(-6, 15, true); brazier(6, 15, true);   // aisle braziers

  // courtyard: a central approach (well, statues, braziers) flanked by four rooms
  g.add(cyl(1.1, 1.25, 1.0, 12, stone, -6, 0.5, -7));                                       // well
  g.add(deco(box(1.7, 0.06, 1.7, flat(0x244055), -6, 0.9, -7, false)));
  for (const sx of [-1, 1]) g.add(deco(box(0.18, 1.9, 0.18, wood, -6 + sx * 1.05, 1.0, -7)));
  { const wr = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.0, 4), roofMat); wr.position.set(-6, 2.4, -7); wr.rotation.y = Math.PI / 4; wr.castShadow = true; deco(wr); g.add(wr); }
  statue(-6, -18); statue(6, -18);
  brazier(-6, -11); brazier(6, -11);

  // four courtyard rooms: dividers at x ±10 (doorways z -18..-15 & z -7..-4) + cross-walls at z -11
  const cDivider = (x) => { wallSeg(x, -21, x, -18, 5, 0.6, false); wallSeg(x, -15, x, -7, 5, 0.6, false); wallSeg(x, -4, x, -1, 5, 0.6, false); };
  cDivider(-10); cDivider(10);
  wallSeg(-22.5, -11, -10, -11, 5, 0.6, false); wallSeg(10, -11, 22.5, -11, 5, 0.6, false);
  g.add(deco(box(12.5, 0.16, 10, mapped(T.floor, 0xb6b1a6), -16.2, 0.0, -16, false)));     // armoury floor
  g.add(deco(box(12.5, 0.16, 10, mapped(T.wood), -16.2, 0.0, -6, false)));                 // kitchen floor
  g.add(deco(box(12.5, 0.16, 10, mapped(T.wood), 16.2, 0.0, -16, false)));                 // bedchamber floor
  g.add(deco(box(12.5, 0.16, 10, mapped(T.tiled), 16.2, 0.0, -6, false)));                 // treasury floor

  // Kitchen (back-left)
  g.add(box(2.2, 2.1, 1.5, stone, -21, 1.05, -9));                                          // range/oven
  g.add(deco(box(1.1, 0.7, 0.2, ember, -19.9, 0.8, -9)));
  g.add(deco(box(0.7, 1.6, 0.7, stone, -21, 3.1, -9)));                                     // chimney
  g.add(deco(cyl(0.4, 0.45, 0.5, 10, flat(0x3a3a3e), -19.9, 2.05, -9)));                    // stew pot
  g.add(box(2.4, 0.9, 1.1, wood, -16, 0.45, -5));                                           // butcher table
  for (const f of [[0xb5651d, -16.9], [0xece0c0, -16], [0x8a1f1f, -15.2]]) g.add(deco(box(0.4, 0.3, 0.4, flat(f[0]), f[1], 1.05, -5)));
  for (const p of [[-21, -3], [-20.2, -3.8]]) g.add(cyl(0.4, 0.45, 0.9, 10, wood, p[0], 0.45, p[1]));    // ale barrels
  for (let r = 0; r < 3; r++) g.add(deco(box(3.0, 0.06, 0.4, flat(0x4a3018), -16, 1.7 + r * 0.7, -1.4)));  // larder shelves

  // Treasury (back-right)
  g.add(box(4.4, 1.1, 0.6, wood, 17, 0.55, -6));                                            // counter
  g.add(deco(box(4.4, 0.14, 0.8, flat(0x5a3a22), 17, 1.16, -6)));
  for (const p of [[19, -3], [19.8, -3], [19.4, -3.8], [20.6, -3]]) g.add(deco(box(0.6, 0.5, 0.6, gold, p[0], 0.25, p[1])));   // gold stacks
  for (const cx of [13.5, 20.5]) { g.add(box(1.3, 0.8, 0.9, wood, cx, 0.4, -2)); g.add(deco(box(1.1, 0.34, 0.7, gold, cx, 0.85, -2))); }   // chests of gold
  g.add(box(2.0, 2.4, 0.5, flat(0x55585e), 21.9, 1.2, -8)); g.add(deco(cyl(0.4, 0.4, 0.14, 10, gold, 21.6, 1.2, -8)));   // vault door + wheel

  // ===================== castle dressing (the grand interior) =====================
  const steel = flat(0x9aa0a8, 0.5), silver = flat(0xc8ccd2, 0.4);
  const tapA = mapped(T.tapestry), tapB = mapped(T.tapestryB), carpetMat = mapped(T.carpet);
  const candle = new THREE.MeshStandardMaterial({ color: 0xffe6a3, emissive: 0xffcf6a, emissiveIntensity: 1.6, roughness: 0.5 });

  // a suit of armour on a pedestal
  const knight = (x, z) => {
    g.add(deco(box(1.2, 0.4, 1.2, stone, x, 0.2, z)));
    g.add(deco(cyl(0.3, 0.36, 1.2, 8, steel, x, 1.0, z)));
    g.add(deco(box(0.74, 0.4, 0.5, steel, x, 1.75, z)));
    g.add(deco(box(0.42, 0.46, 0.42, silver, x, 2.18, z)));
    g.add(deco(box(0.12, 0.34, 0.12, red, x, 2.55, z)));            // helm plume
    g.add(deco(box(0.1, 1.9, 0.1, wood, x + 0.5, 1.45, z)));        // spear
    g.add(deco(cyl(0.12, 0, 0.42, 6, silver, x + 0.5, 2.55, z)));
    g.add(deco(box(0.55, 0.78, 0.1, red, x - 0.5, 1.5, z)));        // shield
  };
  // GLB wall sconce mounted on the side curtain wall; bracket faces the room.
  const wallTorch = (x, z) => buildGLBTorch(g, x, 3.0, z, x < 0 ? 0 : Math.PI, false);
  const tapestry = (x, z, m) => { g.add(deco(box(2.6, 0.18, 0.16, wood, x, 5.4, z))); g.add(deco(box(2.4, 4.4, 0.12, m, x, 3.2, z))); };
  const chandelier = (z, lit) => {
    g.add(deco(box(0.06, 2.2, 0.06, flat(0x2a2622), 0, 7.6, z)));
    g.add(deco(cyl(1.1, 1.1, 0.14, 12, gold, 0, 6.4, z)));
    g.add(deco(cyl(0.7, 0.7, 0.1, 12, gold, 0, 6.7, z)));
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.add(deco(box(0.12, 0.34, 0.12, candle, Math.cos(a), 6.7, z + Math.sin(a)))); }
    if (lit) { const pl = new THREE.PointLight(0xffce7a, 5, 20, 2); pl.position.set(0, 6.2, z); g.add(pl); }
  };

  for (const sx of [-1, 1]) for (const z of [3, 7, 11, 15]) knight(sx * 5, z);           // knights line the aisle
  tapestry(-22.4, 4, tapA); tapestry(-22.4, 16, tapB);   // library wall (right wall = chapel stained glass)
  for (const sx of [-1, 1]) for (const z of [2.5, 8.5, 14.5, -6, -12, -18]) wallTorch(sx * 22.4, z);
  chandelier(6, true); chandelier(13, true); chandelier(HD - 2.5, true);

  // great fireplace (left hall wall, in the Library)
  const fpx = -22.4, fpz = 10;
  g.add(deco(box(0.5, 4.6, 4.6, stone, fpx, 2.3, fpz)));
  g.add(deco(box(0.7, 2.2, 3.0, flat(0x1c1814), fpx + 0.2, 1.1, fpz)));
  g.add(deco(box(0.5, 1.0, 2.4, ember, fpx + 0.35, 0.6, fpz)));
  g.add(deco(box(0.9, 0.4, 3.8, stone, fpx + 0.1, 2.5, fpz)));
  { const pl = new THREE.PointLight(0xff7a2a, 4.5, 13, 2); pl.position.set(fpx + 1.2, 1.3, fpz); g.add(pl); }

  // throne dressing: rug + candelabra
  g.add(deco(box(4, 0.05, 3, carpetMat, 0, 0.84, HD - 3.2, false)));   // rug on the dais (sits on top of the steps)
  for (const sx of [-1, 1]) { g.add(deco(cyl(0.18, 0.24, 1.9, 8, gold, sx * 2.4, 0.95, HD - 2.6))); g.add(deco(box(0.26, 0.32, 0.26, candle, sx * 2.4, 2.05, HD - 2.6))); }

  // --- Armoury (front-left courtyard room) ---
  g.add(box(2.2, 1.5, 1.6, stone, -20.4, 0.75, -19));                                        // forge
  g.add(deco(box(1.1, 0.7, 0.2, ember, -19.3, 0.7, -19)));
  g.add(deco(box(0.55, 1.5, 0.55, stone, -20.4, 2.2, -19)));                                 // forge chimney
  g.add(box(0.8, 0.5, 0.4, flat(0x3a3a3e), -17.5, 0.6, -18)); g.add(deco(cyl(0.26, 0.32, 0.55, 6, flat(0x3a3a3e), -17.5, 0.28, -18)));  // anvil
  knight(-12.5, -19); knight(-12.5, -13);                                                    // armour stands
  g.add(box(0.4, 1.3, 3.4, wood, -22.1, 0.65, -13.5));                                        // weapon rack backing
  for (let i = 0; i < 5; i++) { g.add(deco(box(0.08, 1.9, 0.08, wood, -21.9, 1.0, -15 + i * 0.75))); g.add(deco(cyl(0.1, 0, 0.4, 6, silver, -21.9, 2.0, -15 + i * 0.75))); } // spears
  for (let i = 0; i < 3; i++) g.add(deco(box(1.0, 1.2, 0.12, mapped(T.heraldry), -18.5 + i * 2.2, 2.5, -21.5)));  // shields on the wall
  for (const p of [[-12, -20.5], [-12.9, -20.2]]) g.add(box(0.9, 0.9, 0.9, wood, p[0], 0.45, p[1]));  // crates

  // --- Royal Bedchamber (front-right courtyard room) ---
  g.add(deco(box(7, 0.05, 5, mapped(T.rug), 16, 0.11, -15, false)));                          // rug
  g.add(box(3.2, 0.7, 4.2, wood, 16, 0.35, -17));                                            // bed frame
  g.add(deco(box(3.0, 0.4, 4.0, flat(0x8a1f2a), 16, 0.75, -17)));                            // blanket
  g.add(deco(box(2.8, 0.3, 0.8, flat(0xece0c0), 16, 1.0, -18.7)));                           // pillows
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(deco(box(0.2, 2.6, 0.2, wood, 16 + sx * 1.5, 1.3, -17 + sz * 2)));  // posts
  g.add(deco(box(3.6, 0.25, 4.6, flat(0x6e1f2f), 16, 2.6, -17)));                            // canopy
  g.add(box(2.0, 2.6, 0.9, wood, 21, 1.3, -13)); g.add(deco(box(2.0, 0.2, 0.9, flat(0x3a2415), 21, 2.6, -13)));  // wardrobe
  g.add(box(1.2, 0.8, 0.8, wood, 12, 0.4, -20)); g.add(deco(box(1.25, 0.16, 0.85, flat(0x3a2415), 12, 0.85, -20)));  // chest
  g.add(deco(box(0.7, 0.6, 0.7, wood, 13.2, 0.3, -14))); g.add(deco(box(0.18, 0.4, 0.18, candle, 13.2, 0.8, -14)));  // side table + candle

  // crests beside the inner gate
  for (const sx of [-1, 1]) { g.add(deco(box(1.1, 1.3, 0.12, red, sx * 4, 3.4, 0.4))); g.add(deco(box(0.5, 0.5, 0.14, gold, sx * 4, 3.5, 0.46))); }

  // ===================== side rooms: a Library (left) and a Chapel (right) =====================
  const woodMat = mapped(T.wood), books = mapped(T.bookshelf), tile = mapped(T.tiled), rugMat = mapped(T.rug), panel = mapped(T.woodPanel),
        sgWin = new THREE.MeshStandardMaterial({ map: T.stainedGlass, emissive: 0xffffff, emissiveMap: T.stainedGlass, emissiveIntensity: 0.55, roughness: 0.3 });

  // divider walls between the central hall and each side room (doorway gap at z 8..11)
  const divider = (x) => { wallSeg(x, 0, x, 8, 5, 0.6, false); wallSeg(x, 11, x, 21, 5, 0.6, false); };
  divider(-10); divider(10);

  // --- Library (left) ---
  g.add(deco(box(12.5, 0.16, 21, woodMat, -16.2, 0.0, 10.5, false)));
  g.add(deco(box(8, 0.05, 6, rugMat, -16, 0.11, 9, false)));
  for (const z of [3, 7, 19]) g.add(deco(box(0.5, 3.4, 3.4, books, -22.0, 1.9, z)));            // shelves on the outer wall
  for (const x of [-20, -16, -12.5]) g.add(deco(box(3.4, 3.4, 0.5, books, x, 1.9, 20.5)));      // shelves on the back wall
  g.add(box(3.2, 0.95, 1.4, woodMat, -16, 0.48, 8));                                             // reading table
  g.add(deco(box(3.4, 0.12, 1.6, flat(0x4a3018), -16, 1.0, 8)));
  g.add(deco(box(0.5, 0.55, 0.5, woodMat, -16, 0.28, 9.5))); g.add(deco(box(0.5, 1.0, 0.12, woodMat, -16, 0.8, 9.75))); // chair
  g.add(deco(box(0.8, 0.1, 0.55, flat(0xece0c0), -16.4, 1.06, 8)));                              // open book
  g.add(deco(cyl(0.5, 0.55, 0.55, 12, flat(0x6a8db5), -14, 1.4, 8))); g.add(deco(cyl(0.16, 0.2, 0.5, 8, gold, -14, 1.0, 8))); // globe
  g.add(deco(box(0.14, 0.34, 0.14, candle, -17.4, 1.25, 8)));                                    // desk candle

  // --- Chapel (right) ---
  g.add(deco(box(12.5, 0.16, 21, tile, 16.2, 0.0, 10.5, false)));
  for (const z of [4, 8, 12, 16]) g.add(deco(box(0.2, 3.6, 2.2, sgWin, 22.3, 2.8, z)));          // stained-glass windows
  g.add(deco(box(2.4, 3.8, 0.2, sgWin, 16, 2.9, 20.6)));                                          // great window behind the altar
  g.add(box(2.6, 1.1, 1.2, stone, 16, 0.55, 19));                                                 // altar
  g.add(deco(box(2.9, 0.12, 1.4, flat(0x6e1f2f), 16, 1.16, 19)));
  for (const sx of [-1, 1]) { g.add(deco(cyl(0.09, 0.11, 0.8, 8, gold, 16 + sx, 1.6, 19))); g.add(deco(box(0.12, 0.34, 0.12, candle, 16 + sx, 2.2, 19))); }
  g.add(deco(box(0.22, 1.7, 0.22, gold, 16, 2.6, 19.3))); g.add(deco(box(0.95, 0.22, 0.22, gold, 16, 2.95, 19.3))); // cross
  for (const z of [9, 13]) for (const px of [13.4, 18.6]) { g.add(box(2.2, 0.45, 0.5, woodMat, px, 0.25, z)); g.add(deco(box(2.2, 0.7, 0.12, woodMat, px, 0.6, z - 0.32))); } // pews
  column(11.5, 6); column(11.5, 15);
  g.add(deco(cyl(0.7, 0.7, 0.1, 10, gold, 16, 4.6, 12)));
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.add(deco(box(0.1, 0.3, 0.1, candle, 16 + Math.cos(a) * 0.7, 4.7, 12 + Math.sin(a) * 0.7))); }

  // --- baldachin over the throne ---
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(deco(box(0.18, 4.2, 0.18, gold, sx * 1.7, 2.1, HD - 2.4 + sz)));
  g.add(deco(box(4.0, 0.3, 3.0, flat(0x6e1f2f), 0, 4.3, HD - 2.4)));
  g.add(deco(box(4.2, 0.5, 0.4, gold, 0, 4.55, HD - 3.9)));

  // --- extra grandeur: portraits, banners, sconces, urns, runner, room signs ---
  const portrait = mapped(T.portrait), heraldry = mapped(T.heraldry);
  for (const sx of [-1, 1]) for (const z of [5, 12, 18]) g.add(deco(box(0.1, 1.5, 1.1, portrait, sx * 9.78, 2.7, z)));   // hall portraits
  for (const sx of [-1, 1]) for (const z of [5.5, 16.5]) g.add(deco(box(0.1, 3.2, 1.5, heraldry, sx * 8.6, 3.5, z)));    // hanging banners
  const sconceG = (x, z) => { g.add(deco(box(0.14, 0.45, 0.14, wood, x, 2.7, z))); g.add(deco(box(0.24, 0.3, 0.24, flameMat, x, 3.0, z))); };
  for (const sx of [-1, 1]) for (const z of [3, 9, 15, -5, -11, -17]) sconceG(sx * 9.8, z);
  const urn = (x, z) => { g.add(deco(cyl(0.45, 0.3, 0.9, 10, stone, x, 0.45, z))); const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), flat(0x3f6e3a)); b.position.set(x, 1.15, z); b.scale.y = 0.9; b.castShadow = true; deco(b); g.add(b); };
  for (const sx of [-1, 1]) { urn(sx * 4, 1.5); urn(sx * 3, HD - 4.5); }
  g.add(deco(box(3, 0.06, 20, mapped(T.carpet), 0, 0.12, -11, false)));                                                 // courtyard runner
  statue(-9, -8); statue(9, -8);
  roomSign(g, 'ELDENMOOR KEEP', 0, 7.7, -22.5, Math.PI, 6, 1.3);
  roomSign(g, 'THRONE ROOM', 0, 5.6, HD - 0.8, Math.PI, 4, 0.9);
  roomSign(g, 'LIBRARY', -9.7, 3.5, 9.5, Math.PI / 2);
  roomSign(g, 'CHAPEL', 9.7, 3.5, 9.5, -Math.PI / 2);
  roomSign(g, 'ARMOURY', -9.7, 3.3, -16.5, Math.PI / 2);
  roomSign(g, 'KITCHEN', -9.7, 3.3, -5.5, Math.PI / 2);
  roomSign(g, 'BEDCHAMBER', 9.7, 3.3, -16.5, -Math.PI / 2);
  roomSign(g, 'TREASURY', 9.7, 3.3, -5.5, -Math.PI / 2);

  // --- castle exterior dressing: hanging banners along the front curtain wall ---
  const heraldryX = mapped(T.heraldry);
  for (const sx of [-1, 1]) for (const bx of [12, 17.5]) g.add(deco(box(2.0, 4.4, 0.18, heraldryX, sx * bx, 3.2, -HD - 0.5)));  // banners on the front wall
  // little gilt point-lights to warm the gate at night
  { const gl1 = new THREE.PointLight(0xffb04a, 6, 22, 2); gl1.position.set(0, 5, -24); g.add(gl1); }

  // --- staircases (right = up to the solar; left = down to the cellar) ---
  const upS = makeStairs('up', 'UPPER FLOOR'); upS.position.set(8, 0, 3); g.add(upS);
  const dnS = makeStairs('down', 'CELLAR'); dnS.position.set(-8, 0, 3); g.add(dnS);

  return g;
}

// A flight of stone steps with a sign. Decorative — the floor swap is triggered
// when the player steps onto it (see scene.userData.stairs + main.js).
function makeStairs(dir, label) {
  const g = new THREE.Group();
  const stone = flat(0x8d877c), wood = flat(0x4a3320), dark = flat(0x120f0c);
  const up = dir === 'up';
  for (let i = 0; i < 6; i++) g.add(deco(box(2.6, 0.3, 0.55, stone, 0, up ? 0.15 + i * 0.32 : -0.15 - i * 0.32, i * 0.55)));
  if (!up) g.add(deco(box(2.9, 0.1, 3.6, dark, 0, -2.0, 1.4)));
  for (const sx of [-1, 1]) g.add(deco(box(0.2, 1.1, 3.6, wood, sx * 1.45, up ? 1.4 : -0.5, 1.4)));
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.7, 0.12), new THREE.MeshStandardMaterial({ map: signTexture(label), roughness: 0.85 }));
  sign.position.set(0, 2.6, -0.4); deco(sign); g.add(sign);
  return g;
}

// A flat, always-readable sign board facing direction `ry` (radians around Y).
function roomSign(g, text, x, y, z, ry, w = 2.4, h = 0.7) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTexture(text), side: THREE.DoubleSide }));
  m.position.set(x, y, z); m.rotation.y = ry; m.userData.noCollide = true; m.renderOrder = 1; g.add(m);
}

// ---------------------------------------------------------------------------
// UPPER FLOOR — the royal apartments (open gallery with furnished zones).
// ---------------------------------------------------------------------------
function makeUpper() {
  const T = tex();
  const g = new THREE.Group();
  const HW = 22, HD = 21, WH = 3.6, TH = 0.6;
  const stone = mapped(T.wall), rugMat = mapped(T.rug), books = mapped(T.bookshelf),
        wood = flat(0x4a3320), gold = flat(0xd8b24a, 0.4), red = flat(0x8a1f1f), steel = flat(0x9aa0a8, 0.5);
  const candle = new THREE.MeshStandardMaterial({ color: 0xffe6a3, emissive: 0xffcf6a, emissiveIntensity: 1.5, roughness: 0.5 });
  const sg = new THREE.MeshStandardMaterial({ map: T.stainedGlass, emissive: 0xffffff, emissiveMap: T.stainedGlass, emissiveIntensity: 0.5, roughness: 0.3 });
  const wallSeg = (x0, z0, x1, z1, h = WH, th = TH) => { const w = Math.max(th, Math.abs(x1 - x0)), d = Math.max(th, Math.abs(z1 - z0)); g.add(box(w, h, d, stone, (x0 + x1) / 2, h / 2, (z0 + z1) / 2)); };
  const merlonRun = (x0, z0, x1, z1) => { const w = Math.max(0.1, Math.abs(x1 - x0)), d = Math.max(0.1, Math.abs(z1 - z0)); g.add(deco(coping(w + 0.1, 0.3, d + 0.1, stone, (x0 + x1) / 2, WH + 0.05, (z0 + z1) / 2))); const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.6)); for (let i = 0; i <= n; i++) { const t = i / n; g.add(deco(merlon(0.52, 0.62, 0.52, stone, x0 + (x1 - x0) * t, WH + 0.4, z0 + (z1 - z0) * t))); } };
  const sconce = (x, z) => { g.add(deco(box(0.14, 0.4, 0.14, wood, x, 2.3, z))); g.add(deco(box(0.24, 0.28, 0.24, candle, x, 2.6, z))); };
  const chandelier = (x, z, lit) => { g.add(deco(box(0.05, 1.6, 0.05, flat(0x2a2622), x, 4.4, z))); g.add(deco(cyl(0.9, 0.9, 0.12, 12, gold, x, 3.5, z))); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.add(deco(box(0.1, 0.28, 0.1, candle, x + Math.cos(a) * 0.8, 3.7, z + Math.sin(a) * 0.8))); } if (lit) { const pl = new THREE.PointLight(0xffce7a, 4, 18, 2); pl.position.set(x, 3.3, z); g.add(pl); } };

  buildGLBFloor(g, HW, HD, 0.02);                                                  // tiled modular GLB floor
  // perimeter walls = modular GLB stone (+ invisible colliders), parapet on top
  buildGLBWall(g, -HW, HD, HW, HD, WH);   wallCollider(g, -HW, HD, HW, HD, WH, TH);   merlonRun(-HW, HD, HW, HD);
  buildGLBWall(g, -HW, -HD, -HW, HD, WH); wallCollider(g, -HW, -HD, -HW, HD, WH, TH); merlonRun(-HW, -HD, -HW, HD);
  buildGLBWall(g, HW, -HD, HW, HD, WH);   wallCollider(g, HW, -HD, HW, HD, WH, TH);   merlonRun(HW, -HD, HW, HD);
  buildGLBWall(g, -HW, -HD, -6, -HD, WH); wallCollider(g, -HW, -HD, -6, -HD, WH, TH);   // front wall (balcony gap)
  buildGLBWall(g, 6, -HD, HW, -HD, WH);   wallCollider(g, 6, -HD, HW, -HD, WH, TH);
  for (let x = -6; x <= 6; x += 1.3) g.add(deco(box(0.16, 0.9, 0.16, stone, x, 0.45, -HD)));   // balcony railing
  g.add(deco(box(12.6, 0.2, 0.3, stone, 0, 0.9, -HD)));
  for (const sx of [-1, 1]) for (const z of [-12, -4, 6, 14]) g.add(deco(box(0.2, 2.4, 1.6, sg, sx * (HW - 0.04), 1.8, z)));
  for (const x of [-12, 0, 12]) g.add(deco(box(1.6, 2.4, 0.2, sg, x, 1.8, HD - 0.04)));
  for (const sx of [-1, 1]) for (const z of [-14, -6, 4, 12]) sconce(sx * (HW - 0.5), z);
  chandelier(0, 2, true); chandelier(0, 14, true);

  const dn = makeStairs('down', 'GROUND FLOOR'); dn.position.set(8, 0, 3); g.add(dn);

  // central seating + rug
  g.add(deco(box(10, 0.05, 7, rugMat, 0, 0.1, 4, false)));
  g.add(box(2.2, 0.4, 1.0, wood, -3, 0.4, 4)); g.add(deco(box(0.5, 0.7, 0.1, wood, -3, 0.9, 3.6)));     // a chair

  // Royal Solar (back-centre)
  // (royal seat is now a real glTF throne placed by castleFurniture.js)
  for (const z of [HD - 6, HD - 3]) g.add(deco(box(0.5, 2.6, 3.0, books, -HW + 0.7, 1.3, z)));               // bookshelves
  g.add(deco(box(1.2, 1.6, 0.12, mapped(T.portrait), 5, 2.2, HD - 0.3)));                                     // royal portrait
  g.add(deco(box(0.5, 3.0, 3.0, stone, HW - 0.3, 1.5, HD - 4)));                                              // fireplace breast
  g.add(deco(box(0.5, 1.0, 2.0, new THREE.MeshStandardMaterial({ color: 0xff7a1e, emissive: 0xff5500, emissiveIntensity: 1.1, roughness: 0.7 }), HW - 0.5, 0.6, HD - 4)));

  // War Room (left)
  g.add(box(5, 0.9, 3.4, wood, -13, 0.45, -10)); g.add(deco(box(5.2, 0.1, 3.6, flat(0x3f6e3a), -13, 0.95, -10)));   // map table
  for (let i = 0; i < 8; i++) g.add(deco(box(0.2, 0.4, 0.2, i % 2 ? steel : gold, -15 + (i % 4) * 1.3, 1.2, -11 + (i > 3 ? 1.4 : 0))));
  for (const sx of [-1, 1]) g.add(deco(box(1.6, 2.6, 0.1, mapped(T.heraldry), -13 + sx * 2.4, 2.0, -13)));

  // Royal Bedchamber (right)
  g.add(box(3.2, 0.7, 4.2, wood, 13, 0.35, -12)); g.add(deco(box(3.0, 0.4, 4.0, red, 13, 0.75, -12)));
  g.add(deco(box(2.8, 0.3, 0.8, flat(0xece0c0), 13, 1.0, -13.7)));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(deco(box(0.2, 2.6, 0.2, wood, 13 + sx * 1.5, 1.3, -12 + sz * 2)));
  g.add(deco(box(3.6, 0.25, 4.6, flat(0x6e1f2f), 13, 2.6, -12)));
  g.add(box(2.0, 2.6, 0.9, wood, 19, 1.3, -8));                                                               // wardrobe

  // --- upper-floor detail + signs ---
  const portraitU = mapped(T.portrait);
  roomSign(g, 'ROYAL SOLAR', 0, 3.1, HD - 5.5, Math.PI);
  roomSign(g, 'WAR ROOM', -13, 3.1, -5.5, 0);
  roomSign(g, 'ROYAL BEDCHAMBER', 13, 3.1, -6.5, 0);
  roomSign(g, 'BALCONY', 0, 2.4, -HD + 2, 0, 3, 0.8);
  g.add(box(2.4, 0.9, 1.1, wood, -5, 0.45, HD - 4));                                                          // writing desk
  g.add(deco(box(0.8, 0.1, 0.55, flat(0xece0c0), -5.2, 0.96, HD - 4)));
  g.add(deco(cyl(0.5, 0.55, 0.55, 12, flat(0x6a8db5), -7, 1.3, HD - 4)));                                     // globe
  g.add(deco(box(0.6, 0.9, 0.25, wood, 6, 1.0, HD - 4))); g.add(deco(box(0.14, 1.3, 0.14, wood, 6, 1.9, HD - 4)));   // lute
  for (const sx of [-1, 1]) { g.add(deco(cyl(0.16, 0.2, 1.6, 8, gold, sx * 5, 0.8, HD - 1.6))); g.add(deco(box(0.22, 0.3, 0.22, candle, sx * 5, 1.7, HD - 1.6))); }
  g.add(box(0.4, 1.6, 2.6, wood, -HW + 0.6, 0.8, -6));                                                        // war-room scroll rack
  for (let i = 0; i < 4; i++) g.add(deco(cyl(0.09, 0.09, 0.5, 6, flat(0xece0c0), -HW + 0.9, 1.0 + (i % 2) * 0.5, -7 + i * 0.5)));
  for (let i = 0; i < 6; i++) g.add(deco(box(0.18, 0.42, 0.18, i % 2 ? steel : gold, -15 + (i % 3) * 1.4, 1.2, -8.6)));
  g.add(deco(box(0.7, 0.6, 0.7, wood, 9.5, 0.3, -13.5))); g.add(deco(box(0.18, 0.4, 0.18, candle, 9.5, 0.8, -13.5)));   // nightstand
  g.add(box(1.3, 0.7, 0.8, wood, 9.5, 0.35, -9)); g.add(deco(box(1.1, 0.16, 0.7, flat(0x3a2415), 9.5, 0.78, -9)));     // chest
  g.add(deco(box(0.2, 2.2, 1.0, flat(0x9ec6d8), 17, 1.3, -14)));                                              // mirror
  for (const sx of [-1, 1]) { g.add(deco(cyl(0.4, 0.3, 0.7, 8, stone, sx * 9, 0.35, -HD + 2))); const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), flat(0x3f6e3a)); b.position.set(sx * 9, 1.0, -HD + 2); deco(b); g.add(b); }
  g.add(deco(cyl(0.1, 0.1, 1.3, 8, flat(0x2a2a30), 0, 0.9, -HD + 3))); g.add(deco(cyl(0.16, 0.1, 0.6, 8, gold, 0.4, 1.5, -HD + 3.4)));   // telescope
  for (const sx of [-1, 1]) g.add(box(2.2, 0.4, 0.5, wood, sx * 4, 0.2, -HD + 3.2));                          // benches
  for (const z of [-8, 4, 14]) { g.add(deco(box(0.1, 1.4, 1.0, portraitU, -HW + 0.3, 2.4, z))); g.add(deco(box(0.1, 1.4, 1.0, portraitU, HW - 0.3, 2.4, z))); }
  for (const sx of [-1, 1]) for (const z of [-10, 0, 10]) sconce(sx * (HW - 0.5), z);
  chandelier(0, -8, false);

  // --- richly furnish the royal floor (rugs, council hall, library wall, hearth) ---
  const tapU = mapped(T.tapestry), tapB2 = mapped(T.tapestryB);
  g.add(deco(box(12, 0.05, 8, rugMat, 0, 0.1, HD - 6, false)));                              // solar rug
  g.add(deco(box(9, 0.05, 9, mapped(T.carpet), -13, 0.1, -7, false)));                       // war-room runner
  g.add(deco(box(8, 0.05, 8, rugMat, 13, 0.1, -10, false)));                                 // bedchamber rug
  const baluster = (x0, z0, x1, z1) => { const dx = x1 - x0, dz = z1 - z0, n = Math.max(1, Math.round(Math.hypot(dx, dz) / 0.7)); for (let i = 0; i <= n; i++) { const t = i / n; g.add(deco(cyl(0.07, 0.09, 0.85, 8, stone, x0 + dx * t, 0.42, z0 + dz * t))); } g.add(deco(box(Math.max(0.1, Math.abs(dx)) + 0.12, 0.16, Math.max(0.1, Math.abs(dz)) + 0.12, stone, (x0 + x1) / 2, 0.9, (z0 + z1) / 2))); };
  baluster(-11, -3, -11, 6); baluster(11, -3, 11, 6);
  // council table + chairs + candelabra (solar)
  g.add(box(2.2, 0.85, 6, wood, 0, 0.42, HD - 6)); g.add(deco(box(2.4, 0.12, 6.2, flat(0x5a3a22), 0, 0.9, HD - 6)));
  for (const sz of [HD - 8, HD - 6, HD - 4]) for (const sx of [-1, 1]) { g.add(box(0.5, 0.5, 0.5, wood, sx * 1.7, 0.25, sz)); g.add(deco(box(0.5, 0.8, 0.12, wood, sx * 1.95, 0.7, sz))); }
  for (const sz of [HD - 7.5, HD - 4.5]) { g.add(deco(cyl(0.1, 0.13, 0.4, 8, gold, 0, 1.1, sz))); g.add(deco(box(0.14, 0.26, 0.14, candle, 0, 1.4, sz))); }
  // back-wall library + tapestries
  for (const x of [-19, -15, 15, 19]) g.add(deco(box(3.4, 2.6, 0.4, books, x, 1.3, HD - 0.4)));
  g.add(deco(box(2.4, 3.0, 0.1, tapU, -8.5, 1.9, HD - 0.3))); g.add(deco(box(2.4, 3.0, 0.1, tapB2, 8.5, 1.9, HD - 0.3)));
  // hearth on the left wall + mantel
  g.add(deco(box(0.4, 3.0, 3, stone, -HW + 0.2, 1.5, 3))); g.add(deco(box(0.5, 1.2, 2, new THREE.MeshStandardMaterial({ color: 0xff7a1e, emissive: 0xff5500, emissiveIntensity: 1.1, roughness: 0.7 }), -HW + 0.45, 0.7, 3))); g.add(deco(box(0.7, 0.3, 3.4, stone, -HW + 0.3, 3.1, 3)));
  // potted plants in the corners + wall portraits
  const plant = (x, z) => { g.add(deco(cyl(0.34, 0.26, 0.6, 8, stone, x, 0.3, z))); const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), flat(0x3f6e3a)); b.position.set(x, 0.95, z); b.castShadow = true; deco(b); g.add(b); };
  for (const p of [[-HW + 1.5, -HD + 2], [HW - 1.5, -HD + 2], [-HW + 1.5, HD - 2], [HW - 1.5, HD - 2]]) plant(p[0], p[1]);
  for (const z of [-12, -2]) { g.add(deco(box(0.1, 1.3, 0.95, portraitU, -HW + 0.3, 2.3, z))); g.add(deco(box(0.1, 1.3, 0.95, portraitU, HW - 0.3, 2.3, z))); }

  return g;
}

// ---------------------------------------------------------------------------
// BASEMENT — cellar / dungeon / crypt / vault (dark, torch-lit).
// ---------------------------------------------------------------------------
function makeBasement() {
  const T = tex();
  const g = new THREE.Group();
  const HW = 22, HD = 21, WH = 4, TH = 0.7;
  const stone = mapped(T.wall, 0x6f6a60),
        wood = flat(0x4a3320), dark = flat(0x141210), bone = flat(0xcfc8b6), gold = flat(0xd8b24a, 0.4);
  const torchM = new THREE.MeshStandardMaterial({ color: 0xffb33a, emissive: 0xff7b00, emissiveIntensity: 1.8, roughness: 0.5 });
  const wallSeg = (x0, z0, x1, z1, h = WH, th = TH) => { const w = Math.max(th, Math.abs(x1 - x0)), d = Math.max(th, Math.abs(z1 - z0)); g.add(box(w, h, d, stone, (x0 + x1) / 2, h / 2, (z0 + z1) / 2)); };
  const torch = (x, z, lit) => { g.add(deco(box(0.14, 0.5, 0.14, wood, x, 2.0, z))); g.add(deco(box(0.24, 0.3, 0.24, torchM, x, 2.4, z))); if (lit) { const pl = new THREE.PointLight(0xffa53a, 5, 13, 2); pl.position.set(x, 2.4, z); g.add(pl); } };
  const bars = (x0, z0, x1, z1) => { const n = Math.max(2, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.5)); for (let i = 0; i <= n; i++) { const t = i / n; g.add(deco(box(0.1, 2.6, 0.1, dark, x0 + (x1 - x0) * t, 1.3, z0 + (z1 - z0) * t))); } };

  buildGLBFloor(g, HW, HD, 0.02);                                                 // tiled modular GLB floor
  // perimeter walls = modular GLB stone (+ invisible colliders); cellar is fully enclosed
  buildGLBWall(g, -HW, HD, HW, HD, WH);   wallCollider(g, -HW, HD, HW, HD, WH, TH);
  buildGLBWall(g, -HW, -HD, -HW, HD, WH); wallCollider(g, -HW, -HD, -HW, HD, WH, TH);
  buildGLBWall(g, HW, -HD, HW, HD, WH);   wallCollider(g, HW, -HD, HW, HD, WH, TH);
  buildGLBWall(g, -HW, -HD, HW, -HD, WH); wallCollider(g, -HW, -HD, HW, -HD, WH, TH);
  for (const sx of [-1, 1]) for (const z of [-14, -2, 10]) torch(sx * (HW - 0.6), z, true);
  torch(-6, 18, false); torch(6, 18, false);

  const up = makeStairs('up', 'GROUND FLOOR'); up.position.set(-8, 0, 3); g.add(up);

  // Wine cellar (left)
  for (const z of [-16, -13, -10]) for (const sx of [0, 1]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.6, 12), wood); b.rotation.z = Math.PI / 2; b.position.set(-HW + 2.5 + sx * 1.6, 0.7, z); deco(b); g.add(b); }
  g.add(deco(box(0.4, 2.4, 7, wood, -HW + 0.6, 1.2, -13)));

  // Dungeon cells (back-left)
  wallSeg(-HW, 6, -12, 6, WH, 0.5); wallSeg(-12, 6, -12, 18, WH, 0.5);
  bars(-12, 6, -12, 11); bars(-12, 13, -12, 18);                                   // barred fronts (gap z11-13 = cell door)
  bars(-HW, 12, -12, 12);                                                          // divider between two cells
  g.add(deco(box(1.6, 0.4, 0.6, wood, -17, 0.25, 8))); g.add(deco(box(1.6, 0.4, 0.6, wood, -17, 0.25, 15)));   // cots

  // Crypt (back-right)
  for (const z of [9, 13, 17]) { g.add(box(2.4, 1.0, 1.2, stone, HW - 3, 0.5, z)); g.add(deco(box(2.6, 0.12, 1.4, stone, HW - 3, 1.06, z))); g.add(deco(box(0.4, 0.5, 1.2, bone, HW - 1.3, 0.3, z))); }
  for (const sx of [-1, 1]) g.add(deco(box(1.4, 1.4, 0.04, new THREE.MeshStandardMaterial({ color: 0xdfdcd0, transparent: true, opacity: 0.22 }), HW - 0.8, 3.0, 13)));

  // Vault (centre-back)
  g.add(box(3.0, 2.6, 0.6, flat(0x55585e), 0, 1.3, HD - 0.6)); g.add(deco(cyl(0.5, 0.5, 0.16, 12, gold, 0, 1.3, HD - 0.9)));
  for (const p of [[-1.5, HD - 3], [-0.6, HD - 3], [0.4, HD - 3.4], [1.3, HD - 3]]) g.add(deco(box(0.6, 0.5, 0.6, gold, p[0], 0.25, p[1])));
  for (const cx of [-2, 2]) { g.add(box(1.3, 0.8, 0.9, wood, cx, 0.4, HD - 4)); g.add(deco(box(1.1, 0.34, 0.7, gold, cx, 0.85, HD - 4))); }

  // Storeroom (centre-front) — crates are real glTF models (castleFurniture.js)
  for (const p of [[0, -15], [1.2, -15], [-1.2, -15.4]]) g.add(deco(cyl(0.5, 0.6, 0.9, 8, flat(0xc9a24a), p[0], 0.45, p[1])));

  // --- basement detail + signs ---
  const gem = (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.3 });
  roomSign(g, 'WINE CELLAR', -HW + 3, 2.4, -7, Math.PI / 2);
  roomSign(g, 'DUNGEON', -16, 2.6, 5, 0);
  roomSign(g, 'CRYPT', HW - 4, 2.6, 7, 0);
  roomSign(g, 'VAULT', 0, 2.6, HD - 3.5, Math.PI);
  roomSign(g, 'STOREROOM', 0, 2.2, -16.5, 0);
  for (const sx of [-1, 1]) for (const z of [-6, 8]) { g.add(cyl(0.6, 0.7, WH, 10, stone, sx * 7, WH / 2, z)); g.add(deco(box(1.2, 0.4, 1.2, stone, sx * 7, WH - 0.2, z))); }   // vaulted pillars
  for (const sx of [-1, 1]) g.add(deco(box(0.6, 0.5, 15, stone, sx * 7, WH - 0.1, 1)));                        // arch beams
  g.add(deco(box(0.3, 0.12, 1.4, bone, -18, 0.32, 15))); g.add(deco(box(0.4, 0.4, 0.4, bone, -18, 0.42, 14.2)));   // skeleton
  for (const z of [8, 16]) { g.add(deco(box(0.05, 1.2, 0.05, dark, -21.8, 1.6, z))); g.add(deco(box(0.2, 0.2, 0.2, flat(0x55585e), -21.8, 1.0, z))); }   // chains + manacles
  g.add(box(1.6, 0.6, 0.5, wood, -14.5, 0.3, 8.5)); g.add(deco(box(0.2, 1.2, 0.2, wood, -15.2, 0.6, 8.5)));    // rack
  for (const p of [[-19, 9], [-16.5, 16.5]]) g.add(deco(box(1.2, 0.16, 1.2, flat(0xc9a24a), p[0], 0.12, p[1])));   // straw
  g.add(deco(box(0.5, 0.3, 1.6, bone, HW - 3, 1.18, 13)));                                                     // effigy on a tomb
  for (const z of [9, 17]) { g.add(deco(cyl(0.14, 0.18, 1.4, 8, dark, HW - 5, 0.7, z))); g.add(deco(box(0.22, 0.3, 0.22, torchM, HW - 5, 1.5, z))); }   // crypt candelabra
  for (const p of [[HW - 1.4, 11], [HW - 1.6, 15]]) g.add(deco(box(0.32, 0.3, 0.28, bone, p[0], 0.25, p[1])));   // skulls
  g.add(box(0.4, 2.2, 5, wood, -HW + 0.5, 1.1, -10));                                                          // wine rack
  for (let i = 0; i < 12; i++) g.add(deco(box(0.18, 0.5, 0.18, gem(0x3a6e3a), -HW + 0.95, 0.6 + (i % 3) * 0.6, -12 + Math.floor(i / 3) * 1.2)));
  g.add(box(1.6, 0.8, 1.0, wood, -18, 0.4, -6)); for (const sx of [-1, 1]) g.add(deco(cyl(0.06, 0.08, 0.2, 6, gold, -18 + sx * 0.4, 0.9, -6)));   // tasting table
  for (const p of [[-1.5, HD - 5], [0, HD - 5.5], [1.5, HD - 5]]) g.add(deco(cyl(0.6, 0, 0.5, 8, gold, p[0], 0.25, p[1])));   // gold piles
  for (const c of [[0xc0392b, -1.2], [0x2980b9, -0.3], [0x27ae60, 0.6], [0xd4ac0d, 1.4]]) g.add(deco(box(0.22, 0.2, 0.22, gem(c[0]), c[1], 0.2, HD - 4.4)));   // gems
  for (const p of [[-3, -16], [-2, -16.5], [-3.5, -15.3], [3, -16], [2.2, -16.6]]) g.add(deco(cyl(0.45, 0.55, 0.9, 8, flat(0xb8a06a), p[0], 0.45, p[1])));   // grain sacks
  for (const x of [-1, 0.6]) { g.add(deco(box(0.06, 0.8, 0.06, dark, x, 2.0, -18))); g.add(deco(box(0.4, 0.5, 0.3, flat(0x8a3a2a), x, 1.4, -18))); }   // hanging meat
  torch(0, -2, true); torch(-3, HD - 6, true); torch(3, HD - 6, true);                                        // more torches

  return g;
}

// A cosy tavern — enterable, with a hideable roof, a bar, a hearth and tables.
function makeTavern() {
  const T = tex();
  const g = new THREE.Group();
  const HW = 6.5, HD = 5.5, H = 3.6, TH = 0.4, DOOR = 1.7;
  const wallMat = mapped(T.plaster, 0xb89a6a), beam = flat(0x4a3220), floorMat = mapped(T.wood),
        woodMat = flat(0x6b4a2c), stoneMat = mapped(T.wall);
  const glass = new THREE.MeshStandardMaterial({ color: 0x86bcd6, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.55 });
  const ember = new THREE.MeshStandardMaterial({ color: 0xff7a1e, emissive: 0xff5500, emissiveIntensity: 1.1, roughness: 0.7 });
  const candle = new THREE.MeshStandardMaterial({ color: 0xffe6a3, emissive: 0xffb142, emissiveIntensity: 1.3, roughness: 0.5 });
  const shell = new THREE.Group();
  const wallSeg = (x0, z0, x1, z1) => { const w = Math.max(TH, Math.abs(x1 - x0)), d = Math.max(TH, Math.abs(z1 - z0)); shell.add(box(w, H, d, wallMat, (x0 + x1) / 2, H / 2, (z0 + z1) / 2)); };

  g.add(deco(box(HW * 2, 0.2, HD * 2, floorMat, 0, 0.06, 0, false)));
  wallSeg(-HW, -HD, HW, -HD);                                   // back
  wallSeg(-HW, -HD, -HW, HD); wallSeg(HW, -HD, HW, HD);         // sides
  wallSeg(-HW, HD, -DOOR, HD); wallSeg(DOOR, HD, HW, HD);       // front (door faces +z, the town)
  for (const sx of [-1, 1]) shell.add(box(0.3, 2.6, 0.5, beam, sx * DOOR, 1.3, HD));
  shell.add(box(DOOR * 2 + 0.6, 0.4, 0.5, beam, 0, 2.6, HD));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) shell.add(box(0.3, H, 0.3, beam, sx * HW, H / 2, sz * HD));
  for (const sz of [-1, 1]) shell.add(deco(box(HW * 2, 0.25, 0.32, beam, 0, H - 0.5, sz * HD)));
  for (const sz of [-2.5, 2.5]) for (const sx of [-1, 1]) {
    const wx = sx * (HW - 0.02);
    shell.add(deco(box(0.18, 1.3, 1.5, glass, wx, 1.9, sz)));
    shell.add(deco(box(0.16, 0.14, 1.9, beam, wx, 2.6, sz))); shell.add(deco(box(0.16, 0.14, 1.9, beam, wx, 1.2, sz)));
    for (const ss of [-1, 1]) { shell.add(deco(box(0.16, 1.5, 0.14, beam, wx, 1.9, sz + ss * 0.85))); shell.add(deco(box(0.1, 1.3, 0.42, flat(0x5a3a22), wx + sx * 0.1, 1.9, sz + ss * 0.6))); }
    shell.add(deco(box(0.22, 0.16, 1.0, flat(0x4a3018), wx + sx * 0.12, 1.18, sz)));
    for (let i = 0; i < 4; i++) shell.add(deco(box(0.1, 0.18, 0.1, flat([0xc0392b, 0xd4ac0d, 0x8e44ad, 0xe6e6e6][i]), wx + sx * 0.18, 1.34, sz - 0.36 + i * 0.24)));
  }
  g.add(shell); g.userData.shell = shell;
  // hideable roof + chimney + signpost
  const roof = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), mapped(T.shingle, 0x5a3a2a)); cone.scale.set(HW + 1.4, 3.6, HD + 1.4); cone.position.y = H + 1.7; cone.rotation.y = Math.PI / 4; cone.castShadow = true; deco(cone); roof.add(cone);
  roof.add(deco(box(HW * 2 + 1.6, 0.35, HD * 2 + 1.6, beam, 0, H + 0.05, 0)));
  roof.add(deco(box(0.8, 2.4, 0.8, stoneMat, HW - 1.4, H + 1.7, -HD + 1.4)));
  roof.add(deco(cyl(0.05, 0.05, 0.6, 8, flat(0x3a2418), 0, H + 3.5, 0)));
  { const fin = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 8), flat(0xd8b24a)); fin.position.set(0, H + 3.9, 0); deco(fin); roof.add(fin); }
  g.add(roof);
  // bar, hearth, chandelier, barrels — real GLB furniture
  placeFurn(g, 'house_Shelf_1', 0, -HD + 1.4, 0, 1.1);                       // bar counter
  placeFurn(g, 'house_Bookshelf', 0, -HD + 0.35, 0, 2.4);                    // back-bar shelving (bottles)
  placeFurn(g, 'house_Fireplace', HW - 0.8, -HD + 3, -Math.PI / 2, 2.6);     // hearth on the right wall
  { const pl = new THREE.PointLight(0xffa53a, 4, 14, 2); pl.position.set(HW - 2, 1.4, -HD + 3); g.add(pl); }
  placeFurn(g, 'house_Light_Chandelier', 0, 1, 0, 1.0, 2.5);                 // hanging chandelier
  for (const p of [[-HW + 1, HD - 1.5], [HW - 1, HD - 2]]) placeFurn(g, 'med_Barrel', p[0], p[1], Math.random() * 6, 1.1);
  // tables + chairs — wooden table tops with real GLB chairs around them
  const table = (x, z) => {
    g.add(box(1.5, 0.85, 1.5, woodMat, x, 0.42, z)); g.add(deco(box(1.7, 0.12, 1.7, flat(0x5a3a22), x, 0.9, z)));
    for (let a = 0; a < 4; a++) { const an = a / 4 * Math.PI * 2; placeFurn(g, 'house_Chair_1', x + Math.cos(an) * 1.25, z + Math.sin(an) * 1.25, -an + Math.PI / 2, 0.95); }
    g.add(deco(cyl(0.12, 0.14, 0.22, 8, flat(0xb8a06a), x + 0.3, 1.05, z)));
  };
  table(2.8, 2.6); table(-2.8, 2.6); table(2.8, -1); table(-3, -1.5);

  g.userData.roof = roof; g.userData.hw = HW + 0.8; g.userData.hd = HD + 0.8;
  return g;
}

function footprintOf(b) {
  return { minX: b.position.x - b.userData.hw, maxX: b.position.x + b.userData.hw, minZ: b.position.z - b.userData.hd, maxZ: b.position.z + b.userData.hd };
}

export function buildStructures(scene) {
  const castle = makeCastle(); castle.position.set(0, 0, 46); scene.add(castle);

  const general = makeShop({ wall: 0xcdb98c, roof: 0x7a4a2a, wares: [0x8a1f1f, 0x2f6ea5, 0xc9a24a, 0x3f6e44, 0x9a6a2a] });
  general.position.set(-15, 0, 12); scene.add(general);

  const axes = makeShop({ wall: 0x9a9690, roof: 0x46586a, wares: [0x8a8f96, 0x5fb0e6, 0x9a6cff, 0xc9a24a, 0x6e3a3a] });
  axes.position.set(15, 0, 12); scene.add(axes);

  const tavern = makeTavern(); tavern.position.set(-16, 0, -14); scene.add(tavern);

  // upper floor + basement (hidden until you take the stairs)
  const upper = makeUpper(); upper.position.set(0, 0, 46); upper.visible = false; scene.add(upper);
  const basement = makeBasement(); basement.position.set(0, 0, 46); basement.visible = false; scene.add(basement);

  scene.userData.buildings = [castle, general, axes, tavern];
  scene.userData.upperBuildings = [upper];
  scene.userData.basementBuildings = [basement];
  scene.userData.keep = { ground: castle, upper, basement };
  (scene.userData.outdoor = scene.userData.outdoor || []).push(general, axes, tavern);
  // Shops whose exterior shell can be swapped for a glTF building (storeModels.js).
  scene.userData.shops = [
    { group: general, x: -15, z: 12, glb: 'inn', face: -1 },  // door faces -z
    { group: axes, x: 15, z: 12, glb: 'inn', face: -1 },
    { group: tavern, x: -16, z: -14, glb: 'inn', face: 1 },   // door faces +z
  ];
  scene.userData.stairs = [
    { floor: 0, x: 8, z: 49, r: 1.7, to: 1, lx: 8, lz: 52 },    // ground → upper
    { floor: 0, x: -8, z: 49, r: 1.7, to: -1, lx: -8, lz: 52 }, // ground → cellar
    { floor: 1, x: 8, z: 49, r: 1.7, to: 0, lx: 8, lz: 52 },    // upper → ground
    { floor: -1, x: -8, z: 49, r: 1.7, to: 0, lx: -8, lz: 52 }, // cellar → ground
  ];
  scene.userData.enterables = [
    { roof: general.userData.roof, footprint: footprintOf(general) },
    { roof: axes.userData.roof, footprint: footprintOf(axes) },
    { roof: tavern.userData.roof, footprint: footprintOf(tavern) },
  ];
}
