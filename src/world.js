// world.js — builds the zone you walk around in.
// Sky, fog, sunlight, the ground, and scattered trees / rocks / grass.

import * as THREE from '../vendor/three.module.js';
import { buildStructures, STRUCTURES } from './buildings.js';
import { buildTown, townStructures } from './town.js';
import { buildWater, waterStructures } from './water.js';
import { grassTexture, dirtTexture, barkTexture, pathTexture } from './textures.js';
import { gameMessage } from './ui.js';

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
  scene.fog = new THREE.Fog(0xe2d4ba, 62, 150);   // pulled in for performance (was 205)
  scene.userData.outdoor = [];        // scenery toggled off when you go upstairs / underground

  // Custom gradient sky dome (deep blue zenith -> warm gold horizon glow) with a
  // soft sun bloom painted near the sun's bearing. Built locally so we can tune
  // the golden-hour palette without touching the shared texture helpers.
  const sky = goldenSkyDome();
  scene.add(sky); scene.userData.sky = sky;

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
  const hemi = new THREE.HemisphereLight(0xf8e8c8, 0x5f5230, 1.0);
  scene.add(hemi); scene.userData.hemi = hemi;

  // The "sun": a warm directional key that casts the shadows. Lowered + swung
  // toward the horizon for a longer, golden-hour rake across the smooth forms.
  // Intensity stays 2.7 to match main.js's surface reset.
  const sun = new THREE.DirectionalLight(0xffe0ad, 2.7);
  scene.userData.sun = sun;
  sun.position.set(48, 40, 26);                 // lower + warmer raking angle
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);          // shadow sharpness
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 130;   // shadows only near the player (perf)
  sun.shadow.camera.left = -90;  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;    sun.shadow.camera.bottom = -90;
  sun.shadow.bias = -0.0004;                    // removes shadow "acne" specks
  scene.add(sun);

  // A cool, dim sky-fill from the opposite side. It does NOT cast shadows; it
  // just keeps the shaded sides from going dead-flat and adds gentle blue
  // counter-light against the warm sun — the classic warm/cool form read.
  const skyFill = new THREE.DirectionalLight(0xa6c0e0, 0.5);
  skyFill.position.set(-38, 24, -30);
  scene.add(skyFill); scene.userData.skyFill = skyFill;

  // --- Ground ---
  const grassMap = grassTexture();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ map: grassMap, color: 0xeef0e0, roughness: 1, metalness: 0 })
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
  const patchTones = [0xbfd28a, 0x7f9456, 0xcabf86, 0x9ab16a];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + Math.random() * 0.5;
    const rad = 30 + Math.random() * 48;
    const px = Math.cos(a) * rad, pz = Math.sin(a) * rad;
    // skip patches that would land on the pond
    if (Math.hypot(px - POND.x, pz - POND.z) < POND.r + 3) continue;
    meadowPatch(px, pz, 6 + Math.random() * 9, patchTones[i % patchTones.length], 0.22 + Math.random() * 0.16);
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
  const pond = new THREE.Mesh(
    pondGeo,
    new THREE.MeshStandardMaterial({ color: 0x2f6ea5, roughness: 0.12, metalness: 0.25,
      transparent: true, opacity: 0.88 })
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(POND.x, 0.05, POND.z);
  scene.add(shore);
  scene.add(pond);
  scene.userData.outdoor.push(ground, clearing, shore, pond);

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
  const bark = barkTexture();
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
      const tree = makeTree(p.x, p.z, band.tier, bark);
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
  const rocks = [];
  for (let i = 0; i < 22; i++) {
    const p = spot(72);
    const r = makeRock(p.x, p.z); scene.add(r); rocks.push(r);
    if (Math.random() < 0.4) {                       // a companion boulder or two nearby
      const near = spotNear({ x: p.x, z: p.z }, 1.0, 2.6);
      const r2 = makeRock(near.x, near.z); r2.scale.multiplyScalar(0.6 + Math.random() * 0.4);
      scene.add(r2); rocks.push(r2);
    }
  }
  scene.userData.rocks = rocks;
  scene.userData.outdoor.push(...rocks);

  // Grass tufts: clustered into patches and concentrated along the forest fringe
  // and near the dirt paths so the meadow feels lush near the action and the
  // treeline is softened, rather than tufts sprinkled uniformly everywhere.
  for (let i = 0; i < 34; i++) {
    const p = spot(76);
    const n = 2 + ((Math.random() * 4) | 0);          // a little knot of tufts
    for (let k = 0; k < n; k++) {
      const q = k === 0 ? p : spotNear({ x: p.x, z: p.z }, 0.6, 2.4);
      const gr = makeGrass(q.x, q.z); scene.add(gr); scene.userData.outdoor.push(gr);
    }
  }
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
  const clusters = 9;
  for (let i = 0; i < clusters; i++) {
    const cl = new THREE.Group();
    const puffs = 3 + ((Math.random() * 3) | 0);
    for (let p = 0; p < puffs; p++) {
      const s = 7 + Math.random() * 9;
      const m = new THREE.Mesh(lumpify(new THREE.SphereGeometry(s, 10, 8), 0.12, Math.random() * 10), mat);
      m.position.set((Math.random() - 0.5) * 26, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 18);
      m.scale.set(1.5, 0.55, 1.2);
      cl.add(m);
    }
    const ang = Math.random() * Math.PI * 2;
    const rad = 120 + Math.random() * 160;
    cl.position.set(Math.cos(ang) * rad, 95 + Math.random() * 55, Math.sin(ang) * rad);
    cl.rotation.y = Math.random() * Math.PI * 2;
    g.add(cl);
  }
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

// Per-tier tree palettes & silhouette tuning. Each tier reads as a distinct
// species: bushy oaks, drooping willows, fiery maples, dark gnarled yews and a
// faintly glowing magic tree. Colours are smooth-shaded MeshStandardMaterial
// base tones (cel-shade ready, no flatShading).
const TREE_STYLE = {
  normal: { leaf: [0x6a8d3a, 0x7da043], bark: 0x6b4a2f, trunk: [1.7, 1.3], crown: [1.25, 0.75] },
  oak:    { leaf: [0x4f7a2c, 0x6a9a3c], bark: 0x6b4a2f, trunk: [1.9, 1.2], crown: [1.7, 0.7], broad: true },
  willow: { leaf: [0x7fa64a, 0x9bc163], bark: 0x83735a, trunk: [2.4, 1.1], crown: [1.15, 0.5], droop: true },
  maple:  { leaf: [0xc25a2a, 0xe08a3a], bark: 0x6f4326, trunk: [2.2, 1.2], crown: [1.45, 0.6], fiery: true },
  yew:    { leaf: [0x2f4a33, 0x3c5f41], bark: 0x4a3326, trunk: [1.6, 1.6], crown: [1.55, 0.7], gnarled: true },
  magic:  { leaf: [0x4a78c8, 0x76a6e8], bark: 0x53607a, trunk: [2.6, 1.0], crown: [1.2, 0.6], glow: true },
};

// A lush, rounded RS/WoW tree built per tier: a tapered smooth trunk and layered,
// softly warped canopy clumps with smooth normals. Many instances, so kept light
// (low-segment spheres reused, smooth-shaded). `tier` selects the species look
// and is recorded on userData so chopping yields the right log + XP.
function makeTree(x, z, tier, bark) {
  const st = TREE_STYLE[tier] || TREE_STYLE.normal;
  const g = new THREE.Group();
  const trunkH = st.trunk[0] + Math.random() * st.trunk[1];

  // Tapered, smooth trunk — slightly bulged at the base for a sculpted root flare.
  // Most tiers reuse the shared bark map; yew/magic get a tinted plain trunk so
  // dark gnarled yew and pale magic-wood read distinctly.
  const trunkMat = (tier === 'yew' || tier === 'magic')
    ? new THREE.MeshStandardMaterial({ color: st.bark, roughness: 0.95 })
    : new THREE.MeshStandardMaterial({ map: bark, color: st.bark, roughness: 0.95 });
  const baseR = st.broad ? 0.5 : (st.gnarled ? 0.46 : 0.42);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, baseR, trunkH, 12, 1),
    trunkMat
  );
  trunk.position.y = trunkH / 2;
  if (st.gnarled) { trunk.rotation.z = (Math.random() - 0.5) * 0.18; } // yew leans/twists
  trunk.castShadow = true; trunk.receiveShadow = true;
  g.add(trunk);

  // Two leaf tones (a base + a slightly brighter top) for gentle depth. Magic
  // foliage self-illuminates faintly so it glows at dusk.
  const lo = st.leaf[0], hi = st.leaf[1];
  const leafLo = new THREE.MeshStandardMaterial({ color: lo, roughness: 0.85,
    emissive: st.glow ? 0x24407a : 0x000000, emissiveIntensity: st.glow ? 0.45 : 0 });
  const leafHi = new THREE.MeshStandardMaterial({ color: hi, roughness: 0.8,
    emissive: st.glow ? 0x335aa0 : 0x000000, emissiveIntensity: st.glow ? 0.5 : 0 });

  const r = st.crown[0] + Math.random() * st.crown[1];
  const seed = Math.random() * 10;
  const foliage = [];

  // A clump of canopy: a softly warped, smooth-shaded sphere placed on the crown.
  const clump = (radius, yOff, xz, mat, sy, sd, ox = 0, oz = 0) => {
    const m = new THREE.Mesh(lumpify(new THREE.SphereGeometry(radius, 12, 9), 0.14, sd), mat);
    m.position.set(ox + (Math.random() - 0.5) * xz, trunkH + yOff, oz + (Math.random() - 0.5) * xz);
    m.scale.y = sy;
    m.castShadow = true; m.receiveShadow = true;
    g.add(m); foliage.push(m);
    return m;
  };

  if (st.broad) {
    // OAK — broad, bushy, low-spreading crown of big rounded clumps.
    clump(r * 1.05, r * 0.15, r * 0.4, leafLo, 0.85, seed);
    clump(r * 0.9, r * 0.5, r * 1.3, leafHi, 0.9, seed + 2.0);
    clump(r * 0.85, r * 0.4, r * 1.3, leafLo, 0.9, seed + 4.0);
    clump(r * 0.8, r * 0.75, r * 0.8, leafHi, 0.9, seed + 6.0);
    clump(r * 0.7, r * 0.95, r * 0.5, leafLo, 0.95, seed + 8.0);
  } else if (st.droop) {
    // WILLOW — a slim domed top with long drooping fronds hanging off the rim.
    clump(r * 0.95, r * 0.5, r * 0.3, leafHi, 0.7, seed);
    clump(r * 0.7, r * 0.95, r * 0.5, leafHi, 0.7, seed + 3.0);
    // Drooping fronds: tall thin smooth cones angled down around the canopy.
    const frondMat = leafLo;
    const fronds = 7;
    for (let i = 0; i < fronds; i++) {
      const a = (i / fronds) * Math.PI * 2 + Math.random() * 0.4;
      const fr = r * (0.7 + Math.random() * 0.25);
      const len = r * (1.5 + Math.random() * 0.8);
      const frond = new THREE.Mesh(
        lumpify(new THREE.CylinderGeometry(0.05, r * 0.28, len, 7, 1), 0.18, seed + i), frondMat
      );
      frond.position.set(Math.cos(a) * fr, trunkH + r * 0.35 - len * 0.4, Math.sin(a) * fr);
      frond.rotation.set(Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35);
      frond.castShadow = true; frond.receiveShadow = true;
      g.add(frond); foliage.push(frond);
    }
  } else if (st.gnarled) {
    // YEW — dark, dense, lumpy crown sitting low on a stout twisted trunk.
    clump(r * 1.0, r * 0.1, r * 0.5, leafLo, 0.8, seed);
    clump(r * 0.82, r * 0.45, r * 1.2, leafHi, 0.85, seed + 2.5);
    clump(r * 0.78, r * 0.35, r * 1.2, leafLo, 0.85, seed + 5.0);
    clump(r * 0.7, r * 0.7, r * 0.7, leafHi, 0.9, seed + 7.5);
    clump(r * 0.55, r * 0.95, r * 0.4, leafLo, 0.95, seed + 9.5);
  } else if (st.glow) {
    // MAGIC — a tall, conical, jewel-blue crown that glows softly.
    clump(r * 0.95, r * 0.25, r * 0.3, leafLo, 1.05, seed);
    clump(r * 0.78, r * 0.85, r * 0.4, leafHi, 1.1, seed + 3.0);
    clump(r * 0.6, r * 1.4, r * 0.3, leafLo, 1.15, seed + 6.0);
    clump(r * 0.42, r * 1.9, r * 0.2, leafHi, 1.2, seed + 9.0);
  } else if (st.fiery) {
    // MAPLE — a rounded, fiery-orange crown, a touch taller than a normal tree.
    clump(r, r * 0.4, 0, leafLo, 0.95, seed);
    clump(r * 0.82, r * 1.0, r * 0.7, leafHi, 1.0, seed + 3.1);
    clump(r * 0.7, r * 0.6, r * 1.1, leafLo, 1.0, seed + 6.4);
    clump(r * 0.6, r * 1.3, r * 0.5, leafHi, 1.0, seed + 9.2);
  } else {
    // NORMAL — the original layered, billowing rounded crown.
    clump(r, r * 0.35, 0, leafLo, 0.9, seed);
    clump(r * 0.78, r * 0.95, r * 0.7, leafHi, 0.95, seed + 3.1);
    clump(r * 0.66, r * 0.55, r * 1.1, leafLo, 1.0, seed + 6.4);
    clump(r * 0.55, r * 1.25, r * 0.5, leafHi, 0.95, seed + 9.2);
  }

  g.position.set(x, 0, z);
  g.rotation.y = Math.random() * Math.PI * 2;
  // Higher tiers stand a little taller/grander on average.
  const grand = { normal: 0, oak: 0.1, willow: 0.15, maple: 0.12, yew: 0.05, magic: 0.2 }[tier] || 0;
  g.scale.setScalar(0.8 + grand + Math.random() * 0.7);

  // Data the Woodcutting system uses: which parts are the "leaves" (hidden when
  // the tree is chopped to a stump), plus its current state and which `tier` it
  // is (so chopping awards the right log + XP).
  g.userData = { kind: 'tree', trunk, foliage, depleted: false, respawnAt: 0, shake: 0, tier };
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

// A rounded, water-worn boulder: a higher-poly sphere warped into a few smooth
// lobes with smooth normals, so it lights softly instead of showing hard facets.
// Each gets a slightly varied warm/cool grey so an outcrop reads as real stone.
function makeRock(x, z) {
  const size = 0.6 + Math.random() * 0.9;
  // Slightly varied warm-grey stone: a base grey nudged a touch warmer or cooler.
  const lum = 0x76 + ((Math.random() * 0x22) | 0);
  const warm = (Math.random() * 8) | 0;
  const tint = ((lum + warm) << 16) | (lum << 8) | Math.max(0, lum - warm);
  const rock = new THREE.Mesh(
    lumpify(new THREE.SphereGeometry(size, 14, 10), 0.24, Math.random() * 10),
    new THREE.MeshStandardMaterial({ color: tint, roughness: 0.9, metalness: 0.05 })
  );
  rock.position.set(x, size * 0.32, z);
  rock.scale.set(1, 0.5 + Math.random() * 0.5, 1);     // squat, settled into the ground
  rock.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.4);
  rock.castShadow = true; rock.receiveShadow = true;
  rock.userData = { kind: 'rock' };
  return rock;
}

// A little tuft of grass blades — rounded, slightly curved, smooth-shaded — with
// varied scale and the occasional wildflower so the meadow feels hand-planted.
const FLOWER_COLS = [0xd6534a, 0xe8c24a, 0x9a6cc8, 0xe6e6e6, 0xe07ab0];
function makeGrass(x, z) {
  const g = new THREE.Group();
  const tint = 0x5f7a32 + ((Math.random() * 0x0a1006) | 0);
  const mat = new THREE.MeshStandardMaterial({ color: tint, roughness: 1 });
  const n = 3 + ((Math.random() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const h = 0.4 + Math.random() * 0.45;
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.05 + Math.random() * 0.03, h, 6), mat);
    blade.position.set((Math.random() - 0.5) * 0.6, h / 2, (Math.random() - 0.5) * 0.6);
    blade.rotation.set((Math.random() - 0.5) * 0.55, Math.random() * Math.PI, (Math.random() - 0.5) * 0.55);
    blade.castShadow = true; blade.receiveShadow = true;
    g.add(blade);
  }
  // ~30% of tufts carry a small wildflower on a thin stem for colour in the grass.
  if (Math.random() < 0.3) {
    const fh = 0.5 + Math.random() * 0.3;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, fh, 5),
      new THREE.MeshStandardMaterial({ color: 0x537032, roughness: 1 }));
    stem.position.set((Math.random() - 0.5) * 0.3, fh / 2, (Math.random() - 0.5) * 0.3);
    g.add(stem);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6),
      new THREE.MeshStandardMaterial({ color: FLOWER_COLS[(Math.random() * FLOWER_COLS.length) | 0],
        roughness: 0.7, emissive: 0x1a1408, emissiveIntensity: 0.25 }));
    head.position.set(stem.position.x, fh, stem.position.z);
    head.scale.set(1, 0.7, 1);
    g.add(head);
  }
  g.position.set(x, 0, z);
  g.rotation.y = Math.random() * Math.PI * 2;
  g.scale.setScalar(0.8 + Math.random() * 0.6);
  return g;
}
