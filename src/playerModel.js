// playerModel.js — the hero is the detailed WoW-style dwarf warrior (rune plate,
// braided beard, rune warhammer). Added as a CHILD of the player group so it
// inherits movement/facing/camera; the procedural body is hidden.
//
// Animation: his clips are idle (0) and a walk cycle (1) — there's no chop clip,
// so chopping is a procedural overhand hammer-swing layered onto the right arm
// bone. main.js feeds the walking/chopping state via player.userData.setDwarfMotion.
//
// Self-contained: polls for window.eldenmoor and boots itself.

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';

const URL = './assets/models/player/dwarf.gltf';
const HEIGHT = 1.95;
const FACE = Math.PI;
const loader = new GLTFLoader();

async function swapPlayer(em) {
  const player = em.player;
  if (!player) return;

  const gltf = await new Promise((ok, err) => loader.load(URL, ok, undefined, err));
  const dwarf = gltf.scene;
  dwarf.name = 'player-dwarf';

  const sz = new THREE.Vector3(); new THREE.Box3().setFromObject(dwarf).getSize(sz);
  dwarf.scale.setScalar(HEIGHT / (sz.y || 1));
  dwarf.rotation.y = FACE;
  dwarf.traverse((m) => {
    if (m.isMesh || m.isSkinnedMesh) {
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      m.userData.__toonDone = true;
    }
  });
  dwarf.updateMatrixWorld(true);
  dwarf.position.y = -new THREE.Box3().setFromObject(dwarf).min.y;

  const ud = player.userData || {};
  for (const part of [ud.body, ud.legL, ud.legR, ud.armL, ud.armR]) if (part) part.visible = false;
  if (Array.isArray(ud.hairParts)) for (const h of ud.hairParts) if (h) h.visible = false;

  player.add(dwarf);

  // --- animation state machine -------------------------------------------------
  const mixer = new THREE.AnimationMixer(dwarf);
  const clips = gltf.animations || [];
  const idleAction = clips[0] ? mixer.clipAction(clips[0]) : null;
  const walkAction = clips[1] ? mixer.clipAction(clips[1]) : null;
  let current = null;
  function fadeTo(action) {
    if (!action || action === current) return;
    action.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    if (current) current.crossFadeTo(action, 0.2, false); else action.fadeIn(0.2);
    current = action;
  }
  fadeTo(idleAction);

  // the arm that holds the hammer (right arm); we swing it for chopping.
  // (GLTFLoader strips dots, so 'Arm.R' becomes 'ArmR'.)
  let armR = null, armRBaseX = 0;
  dwarf.traverse((o) => { if (!armR && o.isBone && (o.name === 'ArmR' || o.name === 'ForeArmR')) armR = o; });
  if (armR) armRBaseX = armR.rotation.x;

  let walking = false, chopping = false, chopT = 0;
  // main.js calls this every frame with the live state
  player.userData.setDwarfMotion = (isWalking, isChopping) => { walking = !!isWalking; chopping = !!isChopping; };

  const clock = new THREE.Clock();
  (function tick() {
    requestAnimationFrame(tick);
    const dt = clock.getDelta();
    fadeTo(walking ? (walkAction || idleAction) : idleAction);
    mixer.update(dt);
    // overhand chop: raise + swing the hammer arm on top of the playing clip
    if (armR) {
      if (chopping) {
        chopT += dt * 9;                                   // chop cadence
        const swing = (Math.cos(chopT) * 0.5 + 0.5);       // 0..1, 1 = raised
        armR.rotation.x = armRBaseX - swing * 1.5;         // lift hammer up, drop into the cut
      } else {
        chopT = 0;
      }
    }
  })();

  em.playerDwarf = dwarf;
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
