// world.js — builds the zone you walk around in.
// Sky, fog, sunlight, the ground, and scattered trees / rocks / grass.

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js';
import { buildStructures, STRUCTURES } from './buildings.js';
import { buildTown, townStructures } from './town.js';
import { buildWater, waterStructures } from './water.js';
import { grassTexture, dirtTexture, pathTexture } from './textures.js';
import { gameMessage } from './ui.js';

// --- Low-poly GLB scenery pipeline ------------------------------------------
// The trees, rocks, bushes, grass, flowers and town props are now real
// downloaded low-poly, vertex-coloured GLBs (Quaternius / medieval_village).
// Each file is a single mesh with one vertex-coloured material, so:
//   * repeated decorative scatter (grass, flowers, bushes, plants, fences) is
//     drawn as a single THREE.InstancedMesh per model — one draw call for the
//     whole field, which keeps the deliberately-short draw distance fast.
//   * trees and rocks stay individual cloned objects because gameplay needs
//     them addressable (Woodcutting raycasts each tree, shakes it, hides its
//     foliage; collision reads each tree/rock position + scale). Clones share
//     the loaded geometry + material, so they are cheap on memory.
// Everything is tagged userData.__toonDone so the global cel-shade pass leaves
// these already-stylised models alone, and pushed into scene.userData.outdoor
// so it hides when the player goes upstairs / underground.
const ENV = './assets/models/env/';
const gltfLoader = new GLTFLoader();
const protoCache = {};   // name -> Promise<{ geometry, material, size }>

// Load a single-mesh GLB once and resolve its baked geometry + material in a
// y-up, foot-on-ground frame. We bake the GLB's own node transforms into the
// geometry so a bare InstancedMesh / cloned Mesh reproduces the model faithfully,
// and recentre it on XZ with its base at y=0.
function loadProto(name) {
  if (!protoCache[name]) {
    protoCache[name] = new Promise((resolve, reject) => {
      gltfLoader.load(ENV + name + '.glb', (gltf) => {
        // These low-poly models are one glTF mesh but often SEVERAL primitives
        // (e.g. a tree's trunk + its leaf canopy), which GLTFLoader splits into
        // separate child meshes each with its own coloured material. Collect ALL
        // of them and merge into a single grouped geometry + material array, so
        // the canopy isn't dropped (the old "first mesh only" lost the leaves).
        gltf.scene.updateWorldMatrix(true, true);
        const geos = [], mats = [];
        gltf.scene.traverse((o) => {
          if (!o.isMesh) return;
          let g = o.geometry.clone();
          g.applyMatrix4(o.matrixWorld);                 // bake node transforms in
          for (const a of Object.keys(g.attributes)) { if (a !== 'position' && a !== 'normal') g.deleteAttribute(a); }
          if (g.index) g = g.toNonIndexed();             // uniform for a clean merge
          geos.push(g);
          const m = o.material.isMaterial ? o.material : o.material[0];
          m.userData.__toonDone = true;
          mats.push(m);
        });
        if (!geos.length) { reject(new Error('no mesh in ' + name)); return; }
        const geometry = geos.length === 1 ? geos[0] : mergeGeometries(geos, true); // useGroups -> per-material groups
        const material = geos.length === 1 ? mats[0] : mats;
        geometry.computeBoundingBox();
        const bb = geometry.boundingBox;
        const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
        geometry.translate(-cx, -bb.min.y, -cz);       // centre XZ, base at y=0
        geometry.computeBoundingBox();
        resolve({ geometry, material, size: geometry.boundingBox.getSize(new THREE.Vector3()) });
      }, undefined, reject);
    });
  }
  return protoCache[name];
}

// Build one InstancedMesh covering many placements of a model. `placements` is
// an array of { x, z, ry, s, y }. Loaded async; added to the scene + outdoor
// list when ready. shadow=false for the cheap, plentiful ground cover.
function instanceScatter(scene, name, placements, { shadow = true, tint = false } = {}) {
  if (!placements.length) return;
  loadProto(name).then(({ geometry, material }) => {
    const inst = new THREE.InstancedMesh(geometry, material, placements.length);
    inst.castShadow = shadow; inst.receiveShadow = true;
    inst.userData.__toonDone = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(),
      p = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    placements.forEach((pl, i) => {
      q.setFromAxisAngle(up, pl.ry || 0);
      p.set(pl.x, pl.y || 0, pl.z);
      // gentle per-instance non-uniform scale so a field of clones never looks
      // mechanically identical — a touch taller/shorter and wider/thinner.
      const s = pl.s || 1;
      sc.set(s * (0.88 + Math.random() * 0.24), s * (0.85 + Math.random() * 0.35), s * (0.88 + Math.random() * 0.24));
      m.compose(p, q, sc);
      inst.setMatrixAt(i, m);
    });
    inst.instanceMatrix.needsUpdate = true;
    // Subtle per-instance colour variation (warmer/cooler, lighter/darker green)
    // so ground cover reads as a varied living meadow, not stamped copies. Only
    // applied where it reads well (grass/plants), driven by setColorAt.
    if (tint) {
      const col = new THREE.Color();
      for (let i = 0; i < placements.length; i++) {
        const h = 0.22 + (Math.random() - 0.5) * 0.06;   // green band, slight hue jitter
        const s = 0.45 + Math.random() * 0.25;
        const l = 0.46 + (Math.random() - 0.5) * 0.22;
        col.setHSL(h, s, l);
        inst.setColorAt(i, col);
      }
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    }
    scene.add(inst);
    (scene.userData.outdoor = scene.userData.outdoor || []).push(inst);
  }).catch((e) => console.error('[world] instance load failed', name, e));
}

// Attach a cloned GLB mesh into an existing (already-positioned, already-collidable)
// host group once its model finishes loading. Used for trees + rocks so collision,
// which is built synchronously, already sees the host's position/scale. The clone
// shares the proto's geometry + material across all instances of that model, and
// is scaled to `targetH` world-height (compensating for the host's own scale) so
// models of differing native size read at a consistent height.
function attachClone(host, name, { shadow = true, targetH, keepHostScale = false, onMesh } = {}) {
  loadProto(name).then(({ geometry, material, size }) => {
    const mesh = new THREE.Mesh(geometry, material);   // shares geo+mat across clones
    mesh.castShadow = shadow; mesh.receiveShadow = true;
    mesh.userData.__toonDone = true;
    if (targetH) {
      // Normalise each model's differing native size to `targetH`. For trees we
      // also divide out the host's scale so the trunk reads at the intended
      // height regardless of the (collision-driving) host scale; for rocks we
      // keep the host scale so the per-instance size variation is preserved.
      const hostS = keepHostScale ? 1 : (host.scale.x || 1);
      mesh.scale.setScalar((targetH / (size.y || 1)) / hostS);
    }
    host.add(mesh);
    if (onMesh) onMesh(mesh);
  }).catch((e) => console.error('[world] clone load failed', name, e));
}

// The pond sits here. We also keep trees from spawning on top of it.
const POND = { x: 22, z: -16, r: 6 };
let EXTRA = [];   // extra tree-avoidance footprints from the town

export function buildWorld(scene) {
  // --- Atmosphere: a warm golden-hour fantasy sky + depth fog ---------------
  // A soft, slightly hazy horizon colour drives both the fog and the sky's lower
  // band so the far scenery melts into the same warm light. Fog is pulled in a
  // little and given a gentle gradient so distant towers read with airy depth
  // without crushing the foreground or blowing out the cel-shaded mid-tones.
  const HORIZON = 0xecd9b6;            // warm hazy gold at the skyline
  scene.background = new THREE.Color(HORIZON);
  // Warm, slightly denser haze that starts a touch further out so the foreground
  // meadow stays crisp while distant towers melt into golden light. Far stays at
  // 150 (perf): the draw distance is NOT increased, only the near edge eased back.
  scene.fog = new THREE.Fog(0xe6d6b0, 62, 168);   // warmer golden haze, eased in a touch so distance reads with depth (far unchanged — perf)
  scene.userData.outdoor = [];        // scenery toggled off when you go upstairs / underground

  // Custom gradient sky dome (deep blue zenith -> warm gold horizon glow) with a
  // soft sun bloom painted near the sun's bearing. Built locally so we can tune
  // the golden-hour palette without touching the shared texture helpers.
  const sky = goldenSkyDome();
  sky.visible = false;                          // replaced by the real cubemap sky below
  scene.add(sky); scene.userData.sky = sky;
  // Real photographic skybox (CC0 cube faces) in place of the procedural dome.
  new THREE.CubeTextureLoader().setPath('./assets/textures/sky/')
    .load(['px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg'], (cube) => {
      cube.colorSpace = THREE.SRGBColorSpace;
      scene.background = cube;
    });

  // A few cheap, soft cloud puffs drifting high overhead for a touch of sky life.
  const clouds = makeClouds();
  scene.add(clouds); scene.userData.clouds = clouds;
  scene.userData.outdoor.push(clouds);

  // --- Lights ---------------------------------------------------------------
  // Hemisphere fill: warm light from the sky, earthy bounce from the ground.
  // Kept gentle so the flat toon bands stay readable and shadows don't go inky.
  // NOTE: base surface intensity stays 1.0 so the floor-toggle in main.js (which
  // resets this to 1.0 above ground) matches what we set here.
  // Warmer sky tint + a slightly lifted, warmer earthy ground bounce so the
  // deepest cel-shade bands under the canopy never read as muddy black — the
  // realm stays sunlit, not gloomy. Driven through hemi (not a separate ambient)
  // so main.js's floor-toggle still dims it correctly when you go underground.
  const hemi = new THREE.HemisphereLight(0xfbe6bd, 0x6a5836, 0.92);
  scene.add(hemi); scene.userData.hemi = hemi;

  // The "sun": a warm directional key that casts the shadows. Lowered + swung
  // toward the horizon for a longer, golden-hour rake across the smooth forms.
  // Intensity stays 2.7 to match main.js's surface reset.
  const sun = new THREE.DirectionalLight(0xffd79a, 2.95);
  scene.userData.sun = sun;
  sun.position.set(54, 34, 22);                 // lower, more side-on golden-hour rake for longer shadows + lit stone faces
  sun.castShadow = true;
  // 1024² instead of 2048² — quarter the shadow-pass fragment work for a barely
  // perceptible softness change under the cel-shade bands.
  sun.shadow.mapSize.set(1024, 1024);          // shadow sharpness
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 130;   // shadows only near the player (perf)
  // Tighter frustum (was ±90 → 180×180) so the same 1024² map covers a smaller
  // area at higher density — keeps shadows crisp where the player actually is.
  sun.shadow.camera.left = -70;  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;    sun.shadow.camera.bottom = -70;
  sun.shadow.bias = -0.0004;                    // removes shadow "acne" specks
  scene.add(sun);

  // A cool, dim sky-fill from the opposite side. It does NOT cast shadows; it
  // just keeps the shaded sides from going dead-flat and adds gentle blue
  // counter-light against the warm sun — the classic warm/cool form read.
  const skyFill = new THREE.DirectionalLight(0xb3d2f0, 0.6);
  skyFill.position.set(-38, 24, -30);
  scene.add(skyFill); scene.userData.skyFill = skyFill;

  // --- Ground ---
  const grassMap = grassTexture();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ map: grassMap, color: 0xf4f6e6, roughness: 1, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;  // lay the plane flat
  ground.receiveShadow = true;
  scene.add(ground);
  scene.userData.ground = ground; // used to raycast a "walk here" point

  // Soft, broad colour patches laid just over the lawn so the ground reads as a
  // living meadow with sun-warmed and shaded ground rather than one flat sheet.
  // They're large, very translucent, low-poly discs — cheap and purely visual.
  // Reuse the grass map but tint each disc and fade it via opacity for a smooth
  // blotch that blends into the turf (no hard seams).
  const meadowPatch = (x, z, r, color, op) => {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(r, 18),
      new THREE.MeshStandardMaterial({ map: grassMap, color, roughness: 1, transparent: true, opacity: op, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.008, z);
    m.receiveShadow = true;
    scene.add(m);
    scene.userData.outdoor.push(m);
  };
  // ring of varied-tone patches out around the town/forest edge
  const patchTones = [0xcadf95, 0x86a25a, 0xd2c98c, 0xa6c074, 0xbed888];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2 + Math.random() * 0.5;
    const rad = 28 + Math.random() * 52;
    const px = Math.cos(a) * rad, pz = Math.sin(a) * rad;
    // skip patches that would land on the pond
    if (Math.hypot(px - POND.x, pz - POND.z) < POND.r + 3) continue;
    meadowPatch(px, pz, 6 + Math.random() * 10, patchTones[i % patchTones.length], 0.2 + Math.random() * 0.18);
  }

  // A lighter "dirt" clearing where the hero starts.
  const clearing = new THREE.Mesh(
    new THREE.CircleGeometry(9, 32),
    new THREE.MeshStandardMaterial({ map: dirtTexture(5), roughness: 1 })
  );
  clearing.rotation.x = -Math.PI / 2;
  clearing.position.y = 0.01;        // just above the ground to avoid flicker
  clearing.receiveShadow = true;
  scene.add(clearing);

  // Worn dirt approach road running south from the spawn clearing out into the
  // meadow, plus a couple of branching footpaths toward the pond and the forest
  // edge, so the world has trodden ways rather than an untouched green carpet.
  // These are flat, decorative, walkable strips laid just over the grass.
  const pathMap = pathTexture(8);
  const pathStrip = (x, z, w, d, rot = 0, op = 0.92) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({ map: pathMap, roughness: 1, transparent: true, opacity: op, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2; m.rotation.z = rot;
    m.position.set(x, 0.012, z);
    m.receiveShadow = true;
    scene.add(m);
    scene.userData.outdoor.push(m);
  };
  // southern road out of the clearing toward the forest road
  pathStrip(0, -22, 5, 30);
  // a path easing toward the pond shore on the east
  pathStrip(12, -16, 4.2, 18, Math.PI / 2.6, 0.85);
  // a path wandering off to the western tree line
  pathStrip(-16, -20, 3.8, 16, -Math.PI / 5, 0.85);

  // A little pond off to the side, as a landmark. A muddy shore ring softens the
  // edge into the grass, and a gently domed water disc reads smoother than a flat
  // slab. The water surface is animated subtly in interactions/main if available.
  const shore = new THREE.Mesh(
    new THREE.RingGeometry(POND.r - 0.5, POND.r + 1.4, 44),
    new THREE.MeshStandardMaterial({ map: dirtTexture(3), roughness: 1 })
  );
  shore.rotation.x = -Math.PI / 2;
  shore.position.set(POND.x, 0.015, POND.z);
  shore.receiveShadow = true;

  const pondGeo = new THREE.CircleGeometry(POND.r, 48);
  // bow the centre up a touch so the disc looks like a settled water surface
  const pp = pondGeo.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const dx = pp.getX(i), dy = pp.getY(i);
    pp.setZ(i, (1 - Math.min(1, Math.hypot(dx, dy) / POND.r)) * 0.12);
  }
  pp.needsUpdate = true; pondGeo.computeVertexNormals();
  const pondMat = new THREE.MeshStandardMaterial({
    color: 0x2f86c4, roughness: 0.12, metalness: 0.3,
    emissive: 0x12435f, emissiveIntensity: 0.45,
    transparent: true, opacity: 0.86,
  });
  pondMat.userData.__toonDone = true;
  const pond = new THREE.Mesh(pondGeo, pondMat);
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(POND.x, 0.05, POND.z);
  pond.userData.__toonDone = true;
  // a soft foam ring lapping the pond's edge, gently pulsing
  const pondFoamMat = new THREE.MeshStandardMaterial({
    color: 0xeaf6ff, emissive: 0xbfe2ff, emissiveIntensity: 0.4,
    roughness: 1, transparent: true, opacity: 0.5, depthWrite: false,
  });
  pondFoamMat.userData.__toonDone = true;
  const pondFoam = new THREE.Mesh(new THREE.RingGeometry(POND.r - 0.7, POND.r + 0.2, 48), pondFoamMat);
  pondFoam.rotation.x = -Math.PI / 2;
  pondFoam.position.set(POND.x, 0.052, POND.z);
  pondFoam.userData.__toonDone = true;
  (function pondFoamPulse() {
    const tick = (now) => {
      requestAnimationFrame(tick);
      pondFoamMat.opacity = 0.4 + Math.sin((now || 0) * 0.0016 + 1) * 0.16;
    };
    requestAnimationFrame(tick);
  })();
  scene.add(shore);
  scene.add(pond);
  scene.add(pondFoam);
  scene.userData.outdoor.push(ground, clearing, shore, pond, pondFoam);

  // --- The castle (home base) + the two shop buildings ---
  buildStructures(scene);
  EXTRA = townStructures().concat(waterStructures());
  buildTown(scene);
  buildWater(scene);

  // --- Scatter the scenery ---
  // Trees are collected into an array so other code can find & interact with them
  // (e.g. the Woodcutting system clicks and chops them). Each tree carries a
  // `tier` (normal/oak/willow/maple/yew/magic) so chopping yields tier-specific
  // logs + XP. We plant the common low tiers densely and the rare high tiers
  // sparsely, loosely ringed outward, so the forest reads like a gentle
  // progression from the spawn clearing toward the deep woods.
  const FOREST = [
    { tier: 'normal', count: 16, range: 46 },
    { tier: 'oak',    count: 9,  range: 56 },
    { tier: 'willow', count: 6,  range: 60, near: POND }, // willows love water
    { tier: 'maple',  count: 6,  range: 66 },
    { tier: 'yew',    count: 4,  range: 72 },
    { tier: 'magic',  count: 3,  range: 78 },
  ];
  const trees = [];
  for (const band of FOREST) {
    let placed = 0, guard = 0;
    while (placed < band.count && guard++ < band.count * 12) {
      // Natural clustering: most trees of a band sprout in little groves seeded
      // off the first member, so the forest reads as clumps with clearings
      // between them instead of an evenly-sprinkled lattice. Willows still hug
      // the pond. ~40% of trees seed a fresh grove; the rest nestle near it.
      let p;
      if (band.near) {
        p = spotNear(band.near, 7, 13);
      } else if (placed === 0 || Math.random() < 0.4) {
        p = spot(band.range);
      } else {
        const c = trees[trees.length - 1].position;   // cluster around the last one
        p = spotNear({ x: c.x, z: c.z }, 3.5, 8.5);
      }
      const tree = makeTree(scene, p.x, p.z, band.tier);
      scene.add(tree);
      trees.push(tree);
      placed++;
    }
  }
  scene.userData.trees = trees;
  scene.userData.outdoor.push(...trees);
  installWoodcuttingHook(); // tier-aware logs/XP + chop juice (vfx/audio)

  // Rocks tend to gather where trees thin out — scatter most singly, but let a
  // few cluster into little rocky outcrops for a more natural, weathered look.
  // Each rock is an individually-placed clone so collision and the mining
  // raycast can address it; the three rock GLBs share geometry across clones.
  const rocks = [];
  for (let i = 0; i < 22; i++) {
    const p = spot(72);
    const r = makeRock(scene, p.x, p.z); scene.add(r); rocks.push(r);
    if (Math.random() < 0.4) {                       // a companion boulder or two nearby
      const near = spotNear({ x: p.x, z: p.z }, 1.0, 2.6);
      const r2 = makeRock(scene, near.x, near.z); r2.scale.multiplyScalar(0.6 + Math.random() * 0.4);
      scene.add(r2); rocks.push(r2);
    }
  }
  scene.userData.rocks = rocks;
  scene.userData.outdoor.push(...rocks);

  // Grass / flowers / bushes / plants: purely decorative ground cover, scattered
  // in the same clustered pattern as before but rendered as ONE InstancedMesh per
  // model (one draw call each) so the meadow can stay lush without lag.
  const grassP = [], shortGrassP = [], grass2P = [], flowerP = [], bushP = [], plantP = [];
  const grassBuckets = [grassP, grass2P, shortGrassP];
  // Denser meadow: more seed knots, more tufts per knot, more wildflowers, so the
  // fields read lush. Still one InstancedMesh per model (a handful of draw calls).
  for (let i = 0; i < 70; i++) {
    const p = spot(80);
    const n = 3 + ((Math.random() * 5) | 0);          // a fuller knot of tufts
    for (let k = 0; k < n; k++) {
      const q = k === 0 ? p : spotNear({ x: p.x, z: p.z }, 0.5, 2.8);
      const place = { x: q.x, z: q.z, ry: Math.random() * Math.PI * 2, s: 1.4 + Math.random() * 1.1 };
      grassBuckets[(Math.random() * grassBuckets.length) | 0].push(place);
      if (Math.random() < 0.3) flowerP.push({ x: q.x + (Math.random() - 0.5), z: q.z + (Math.random() - 0.5), ry: Math.random() * Math.PI * 2, s: 1.2 + Math.random() * 0.8 });
    }
  }
  // Leafy bushes + small plants/ferns softening the treeline and dotting the
  // meadow, sometimes in little clumps for a wilder, fuller look.
  for (let i = 0; i < 36; i++) {
    const p = spot(78);
    const n = Math.random() < 0.4 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const q = k === 0 ? p : spotNear({ x: p.x, z: p.z }, 0.8, 2.5);
      const bk = [bushP, bushP, plantP][(Math.random() * 3) | 0];
      bk.push({ x: q.x, z: q.z, ry: Math.random() * Math.PI * 2, s: 1.3 + Math.random() * 0.9 });
    }
  }
  instanceScatter(scene, 'nat_Grass', grassP, { shadow: false, tint: true });
  instanceScatter(scene, 'nat_Grass_2', grass2P, { shadow: false, tint: true });
  instanceScatter(scene, 'nat_Grass_Short', shortGrassP, { shadow: false, tint: true });
  instanceScatter(scene, 'nat_Flowers', flowerP, { shadow: false });
  // bushes split across the two bush models + berry bush for variety
  instanceScatter(scene, 'nat_Bush_1', bushP.filter((_, i) => i % 3 === 0));
  instanceScatter(scene, 'nat_Bush_2', bushP.filter((_, i) => i % 3 === 1));
  instanceScatter(scene, 'nat_BushBerries_1', bushP.filter((_, i) => i % 3 === 2));
  instanceScatter(scene, 'nat_Plant_1', plantP.filter((_, i) => i % 3 === 0), { shadow: false, tint: true });
  instanceScatter(scene, 'nat_Plant_3', plantP.filter((_, i) => i % 3 === 1), { shadow: false, tint: true });
  instanceScatter(scene, 'nat_Plant_5', plantP.filter((_, i) => i % 3 === 2), { shadow: false, tint: true });
}

// --- Atmosphere helpers ----------------------------------------------------

// A golden-hour gradient sky dome painted on a tall canvas: a deep blue zenith
// easing down through soft cyan into a warm gold horizon haze, with a gentle sun
// bloom feathered just above the skyline. BackSide + fog:false so it always sits
// behind the world. Kept self-contained here so the mood is tunable in-file.
function goldenSkyDome() {
  const W = 16, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');

  // Vertical gradient: top (zenith) -> bottom (horizon).
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0.00, '#2a4f86');   // deep blue zenith
  grad.addColorStop(0.32, '#4f7fb6');
  grad.addColorStop(0.58, '#8db4d2');   // pale cyan mid-sky
  grad.addColorStop(0.78, '#d3cdba');
  grad.addColorStop(0.90, '#eccf9d');   // warming toward gold
  grad.addColorStop(1.00, '#f5e2bf');   // warm hazy horizon
  g.fillStyle = grad; g.fillRect(0, 0, W, H);

  // Soft sun glow feathered above the horizon for a golden-hour bloom. Reaches a
  // little higher up the dome so the warm band still reads at normal play pitch.
  const glow = g.createLinearGradient(0, H * 0.55, 0, H);
  glow.addColorStop(0, 'rgba(255,224,160,0)');
  glow.addColorStop(0.5, 'rgba(255,219,148,0.34)');
  glow.addColorStop(1, 'rgba(255,238,192,0.60)');
  g.fillStyle = glow; g.fillRect(0, H * 0.55, W, H * 0.45);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(440, 32, 18), mat);
  dome.renderOrder = -1;
  return dome;
}

// A scatter of soft, flattened cloud puffs high in the sky. Each puff is a
// low-poly sphere with smooth normals, lit only by the unshadowed fill so it
// stays bright and gauzy. Purely decorative; tagged out of the way and never
// collided (it's never pushed into buildings).
function makeClouds() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xfdf6ec, roughness: 1, metalness: 0,
    emissive: 0xf3e6cf, emissiveIntensity: 0.25,
    transparent: true, opacity: 0.85, fog: false, depthWrite: false,
  });
  // The puffs are static decorative geometry that only ever toggles .visible as a
  // whole, so we bake every puff's cluster + local transform into its geometry and
  // merge them into ONE mesh (one draw call, one outline hull) instead of ~36
  // separate spheres. Visually identical — same material, same world placements.
  const clusters = 9;
  const geos = [];
  const clusterM = new THREE.Matrix4(), puffM = new THREE.Matrix4();
  const q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  const noRot = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < clusters; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = 120 + Math.random() * 160;
    q.setFromAxisAngle(up, Math.random() * Math.PI * 2);
    clusterM.compose(pos.set(Math.cos(ang) * rad, 95 + Math.random() * 55, Math.sin(ang) * rad), q, scl.set(1, 1, 1));
    const puffs = 3 + ((Math.random() * 3) | 0);
    for (let p = 0; p < puffs; p++) {
      const s = 7 + Math.random() * 9;
      const geo = lumpify(new THREE.SphereGeometry(s, 10, 8), 0.12, Math.random() * 10);
      puffM.compose(
        pos.set((Math.random() - 0.5) * 26, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 18),
        noRot,
        scl.set(1.5, 0.55, 1.2));
      geo.applyMatrix4(puffM);                 // bake the puff's local pos+scale
      geo.applyMatrix4(clusterM);              // then the cluster's world transform
      geos.push(geo);
    }
  }
  const merged = mergeGeometries(geos, false);
  for (const geo of geos) geo.dispose();       // free the per-puff source geometries
  const cloud = new THREE.Mesh(merged, mat);
  g.add(cloud);
  g.renderOrder = -1;
  return g;
}

// --- Helpers ---------------------------------------------------------------

// Don't place scenery on the spawn clearing or in the pond.
function isClear(x, z) {
  if (Math.hypot(x, z) < 9) return false;
  // Keep the whole town + castle grounds clear of trees (no clutter around the
  // buildings); the forest grows out past the edges for Woodcutting.
  if (x > -36 && x < 36 && z > -12 && z < 78) return false;
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 1.5) return false;
  for (const s of STRUCTURES) { if (Math.hypot(x - s.x, z - s.z) < s.r) return false; }
  for (const s of EXTRA) { if (Math.hypot(x - s.x, z - s.z) < s.r) return false; }
  return true;
}

// Pick a random open spot within `range` of the center.
function spot(range) {
  let x = 0, z = 0;
  for (let t = 0; t < 30; t++) {
    x = (Math.random() * 2 - 1) * range;
    z = (Math.random() * 2 - 1) * range;
    if (isClear(x, z)) break;
  }
  return { x, z };
}

// Pick an open spot in a ring `rMin..rMax` around a landmark (used to nestle
// willows near the pond shore). Falls back to a normal scatter if it can't find
// a clear ringed spot.
function spotNear(c, rMin, rMax) {
  for (let t = 0; t < 40; t++) {
    const a = Math.random() * Math.PI * 2;
    const r = rMin + Math.random() * (rMax - rMin);
    const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
    if (isClear(x, z) && Math.hypot(x, z) > 9) return { x, z };
  }
  return spot(60);
}

// Gently warp a sphere's vertices outward by smooth low-frequency noise so each
// canopy clump reads as an organic, rounded mass — not a perfect ball and not a
// faceted blob. Smooth normals are recomputed so it lights softly.
function lumpify(geo, amount, seed) {
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const len = v.length() || 1;
    const n =
      Math.sin(v.x * 1.7 + seed) * 0.5 +
      Math.sin(v.y * 2.1 + seed * 1.7) * 0.3 +
      Math.sin(v.z * 1.9 + seed * 2.3) * 0.4 +
      Math.sin((v.x + v.z) * 3.1 + seed) * 0.15;
    const s = 1 + n * amount;
    v.multiplyScalar(s);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();   // smooth normals -> soft rounded shading
  return geo;
}

// Per-tier tree GLBs. Each Woodcutting tier maps to one or more low-poly tree
// models (oaks read as broad common trees, willows/yews/magic borrow distinct
// silhouettes from the pine/birch/dead sets) plus a base scale so the species
// stand at a believable, varied height. `pick` chooses a model for a placement.
// Shared chop-stump resources: identical geometry + material across every tree,
// never modified per-instance, so they're built once and reused (43+ fewer
// geometry/material allocations than minting a fresh pair per tree).
const STUMP_GEO = new THREE.CylinderGeometry(0.22, 0.3, 0.5, 9, 1);
const STUMP_MAT = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.95 });

const TREE_MODELS = {
  normal: { models: ['nat_CommonTree_1', 'nat_CommonTree_3', 'nat_BirchTree_1'], h: 5.5 },
  oak:    { models: ['nat_CommonTree_1', 'nat_CommonTree_3', 'nat_CommonTree_Autumn_2'], h: 7.0 },
  willow: { models: ['nat_BirchTree_1', 'nat_BirchTree_3'], h: 7.0 },
  maple:  { models: ['nat_CommonTree_Autumn_2', 'nat_CommonTree_3'], h: 6.5 },
  yew:    { models: ['nat_PineTree_1', 'nat_PineTree_3', 'nat_PineTree_5'], h: 7.5 },
  magic:  { models: ['nat_CommonTree_Dead_1', 'nat_CommonTree_Dead_3'], h: 7.5 },
};

// A tree is a host Group placed + scaled synchronously (so collision, built right
// after buildWorld, already sees its position + scale), into which the low-poly
// GLB mesh is dropped once it loads. The whole model is registered as the tree's
// `foliage` so Woodcutting hides it to a small stump when chopped, and the host
// Group is what interactions.js raycasts, rotates (shake) and tracks as the tree.
function makeTree(scene, x, z, tier) {
  const def = TREE_MODELS[tier] || TREE_MODELS.normal;
  const g = new THREE.Group();
  const foliage = [];

  // A short stump that stays behind when the tree is chopped (the GLB foliage is
  // hidden). Tinted to read as fresh-cut wood; matches the toon look via the pass.
  // The stump geometry + material are identical for every tree and never mutated
  // per-instance, so all 44 trees share one cached geometry + material (saving
  // dozens of buffer/material allocations) — each stump is still its own Mesh so
  // it stays addressable.
  const stump = new THREE.Mesh(STUMP_GEO, STUMP_MAT);
  stump.position.y = 0.25; stump.castShadow = true; stump.receiveShadow = true;
  g.add(stump);

  // Modest host scale drives the chop-stump size and the collision footprint
  // (collision reads 0.42 * scale.x → ~0.5 radius here); the model itself is
  // sized to a target world height independently inside attachClone.
  g.position.set(x, 0, z);
  g.rotation.y = Math.random() * Math.PI * 2;
  // a little side-tilt + non-uniform scale so a grove doesn't read as identical
  // cones — fuller, wilder silhouettes.
  g.rotation.x = (Math.random() - 0.5) * 0.05;
  g.rotation.z = (Math.random() - 0.5) * 0.05;
  const baseS = 1.05 + Math.random() * 0.45;
  g.scale.set(baseS * (0.92 + Math.random() * 0.16), baseS, baseS * (0.92 + Math.random() * 0.16));

  const modelName = def.models[(Math.random() * def.models.length) | 0];
  const targetH = def.h * (0.8 + Math.random() * 0.45);   // wider height spread
  // Magic trees keep a faint dusk glow on their material (shared across that
  // model's clones, applied once when the proto resolves).
  attachClone(g, modelName, { shadow: true, targetH, onMesh: (mesh) => {
    foliage.push(mesh);
    if (g.userData.depleted) mesh.visible = false;   // loaded after an early chop
    if (tier === 'magic' && mesh.material) {
      const mm = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mm) {
        if (mat.userData.__glow) continue;
        mat.emissive = new THREE.Color(0x2a4a86);
        mat.emissiveIntensity = 0.4;
        mat.userData.__glow = true;
      }
    }
  } });

  // Data the Woodcutting system uses: `foliage` are the meshes hidden when the
  // tree is chopped to a stump, plus its current state and which `tier` it is
  // (so chopping awards the right log + XP). `trunk` points at the stump.
  g.userData = { kind: 'tree', trunk: stump, foliage, depleted: false, respawnAt: 0, shake: 0, tier };
  return g;
}

// --- Tier-aware Woodcutting reward + chop juice ------------------------------
// interactions.js drives the actual chopping but is generic: it calls
// skills.chopReward() and inventory.add('logs', 1) with no idea which species it
// hit. We can only touch world/skills/items, so we wrap those two methods at
// runtime (the same self-initializing pattern vfx.js/combat.js use): figure out
// which tree the player is chopping, then redirect the XP and the log to that
// tree's tier — and fire wood-chip vfx + a chop sound. If the player is below
// the tier's level it's gated with a message and yields nothing. Falls back to a
// normal tree if anything is unavailable, so the base game keeps working.
function installWoodcuttingHook() {
  let tries = 0;
  const timer = setInterval(() => {
    const em = window.eldenmoor;
    if (++tries > 200) { clearInterval(timer); return; }
    if (!em || !em.skills || !em.inventory || !em.player || !em.scene) return;
    clearInterval(timer);

    const skills = em.skills, inventory = em.inventory, player = em.player, scene = em.scene;
    if (typeof skills.chopReward !== 'function' || skills.__wcHooked) return;
    skills.__wcHooked = true;

    // Find the non-depleted tree the player is currently standing at (the one
    // interactions.js is chopping): nearest within chop reach.
    function activeTree() {
      let best = null, bestD = 3.0 * 3.0; // ~chop range, squared
      for (const tr of scene.userData.trees || []) {
        if (!tr.userData || tr.userData.kind !== 'tree' || tr.userData.depleted) continue;
        const dx = tr.position.x - player.position.x, dz = tr.position.z - player.position.z;
        const d = dx * dx + dz * dz;
        if (d < bestD) { bestD = d; best = tr; }
      }
      return best;
    }

    // `pending` carries the resolved tier id between chopReward and the
    // inventory.add('logs',1) interactions.js runs right after. `false` means
    // "this swing produced no log" (a missed success roll) so the add is dropped.
    let pending = null;
    let gateMsgAt = 0;

    const origReward = skills.chopReward.bind(skills);
    skills.chopReward = function (forcedTier) {
      const tree = activeTree();
      const tierId = forcedTier || (tree && tree.userData.tier) || 'normal';
      const tier = skills.treeTier ? skills.treeTier(tierId) : null;

      // Always give chop feedback (chips + sound) at the tree on each swing.
      if (tree) {
        const p = tree.position;
        if (em.vfx && em.vfx.burst) em.vfx.burst('gather', p.x, 0.9, p.z);
        if (em.audio && em.audio.play) em.audio.play('chop');
      }

      // Level gate: if you can't cut this tier yet, no XP and no log.
      if (skills.canChopTier && !skills.canChopTier(tierId)) {
        pending = false;
        const now = Date.now();
        if (tier && now - gateMsgAt > 1500) {
          gateMsgAt = now;
          gameMessage('You need Woodcutting level ' + tier.level + ' to chop ' + tier.axe + '.');
        }
        return { xp: 0, leveledUp: false, level: skills.state.woodcutting.level };
      }

      // Per-tick success roll (the OSRS-style "do I get a log this swing?").
      // On a miss: no log, no XP this tick — but you keep swinging.
      if (skills.chopSuccess && !skills.chopSuccess(tierId)) {
        pending = false;
        return { xp: 0, leveledUp: false, level: skills.state.woodcutting.level };
      }

      pending = tierId;
      return origReward(tierId);
    };

    const origAdd = inventory.add.bind(inventory);
    inventory.add = function (id, qty) {
      // Redirect the generic 'logs' that interactions.js adds after a chop to the
      // active tier's log — or drop it entirely on a missed/gated swing. Any other
      // add (nests, loot, shop) passes through untouched.
      if (id === 'logs' && pending !== null) {
        const tierId = pending; pending = null;
        if (tierId === false) return; // missed swing: no log
        const log = skills.treeTier ? skills.treeTier(tierId).log : 'logs';
        return origAdd(log, qty);
      }
      return origAdd(id, qty);
    };
  }, 80);
}

// A boulder built from one of the three low-poly rock GLBs. It is a host Group
// placed + scaled synchronously (so collision and the mining raycast can address
// it before the model finishes loading) into which the rock mesh is dropped. The
// three rock models share their geometry + material across all clones.
const ROCK_MODELS = ['nat_Rock_1', 'nat_Rock_2', 'nat_Rock_3'];
function makeRock(scene, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = Math.random() * Math.PI * 2;
  // Host scale drives the collision radius (collision reads 0.5 * max(scale)).
  g.scale.setScalar(0.9 + Math.random() * 0.7);
  g.userData = { kind: 'rock' };

  const name = ROCK_MODELS[(Math.random() * ROCK_MODELS.length) | 0];
  // keepHostScale: the host scale (and any companion-boulder shrink) drives the
  // visible rock size, while targetH just normalises the three models to a common
  // base height first.
  attachClone(g, name, { shadow: true, targetH: 0.9, keepHostScale: true });
  return g;
}
