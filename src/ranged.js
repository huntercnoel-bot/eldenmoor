// ranged.js — the Ranged skill, completing the OSRS combat triangle alongside
// melee (combat.js) and Magic (magic.js). Self-contained & self-initializing.
//
// When you have a BOW equipped (an item with tool:'bow') and ARROWS in your bag,
// left-clicking a monster looses an arrow at it from range: it consumes one
// arrow, flies a projectile to the target, rolls Ranged accuracy vs the target's
// defence, deals damage through the shared combat path (em.combat.damageMonster),
// and grants Ranged XP. With no bow equipped it does nothing, so melee is
// unaffected. Exposed as window.eldenmoor.ranged.

import * as THREE from '../vendor/three.module.js';
import { ITEMS } from './items.js';
import { gameMessage } from './ui.js';

function startRanged(em) {
  const { scene, camera, player, skills, inventory } = em;
  const rangedLevel = () => (skills.state.ranged && skills.state.ranged.level) || 1;

  function equippedBow() {
    const w = em.equipment && em.equipment.getWeapon && em.equipment.getWeapon();
    return (w && w.tool === 'bow') ? w : null;
  }
  function bestArrow() {
    // use the strongest arrow type the player carries
    let best = null;
    for (const id in ITEMS) {
      const d = ITEMS[id];
      if (d.ammo && inventory.count(id) > 0) { if (!best || (d.rangedStr || 0) > (ITEMS[best].rangedStr || 0)) best = id; }
    }
    return best;
  }

  // --- click a monster while a bow is equipped to shoot ----------------------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const canvas = (em.renderer && em.renderer.domElement) || document.querySelector('canvas');
  function pickMonster(clientX, clientY) {
    const listM = (em.monsters && em.monsters.list) || [];
    if (!listM.length) return null;
    const r = canvas.getBoundingClientRect();
    ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(listM, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !(o.userData && o.userData.monster)) o = o.parent;
      if (o && o.userData.monster.alive) return o;
    }
    return null;
  }

  let downX = 0, downY = 0, lastShot = 0;
  if (canvas) {
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { downX = e.clientX; downY = e.clientY; } }, true);
    canvas.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      // only act when a bow is equipped and no spell is armed (magic gets priority)
      if (!equippedBow()) return;
      if (em.magic && em.magic.armed) return;
      const g = pickMonster(e.clientX, e.clientY);
      if (g) { e.stopPropagation(); shoot(g); }
    }, true);   // capture so a bow shot beats the melee-engage click
  }

  // --- firing ---------------------------------------------------------------
  const arrows = [];   // in-flight {mesh, from, target, t, arrowStr}
  function shoot(g) {
    const bow = equippedBow();
    if (!bow) return;
    if (rangedLevel() < (bow.rangedLevel || 1)) { gameMessage('You need Ranged level ' + bow.rangedLevel + ' to use that bow.'); return; }
    const now = performance.now() / 1000;
    if (now - lastShot < (bow.shootTime || 1.5) * 0.5) return;   // light rate-limit on rapid clicks
    const arrowId = bestArrow();
    if (!arrowId) { gameMessage('You have no arrows left.'); return; }
    inventory.removeN(arrowId, 1);
    lastShot = now;
    const dx = g.position.x - player.position.x, dz = g.position.z - player.position.z;
    player.rotation.y = Math.atan2(dx, dz);
    if (em.audio && em.audio.play) em.audio.play('chop');
    // a slim arrow mesh
    const geo = new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xcaa46a });
    const mesh = new THREE.Mesh(geo, mat); mesh.userData.__toonDone = true;
    const from = new THREE.Vector3(player.position.x, 1.3, player.position.z);
    mesh.position.copy(from);
    scene.add(mesh);
    arrows.push({ mesh, from, target: g, t: 0, bowStr: bow.rangedStr || 0, arrowStr: (ITEMS[arrowId].rangedStr || 0) });
  }

  function landArrow(a) {
    const g = a.target;
    scene.remove(a.mesh);
    if (a.mesh.geometry) a.mesh.geometry.dispose();
    if (a.mesh.material) a.mesh.material.dispose();
    if (!g || !g.userData || !g.userData.monster || !g.userData.monster.alive) return;
    const def = g.userData.monster.type.defense || 1;
    const lvl = rangedLevel();
    const acc = Math.max(0.4, Math.min(0.96, (lvl + 6) / (lvl + 6 + def * 2.1)));
    let dmg = 0;
    if (Math.random() < acc) {
      const maxHit = 1 + Math.round((a.bowStr + a.arrowStr) * (1 + (lvl - 1) * 0.06));
      dmg = Math.floor(Math.random() * (maxHit + 1));
    }
    if (em.vfx && em.vfx.burst) em.vfx.burst('hit', g.position.x, g.position.y + 1.0, g.position.z);
    if (em.combat && em.combat.damageMonster) em.combat.damageMonster(g, dmg, dmg === 0 ? 'miss' : 'dmg');
    const r = skills.addXp('ranged', 4 + dmg * 2);
    if (r && r.leveledUp) gameMessage('Congratulations, your Ranged is now level ' + r.level + '!');
  }

  // --- per-frame: fly arrows -------------------------------------------------
  let last = performance.now();
  const _to = new THREE.Vector3();   // reused per-frame to avoid allocations
  function tick(now) {
    requestAnimationFrame(tick);
    if (!window.eldenmoor || !window.eldenmoor.player) return;
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1;
    for (let i = arrows.length - 1; i >= 0; i--) {
      const a = arrows[i];
      a.t += dt * 3.6;
      const to = a.target && a.target.position
        ? _to.set(a.target.position.x, (a.target.position.y || 0) + 1.0, a.target.position.z)
        : a.from;
      a.mesh.position.lerpVectors(a.from, to, Math.min(1, a.t));
      a.mesh.lookAt(to);
      a.mesh.rotateX(Math.PI / 2);
      if (a.t >= 1) { landArrow(a); arrows.splice(i, 1); }
    }
  }
  requestAnimationFrame(tick);

  return { shoot, equippedBow, bestArrow };
}

// ----- self-initialize ------------------------------------------------------
(function boot() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.scene && em.camera && em.player && em.skills && em.inventory && em.equipment) {
      clearInterval(iv);
      try { em.ranged = startRanged(em); }
      catch (err) { console.error('[ranged] failed to start', err); }
    } else if (tries > 600) { clearInterval(iv); }
  }, 100);
})();
