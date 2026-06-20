// world.js — builds the zone you walk around in.
// Sky, fog, sunlight, the ground, and scattered trees / rocks / grass.

import * as THREE from '../vendor/three.module.js';
import { buildStructures, STRUCTURES } from './buildings.js';
import { buildTown, townStructures } from './town.js';
import { buildWater, waterStructures } from './water.js';
import { grassTexture, dirtTexture, barkTexture } from './textures.js';

// The pond sits here. We also keep trees from spawning on top of it.
const POND = { x: 22, z: -16, r: 6 };
let EXTRA = [];   // extra tree-avoidance footprints from the town

export function buildWorld(scene) {
  // --- Atmosphere: a warm golden-hour fantasy sky + depth fog ---------------
  // A soft, slightly hazy horizon colour drives both the fog and the sky's lower
  // band so the far scenery melts into the same warm light. Fog is pulled in a
  // little and given a gentle gradient so distant towers read with airy depth
  // without crushing the foreground or blowing out the cel-shaded mid-tones.
  const HORIZON = 0xead9bd;            // warm hazy gold at the skyline
  scene.background = new THREE.Color(HORIZON);
  scene.fog = new THREE.Fog(0xdcd2c4, 48, 205);
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
  const hemi = new THREE.HemisphereLight(0xf3e2c2, 0x4d4126, 1.0);
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
  sun.shadow.camera.far = 200;
  sun.shadow.camera.left = -90;  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;    sun.shadow.camera.bottom = -90;
  sun.shadow.bias = -0.0004;                    // removes shadow "acne" specks
  scene.add(sun);

  // A cool, dim sky-fill from the opposite side. It does NOT cast shadows; it
  // just keeps the shaded sides from going dead-flat and adds gentle blue
  // counter-light against the warm sun — the classic warm/cool form read.
  const skyFill = new THREE.DirectionalLight(0x9fb8d8, 0.45);
  skyFill.position.set(-38, 24, -30);
  scene.add(skyFill); scene.userData.skyFill = skyFill;

  // --- Ground ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;  // lay the plane flat
  ground.receiveShadow = true;
  scene.add(ground);
  scene.userData.ground = ground; // used to raycast a "walk here" point

  // A lighter "dirt" clearing where the hero starts.
  const clearing = new THREE.Mesh(
    new THREE.CircleGeometry(9, 32),
    new THREE.MeshStandardMaterial({ map: dirtTexture(5), roughness: 1 })
  );
  clearing.rotation.x = -Math.PI / 2;
  clearing.position.y = 0.01;        // just above the ground to avoid flicker
  clearing.receiveShadow = true;
  scene.add(clearing);

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
  const AUTUMN = [0xd9822b, 0xc44536, 0xe3b04b, 0x6a8d3a, 0xb5651d]; // tree colors

  // Trees are collected into an array so other code can find & interact with them
  // (e.g. the Woodcutting system clicks and chops them).
  const bark = barkTexture();
  const trees = [];
  for (let i = 0; i < 42; i++) {
    const p = spot(70);
    const tree = makeTree(p.x, p.z, AUTUMN, bark);
    scene.add(tree);
    trees.push(tree);
  }
  scene.userData.trees = trees;
  scene.userData.outdoor.push(...trees);

  const rocks = [];
  for (let i = 0; i < 24; i++) { const p = spot(72); const r = makeRock(p.x, p.z); scene.add(r); rocks.push(r); }
  scene.userData.rocks = rocks;
  scene.userData.outdoor.push(...rocks);
  for (let i = 0; i < 70; i++) { const p = spot(74); const gr = makeGrass(p.x, p.z); scene.add(gr); scene.userData.outdoor.push(gr); }
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

// A lush, rounded RS/WoW tree: a tapered smooth trunk and a few layered, softly
// warped canopy clumps with smooth normals. Many instances, so kept light
// (low-segment spheres reused, smooth-shaded).
function makeTree(x, z, palette, bark) {
  const g = new THREE.Group();
  const trunkH = 1.7 + Math.random() * 1.3;

  // Tapered, smooth trunk — slightly bulged at the base for a sculpted root flare.
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.42, trunkH, 12, 1),
    new THREE.MeshStandardMaterial({ map: bark, roughness: 0.95 })
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true; trunk.receiveShadow = true;
  g.add(trunk);

  // Two leaf tones (a base + a slightly brighter top) for gentle depth.
  const base = palette[(Math.random() * palette.length) | 0];
  const c = new THREE.Color(base);
  const top = c.clone().offsetHSL(0, 0.02, 0.08).getHex();
  const leafLo = new THREE.MeshStandardMaterial({ color: base, roughness: 0.85 });
  const leafHi = new THREE.MeshStandardMaterial({ color: top, roughness: 0.8 });

  const r = 1.25 + Math.random() * 0.75;
  const seed = Math.random() * 10;

  // A wide rounded under-canopy + a couple of smaller upper clumps stacked to
  // build a layered, billowing crown.
  const clump = (radius, yOff, xz, mat, sy, sd) => {
    const m = new THREE.Mesh(lumpify(new THREE.SphereGeometry(radius, 12, 9), 0.14, sd), mat);
    m.position.set((Math.random() - 0.5) * xz, trunkH + yOff, (Math.random() - 0.5) * xz);
    m.scale.y = sy;
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    return m;
  };

  const blob = clump(r, r * 0.35, 0, leafLo, 0.9, seed);
  const blob2 = clump(r * 0.78, r * 0.95, r * 0.7, leafHi, 0.95, seed + 3.1);
  const blob3 = clump(r * 0.66, r * 0.55, r * 1.1, leafLo, 1.0, seed + 6.4);
  const blob4 = clump(r * 0.55, r * 1.25, r * 0.5, leafHi, 0.95, seed + 9.2);

  g.position.set(x, 0, z);
  g.rotation.y = Math.random() * Math.PI * 2;
  g.scale.setScalar(0.8 + Math.random() * 0.8);

  // Data the Woodcutting system uses: which parts are the "leaves" (hidden when
  // the tree is chopped to a stump), plus its current state.
  g.userData = { kind: 'tree', trunk, foliage: [blob, blob2, blob3, blob4], depleted: false, respawnAt: 0, shake: 0 };
  return g;
}

// A rounded, water-worn boulder: a higher-poly sphere warped into a few smooth
// lobes with smooth normals, so it lights softly instead of showing hard facets.
function makeRock(x, z) {
  const size = 0.6 + Math.random() * 0.9;
  const rock = new THREE.Mesh(
    lumpify(new THREE.SphereGeometry(size, 14, 10), 0.22, Math.random() * 10),
    new THREE.MeshStandardMaterial({ color: 0x8b8780, roughness: 0.85, metalness: 0.05 })
  );
  rock.position.set(x, size * 0.32, z);
  rock.scale.set(1, 0.55 + Math.random() * 0.45, 1);   // squat, settled into the ground
  rock.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.4);
  rock.castShadow = true; rock.receiveShadow = true;
  rock.userData = { kind: 'rock' };
  return rock;
}

// A little tuft of grass blades — rounded, slightly curved, smooth-shaded.
function makeGrass(x, z) {
  const g = new THREE.Group();
  const tint = 0x5f7a32 + ((Math.random() * 0x0a1006) | 0);
  const mat = new THREE.MeshStandardMaterial({ color: tint, roughness: 1 });
  const n = 3 + ((Math.random() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const h = 0.45 + Math.random() * 0.35;
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.06, h, 6), mat);
    blade.position.set((Math.random() - 0.5) * 0.55, h / 2, (Math.random() - 0.5) * 0.55);
    blade.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.5);
    g.add(blade);
  }
  g.position.set(x, 0, z);
  return g;
}
