// kingModel.js — swaps the procedural King NPC for the detailed WoW-style dwarf
// model (the same rig that was briefly the hero), posed SITTING on the throne in
// the castle's ground-floor great hall. Self-contained: polls for window.eldenmoor,
// finds the 'king' NPC, hides its boxy procedural body, parents the dwarf onto it,
// seats it on the throne, freezes its wander, and runs a tiny idle + seated-pose
// loop of its own. Tagged __toonDone so it stays out of the global cel-shade pass.
//
// The seated pose is driven by overriding the leg bones every frame AFTER the idle
// clip updates, so the upper body still breathes while the legs stay folded on the
// seat. All the fiddly offsets live in window.eldenmoor.kingTune for live tuning.

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';

const URL = './assets/models/dwarf/dwarf.gltf';
const HEIGHT = 2.15;          // standing height the model is scaled to (a big, imposing king)

// Live-tunable seat placement + pose (override via window.eldenmoor.kingTune in console)
const TUNE = {
  z: 64.4,          // world z of the king group (throne sits ~65)
  seatY: 0.52,      // local y lift so the dwarf's seat meets the throne cushion
  face: Math.PI,    // yaw of the dwarf so he looks DOWN the hall (-z), toward the approaching player
  hip: -1.5,        // thigh pitch (fold forward onto the seat)
  knee: 1.55,       // shin pitch (drop down off the seat)
  spine: -0.1,      // slight recline against the throne back
  armOut: 0.16,     // arms eased outward to rest on the armrests
};

function findBone(root, name) {
  let hit = null;
  root.traverse((o) => { if (!hit && o.isBone && o.name === name) hit = o; });
  return hit;
}

function boot() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const em = window.eldenmoor;
    const king = em && em.npcs && em.npcs.find((n) => n.def.id === 'king');
    if (em && em.scene && king) { clearInterval(iv); swap(em, king); }
    else if (tries > 1200) clearInterval(iv);
  }, 100);
}

function swap(em, king) {
  em.kingTune = Object.assign({}, TUNE, em.kingTune || {});
  const tune = em.kingTune;
  const loader = new GLTFLoader();
  loader.load(URL, (gltf) => {
    const dwarf = gltf.scene;

    // scale to standing height, then tag + shadow every mesh
    const box = new THREE.Box3().setFromObject(dwarf);
    const h = box.max.y - box.min.y;
    const s = HEIGHT / (h || 1);
    dwarf.scale.setScalar(s);
    dwarf.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.__toonDone = true; o.frustumCulled = false; }
    });
    dwarf.userData.__toonDone = true;

    // drop the dwarf so feet sit at the group origin, then lift to the cushion
    const grounded = -box.min.y * s;
    dwarf.position.set(0, grounded + tune.seatY, 0);
    dwarf.rotation.y = tune.face;

    // hide the procedural king body (crown, robe, sceptre, the lot) but keep the
    // group itself so the name label, raycast-to-talk and quest marker still work
    king.group.traverse((o) => { if (o.isMesh) o.visible = false; });
    king.group.add(dwarf);

    // a warm, regal key light so the king reads clearly in the dim great hall
    // (child of the group, so it only shines while the king's floor is shown)
    const keyLight = new THREE.PointLight(0xffe2ad, 13, 16, 2);
    keyLight.position.set(0, 3.4, -2.8);     // in front (−z) and above the seated king
    king.group.add(keyLight);
    const fillLight = new THREE.PointLight(0xfff0d0, 5, 9, 2);
    fillLight.position.set(0, 1.2, -1.6);    // low warm fill so his face/beard reads
    king.group.add(fillLight);

    // park the king on the throne and freeze his wander for good
    king.group.position.set(0, 0, tune.z);
    king.group.rotation.y = 0;            // facing is baked into the dwarf (tune.face)
    king._home = { x: 0, z: tune.z };
    king._tgt = { x: 0, z: tune.z };
    king._next = Infinity;                // never pick a new wander target

    // grab the leg/spine/arm bones we re-pose each frame (GLTFLoader strips dots)
    const bones = {
      upLegL: findBone(dwarf, 'UpLegL'), upLegR: findBone(dwarf, 'UpLegR'),
      legL: findBone(dwarf, 'LegL'), legR: findBone(dwarf, 'LegR'),
      spine: findBone(dwarf, 'Spine'),
      armL: findBone(dwarf, 'ArmL'), armR: findBone(dwarf, 'ArmR'),
    };

    // gentle idle so the king breathes; legs get overridden to the seated fold below
    let mixer = null;
    if (gltf.animations && gltf.animations.length) {
      mixer = new THREE.AnimationMixer(dwarf);
      mixer.clipAction(gltf.animations[0]).play();
    }

    em.kingDwarf = dwarf;
    em.kingBones = bones;

    const seat = () => {
      const t = em.kingTune;
      if (bones.upLegL) bones.upLegL.rotation.x = t.hip;
      if (bones.upLegR) bones.upLegR.rotation.x = t.hip;
      if (bones.legL) bones.legL.rotation.x = t.knee;
      if (bones.legR) bones.legR.rotation.x = t.knee;
      if (bones.spine) bones.spine.rotation.x = t.spine;
      if (bones.armL) bones.armL.rotation.z = -t.armOut;
      if (bones.armR) bones.armR.rotation.z = t.armOut;
      // keep placement live-tunable while iterating
      dwarf.position.y = grounded + t.seatY;
      dwarf.rotation.y = t.face;
      king.group.position.z = t.z;
    };

    const clock = new THREE.Clock();
    const tick = () => {
      const dt = clock.getDelta();
      if (mixer) mixer.update(dt);
      seat();                              // override legs AFTER the idle clip
      requestAnimationFrame(tick);
    };
    seat();
    requestAnimationFrame(tick);
  }, undefined, (err) => console.error('[kingModel] load failed', err));
}

boot();
