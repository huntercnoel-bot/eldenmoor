// world.js — builds the zone you walk around in.
// Sky, fog, sunlight, the ground, and scattered trees / rocks / grass.

import * as THREE from '../vendor/three.module.js';
import { buildStructures, STRUCTURES } from './buildings.js';
import { buildTown, townStructures } from './town.js';
import { buildWater, waterStructures } from './water.js';
import { grassTexture, dirtTexture, barkTexture, skyDome } from './textures.js';

// The pond sits here. We also keep trees from spawning on top of it.
const POND = { x: 22, z: -16, r: 6 };
let EXTRA = [];   // extra tree-avoidance footprints from the town

export function buildWorld(scene) {
  // --- Sky color + distance fog (fog hides the far edges and adds depth) ---
  scene.background = new THREE.Color(0xdde9f0);
  scene.fog = new THREE.Fog(0xc6dcee, 55, 180);
  scene.userData.outdoor = [];        // scenery toggled off when you go upstairs / underground
  const sky = skyDome(); scene.add(sky); scene.userData.sky = sky;

  // --- Lights ---
  // Hemisphere light = soft fill: sky color from above, ground color from below.
  const hemi = new THREE.HemisphereLight(0xbcd6f0, 0x55492f, 1.0); scene.add(hemi); scene.userData.hemi = hemi;

  // The "sun": a strong directional light that casts shadows.
  const sun = new THREE.DirectionalLight(0xfff1d4, 2.7);
  scene.userData.sun = sun;
  sun.position.set(35, 55, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);          // shadow sharpness
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 200;
  sun.shadow.camera.left = -90;  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;    sun.shadow.camera.bottom = -90;
  sun.shadow.bias = -0.0004;                    // removes shadow "acne" specks
  scene.add(sun);

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
