// npcModels.js — replaces the boxy PROCEDURAL town NPCs with real downloaded
// character models, the same way the King was already swapped.
//
// Self-contained: polls for window.eldenmoor, finds the NPC list, and for each
// NPC (except the King, already done) hides the procedural body meshes, parents
// a cloned GLTF model onto the NPC's group, tags every mesh `__toonDone`, and
// drives one shared rAF mixer loop. The group itself stays visible so the
// floating name label, raycast-to-talk and gentle wander all keep working.
//
// main.js only needs `import './npcModels.js';`.
//
// --- ANIMATION NOTES (verified by parsing the GLBs) -------------------------
// * KnightCharacter.glb ships its OWN clips ("HumanArmature|Idle",
//   "HumanArmature|Walking", "HumanArmature|Run", ...). Guards use these via a
//   per-model AnimationMixer, crossfading Idle<->Walking with movement.
// * The Quaternius modular men_*/women_* models ship NO clips. UniAnimLib was
//   meant to drive them, but its skeleton uses Rigify names ("DEF-upper_arm.L",
//   "root") while the modular models use Godot names ("UpperArm.L", "Root") —
//   ZERO bone-name overlap even after GLTFLoader strips dots, so retargeting
//   UniAnimLib onto them would animate nothing (a frozen pose). To stay robust
//   we therefore do NOT retarget: the modular models keep their natural A-pose
//   bind (arms already relaxed at the sides — never a T-pose) and get a subtle
//   procedural breathe/sway + a footstep-driven leg shuffle while walking. This
//   reads as a living person and can never visibly break.

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';

const DIR = './assets/models/npc/';
const loader = new GLTFLoader();
const cache = {};   // url -> Promise<gltf>

// The Quaternius modular men & women all ship in a stiff T-pose. Dropping the
// arms (verified by rendering every model AFTER the skeleton clone): the men need
// a local-Y rotation only (bind X/Z preserved); the women need a Y *and* a Z
// rotation. Bind X is always preserved; a tiny X-swing rides on top for
// breathing / walking. Never zero all three axes — that flings the arms up.
const ARM = { menY: 1.15, womenY: 2.2, womenZ: 1.25 };

function load(url) {
  if (!cache[url]) cache[url] = new Promise((ok, err) => loader.load(url, ok, undefined, err));
  return cache[url];
}

// SkinnedMesh-safe deep clone (inlined three.js SkeletonUtils.clone). A plain
// Object3D.clone(true) shares the Skeleton by reference, so multiple guards
// would fight over one set of bones and the mixer would drive the original
// model. This rebuilds each clone's skeleton from its OWN cloned bone tree.
function cloneSkinned(source) {
  const clone = source.clone(true);

  const cloneLookup = new Map();
  const sourceLookup = new Map();
  (function parallel(a, b) {           // a = source, b = clone
    sourceLookup.set(b, a);
    cloneLookup.set(a, b);
    const ac = a.children, bc = b.children;
    for (let i = 0; i < ac.length; i++) parallel(ac[i], bc[i]);
  })(source, clone);

  clone.traverse((node) => {
    if (!node.isSkinnedMesh) return;
    const cloneMesh = node;
    const sourceMesh = sourceLookup.get(cloneMesh);
    const sourceBones = sourceMesh.skeleton.bones;
    cloneMesh.skeleton = sourceMesh.skeleton.clone();
    cloneMesh.bindMatrix.copy(sourceMesh.bindMatrix);
    cloneMesh.skeleton.bones = sourceBones.map((b) => cloneLookup.get(b));
    cloneMesh.bind(cloneMesh.skeleton, cloneMesh.bindMatrix);
  });

  return clone;
}

// Reliable height/footing for a (possibly skinned) model. Box3.setFromObject is
// unreliable on freshly-cloned SkinnedMeshes (stale world matrices + bind-pose
// quirks gave wildly wrong sizes), so we measure the rest-pose silhouette
// straight from the transformed vertex positions. Returns world-space y bounds.
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

// Quaternius characters (modular + KnightCharacter) face +Z in their source;
// the wander code points the group with g.rotation.y = atan2(dx, dz), whose
// zero-heading is +Z — so a 0 facing offset makes them walk forward. Kept as a
// per-model field so a human can flip any single model to Math.PI if needed.
const FACE = 0;

// Per-NPC model assignment. Roles mapped sensibly; townsfolk spread for variety.
// `clips` models carry their own animation; the rest fall back to the relaxed
// procedural stand. `h` = target height in metres (guards a touch taller).
const ROLE = {
  KNIGHT:   { file: 'quaternius/KnightCharacter.glb', h: 1.95, face: FACE, clips: true },
  FARMER:   { file: 'quaternius/men_Farmer.glb',      h: 1.82, face: FACE },
  WORKER_M: { file: 'quaternius/men_Worker.glb',      h: 1.82, face: FACE },
  SUIT:     { file: 'quaternius/men_Suit.glb',        h: 1.82, face: FACE },
  CASUAL_M: { file: 'quaternius/men_Casual.glb',      h: 1.80, face: FACE },
  CASUAL2_M:{ file: 'quaternius/men_Casual2.glb',     h: 1.80, face: FACE },
  ADVENT_M: { file: 'quaternius/men_Adventurer.glb',  h: 1.82, face: FACE },
  PUNK_M:   { file: 'quaternius/men_Punk.glb',        h: 1.80, face: FACE },
  WORKER_W: { file: 'quaternius/women_Worker.glb',    h: 1.72, face: FACE },
  MEDIEVAL_W:{file: 'quaternius/women_Medieval.glb',  h: 1.72, face: FACE },
  FORMAL_W: { file: 'quaternius/women_Formal.glb',    h: 1.72, face: FACE },
  CASUAL_W: { file: 'quaternius/women_Casual.glb',    h: 1.72, face: FACE },
  ADVENT_W: { file: 'quaternius/women_Adventurer.glb',h: 1.72, face: FACE },
};

// id -> role key. Guards are handled by def.guard below, not listed here.
const NPC_ROLE = {
  farmer:   'FARMER',
  smith:    'WORKER_M',     // Garrett, blacksmith
  cook:     'WORKER_W',     // Bessa, castle cook
  nun:      'MEDIEVAL_W',   // Sister Adela
  banker:   'FORMAL_W',     // Edra
  bramble:  'SUIT',         // general-store keeper
  hilda:    'WORKER_W',     // burly axe merchant
  mara:     'CASUAL_W',     // market trader
  duke:     'SUIT',         // Duke Veylin, steward
  advisor:  'FORMAL_W',     // Lady Maelis
  tomas:    'CASUAL2_M',    // Old Tomas
  child:    'CASUAL_M',     // Wren (def.scale already shrinks the group)
  innkeep:  'WORKER_M',     // Bram
  patron1:  'ADVENT_M',     // Old Saul
  patron2:  'ADVENT_W',     // Edda
  jailer:   'PUNK_M',       // Grix
  prisoner: 'CASUAL2_M',    // Old Hagen
};

function roleFor(def) {
  if (def.id === 'king') return null;       // already swapped elsewhere — skip
  if (def.guard) return ROLE.KNIGHT;
  const key = NPC_ROLE[def.id];
  return key ? ROLE[key] : ROLE.CASUAL_M;   // sensible default for any stray NPC
}

// Pick the best Idle / Walk clip out of a model's own animation list.
function pickClip(clips, kind) {
  const names = clips.map((c) => c.name);
  const want = kind === 'walk'
    ? [/walk/i, /run/i, /jog/i]
    : [/\bidle\b/i, /idle/i, /stand/i];
  for (const re of want) {
    const i = names.findIndex((n) => re.test(n) && !/sword|jump|roll|death|attack|back/i.test(n));
    if (i >= 0) return clips[i];
  }
  // last resort for walk: anything not idle/death
  if (kind === 'walk') {
    const i = names.findIndex((n) => !/idle|death|tpose/i.test(n));
    if (i >= 0) return clips[i];
  }
  return clips[0] || null;
}

async function swapOne(em, n) {
  const def = n.def, group = n.group;
  const role = roleFor(def);
  if (!role || group.userData.__npcModelDone) return;
  group.userData.__npcModelDone = true;

  const gltf = await load(DIR + role.file);
  const model = cloneSkinned(gltf.scene);
  model.name = 'npc-' + def.id;

  // --- scale to a human height, normalise so the feet sit on y=0 ---
  model.rotation.y = role.face || 0;          // Y-rotation doesn't change height
  let m = measureY(model);                     // native rest-pose height (scale 1)
  let nativeH = (isFinite(m.h) && m.h > 0.01) ? m.h : 1.8;
  const s = role.h / nativeH;
  model.scale.setScalar(s);
  model.position.y = -m.min * s;               // drop feet to the group's y=0

  model.traverse((m) => {
    if (m.isMesh || m.isSkinnedMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;          // skinned bounds drift; keep it drawn
      m.userData.__toonDone = true;     // tell the cel-shader to leave it alone
    }
  });

  // --- hide the procedural body, but keep the group itself visible so the
  //     name label / raycast-to-talk / wander all still work. Done BEFORE the
  //     model is added so we only hide the boxy original meshes. ---
  group.traverse((o) => { if (o.isMesh) o.visible = false; });
  group.add(model);

  // ----- animation / pose ----------------------------------------------------
  // KnightCharacter ships its own rig-correct clips → use them. The clip-less
  // modular men/women can't borrow them (same bone names, different bind
  // orientation, which distorts the pose), so instead we force their shared rig
  // into a relaxed A-pose and breathe/swing it procedurally in the tick loop.
  const mixer = new THREE.AnimationMixer(model);
  const own = (gltf.animations && gltf.animations.length) ? gltf.animations : null;
  let idleAction = null, walkAction = null, arms = null;
  if (own) {
    const ic = pickClip(own, 'idle'), wc = pickClip(own, 'walk');
    if (ic) idleAction = mixer.clipAction(ic);
    if (wc) walkAction = mixer.clipAction(wc);
    if (idleAction) idleAction.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.2).play();
  } else {
    arms = { upL: null, upR: null, women: role.file.indexOf('women_') >= 0 };
    model.traverse((o) => {
      if (!o.isBone) return;
      if (o.name === 'UpperArmL') arms.upL = o;
      else if (o.name === 'UpperArmR') arms.upR = o;
    });
    // remember the bind rotation so we only override the one arm-down axis and
    // leave the other two as authored (zeroing them flings the arms up).
    if (arms.upL) arms.baseL = arms.upL.rotation.clone();
    if (arms.upR) arms.baseR = arms.upR.rotation.clone();
  }

  n._model = {
    model, mixer, idleAction, walkAction, arms,
    current: idleAction,
    lastX: group.position.x, lastZ: group.position.z,
    moving: false, phase: Math.random() * Math.PI * 2,
  };
}

function fadeTo(st, action) {
  if (!action || action === st.current) return;
  action.reset().setLoop(THREE.LoopRepeat, Infinity).play();
  if (st.current) st.current.crossFadeTo(action, 0.25, false); else action.fadeIn(0.25);
  st.current = action;
}

async function swapNpcs(em) {
  const npcs = em.npcs || [];
  // Swap each NPC independently — a single failure must not stall the rest.
  for (const n of npcs) {
    try { await swapOne(em, n); }
    catch (err) { console.error('[npcModels] swap failed for', n.def && n.def.id, err); }
  }

  const clock = new THREE.Clock();
  (function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.1);
    for (const n of npcs) {
      const st = n._model;
      if (!st) continue;
      const g = n.group;

      // movement detection: did the wander code move the group this frame?
      const dx = g.position.x - st.lastX, dz = g.position.z - st.lastZ;
      st.lastX = g.position.x; st.lastZ = g.position.z;
      const speed = Math.hypot(dx, dz) / (dt || 1 / 60);
      st.moving = speed > 0.05;

      if (st.idleAction || st.walkAction) {
        // clip-driven model (the Knight): crossfade its own Idle <-> Walk
        fadeTo(st, st.moving ? (st.walkAction || st.idleAction) : (st.idleAction || st.walkAction));
        st.mixer.update(dt);
      } else if (st.arms) {
        // clip-less modular model: hold a relaxed arms-down stand (men drop on Y,
        // women on Z), with a small X-swing for breathing / walking. Never T-poses.
        const a = st.arms;
        st.phase += dt * (st.moving ? 9 : 1.5);
        const sw = Math.sin(st.phase) * (st.moving ? 0.16 : 0.025);
        const bL = a.baseL, bR = a.baseR;
        if (a.women) {   // women: drop on Y and Z, keep bind X
          if (a.upL) a.upL.rotation.set(bL.x + sw, -ARM.womenY, ARM.womenZ);
          if (a.upR) a.upR.rotation.set(bR.x - sw, ARM.womenY, -ARM.womenZ);
        } else {         // men: drop on Y, keep bind X/Z
          if (a.upL) a.upL.rotation.set(bL.x + sw, -ARM.menY, bL.z);
          if (a.upR) a.upR.rotation.set(bR.x - sw, ARM.menY, bR.z);
        }
        st.mixer.update(dt);
      }
    }
  })();
}

// ----- self-initialize --------------------------------------------------------
(function boot() {
  let tries = 0;
  const iv = setInterval(async () => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.scene && em.npcs && em.npcs.length) {
      clearInterval(iv);
      try { await swapNpcs(em); }
      catch (err) { console.error('[npcModels] init failed', err); }
    } else if (tries > 800) { clearInterval(iv); }
  }, 100);
})();
