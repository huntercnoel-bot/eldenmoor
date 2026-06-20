// interactions.js — moving and interacting. Left-click a tree to chop it, an NPC
// to talk/trade, or the ground to walk there. Exposes raycast + target helpers
// that the right-click menu (contextmenu.js) uses.

import * as THREE from '../vendor/three.module.js';
import { gameMessage } from './ui.js';

const CHOP_RANGE = 2.6;
const NPC_RANGE = 2.8;
const WALK_SPEED = 6.5;
const ARRIVE = 0.4;
const DEPLETE_CHANCE = 0.25;
const RESPAWN_TIME = 6;
const NEST_CHANCE = 0.04;

export function setupInteractions(scene, camera, player, dom, skills, inventory, equipment, onLevelUp) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const dir = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  let target = null;       // tree we're chopping
  let moveTarget = null;   // ground point we're walking to
  let npcTarget = null;    // npc group we're walking to
  let npcAction = null;    // function to run on reaching the npc
  let npcDefault = null;   // default left-click action for an npc: (def) => void
  let chopTimer = 0;
  let clock = 0;
  const floaters = [];

  function clearTargets() { target = null; moveTarget = null; npcTarget = null; npcAction = null; chopTimer = 0; }
  function setChopTarget(tree) { clearTargets(); target = tree; }
  function setWalkTarget(point) { clearTargets(); moveTarget = point.clone(); }
  function setNpcTarget(group, action) { clearTargets(); npcTarget = group; npcAction = action; }
  function setNpcDefault(fn) { npcDefault = fn; }

  // --- Raycasting helpers (shared with the right-click menu) ---
  function aim(x, y) {
    const r = dom.getBoundingClientRect();
    mouse.x = ((x - r.left) / r.width) * 2 - 1;
    mouse.y = -((y - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
  }
  function pickTree() {
    const hits = raycaster.intersectObjects(scene.userData.trees || [], true);
    for (const h of hits) { let o = h.object; while (o && o.userData.kind !== 'tree') o = o.parent; if (o && !o.userData.depleted) return o; }
    return null;
  }
  function pickNpc() {
    const hits = raycaster.intersectObjects(scene.userData.npcs || [], true);
    for (const h of hits) { let o = h.object; while (o && o.userData.kind !== 'npc') o = o.parent; if (o) return o; }
    return null;
  }
  function pickRock() {
    const hits = raycaster.intersectObjects(scene.userData.rocks || [], false);
    return hits.length ? hits[0].object : null;
  }
  // Walk target = where the camera ray meets the y=0 plane. Using a math plane
  // (not the ground mesh) means click-to-move still works on the upper/basement
  // floors, where the outdoor ground is hidden.
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const groundPt = new THREE.Vector3();
  function pickGround() {
    return raycaster.ray.intersectPlane(groundPlane, groundPt) ? groundPt.clone() : null;
  }
  function raycastWorld(x, y) { aim(x, y); return { npc: pickNpc(), tree: pickTree(), rock: pickRock(), point: pickGround() }; }

  // --- Left-click: default action ---
  let downX = 0, downY = 0;
  dom.addEventListener('mousedown', (e) => { if (e.button === 0) { downX = e.clientX; downY = e.clientY; } });
  dom.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return; // a camera drag
    const w = raycastWorld(e.clientX, e.clientY);
    if (w.npc) setNpcTarget(w.npc, () => { if (npcDefault) npcDefault(w.npc.userData.def); });
    else if (w.tree) setChopTarget(w.tree);
    else if (w.point) setWalkTarget(w.point);
  });

  // --- Floating text ---
  function spawnFloater(x, y, z, text, color) {
    const el = document.createElement('div');
    el.className = 'xpfloat'; el.textContent = text;
    if (color) el.style.color = color;
    document.body.appendChild(el);
    floaters.push({ el, pos: new THREE.Vector3(x, y, z), life: 1.4 });
  }
  function updateFloaters(dt) {
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.life -= dt; f.pos.y += dt * 0.8;
      tmp.copy(f.pos).project(camera);
      f.el.style.left = (tmp.x * 0.5 + 0.5) * window.innerWidth + 'px';
      f.el.style.top = (-tmp.y * 0.5 + 0.5) * window.innerHeight + 'px';
      f.el.style.opacity = Math.max(0, Math.min(1, f.life));
      if (f.life <= 0) { f.el.remove(); floaters.splice(i, 1); }
    }
  }

  function updateTrees(dt) {
    for (const tree of scene.userData.trees || []) {
      if (tree.userData.depleted && clock >= tree.userData.respawnAt) {
        tree.userData.depleted = false;
        tree.userData.foliage.forEach((m) => (m.visible = true));
      }
      if (tree.userData.shake > 0) {
        tree.userData.shake = Math.max(0, tree.userData.shake - dt);
        tree.rotation.z = Math.sin(clock * 40) * tree.userData.shake * 0.12;
      } else if (tree.rotation.z !== 0) { tree.rotation.z = 0; }
    }
  }

  function faceToward(x, z) {
    dir.set(x - player.position.x, 0, z - player.position.z);
    const d = dir.length();
    if (d > 0.0001) player.rotation.y = Math.atan2(dir.x, dir.z);
    return d;
  }
  function step(dt) {
    dir.normalize();
    player.position.x += dir.x * WALK_SPEED * dt;
    player.position.z += dir.z * WALK_SPEED * dt;
  }

  function update(dt, wasdMoving) {
    clock += dt;
    updateFloaters(dt);
    updateTrees(dt);

    if (wasdMoving) { clearTargets(); return { walking: false, chopping: false }; }

    // 1) Chop a tree.
    if (target && !target.userData.depleted) {
      const d = faceToward(target.position.x, target.position.z);
      if (d > CHOP_RANGE) { step(dt); chopTimer = 0; return { walking: true, chopping: false }; }
      const axe = equipment.getWeapon();
      if (!axe || axe.tool !== 'axe') {
        gameMessage('You need an axe equipped to chop. (Wield one from your bag.)');
        spawnFloater(player.position.x, 2.4, player.position.z, 'No axe equipped!', '#ff9a8a');
        target = null;
        return { walking: false, chopping: false };
      }
      if ((skills.state.woodcutting.level || 1) < (axe.wcLevel || 1)) {
        gameMessage('You need Woodcutting level ' + axe.wcLevel + ' to use the ' + axe.name + '.');
        target = null;
        return { walking: false, chopping: false };
      }
      chopTimer += dt;
      if (chopTimer >= (axe.chopTime || 1.8)) {
        chopTimer = 0;
        const reward = skills.chopReward();
        inventory.add('logs', 1);
        spawnFloater(target.position.x, 2.6, target.position.z, '+' + reward.xp + ' xp');
        target.userData.shake = 0.3;
        if (reward.leveledUp && onLevelUp) onLevelUp(reward.level);
        if (Math.random() < NEST_CHANCE) {
          inventory.add('birds_nest', 1);
          spawnFloater(target.position.x + 0.4, 3.1, target.position.z, "Bird's nest!", '#ffe08a');
        }
        if (Math.random() < DEPLETE_CHANCE) {
          target.userData.depleted = true;
          target.userData.respawnAt = clock + RESPAWN_TIME;
          target.userData.foliage.forEach((m) => (m.visible = false));
          target = null;
        }
      }
      return { walking: false, chopping: true };
    }
    target = null;

    // 2) Walk to an NPC, then run its action (talk/trade).
    if (npcTarget) {
      const d = faceToward(npcTarget.position.x, npcTarget.position.z);
      if (d > NPC_RANGE) { step(dt); return { walking: true, chopping: false }; }
      const act = npcAction; npcTarget = null; npcAction = null;
      if (act) act();
      return { walking: false, chopping: false };
    }

    // 3) Walk to a clicked ground point.
    if (moveTarget) {
      const d = faceToward(moveTarget.x, moveTarget.z);
      if (d > ARRIVE) { step(dt); return { walking: true, chopping: false }; }
      moveTarget = null;
    }
    return { walking: false, chopping: false };
  }

  return { update, setChopTarget, setWalkTarget, setNpcTarget, setNpcDefault, raycastWorld, stop: clearTargets };
}
