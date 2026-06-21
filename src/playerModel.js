// playerModel.js — replaces the BLOCKY PROCEDURAL PLAYER HERO with a real
// downloaded character model (Quaternius KnightCharacter), the same way the King
// and town NPCs were already swapped (see kingModel.js / npcModels.js).
//
// Self-contained: polls for window.eldenmoor, grabs em.player (the procedural
// hero Group built in player.js), loads KnightCharacter.glb, scales it to a
// human height, hides the boxy procedural body, parents the model onto the
// player group, tags every mesh `__toonDone`, and drives its OWN clips
// (Idle / Walking / swordAttack) from a tiny rAF mixer loop. The player group
// itself stays — controls keeps moving/rotating it, gear hooks keep working.
//
// main.js only needs `import './playerModel.js';` plus (optionally) a one-line
// hook that calls em.player.userData.setPlayerChop(bool) while woodcutting.
// This module does NOT edit main.js / player.js.
//
// --- ANIMATION NOTES (KnightCharacter ships its own rig-correct clips) -------
//   HumanArmature|Idle, HumanArmature|Walking, HumanArmature|Run,
//   HumanArmature|swordAttack* — used here via a per-model AnimationMixer that
//   crossfades Idle <-> Walking with movement and to the sword-attack clip while
//   chopping. Movement is detected from em.player.position delta each frame.

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';

const URL = './assets/models/npc/quaternius/KnightCharacter.glb';
const HEIGHT = 1.85;   // target standing height in metres

// The Quaternius KnightCharacter faces +Z in its source; controls sets
// player.rotation.y to the movement heading whose zero is +Z, so a 0 offset
// makes the hero face the way he walks (away from the south camera, like the old
// procedural hero). Kept tunable: set window.eldenmoor.playerTune.face = Math.PI
// in the console to flip him.
const FACE = 0;

const TUNE = { face: FACE };

// Reliable height/footing for a freshly-loaded SkinnedMesh. Box3.setFromObject
// is unreliable here (stale world matrices + bind-pose quirks), so we measure
// the rest-pose silhouette straight from the transformed vertex positions.
const _v = new THREE.Vector3();
function measureY(model) {
  model.updateMatrixWorld(true);
  let min = Infinity, max = -Infinity;
  model.traverse((o) => {
    if (!(o.isMesh || o.isSkinnedMesh) || !o.geometry || !o.geometry.attributes.position) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (_v.y < min) min = _v.y;
      if (_v.y > max) max = _v.y;
    }
  });
  return { min, max, h: max - min };
}

// Pick the best clip out of the model's own animation list by kind.
function pickClip(clips, kind) {
  const names = clips.map((c) => c.name);
  let want;
  if (kind === 'chop') want = [/^.*\bswordattack$/i, /swordattack/i, /attack/i];
  else if (kind === 'walk') want = [/walking/i, /\bwalk/i, /run/i, /jog/i];
  else want = [/\bidle\b/i, /idle/i, /stand/i];
  for (const re of want) {
    const i = names.findIndex((n) => re.test(n) && (kind === 'chop' || !/sword|jump|roll|death|attack|back/i.test(n)));
    if (i >= 0) return clips[i];
  }
  if (kind === 'walk') {
    const i = names.findIndex((n) => !/idle|death|tpose/i.test(n));
    if (i >= 0) return clips[i];
  }
  return clips[0] || null;
}

function swap(em) {
  em.playerTune = Object.assign({}, TUNE, em.playerTune || {});
  const player = em.player;
  const loader = new GLTFLoader();
  loader.load(URL, (gltf) => {
    const model = gltf.scene;
    model.name = 'player-hero';

    // --- scale to a human height, drop the feet to the group's y=0 ---
    model.rotation.y = em.playerTune.face || 0;     // Y-rotation doesn't change height
    const m = measureY(model);
    const nativeH = (isFinite(m.h) && m.h > 0.01) ? m.h : 1.8;
    const s = HEIGHT / nativeH;
    model.scale.setScalar(s);
    model.position.y = -m.min * s;                   // plant feet at the group origin

    model.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;          // skinned bounds drift; keep it drawn
        o.userData.__toonDone = true;     // tell the cel-shader to leave it alone
      }
    });

    // --- hide the procedural hero body, but keep the player group itself so
    //     controls / gear hooks / camera all keep working. Done BEFORE adding
    //     the model so only the boxy original meshes are hidden. ---
    player.traverse((o) => { if (o.isMesh) o.visible = false; });
    player.add(model);

    // ----- animation: use the model's OWN clips ------------------------------
    const own = (gltf.animations && gltf.animations.length) ? gltf.animations : [];
    const mixer = new THREE.AnimationMixer(model);
    const idleClip = pickClip(own, 'idle');
    const walkClip = pickClip(own, 'walk');
    const chopClip = pickClip(own, 'chop');
    const idleAction = idleClip ? mixer.clipAction(idleClip) : null;
    const walkAction = walkClip ? mixer.clipAction(walkClip) : null;
    const chopAction = chopClip ? mixer.clipAction(chopClip) : null;
    if (idleAction) idleAction.reset().setLoop(THREE.LoopRepeat, Infinity).play();

    const st = {
      model, mixer, idleAction, walkAction, chopAction,
      current: idleAction,
      lastX: player.position.x, lastZ: player.position.z,
      moving: false, chopping: false,
    };

    const fadeTo = (action) => {
      if (!action || action === st.current) return;
      action.reset().setLoop(THREE.LoopRepeat, Infinity).play();
      if (st.current) st.current.crossFadeTo(action, 0.2, false); else action.fadeIn(0.2);
      st.current = action;
    };

    // --- chop hook for main.js (woodcutting). The HUMAN wires the call; we
    //     just flip the flag and let the tick loop crossfade to/from it. ---
    player.userData.setPlayerChop = (bool) => { st.chopping = !!bool; };

    em.playerModel = st;

    const clock = new THREE.Clock();
    (function tick() {
      requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.1);

      // movement detection: did controls move the player group this frame?
      const dx = player.position.x - st.lastX, dz = player.position.z - st.lastZ;
      st.lastX = player.position.x; st.lastZ = player.position.z;
      const speed = Math.hypot(dx, dz) / (dt || 1 / 60);
      st.moving = speed > 0.05;

      // keep the facing offset live-tunable while iterating
      model.rotation.y = em.playerTune.face || 0;

      // chop > walk > idle
      if (st.chopping && st.chopAction) fadeTo(st.chopAction);
      else fadeTo(st.moving ? (st.walkAction || st.idleAction) : (st.idleAction || st.walkAction));

      st.mixer.update(dt);
    })();
  }, undefined, (err) => console.error('[playerModel] load failed', err));
}

// ----- self-initialize --------------------------------------------------------
(function boot() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.scene && em.player) {
      clearInterval(iv);
      try { swap(em); }
      catch (err) { console.error('[playerModel] init failed', err); }
    } else if (tries > 1200) { clearInterval(iv); }
  }, 100);
})();
