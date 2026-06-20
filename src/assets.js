// assets.js — real glTF (.glb) model pipeline for Eldenmoor.
//
// Loads stylized, hand-painted CC0 characters (KayKit "Adventurers" pack) via a
// vendored GLTFLoader and drops them into the live scene — a step away from the
// blocky procedural meshes toward a WoW-style look. Models are skinned + rigged
// with a big animation set (Idle / Walking / attacks / Death …) and are
// re-skinned by the global cel-shade pass so they match the rest of the game.
//
// Self-contained: polls for window.eldenmoor and boots itself, so main.js only
// needs a single `import './assets.js';` line. Exposes its helpers on
// window.eldenmoor.assets for reuse (NPCs, monsters, the hero later).

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';

// CC0 1.0 — KayKit Character Pack: Adventurers (see assets/models/kaykit/LICENSE.txt)
export const KAYKIT_CHARACTERS = {
  Knight:    './assets/models/kaykit/Knight.glb',
  Rogue:     './assets/models/kaykit/Rogue.glb',
  Mage:      './assets/models/kaykit/Mage.glb',
  Barbarian: './assets/models/kaykit/Barbarian.glb',
};

const loader = new GLTFLoader();
const mixers = [];        // every live AnimationMixer, ticked by one RAF loop
let clock = null;

// Promise wrapper around GLTFLoader.load.
export function loadGLTF(url) {
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}

// Spawn a KayKit character into the scene.
//   opts: { position:[x,y,z], rotationY, height (target world height), anim }
// Returns a handle: { root, mixer, play(name), gltf } (async — resolves a Promise).
export async function spawnCharacter(name, opts = {}) {
  const url = KAYKIT_CHARACTERS[name];
  if (!url) throw new Error('unknown KayKit character: ' + name);
  const em = window.eldenmoor;
  if (!em || !em.scene) throw new Error('scene not ready');

  const gltf = await loadGLTF(url);
  const root = gltf.scene;

  // Skinned meshes must keep casting/receiving shadows like the rest of the cast.
  root.traverse((o) => {
    if (o.isMesh || o.isSkinnedMesh) {
      o.castShadow = true; o.receiveShadow = true;
      o.frustumCulled = false;           // skinned bounds can be wrong; avoid pop-out
    }
  });

  // Scale so the model stands at a believable height, then plant feet on the ground.
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3(); box.getSize(size);
  const targetH = opts.height || 1.9;
  const s = targetH / (size.y || 1);
  root.scale.setScalar(s);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  const [px, , pz] = opts.position || [0, 0, 0];
  const py = (opts.position && opts.position[1] != null) ? opts.position[1] : -box2.min.y;
  root.position.set(px, py, pz);
  if (opts.rotationY != null) root.rotation.y = opts.rotationY;

  em.scene.add(root);

  // Animation: drive a mixer, default to a looped Idle.
  const mixer = new THREE.AnimationMixer(root);
  const byName = {};
  for (const clip of gltf.animations) byName[clip.name] = clip;
  let current = null;
  function play(clipName, opt = {}) {
    const clip = byName[clipName] || byName.Idle || gltf.animations[0];
    if (!clip) return null;
    const action = mixer.clipAction(clip);
    action.reset();
    action.setLoop(opt.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = !!opt.once;
    if (current && current !== action) current.crossFadeTo(action, 0.2, false);
    action.play();
    current = action;
    return action;
  }
  play(opts.anim || 'Idle');
  mixers.push(mixer);

  // Re-skin into the cel-shaded / toon look so it matches the world.
  if (em.applyToonTo) { try { em.applyToonTo(root); } catch (e) { /* non-fatal */ } }

  return { root, mixer, play, gltf, animations: Object.keys(byName) };
}

// One RAF loop advances every mixer.
function tick() {
  requestAnimationFrame(tick);
  if (!clock) clock = new THREE.Clock();
  const dt = Math.min(0.05, clock.getDelta());
  for (const m of mixers) m.update(dt);
}

// ----- self-initialize: prove the pipeline with a couple of castle guards -----
(function boot() {
  let tries = 0;
  const iv = setInterval(async () => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.scene && em.player) {
      clearInterval(iv);
      tick();
      // Expose the pipeline for reuse (showcase.js, future NPC/monster swaps).
      // Nothing is spawned into the town itself — new assets live in the
      // separate showcase area so they don't mix with the existing build.
      em.assets = { loadGLTF, spawnCharacter, KAYKIT_CHARACTERS, mixers };
    } else if (tries > 600) { clearInterval(iv); }
  }, 100);
})();
