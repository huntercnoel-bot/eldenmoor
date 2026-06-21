// playerModel.js — replaces the procedural "block" hero with a real glTF
// character: the detailed WoW-style dwarf warrior (rune plate, braided beard, a
// rune warhammer). The dwarf is added as a CHILD of the player group, so it
// inherits movement, facing and the follow-camera for free; the procedural body
// is just hidden (the rig stays intact for gear/anim code that may reference it).
// Tagged __toonDone so it keeps its realistic textures (no cel-shade outline).
//
// Self-contained: polls for window.eldenmoor and boots itself.

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';

const URL = './assets/models/player/dwarf.gltf';
const HEIGHT = 1.95;            // world height to scale the dwarf to
const FACE = Math.PI;           // spin so he faces the player's forward (tuned)
const loader = new GLTFLoader();
let mixer = null, clock = null;

async function swapPlayer(em) {
  const player = em.player;
  if (!player) return;

  const gltf = await new Promise((ok, err) => loader.load(URL, ok, undefined, err));
  const dwarf = gltf.scene;
  dwarf.name = 'player-dwarf';

  // scale to the hero's height
  const sz = new THREE.Vector3(); new THREE.Box3().setFromObject(dwarf).getSize(sz);
  dwarf.scale.setScalar(HEIGHT / (sz.y || 1));
  dwarf.rotation.y = FACE;
  dwarf.traverse((m) => {
    if (m.isMesh || m.isSkinnedMesh) {
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      m.userData.__toonDone = true;          // keep the realistic dwarf textures
    }
  });
  // plant the feet at the player group's origin (which sits on the ground)
  dwarf.updateMatrixWorld(true);
  dwarf.position.y = -new THREE.Box3().setFromObject(dwarf).min.y;

  // hide the procedural body (rig refs kept for any code that reads them)
  const ud = player.userData || {};
  for (const part of [ud.body, ud.legL, ud.legR, ud.armL, ud.armR]) if (part) part.visible = false;
  if (Array.isArray(ud.hairParts)) for (const h of ud.hairParts) if (h) h.visible = false;

  player.add(dwarf);

  // idle animation
  mixer = new THREE.AnimationMixer(dwarf);
  const idle = gltf.animations && gltf.animations[0];
  if (idle) mixer.clipAction(idle).play();
  clock = new THREE.Clock();
  (function tick() {
    requestAnimationFrame(tick);
    if (mixer) mixer.update(clock.getDelta());
  })();

  em.playerDwarf = dwarf;     // expose for tuning from the console
}

(function boot() {
  let tries = 0;
  const iv = setInterval(async () => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.player) {
      clearInterval(iv);
      try { await swapPlayer(em); }
      catch (err) { console.error('[playerModel] swap failed', err); }
    } else if (tries > 800) { clearInterval(iv); }
  }, 100);
})();
