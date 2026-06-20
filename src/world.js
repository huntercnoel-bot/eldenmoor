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

  // A little pond off to the side, as a landmark.
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(POND.r, 40),
    new THREE.MeshStandardMaterial({ color: 0x2f6ea5, roughness: 0.2, metalness: 0.1,
      transparent: true, opacity: 0.85 })
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(POND.x, 0.02, POND.z);
  scene.add(pond);
  scene.userData.outdoor.push(ground, clearing, pond);

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

// A stylized autumn tree: a trunk + a couple of low-poly leafy blobs.
function makeTree(x, z, palette, bark) {
  const g = new THREE.Group();
  const trunkH = 1.6 + Math.random() * 1.2;

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.3, trunkH, 8),
    new THREE.MeshStandardMaterial({ map: bark, roughness: 1 })
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true; trunk.receiveShadow = true;
  g.add(trunk);

  const color = palette[(Math.random() * palette.length) | 0];
  const leaf = new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true });

  const r = 1.3 + Math.random() * 0.8;
  const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leaf);
  blob.position.y = trunkH + r * 0.5;
  blob.scale.y = 0.85;
  blob.castShadow = true;
  g.add(blob);

  const blob2 = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.7, 0), leaf);
  blob2.position.set((Math.random() - 0.5) * 0.9, trunkH + r, (Math.random() - 0.5) * 0.9);
  blob2.castShadow = true;
  g.add(blob2);

  const blob3 = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.6, 0), leaf);
  blob3.position.set((Math.random() - 0.5) * 1.2, trunkH + r * 0.35, (Math.random() - 0.5) * 1.2);
  blob3.castShadow = true;
  g.add(blob3);

  g.position.set(x, 0, z);
  g.rotation.y = Math.random() * Math.PI * 2;
  g.scale.setScalar(0.8 + Math.random() * 0.8);

  // Data the Woodcutting system uses: which parts are the "leaves" (hidden when
  // the tree is chopped to a stump), plus its current state.
  g.userData = { kind: 'tree', trunk, foliage: [blob, blob2, blob3], depleted: false, respawnAt: 0, shake: 0 };
  return g;
}

// A chunky gray boulder.
function makeRock(x, z) {
  const rock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.6 + Math.random() * 0.9, 0),
    new THREE.MeshStandardMaterial({ color: 0x8b8780, roughness: 1, flatShading: true })
  );
  rock.position.set(x, 0.1, z);
  rock.scale.set(1, 0.6 + Math.random() * 0.5, 1);
  rock.rotation.set(Math.random(), Math.random() * Math.PI * 2, Math.random());
  rock.castShadow = true; rock.receiveShadow = true;
  rock.userData = { kind: 'rock' };
  return rock;
}

// A little tuft of grass blades.
function makeGrass(x, z) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x5f7a32, roughness: 1, flatShading: true });
  const n = 2 + ((Math.random() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.5 + Math.random() * 0.3, 4), mat);
    blade.position.set((Math.random() - 0.5) * 0.5, 0.25, (Math.random() - 0.5) * 0.5);
    g.add(blade);
  }
  g.position.set(x, 0, z);
  return g;
}
