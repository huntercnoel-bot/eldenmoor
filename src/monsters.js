// monsters.js — smooth, rounded low-poly monsters for the first combat zone.
//
// Self-contained art + spawning. The combat system (combat.js) drives HP,
// damage, death and respawn; this module only owns the *geometry*, the world
// spawn placement, the idle wander, and the "aggro and chase the player" walk.
//
// Style rules (to match the hero/NPCs and the later cel-shaded pass):
//   * capsules / spheres / lathe only — NO boxes, NO flatShading.
//   * smooth normals everywhere; plain MeshStandardMaterial with a base `color`.
//   * each monster is a THREE.Group with a `.userData.rig` for limb animation
//     and a `.userData.monster` stat block the combat layer reads/writes.
//
// Exposed via window.eldenmoor.monsters (list + helpers). Self-initializes by
// polling for window.eldenmoor, so it needs no main.js wiring beyond the import.

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';

// ============================================================================
//  REAL CREATURE MODELS  —  swap the procedural blobs for rigged GLBs
// ============================================================================
// Each monster TYPE maps to a downloaded Quaternius creature (committed under
// assets/models/monsters/). The procedural group is still built (so combat.js
// keeps its hitbox / footprint / rig fields), but its meshes are hidden and a
// deep-cloned GLB is parented on top, driven by its OWN clips through an
// AnimationMixer (Idle / Walk / Attack / Death). Mirrors src/npcModels.js.

const MODEL_DIR = './assets/models/monsters/';
const _loader = new GLTFLoader();
const _glbCache = {};   // url -> Promise<gltf>

function loadGlb(url) {
  if (!_glbCache[url]) _glbCache[url] = new Promise((ok, err) => _loader.load(url, ok, undefined, err));
  return _glbCache[url];
}

// Per-type model assignment. `h` = target on-the-ground height in metres.
// `face` lets a human flip a single model 180° if it walks backwards.
//   giant_rat -> enemy_Rat   (perfect fit)
//   goblin    -> enemy_Spider (no humanoid enemy ships; the spider is the most
//                              menacing fit and is sized up to read as a brute)
const MONSTER_MODEL = {
  giant_rat: { file: 'enemy_Rat.glb',    h: 0.85, face: 0 },
  goblin:    { file: 'enemy_Spider.glb', h: 1.30, face: 0 },
  // New creatures wired to their own GLBs (Beast Tamer pass).
  frog:      { file: 'enemy_Frog.glb',   h: 0.70, face: 0 },
  snake:     { file: 'enemy_Snake.glb',  h: 0.55, face: 0 },
  wasp:      { file: 'enemy_Wasp.glb',   h: 0.60, face: 0 },
  // Trainer mobs. The chicken now has its OWN model (Kenney cube chick) — a
  // static mesh (no clips) that sits in Idle pose, fine for a fowl. Marsh hopper
  // still reuses the frog at a smaller scale (easy XP, like OSRS chickens & cows).
  chicken:   { file: 'chicken.glb',      h: 0.55, face: 0 },
  marsh_hopper: { file: 'enemy_Frog.glb', h: 0.40, face: 0 },
  // --- Undead dungeon mobs. Each undead now has its OWN KayKit Skeleton GLB so
  //     they read as distinct silhouettes (all share the same clip family —
  //     Idle/Walk/Attack/Death — so the existing mixer wiring is a drop-in):
  //       skeleton          -> Skeleton_Minion (base bones)
  //       skeleton_warrior  -> Skeleton_Warrior (armoured, larger)
  //       zombie            -> Skeleton_Rogue, tinted rotten green
  //       hollow_king       -> Skeleton_Mage, gilded + giant (distinct boss)
  skeleton:         { file: 'Skeleton_Minion.glb',  h: 1.70, face: 0 },
  skeleton_warrior: { file: 'Skeleton_Warrior.glb', h: 1.95, face: 0 },
  zombie:           { file: 'Skeleton_Rogue.glb',   h: 1.65, face: 0, tint: 0x4a6b34 },
  hollow_king:      { file: 'Skeleton_Mage.glb',    h: 2.85, face: 0, tint: 0xcaa44a },   // giant gilded bone-king
};

// SkinnedMesh-safe deep clone (inlined three.js SkeletonUtils.clone). A plain
// Object3D.clone(true) shares the Skeleton by reference, so multiple monsters of
// the same type would fight over one set of bones. This rebuilds each clone's
// skeleton from its OWN cloned bone tree. (Copied from src/npcModels.js.)
function cloneSkinned(source) {
  const clone = source.clone(true);
  const cloneLookup = new Map();
  const sourceLookup = new Map();
  (function parallel(a, b) {            // a = source, b = clone
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

// Reliable height/footing for a skinned model: measure the rest-pose silhouette
// straight from transformed vertex positions (Box3.setFromObject is unreliable
// on freshly-cloned SkinnedMeshes). Returns world-space y bounds.
const _mv = new THREE.Vector3();
function measureY(model) {
  model.updateMatrixWorld(true);
  let min = Infinity, max = -Infinity;
  model.traverse((o) => {
    if (!(o.isMesh || o.isSkinnedMesh) || !o.geometry || !o.geometry.attributes.position) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      _mv.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (_mv.y < min) min = _mv.y;
      if (_mv.y > max) max = _mv.y;
    }
  });
  return { min, max, h: max - min };
}

// Pick a clip by intent out of a creature's own animation list. These models
// name their clips "<Armature>|<Creature>_<Action>" (e.g. "RatArmature|Rat_Walk").
function pickMonsterClip(clips, kind) {
  if (!clips || !clips.length) return null;
  const order = {
    idle:   [/idle/i, /stand/i],
    walk:   [/run/i, /walk/i, /flying/i, /jog/i],
    attack: [/attack/i, /bite/i, /jump/i],
    death:  [/death/i, /die/i],
  }[kind] || [];
  for (const re of order) {
    const c = clips.find((c) => re.test(c.name) && !/tpose/i.test(c.name));
    if (c) return c;
  }
  return null;
}

// Attach a cloned GLB to a freshly-built monster group `g` of the given `type`.
// Hides the procedural meshes, parents the model, and wires up the mixer state
// onto g.userData._model. Resolves silently on any failure (the procedural body
// is kept visible as a fallback so a monster is never invisible / T-posed).
async function attachModel(g, type) {
  const cfg = MONSTER_MODEL[type.id];
  if (!cfg) return;
  let gltf;
  try { gltf = await loadGlb(MODEL_DIR + cfg.file); }
  catch (err) { console.error('[monsters] model load failed', cfg.file, err); return; }
  if (g.userData.monster && g.userData.monster.removed) return;   // killed mid-load

  const model = cloneSkinned(gltf.scene);
  model.name = 'monster-' + type.id;
  model.rotation.y = cfg.face || 0;            // Y-rot doesn't change height

  // scale to a sensible on-ground height, drop feet to the group's y=0
  const m = measureY(model);
  const nativeH = (isFinite(m.h) && m.h > 0.01) ? m.h : 1.0;
  const s = cfg.h / nativeH;
  model.scale.setScalar(s);
  model.position.y = -m.min * s;

  model.traverse((o) => {
    if (o.isMesh || o.isSkinnedMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;          // skinned bounds drift; keep it drawn
      o.userData.__toonDone = true;     // tell the cel-shader to leave it alone
      o.userData.monsterRoot = g;       // raycast hits on the model resolve to root
      // clone the material per-instance — clone(true) shares material refs, so
      // combat.js's death-fade (setOpacity) would otherwise fade every monster
      // of this type at once. A fresh copy keeps each death independent.
      if (o.material) o.material = Array.isArray(o.material) ? o.material.map((mm) => mm.clone()) : o.material.clone();
      // optional per-type tint (zombie reuses the skeleton GLB recoloured darker
      // green). Multiply the base colour so the model's texture detail survives.
      if (cfg.tint != null && o.material) {
        const tint = new THREE.Color(cfg.tint);
        const apply = (mm) => { if (mm && mm.color) mm.color.multiply(tint); };
        Array.isArray(o.material) ? o.material.forEach(apply) : apply(o.material);
      }
    }
  });

  // hide the procedural body (keep the group + rig objects for combat), add model
  g.traverse((o) => { if (o.isMesh) o.visible = false; });
  g.add(model);

  // ----- own-clip animation via a per-model mixer ----------------------------
  const mixer = new THREE.AnimationMixer(model);
  const clips = gltf.animations || [];
  const mk = (kind, loop) => {
    const clip = pickMonsterClip(clips, kind);
    if (!clip) return null;
    const a = mixer.clipAction(clip);
    if (loop === false) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    else a.setLoop(THREE.LoopRepeat, Infinity);
    return a;
  };
  const idle = mk('idle', true);
  const walk = mk('walk', true);
  const attack = mk('attack', false);
  const death = mk('death', false);
  const start = idle || walk;
  if (start) start.reset().play();

  g.userData._model = {
    model, mixer,
    idle, walk, attack, death,
    current: start || null,
    lastX: g.position.x, lastZ: g.position.z,
    attackUntil: 0,        // wall-clock (s) the attack action plays until
    lastAttackSeen: -1,    // md.lastAttack value we last reacted to
    deathPlayed: false,
  };
}

// ----- shared material helper (smooth, lit, cel-shade-ready) -----------------
function mat(color, rough = 0.85, metal = 0.0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}
const cap = (r, len, m) => { const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 10, 18), m); o.castShadow = true; o.receiveShadow = true; return o; };
const ball = (r, m) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), m); o.castShadow = true; o.receiveShadow = true; return o; };
const lathe = (pts, m, seg = 22) => { const o = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg), m); o.castShadow = true; o.receiveShadow = true; return o; };
const place = (o, x, y, z, rx = 0, ry = 0, rz = 0, s) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); if (s !== undefined) (Array.isArray(s) ? o.scale.set(s[0], s[1], s[2]) : o.scale.setScalar(s)); return o; };

// ============================================================================
//  MONSTER TYPES  —  smooth blobby creatures
// ============================================================================

// --- Giant rat: a low, rounded body with a domed head, ears, snout and tail.
function buildGiantRat() {
  const g = new THREE.Group();
  const fur = mat(0x6b5a48);          // brown-grey fur
  const skin = mat(0xc99a8c, 0.7);    // pink ears / nose / tail
  const dark = mat(0x141014);         // eyes

  // egg-shaped body (capsule, tilted forward, scaled to be hunched + low)
  const body = cap(0.42, 0.5, fur);
  place(body, 0, 0.5, 0, 0, 0, Math.PI / 2, [1, 1.25, 1]);
  body.scale.x = 1.0; body.scale.z = 0.9;
  g.add(body);

  // domed head out front
  const head = ball(0.3, fur); place(head, 0, 0.46, 0.62, 0, 0, 0, [1, 0.92, 1.1]); g.add(head);
  // tapered snout
  const snout = lathe([[0.0, 0], [0.1, 0.04], [0.13, 0.12], [0.07, 0.24], [0.0, 0.27]], fur, 16);
  place(snout, 0, 0.42, 0.78, Math.PI / 2, 0, 0, 1); g.add(snout);
  const nose = ball(0.05, skin); place(nose, 0, 0.42, 0.98); g.add(nose);
  // round ears
  for (const sx of [-1, 1]) { const ear = ball(0.13, skin); place(ear, sx * 0.16, 0.7, 0.56, 0, 0, 0, [0.7, 1, 0.4]); g.add(ear); }
  // beady eyes
  for (const sx of [-1, 1]) { const eye = ball(0.045, dark); place(eye, sx * 0.13, 0.5, 0.82); g.add(eye); }

  // four stubby legs (capsules) — front + back pairs we can swing
  const legs = [];
  const mkLeg = (x, z) => { const l = cap(0.07, 0.16, fur); place(l, x, 0.18, z, 0, 0, 0); g.add(l); legs.push(l); return l; };
  const flL = mkLeg(0.22, 0.4), flR = mkLeg(-0.22, 0.4);
  const blL = mkLeg(0.24, -0.18), blR = mkLeg(-0.24, -0.18);

  // long curved pink tail (lathe wisp behind)
  const tail = lathe([[0.0, 0], [0.05, 0.0], [0.045, 0.4], [0.03, 0.8], [0.0, 1.0]], skin, 12);
  place(tail, 0, 0.34, -0.5, -Math.PI / 2 - 0.5, 0, 0, 1); g.add(tail);

  g.userData.rig = { body, head, tail, frontL: flL, frontR: flR, backL: blL, backR: blR };
  return g;
}

// --- Goblin: a small, round-bellied humanoid — capsule torso, ball head, big
//     ears + nose, stubby limbs, clutching a little club.
function buildGoblin() {
  const g = new THREE.Group();
  const skinC = 0x6f8f43;             // mottled green
  const skin = mat(skinC);
  const cloth = mat(0x6e4a2c);        // loincloth / rags
  const wood = mat(0x5a3f24);         // club
  const dark = mat(0x14140f);

  // pot-bellied torso
  const torso = cap(0.3, 0.34, skin); place(torso, 0, 0.86, 0, 0, 0, 0, [1.1, 1, 0.95]); g.add(torso);
  const belly = ball(0.27, skin); place(belly, 0, 0.74, 0.06, 0, 0, 0, [1.05, 0.9, 1]); g.add(belly);
  // ragged loincloth (lathe skirt)
  const rag = lathe([[0.24, 0], [0.3, -0.12], [0.28, -0.22], [0.2, -0.28]], cloth, 18);
  place(rag, 0, 0.66, 0, 0, 0, 0, 1); g.add(rag);

  // big round head, sloped brow
  const head = ball(0.26, skin); place(head, 0, 1.32, 0.02, 0, 0, 0, [1, 1.05, 1]); g.add(head);
  const brow = ball(0.2, skin); place(brow, 0, 1.42, 0.12, 0, 0, 0, [1.1, 0.5, 0.9]); g.add(brow);
  // long hooked nose
  const nose = lathe([[0.0, 0], [0.07, 0.05], [0.09, 0.16], [0.04, 0.27], [0.0, 0.3]], skin, 14);
  place(nose, 0, 1.3, 0.22, Math.PI / 2 - 0.3, 0, 0, 1); g.add(nose);
  // big pointy ears (cones via lathe)
  for (const sx of [-1, 1]) { const ear = lathe([[0.0, 0], [0.08, 0.02], [0.1, 0.1], [0.0, 0.3]], skin, 12); place(ear, sx * 0.27, 1.36, -0.02, 0, 0, sx * -1.1, 1); g.add(ear); }
  // beady yellow-dark eyes
  for (const sx of [-1, 1]) { const eye = ball(0.04, dark); place(eye, sx * 0.1, 1.34, 0.24); g.add(eye); }
  // little tusks
  for (const sx of [-1, 1]) { const t = ball(0.03, mat(0xeae3c8)); place(t, sx * 0.06, 1.2, 0.22, 0, 0, 0, [0.7, 1.4, 0.7]); g.add(t); }

  // arms (shoulder groups so we can swing them)
  const mkArm = (x) => { const a = new THREE.Group(); a.position.set(x, 1.08, 0); const upper = cap(0.08, 0.26, skin); place(upper, 0, -0.16, 0); a.add(upper); const hand = ball(0.09, skin); place(hand, 0, -0.34, 0.02); a.add(hand); g.add(a); return a; };
  const armL = mkArm(0.3), armR = mkArm(-0.3);
  // club in the right hand
  const club = new THREE.Group();
  const handle = cap(0.04, 0.26, wood); place(handle, 0, -0.13, 0); club.add(handle);
  const knob = ball(0.11, wood); place(knob, 0, -0.3, 0); club.add(knob);
  club.position.set(0, -0.34, 0.04); club.rotation.x = -0.5; armR.add(club);

  // stubby legs
  const mkLeg = (x) => { const l = new THREE.Group(); l.position.set(x, 0.5, 0); const leg = cap(0.1, 0.2, skin); place(leg, 0, -0.16, 0); l.add(leg); const foot = ball(0.1, skin); place(foot, 0, -0.32, 0.05, 0, 0, 0, [1, 0.7, 1.4]); l.add(foot); g.add(l); return l; };
  const legL = mkLeg(0.14), legR = mkLeg(-0.14);

  g.userData.rig = { body: torso, head, armL, armR, legL, legR, club };
  return g;
}

// --- Frog: a squat green dome with bulging eyes and folded back legs. ---------
function buildFrog() {
  const g = new THREE.Group();
  const skin = mat(0x6fae45);
  const belly = mat(0xcfe09a, 0.8);
  const dark = mat(0x14140f);

  const body = ball(0.34, skin); place(body, 0, 0.3, 0, 0, 0, 0, [1.2, 0.85, 1.1]); g.add(body);
  const under = ball(0.27, belly); place(under, 0, 0.22, 0.08, 0, 0, 0, [1.1, 0.6, 1]); g.add(under);
  // wide flat mouth
  const head = ball(0.26, skin); place(head, 0, 0.32, 0.28, 0, 0, 0, [1.25, 0.7, 0.8]); g.add(head);
  for (const sx of [-1, 1]) {
    const bulge = ball(0.11, skin); place(bulge, sx * 0.16, 0.5, 0.18); g.add(bulge);
    const eye = ball(0.06, dark); place(eye, sx * 0.16, 0.52, 0.26); g.add(eye);
  }
  // folded back legs (groups so the rig can hop them) + small front legs
  const mkBack = (x) => { const l = new THREE.Group(); l.position.set(x, 0.16, -0.14); const thigh = cap(0.07, 0.14, skin); place(thigh, 0, 0, 0, 0, 0, Math.PI / 2 - 0.6); l.add(thigh); const foot = ball(0.07, skin); place(foot, x * 0.18, -0.06, 0.12, 0, 0, 0, [1.6, 0.5, 1]); l.add(foot); g.add(l); return l; };
  const blL = mkBack(0.22), blR = mkBack(-0.22);
  const mkFront = (x) => { const l = cap(0.05, 0.1, skin); place(l, x, 0.1, 0.2); g.add(l); return l; };
  const flL = mkFront(0.13), flR = mkFront(-0.13);
  g.userData.rig = { body, head, frontL: flL, frontR: flR, backL: blL, backR: blR };
  return g;
}

// --- Snake: a coiled tapering body, raised head, flicking tongue. -------------
function buildSnake() {
  const g = new THREE.Group();
  const skin = mat(0x4f8a3e);
  const under = mat(0xd0c878, 0.8);
  const dark = mat(0x14140f);
  // coiled base ring (torus-like via lathe ring) + tapering raised neck
  const coil = lathe([[0.28, 0], [0.36, 0.05], [0.36, 0.12], [0.28, 0.16], [0.24, 0.1], [0.24, 0.04]], skin, 24);
  place(coil, 0, 0.06, 0, 0, 0, 0, 1); g.add(coil);
  const neck = cap(0.11, 0.34, skin); place(neck, 0, 0.42, 0.04, -0.5, 0, 0); g.add(neck);
  const head = ball(0.14, skin); place(head, 0, 0.62, 0.22, 0, 0, 0, [1, 0.8, 1.3]); g.add(head);
  const chin = ball(0.1, under); place(chin, 0, 0.57, 0.28, 0, 0, 0, [1, 0.5, 1]); g.add(chin);
  for (const sx of [-1, 1]) { const eye = ball(0.035, dark); place(eye, sx * 0.07, 0.66, 0.3); g.add(eye); }
  const tongue = lathe([[0, 0], [0.012, 0.1], [0, 0.2]], mat(0xb03040), 8); place(tongue, 0, 0.6, 0.36, Math.PI / 2 - 0.3, 0, 0); g.add(tongue);
  // "head" as the swing rig so the procedural fallback sways
  g.userData.rig = { body: coil, head, neck };
  return g;
}

// --- Wasp: a striped abdomen, thorax, head, and a pair of wing planes. --------
function buildWasp() {
  const g = new THREE.Group();
  const yellow = mat(0xe0b830);
  const black = mat(0x231b10);
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xeaf2ff, roughness: 0.3, transparent: true, opacity: 0.5 });
  // floats a bit off the ground
  const thorax = ball(0.17, black); place(thorax, 0, 0.66, 0); g.add(thorax);
  const abdomen = lathe([[0, 0], [0.12, 0.06], [0.17, 0.2], [0.1, 0.36], [0, 0.42]], yellow, 18);
  place(abdomen, 0, 0.62, -0.16, Math.PI / 2 + 0.4, 0, 0); g.add(abdomen);
  // stripe bands
  for (let i = 0; i < 2; i++) { const band = ball(0.13 - i * 0.03, black); place(band, 0, 0.6 - i * 0.02, -0.18 - i * 0.12, 0, 0, 0, [1, 0.5, 1]); g.add(band); }
  const head = ball(0.12, black); place(head, 0, 0.68, 0.18); g.add(head);
  for (const sx of [-1, 1]) { const eye = ball(0.04, mat(0x6a3010)); place(eye, sx * 0.07, 0.7, 0.26); g.add(eye); const ant = cap(0.012, 0.12, black); place(ant, sx * 0.05, 0.8, 0.22, -0.6, 0, sx * 0.3); g.add(ant); }
  const stinger = lathe([[0, 0], [0.03, 0.04], [0, 0.16]], black, 8); place(stinger, 0, 0.58, -0.5, Math.PI / 2, 0, 0); g.add(stinger);
  // wings (thin planes) — grouped so the rig can buzz them
  const mkWing = (x) => { const w = new THREE.Group(); w.position.set(x, 0.74, -0.02); const plane = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), wingMat); plane.material.side = THREE.DoubleSide; place(plane, x * 0.2, 0, -0.06, 0, 0, 0, [0.7, 1, 1]); plane.rotation.x = -Math.PI / 2 + 0.3; w.add(plane); g.add(w); return w; };
  const wingL = mkWing(0.16), wingR = mkWing(-0.16);
  g.userData.rig = { body: thorax, head, wingL, wingR, abdomen };
  return g;
}

// --- Chicken: a tiny round trainer fowl (reuses no GLB humanoid). -------------
function buildChicken() {
  const g = new THREE.Group();
  const feather = mat(0xf0ead8);
  const beakC = mat(0xe0a030);
  const comb = mat(0xc83a2a);
  const dark = mat(0x14140f);
  const body = ball(0.2, feather); place(body, 0, 0.3, 0, 0, 0, 0, [1, 1.1, 1.2]); g.add(body);
  const head = ball(0.12, feather); place(head, 0, 0.5, 0.08); g.add(head);
  const cb = ball(0.05, comb); place(cb, 0, 0.6, 0.06, 0, 0, 0, [1.4, 0.7, 0.5]); g.add(cb);
  const beak = lathe([[0, 0], [0.04, 0.03], [0, 0.1]], beakC, 8); place(beak, 0, 0.5, 0.22, Math.PI / 2, 0, 0); g.add(beak);
  for (const sx of [-1, 1]) { const eye = ball(0.02, dark); place(eye, sx * 0.05, 0.52, 0.16); g.add(eye); }
  const tail = lathe([[0, 0], [0.08, 0.04], [0, 0.18]], feather, 8); place(tail, 0, 0.36, -0.18, -1.0, 0, 0); g.add(tail);
  const mkLeg = (x) => { const l = new THREE.Group(); l.position.set(x, 0.16, 0); const leg = cap(0.02, 0.1, beakC); place(leg, 0, -0.06, 0); l.add(leg); g.add(l); return l; };
  const legL = mkLeg(0.07), legR = mkLeg(-0.07);
  g.userData.rig = { body, head, legL, legR };
  return g;
}

// ----- monster catalogue (stats the combat layer reads) ----------------------
export const MONSTER_TYPES = {
  // ===== TRAINER MOBS (low-level, easy XP, no aggro) ========================
  chicken: {
    id: 'chicken', name: 'Chicken', build: buildChicken, scale: 1.0,
    maxHp: 3, dmg: [0, 1], attackSpeed: 2.4, defense: 0,
    aggroRange: 0, leashRange: 14, speed: 1.4, hpBarY: 0.7,
    xp: 3, loot: [
      { id: 'bones', chance: 1.0, min: 1, max: 1 },              // always
      { id: 'feather', chance: 0.9, min: 5, max: 15 },           // common
      { id: 'raw_chicken', chance: 0.85, min: 1, max: 1 },       // common
      { id: 'coins', chance: 0.25, min: 1, max: 3 },             // uncommon
    ],
  },
  marsh_hopper: {
    id: 'marsh_hopper', name: 'Marsh Hopper', build: buildFrog, scale: 1.0,
    maxHp: 5, dmg: [0, 1], attackSpeed: 2.2, defense: 1,
    aggroRange: 0, leashRange: 16, speed: 1.7, hpBarY: 0.6,
    xp: 5, loot: [
      { id: 'bones', chance: 1.0, min: 1, max: 1 },
      { id: 'raw_meat', chance: 0.8, min: 1, max: 1 },
      { id: 'frog_leg', chance: 0.35, min: 1, max: 2 },
      { id: 'coins', chance: 0.3, min: 1, max: 5 },
    ],
  },

  // ===== STANDARD MOBS ======================================================
  giant_rat: {
    id: 'giant_rat', name: 'Giant Rat', build: buildGiantRat, scale: 1.0,
    maxHp: 12, dmg: [1, 3], attackSpeed: 1.6, defense: 1,
    aggroRange: 7, leashRange: 22, speed: 1.9, hpBarY: 1.05,
    xp: 8, loot: [
      { id: 'bones', chance: 1.0, min: 1, max: 1 },              // always
      { id: 'coins', chance: 0.85, min: 1, max: 6 },             // common
      { id: 'raw_rat_meat', chance: 0.5, min: 1, max: 1 },       // common
      { id: 'rat_tail', chance: 0.3, min: 1, max: 1 },           // uncommon (themed)
      { id: 'bronze_dagger', chance: 0.03, min: 1, max: 1 },     // rare (gear)
    ],
  },
  frog: {
    id: 'frog', name: 'Giant Frog', build: buildFrog, scale: 1.4,
    maxHp: 18, dmg: [1, 4], attackSpeed: 1.8, defense: 2,
    aggroRange: 6, leashRange: 20, speed: 2.0, hpBarY: 1.0,
    xp: 13, loot: [
      { id: 'bones', chance: 1.0, min: 1, max: 1 },
      { id: 'coins', chance: 0.85, min: 3, max: 14 },
      { id: 'raw_meat', chance: 0.55, min: 1, max: 2 },
      { id: 'frog_leg', chance: 0.4, min: 1, max: 3 },           // themed
      { id: 'leather_body', chance: 0.04, min: 1, max: 1 },      // rare gear
    ],
  },
  goblin: {
    id: 'goblin', name: 'Goblin', build: buildGoblin, scale: 1.0,
    maxHp: 22, dmg: [2, 5], attackSpeed: 1.9, defense: 3,
    aggroRange: 8, leashRange: 26, speed: 2.2, hpBarY: 1.85,
    xp: 18, loot: [
      { id: 'bones', chance: 1.0, min: 1, max: 1 },
      { id: 'coins', chance: 0.95, min: 3, max: 18 },
      { id: 'raw_meat', chance: 0.4, min: 1, max: 1 },
      { id: 'goblin_ear', chance: 0.45, min: 1, max: 1 },        // themed
      { id: 'goblin_charm', chance: 0.12, min: 1, max: 1 },      // uncommon themed
      { id: 'bronze_sword', chance: 0.05, min: 1, max: 1 },      // rare gear
      { id: 'bronze_axe', chance: 0.04, min: 1, max: 1 },        // rare gear
    ],
  },
  wasp: {
    id: 'wasp', name: 'Giant Wasp', build: buildWasp, scale: 1.3,
    maxHp: 20, dmg: [2, 5], attackSpeed: 1.4, defense: 4,
    aggroRange: 9, leashRange: 24, speed: 3.0, hpBarY: 1.1,
    xp: 20, loot: [
      { id: 'bones', chance: 1.0, min: 1, max: 1 },
      { id: 'coins', chance: 0.9, min: 4, max: 22 },
      { id: 'raw_meat', chance: 0.3, min: 1, max: 1 },
      { id: 'wasp_stinger', chance: 0.45, min: 1, max: 2 },      // themed
      { id: 'iron_dagger', chance: 0.05, min: 1, max: 1 },       // rare gear
    ],
  },
  snake: {
    id: 'snake', name: 'Giant Snake', build: buildSnake, scale: 1.5,
    maxHp: 32, dmg: [3, 7], attackSpeed: 1.7, defense: 6,
    aggroRange: 9, leashRange: 28, speed: 2.4, hpBarY: 1.1,
    xp: 32, loot: [
      { id: 'big_bones', chance: 1.0, min: 1, max: 1 },         // always (bigger beast)
      { id: 'coins', chance: 0.95, min: 8, max: 40 },
      { id: 'raw_meat', chance: 0.5, min: 1, max: 2 },
      { id: 'snake_hide', chance: 0.5, min: 1, max: 1 },        // themed material
      { id: 'snake_fang', chance: 0.3, min: 1, max: 1 },        // themed trophy
      { id: 'emerald', chance: 0.04, min: 1, max: 1 },          // rare valuable
    ],
  },

  // ===== UNDEAD DUNGEON MOBS (Crypt of the Hollow King) =====================
  // Tougher than the surface beasts and aggressive — proper mid-level PvE. They
  // share one rigged GLB (the skeleton) and lean on the same drop economy:
  // always bones/big_bones, good coin, common smithing materials (coal/iron ore)
  // and the occasional bronze/iron gear, topped by a rare themed ancient_shard.
  skeleton: {
    id: 'skeleton', name: 'Skeleton', build: buildGoblin, scale: 1.0,
    maxHp: 38, dmg: [3, 8], attackSpeed: 1.8, defense: 7,
    aggroRange: 9, leashRange: 30, speed: 2.2, hpBarY: 2.0,
    xp: 36, loot: [
      { id: 'bones', chance: 1.0, min: 1, max: 1 },              // always
      { id: 'coins', chance: 0.95, min: 8, max: 38 },            // common
      { id: 'coal', chance: 0.3, min: 1, max: 2 },               // material
      { id: 'iron_ore', chance: 0.18, min: 1, max: 1 },          // material
      { id: 'bronze_sword', chance: 0.07, min: 1, max: 1 },      // gear
      { id: 'iron_dagger', chance: 0.05, min: 1, max: 1 },       // gear
      { id: 'ancient_shard', chance: 0.012, min: 1, max: 1 },    // rare themed
    ],
  },
  skeleton_warrior: {
    id: 'skeleton_warrior', name: 'Skeleton Warrior', build: buildGoblin, scale: 1.0,
    maxHp: 60, dmg: [5, 12], attackSpeed: 2.0, defense: 12,
    aggroRange: 10, leashRange: 32, speed: 2.3, hpBarY: 2.2,
    xp: 60, loot: [
      { id: 'big_bones', chance: 1.0, min: 1, max: 1 },          // always (heavier)
      { id: 'coins', chance: 0.98, min: 20, max: 75 },           // common, generous
      { id: 'coal', chance: 0.4, min: 1, max: 3 },               // material
      { id: 'iron_ore', chance: 0.3, min: 1, max: 2 },           // material
      { id: 'iron_sword', chance: 0.08, min: 1, max: 1 },        // gear
      { id: 'iron_helm', chance: 0.06, min: 1, max: 1 },         // gear
      { id: 'ancient_shard', chance: 0.04, min: 1, max: 1 },     // rare themed
    ],
  },
  zombie: {
    id: 'zombie', name: 'Zombie', build: buildGoblin, scale: 1.0,
    maxHp: 46, dmg: [4, 9], attackSpeed: 2.4, defense: 6,
    aggroRange: 8, leashRange: 28, speed: 1.5, hpBarY: 2.0,
    xp: 44, loot: [
      { id: 'big_bones', chance: 1.0, min: 1, max: 1 },          // always
      { id: 'coins', chance: 0.9, min: 6, max: 30 },             // common
      { id: 'raw_meat', chance: 0.35, min: 1, max: 1 },          // rotten flesh
      { id: 'coal', chance: 0.22, min: 1, max: 2 },              // material
      { id: 'bronze_dagger', chance: 0.06, min: 1, max: 1 },     // gear
      { id: 'ancient_shard', chance: 0.018, min: 1, max: 1 },    // rare themed
    ],
  },
  // THE BOSS — the Hollow King, a giant gilded skeleton ruling the inner crypt.
  // A real fight: heavy HP/defence and big hits, but slow. Guaranteed great loot,
  // including a near-even chance at one of two uniques (his crown or his blade).
  hollow_king: {
    id: 'hollow_king', name: 'The Hollow King', build: buildGoblin, scale: 1.0,
    maxHp: 220, dmg: [10, 24], attackSpeed: 2.6, defense: 22,
    aggroRange: 12, leashRange: 40, speed: 2.0, hpBarY: 3.4, boss: true,
    xp: 340, loot: [
      { id: 'big_bones', chance: 1.0, min: 2, max: 3 },          // always, plenty
      { id: 'coins', chance: 1.0, min: 200, max: 600 },          // a king's purse
      { id: 'ancient_shard', chance: 1.0, min: 1, max: 2 },      // always (curio)
      { id: 'coal', chance: 0.7, min: 3, max: 8 },
      { id: 'mithril_ore', chance: 0.4, min: 1, max: 3 },
      { id: 'death_rune', chance: 0.5, min: 5, max: 15 },        // arcane spoils
      { id: 'crown_of_the_hollow', chance: 0.5, min: 1, max: 1 },// UNIQUE (head)
      { id: 'hollow_blade', chance: 0.5, min: 1, max: 1 },       // UNIQUE (weapon)
    ],
  },
};

// Where monsters live, laid out as OSRS-style SPAWN ZONES that ramp in danger
// the further you stray from town. Each entry: [type, centerX, centerZ, count].
//   * Farmstead (near town):  chickens + marsh hoppers + a couple rats — safe,
//     non-aggressive trainer fodder for a brand-new player.
//   * Field rats / frogs:     classic low-level aggressive mobs.
//   * Goblin & wasp wilds:    mid-level threats further out.
//   * Snake fen (far out):    the toughest zone, real danger + best loot.
const SPAWN_CLUSTERS = [
  // --- Farmstead trainer zone, close to town centre -----------------------
  ['chicken', -16, 14, 4],
  ['chicken', -22, 18, 3],
  ['marsh_hopper', -20, 24, 3],
  ['giant_rat', -24, 12, 2],

  // --- Low-level field zone -----------------------------------------------
  ['giant_rat', -40, -10, 3],
  ['giant_rat', 38, -34, 2],
  ['frog', 28, 26, 3],
  ['frog', -34, 30, 2],

  // --- Mid-level wilds ----------------------------------------------------
  ['goblin', -46, -38, 3],
  ['goblin', 44, 8, 2],
  ['wasp', 54, -24, 3],
  ['wasp', -52, 6, 2],

  // --- Far snake fen (high danger) ----------------------------------------
  ['snake', 64, 40, 3],
  ['snake', -64, -52, 2],

  // --- Crypt of the Hollow King (undead dungeon, far NW corner) ------------
  // Built by dungeon.js around (-105, 88). The undead pack tight around the
  // crypt mouth, scaling up in danger toward the inner ring.
  ['skeleton', -118, 78, 3],
  ['skeleton', -100, 96, 3],
  ['zombie', -112, 92, 3],
  ['zombie', -96, 80, 2],
  ['skeleton_warrior', -107, 88, 2],
  ['skeleton_warrior', -120, 96, 1],
  // The boss holds the inner crypt — a single Hollow King.
  ['hollow_king', -107, 100, 1],
];

const rand = (a, b) => a + Math.random() * (b - a);

// Build one monster instance positioned at (x,z), returning the group with a
// fresh stat block on userData.monster.
export function spawnMonster(typeId, x, z) {
  const type = MONSTER_TYPES[typeId];
  if (!type) return null;
  const g = type.build();
  g.scale.setScalar(type.scale);
  g.position.set(x, 0, z);
  g.rotation.y = Math.random() * Math.PI * 2;
  g.userData.monster = {
    typeId, type,
    hp: type.maxHp, maxHp: type.maxHp,
    alive: true,
    state: 'wander',          // 'wander' | 'chase' | 'dead'
    home: { x, z },
    target: { x, z },
    nextWander: 0,
    lastAttack: 0,
    phase: Math.random() * 10,
    bob: 0,
  };
  // tag every child so a raycast hit can walk up to the root group
  g.traverse((o) => { o.userData.monsterRoot = g; });
  // cel-shade this fresh monster (flat toon bands + outline) to match the scene
  const em = window.eldenmoor;
  if (em && em.applyToonTo) em.applyToonTo(g);
  // swap the procedural blob for a real rigged creature model (async; the
  // procedural body shows until the GLB resolves, so it's never invisible)
  attachModel(g, type).catch((err) => console.error('[monsters] attach failed', err));
  return g;
}

// ============================================================================
//  WORLD MANAGER  —  spawn, wander, aggro/chase
// ============================================================================
function startMonsters(em) {
  const { scene } = em;
  const monsters = [];

  function spawnAll() {
    // Build the full spawn list, then spawn a FEW per tick instead of all at
    // once. Each spawn clones a skinned GLB + builds an AnimationMixer, so doing
    // all ~50 synchronously on login caused a big CPU spike (the "super laggy on
    // login" stutter). Staggering spreads it over ~2s for a smooth entrance.
    const queue = [];
    for (const [typeId, cx, cz, count] of SPAWN_CLUSTERS)
      for (let i = 0; i < count; i++) queue.push([typeId, cx, cz]);
    let qi = 0;
    (function pump() {
      for (let n = 0; n < 3 && qi < queue.length; n++, qi++) {
        const [typeId, cx, cz] = queue[qi];
        const a = Math.random() * Math.PI * 2, r = rand(2, 9);
        const m = spawnMonster(typeId, cx + Math.cos(a) * r, cz + Math.sin(a) * r);
        if (m) { scene.add(m); monsters.push(m); }
      }
      if (qi < queue.length) setTimeout(pump, 110);
    })();
  }
  spawnAll();

  // Respawn a fresh monster of the same type near the original home after death.
  function respawn(typeId, home) {
    const a = Math.random() * Math.PI * 2, r = rand(1, 6);
    const m = spawnMonster(typeId, home.x + Math.cos(a) * r, home.z + Math.sin(a) * r);
    if (m) { scene.add(m); monsters.push(m); }
    return m;
  }

  // Remove a dead monster from the scene + list (combat.js calls after fade).
  function remove(group) {
    const i = monsters.indexOf(group);
    if (i >= 0) monsters.splice(i, 1);
    if (group.userData.monster) group.userData.monster.removed = true;
    const sm = group.userData._model;
    if (sm && sm.mixer) sm.mixer.stopAllAction();
    scene.remove(group);
    group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }

  // smoothly crossfade a model's mixer onto a new looping action
  function fadeTo(sm, action) {
    if (!action || action === sm.current) return;
    action.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    if (sm.current) sm.current.crossFadeTo(action, 0.2, false); else action.fadeIn(0.2);
    sm.current = action;
  }

  // Drive a GLB monster's own clips: Death > Attack > Walk > Idle. Returns true
  // if the model handled animation (so the procedural rig path is skipped).
  function driveModel(g, md, dt, t, moving) {
    const sm = g.userData._model;
    if (!sm) return false;

    // Death: play once on death, then hold the final frame while combat fades it.
    if (md.state === 'dead' || !md.alive) {
      if (sm.death && !sm.deathPlayed) {
        sm.deathPlayed = true;
        if (sm.current && sm.current !== sm.death) sm.current.fadeOut(0.15);
        sm.death.reset().setLoop(THREE.LoopOnce, 1).play();
        sm.death.clampWhenFinished = true;
        sm.current = sm.death;
      }
      sm.mixer.update(dt);
      return true;
    }

    // Attack: combat.js bumps md.lastAttack each time the monster hits the player.
    // Fire the one-shot Attack clip when we see a fresh swing.
    if (sm.attack && md.lastAttack && md.lastAttack !== sm.lastAttackSeen) {
      sm.lastAttackSeen = md.lastAttack;
      sm.attackUntil = t + (sm.attack.getClip ? sm.attack.getClip().duration : 0.8);
      sm.attack.reset().setLoop(THREE.LoopOnce, 1).play();
      if (sm.current && sm.current !== sm.attack) sm.current.crossFadeTo(sm.attack, 0.1, false);
      sm.current = sm.attack;
    }

    if (sm.current === sm.attack && t < sm.attackUntil) {
      sm.mixer.update(dt);
      return true;   // let the attack finish before returning to locomotion
    }

    // Locomotion: Walk while moving, Idle otherwise (fall back to whatever exists).
    fadeTo(sm, moving ? (sm.walk || sm.idle) : (sm.idle || sm.walk));
    sm.mixer.update(dt);
    return true;
  }

  // animate limbs for a walking monster
  function animate(g, md, dt, t, moving, speedScale) {
    if (driveModel(g, md, dt, t, moving)) return;   // GLB model owns its animation
    const rig = g.userData.rig; if (!rig) return;
    if (moving) {
      md.bob += dt * 9 * speedScale;
      const sw = Math.sin(md.bob) * 0.6;
      g.position.y = Math.abs(Math.sin(md.bob)) * 0.05;
      // Quadruped-style swing (rat/frog/chicken) when those limbs exist,
      // otherwise the biped goblin swing — each guarded so the new procedural
      // fallbacks (snake/wasp, which have neither) simply bob without throwing.
      if (rig.frontL && rig.backL) {
        rig.frontL.rotation.x = sw; rig.frontR.rotation.x = -sw;
        rig.backL.rotation.x = -sw; rig.backR.rotation.x = sw;
      } else if (rig.legL && rig.armL) {
        rig.legL.rotation.x = sw; rig.legR.rotation.x = -sw;
        rig.armL.rotation.x = -sw * 0.7; rig.armR.rotation.x = sw * 0.7;
      } else if (rig.legL) {
        rig.legL.rotation.x = sw; rig.legR.rotation.x = -sw;
      } else if (rig.wingL) {
        // wasp: flap wings fast, hover
        rig.wingL.rotation.z = 0.4 + Math.sin(md.bob * 4) * 0.5;
        rig.wingR.rotation.z = -0.4 - Math.sin(md.bob * 4) * 0.5;
      } else if (rig.head) {
        // snake: sway the raised head/neck
        rig.head.rotation.y = sw * 0.5;
      }
    } else {
      g.position.y *= 0.8;
      for (const k of ['frontL', 'frontR', 'backL', 'backR', 'legL', 'legR', 'armL', 'armR']) {
        if (rig[k]) rig[k].rotation.x *= 0.85;
      }
    }
  }

  // Per-frame update. Only runs on the ground floor (monsters live outdoors).
  //
  // PERF: with 50+ monsters across the map + dungeon, blindly ticking every one
  // (movement math + an AnimationMixer skeleton update) every frame is the main
  // cost. We cull by squared distance to the player:
  //   * beyond ACTIVE_RADIUS:  throttle the idle wander AI to ~4x/second (aggro
  //                            stays correct — a player approaching is always
  //                            inside the radius long before they're in range).
  //   * beyond ANIM_RADIUS:    skip the mixer entirely (was already done at 60).
  //   * mixer updates are also capped per-frame (ANIM_BUDGET) so a big pack near
  //     the player can't blow the frame; skipped ones simply animate next frame.
  // All thresholds are generous (well past any aggro/leash range) so gameplay is
  // identical — only the *animation smoothness* of far, idle, out-of-sight
  // monsters degrades, which is never observed. Throttled wander accumulates the
  // skipped dt so movement speed is unchanged when it does run.
  const ACTIVE_RADIUS2 = 70 * 70;    // beyond this, throttle the idle wander AI
  const ANIM_RADIUS2 = 55 * 55;      // beyond this, skip the mixer (was 60)
  const RENDER_RADIUS2 = 62 * 62;    // beyond this, DON'T render the monster at all
  const ANIM_BUDGET = 24;            // max GLB mixers updated per frame
  function update(dt, t) {
    const player = window.eldenmoor.player;
    const floor = (window.eldenmoor.getFloor ? window.eldenmoor.getFloor() : 0);
    const onGround = floor === 0;
    const px = player.position.x, pz = player.position.z;
    let animCount = 0;
    for (const g of monsters) {
      const md = g.userData.monster;
      if (!md.alive || md.state === 'dead') {
        // combat owns death + fade/respawn; we still tick the mixer so the GLB
        // model can play its one-shot Death clip and hold the final frame.
        if (g.userData._model) animate(g, md, dt, t, false);
        continue;
      }
      const dpx = px - g.position.x, dpz = pz - g.position.z;
      const pdist2 = dpx * dpx + dpz * dpz;     // squared (cheap; sqrt only when needed)
      // RENDER CULL: a monster far from the player isn't worth drawing. Their
      // skinned GLBs have frustumCulled off, so otherwise all ~50 monsters across
      // the whole map render every frame regardless of where the camera looks —
      // a big needless cost. Hide the far ones (AI/aggro/respawn still runs).
      g.visible = onGround && pdist2 < RENDER_RADIUS2;
      if (!onGround) continue;

      const type = md.type;

      // Far + idle: throttle the wander AI. Accumulate the skipped dt so wander
      // speed is unchanged when the step does run. A cheap squared-distance aggro
      // pre-check still flips an approaching idler to 'chase' immediately, so the
      // throttle never makes a monster "miss" a player walking up to it.
      let stepDt = dt;
      if (md.state === 'wander' && pdist2 > ACTIVE_RADIUS2) {
        md._throttleAcc = (md._throttleAcc || 0) + dt;
        const ag = type.aggroRange;
        if (ag > 0 && pdist2 < ag * ag) { md.state = 'chase'; }
        else if (md._throttleAcc < 0.25) { continue; }
        stepDt = md._throttleAcc; md._throttleAcc = 0;
      }

      const pdist = Math.sqrt(pdist2);

      // aggro / leash
      if (md.state === 'wander' && pdist < type.aggroRange) md.state = 'chase';
      if (md.state === 'chase') {
        const homeDist = Math.hypot(g.position.x - md.home.x, g.position.z - md.home.z);
        if (pdist > type.aggroRange * 2.2 || homeDist > type.leashRange) md.state = 'wander';
      }

      let moving = false, speedScale = 1;
      if (md.state === 'chase') {
        // chase the player, stop a short distance away (melee reach)
        if (pdist > 1.4) {
          const step = Math.min(pdist, type.speed * stepDt);
          g.position.x += (dpx / pdist) * step; g.position.z += (dpz / pdist) * step;
          g.rotation.y = Math.atan2(dpx, dpz);
          moving = true; speedScale = 1.4;
        } else {
          g.rotation.y = Math.atan2(dpx, dpz);
        }
      } else {
        // idle wander around home (reuse the target object — no per-frame alloc)
        if (t >= md.nextWander) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * 6;
          md.target.x = md.home.x + Math.cos(a) * r;
          md.target.z = md.home.z + Math.sin(a) * r;
          md.nextWander = t + 2 + Math.random() * 5;
        }
        const dx = md.target.x - g.position.x, dz = md.target.z - g.position.z, d = Math.hypot(dx, dz);
        if (d > 0.1) {
          const step = Math.min(d, type.speed * 0.4 * stepDt);
          g.position.x += (dx / d) * step; g.position.z += (dz / d) * step;
          g.rotation.y = Math.atan2(dx, dz);
          moving = true; speedScale = 0.6;
        }
      }
      // perf: skip the animation mixer for distant monsters, and cap how many
      // mixers we tick per frame so a near pack can't blow the frame budget.
      // Chasing monsters are always close, so they're never starved here.
      if (pdist2 > ANIM_RADIUS2) continue;
      if (g.userData._model) {
        if (animCount >= ANIM_BUDGET) continue;
        animCount++;
      }
      animate(g, md, dt, t, moving, speedScale);
    }
  }

  // own animation loop (disjoint from main.js's renderer loop)
  let last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    if (!window.eldenmoor || !window.eldenmoor.player) return;
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1;
    const t = now / 1000;
    try { update(dt, t); } catch (e) { /* keep the loop alive */ }
  }
  requestAnimationFrame(tick);

  return { list: monsters, spawnMonster, respawn, remove, MONSTER_TYPES };
}

// ----- self-initialize -------------------------------------------------------
(function boot() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.scene && em.player) {
      clearInterval(iv);
      try { em.monsters = startMonsters(em); }
      catch (err) { console.error('[monsters] failed to start', err); }
    } else if (tries > 600) { clearInterval(iv); }
  }, 100);
})();
