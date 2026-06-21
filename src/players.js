// players.js — renders OTHER players in the world. Each remote player is a real
// downloaded knight character (a cloned GLB with its OWN skeleton + clips) with
// a name label that smoothly follows the positions the server sends.
//
// The visual is a clone of KnightCharacter.glb (ships Idle/Walking/Run clips).
// We reuse the proven swap pattern from npcModels.js: cloneSkinned for a private
// skeleton per avatar, vertex-based height measurement (Box3.setFromObject is
// unreliable on freshly-cloned SkinnedMeshes), an AnimationMixer driving the
// model's own Idle<->Walk crossfade off the networked position delta, and a
// per-model FACE heading offset. Meshes are tagged __toonDone so the cel-shader
// leaves them alone. Networking / interpolation / name-label logic is unchanged.

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';

const MODEL_URL = './assets/models/npc/quaternius/KnightCharacter.glb';
const TARGET_H = 1.85;   // metres
// Quaternius characters (incl. KnightCharacter) face +Z in their source. The
// remote avatar's heading is set with rotation.y = atan2(dx, dz) whose zero is
// +Z, so a 0 offset walks forward. Kept as a knob in case a human flips it.
const FACE = 0;

const loader = new GLTFLoader();
let _gltfPromise = null;
function loadGltf() {
  if (!_gltfPromise) _gltfPromise = new Promise((ok, err) => loader.load(MODEL_URL, ok, undefined, err));
  return _gltfPromise;
}

// SkinnedMesh-safe deep clone (inlined three.js SkeletonUtils.clone). A plain
// Object3D.clone(true) shares the Skeleton by reference, so multiple avatars
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
const _vy = new THREE.Vector3();
function measureY(model) {
  model.updateMatrixWorld(true);
  let min = Infinity, max = -Infinity;
  model.traverse((o) => {
    if (!(o.isMesh || o.isSkinnedMesh) || !o.geometry || !o.geometry.attributes.position) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      _vy.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (_vy.y < min) min = _vy.y;
      if (_vy.y > max) max = _vy.y;
    }
  });
  return { min, max, h: max - min };
}

// Pick the best Idle / Walk clip out of the model's own animation list.
function pickClip(clips, kind) {
  const names = clips.map((c) => c.name);
  const want = kind === 'walk'
    ? [/walk/i, /run/i, /jog/i]
    : [/\bidle\b/i, /idle/i, /stand/i];
  for (const re of want) {
    const i = names.findIndex((n) => re.test(n) && !/sword|jump|roll|death|attack|back/i.test(n));
    if (i >= 0) return clips[i];
  }
  if (kind === 'walk') {
    const i = names.findIndex((n) => !/idle|death|tpose/i.test(n));
    if (i >= 0) return clips[i];
  }
  return clips[0] || null;
}

function fadeTo(st, action) {
  if (!action || action === st.current) return;
  action.reset().setLoop(THREE.LoopRepeat, Infinity).play();
  if (st.current) st.current.crossFadeTo(action, 0.25, false); else action.fadeIn(0.25);
  st.current = action;
}

export function createRemotePlayers(scene, camera) {
  const remotes = {}; // username -> { group, tx, tz, tr, label, anim }
  const _v = new THREE.Vector3();
  let shown = true;   // remote players are only shown on the ground floor

  // Build the cloned-GLB avatar for a remote player's group (async; the group
  // is added synchronously so networking can start interpolating immediately).
  async function buildAvatar(r) {
    let gltf;
    try { gltf = await loadGltf(); }
    catch (err) { console.error('[players] avatar model load failed', err); return; }
    if (r.removed) return;

    const model = cloneSkinned(gltf.scene);
    model.rotation.y = FACE;                      // Y-rotation doesn't change height
    const m = measureY(model);                     // native rest-pose height (scale 1)
    const nativeH = (isFinite(m.h) && m.h > 0.01) ? m.h : 1.8;
    const s = TARGET_H / nativeH;
    model.scale.setScalar(s);
    model.position.y = -m.min * s;                 // drop feet to the group's y=0

    model.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;        // skinned bounds drift; keep it drawn
        o.userData.__toonDone = true;   // tell the cel-shader to leave it alone
      }
    });

    r.group.add(model);

    // animation: the Knight ships its own rig-correct clips — crossfade Idle/Walk.
    const mixer = new THREE.AnimationMixer(model);
    const clips = (gltf.animations && gltf.animations.length) ? gltf.animations : [];
    const ic = pickClip(clips, 'idle'), wc = pickClip(clips, 'walk');
    const idleAction = ic ? mixer.clipAction(ic) : null;
    const walkAction = wc ? mixer.clipAction(wc) : null;
    if (idleAction) idleAction.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.2).play();

    r.anim = { model, mixer, idleAction, walkAction, current: idleAction };
  }

  function add(user, x, z, ry) {
    if (remotes[user]) return;
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = ry || 0;
    scene.add(group);
    const label = document.createElement('div');
    label.className = 'player-label';
    label.textContent = user;
    document.body.appendChild(label);
    const r = { group, tx: x, tz: z, tr: ry || 0, label, anim: null, removed: false };
    remotes[user] = r;
    buildAvatar(r);
  }

  function remove(user) {
    const r = remotes[user];
    if (!r) return;
    r.removed = true;
    scene.remove(r.group);
    r.label.remove();
    // Free this avatar's PRIVATE GPU/CPU resources. Geometry and materials are
    // shared by reference with the cached GLB prototype (Object3D.clone keeps
    // those refs), so we must NOT dispose them — only the per-clone skeleton
    // bone textures and the mixer are unique to this avatar.
    if (r.anim) {
      try {
        const mixer = r.anim.mixer, model = r.anim.model;
        if (mixer) { mixer.stopAllAction(); if (model) mixer.uncacheRoot(model); }
        if (model) model.traverse((o) => {
          if (o.isSkinnedMesh && o.skeleton && o.skeleton.dispose) o.skeleton.dispose();
        });
      } catch (err) { /* never let cleanup throw */ }
      r.anim = null;
    }
    delete remotes[user];
  }

  // Update where a player is heading (the server sends these as they move).
  function setTarget(user, x, z, ry) {
    let r = remotes[user];
    if (!r) { add(user, x, z, ry); return; }
    r.tx = x; r.tz = z; r.tr = ry;
  }

  function clear() { for (const u of Object.keys(remotes)) remove(u); }
  function setVisible(v) { shown = v; }

  function update(dt, t) {
    const k = Math.min(1, dt * 10);
    const mdt = Math.min(dt, 0.1);
    for (const u of Object.keys(remotes)) {
      const r = remotes[u];
      if (!shown) { r.group.visible = false; r.label.style.display = 'none'; continue; }
      r.group.visible = true;
      const dx = r.tx - r.group.position.x, dz = r.tz - r.group.position.z;
      const moving = (dx * dx + dz * dz) > 0.004;       // still travelling toward target?
      r.group.position.x += dx * k;                      // smoothly glide there
      r.group.position.z += dz * k;
      r.group.rotation.y = r.tr;

      // drive the cloned model's own Idle<->Walk clips off the networked motion.
      const a = r.anim;
      if (a) {
        fadeTo(a, moving ? (a.walkAction || a.idleAction) : (a.idleAction || a.walkAction));
        a.mixer.update(mdt);
      }

      _v.set(r.group.position.x, 2.5, r.group.position.z).project(camera);
      if (_v.z > 1 || _v.x < -1.1 || _v.x > 1.1) { r.label.style.display = 'none'; continue; }
      r.label.style.display = 'block';
      r.label.style.left = (_v.x * 0.5 + 0.5) * window.innerWidth + 'px';
      r.label.style.top = (-_v.y * 0.5 + 0.5) * window.innerHeight + 'px';
    }
  }

  return { add, remove, setTarget, update, clear, setVisible, remotes };
}
