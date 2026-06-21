// prayer.js — the Prayer skill, OSRS-style. Self-contained & self-initializing:
// it polls for window.eldenmoor, then wires everything at runtime. It provides:
//
//   * BURYING BONES for Prayer XP (contextmenu.js adds a "Bury" option for any
//     item with a `buryXp`; it calls window.eldenmoor.prayer.bury(itemId)).
//   * PRAYER POINTS — a pool whose max equals your Prayer level. Active prayers
//     drain it over time; at zero, all prayers switch off.
//   * ACTIVATABLE PRAYERS — combat boosts (Attack / Strength / Defence) the
//     player toggles on. combat.js reads window.eldenmoor.prayer.getBoosts().
//   * AN ALTAR by the chapel — click it to recharge your prayer points to full.
//   * A little prayer panel (points orb + prayer buttons) drawn on the HUD.
//
// Exposed as window.eldenmoor.prayer.

import * as THREE from '../vendor/three.module.js';
import { ITEMS } from './items.js';
import { gameMessage } from './ui.js';

// The prayers, low -> high. `mult` is the multiplier handed to combat for the
// stat. Higher prayers drain faster. (Mirrors OSRS's Thick Skin / Burst of
// Strength / Clarity of Thought, then their improved tiers.)
const PRAYERS = [
  { id: 'thick_skin',   name: 'Thick Skin',          level: 1,  stat: 'defence',  mult: 1.05, drain: 0.10, icon: '🛡️' },
  { id: 'burst_str',    name: 'Burst of Strength',   level: 4,  stat: 'strength', mult: 1.05, drain: 0.10, icon: '💪' },
  { id: 'clarity',      name: 'Clarity of Thought',  level: 7,  stat: 'attack',   mult: 1.05, drain: 0.10, icon: '⚔️' },
  { id: 'rock_skin',    name: 'Rock Skin',           level: 10, stat: 'defence',  mult: 1.10, drain: 0.20, icon: '🪨' },
  { id: 'super_str',    name: 'Superhuman Strength', level: 13, stat: 'strength', mult: 1.10, drain: 0.20, icon: '🔥' },
  { id: 'reflexes',     name: 'Improved Reflexes',   level: 16, stat: 'attack',   mult: 1.10, drain: 0.20, icon: '🎯' },
];

const ALTAR = { x: -28, z: 24 };   // just in front of the chapel door (town.js CHAPEL = [-28,16])
const ALTAR_RANGE = 3.0;

function startPrayer(em) {
  const { scene, camera, player, skills, inventory } = em;

  let points = (skills.state.prayer && skills.state.prayer.level) || 1;
  const active = new Set();           // ids of prayers currently switched on
  let walkToAltar = false;

  function maxPoints() { return (skills.state.prayer && skills.state.prayer.level) || 1; }

  // --- bury bones -----------------------------------------------------------
  function bury(itemId) {
    const def = ITEMS[itemId];
    if (!def || !def.buryXp) return;
    if (!inventory.removeOne(itemId)) return;
    const r = skills.addXp('prayer', def.buryXp);
    // burying restores a couple of prayer points too (nice QoL, not OSRS-exact)
    points = Math.min(maxPoints(), points + 1);
    gameMessage('You bury the ' + def.name.toLowerCase() + '.');
    if (em.audio && em.audio.play) em.audio.play('pickup');
    if (r && r.leveledUp) gameMessage('Congratulations, your Prayer is now level ' + r.level + '!');
    refreshPanel();
  }

  // --- combat boosts read by combat.js --------------------------------------
  function getBoosts() {
    const b = { attack: 1, strength: 1, defence: 1 };
    if (points <= 0) return b;
    for (const p of PRAYERS) if (active.has(p.id)) b[p.stat] = Math.max(b[p.stat], p.mult);
    return b;
  }

  function toggle(id) {
    const p = PRAYERS.find((x) => x.id === id);
    if (!p) return;
    if ((skills.state.prayer.level || 1) < p.level) { gameMessage('You need Prayer level ' + p.level + ' to use ' + p.name + '.'); return; }
    if (active.has(id)) { active.delete(id); }
    else {
      if (points <= 0) { gameMessage('You have run out of prayer points. Pray at an altar to recharge.'); return; }
      active.add(id);
      gameMessage(p.name + ' activated.');
    }
    if (em.audio && em.audio.play) em.audio.play('click');
    refreshPanel();
  }

  function recharge() {
    points = maxPoints();
    gameMessage('You recharge your prayer at the altar.');
    if (em.audio && em.audio.play) em.audio.play('levelup');
    refreshPanel();
  }

  // --- the altar prop -------------------------------------------------------
  const altarG = new THREE.Group();
  altarG.position.set(ALTAR.x, 0, ALTAR.z);
  {
    const stone = new THREE.MeshStandardMaterial({ color: 0xc9c2af, roughness: 0.9, metalness: 0 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd8b24a, roughness: 0.5, metalness: 0.3, emissive: 0x3a2c08 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 1.1), stone); base.position.y = 0.5;
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.22, 1.35), stone); top.position.y = 1.1;
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.1, 0.18), gold); cross.position.y = 1.85;
    const crossArm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.18), gold); crossArm.position.y = 1.95;
    for (const m of [base, top, cross, crossArm]) { m.castShadow = true; m.userData.__toonDone = true; altarG.add(m); }
    // a soft candle glow so it reads as holy
    const glow = new THREE.PointLight(0xffd98a, 0.6, 6); glow.position.set(0, 1.6, 0); altarG.add(glow);
  }
  altarG.userData = { kind: 'prayer_altar' };
  scene.add(altarG);
  (scene.userData.outdoor = scene.userData.outdoor || []).push(altarG);

  // --- click the altar to recharge ------------------------------------------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const canvas = (em.renderer && em.renderer.domElement) || document.querySelector('canvas');
  function clickedAltar(clientX, clientY) {
    if (!canvas) return false;
    const r = canvas.getBoundingClientRect();
    ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects([altarG], true).length > 0;
  }
  let downX = 0, downY = 0;
  if (canvas) {
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { downX = e.clientX; downY = e.clientY; } }, true);
    canvas.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      if ((em.getFloor ? em.getFloor() : 0) !== 0) return;
      if (clickedAltar(e.clientX, e.clientY)) {
        e.stopPropagation();
        if (em.interactions && em.interactions.stop) em.interactions.stop();
        // walk toward the altar, then recharge once we're close (handled in tick)
        if (em.interactions && em.interactions.setWalkTarget) em.interactions.setWalkTarget({ x: ALTAR.x, z: ALTAR.z + ALTAR_RANGE * 0.7 });
        walkToAltar = true;
      }
    }, true);
  }

  // --- HUD panel ------------------------------------------------------------
  const panel = document.createElement('div');
  panel.id = 'prayer-panel';
  panel.style.cssText = 'position:fixed;left:12px;top:150px;z-index:24;display:flex;flex-direction:column;gap:5px;' +
    'font-family:Georgia,serif;pointer-events:auto;user-select:none;';
  document.body.appendChild(panel);
  const orb = document.createElement('div');
  orb.style.cssText = 'display:flex;align-items:center;gap:6px;color:#dff0ff;font-weight:700;font-size:14px;' +
    'text-shadow:0 1px 2px #000;background:rgba(20,28,40,0.55);border:1px solid rgba(140,180,255,0.4);' +
    'border-radius:10px;padding:3px 9px;width:max-content;';
  panel.appendChild(orb);
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;max-width:120px;';
  panel.appendChild(btnRow);

  function refreshPanel() {
    const max = maxPoints();
    orb.innerHTML = '🙏 <span style="color:#9fd3ff">' + Math.floor(points) + '</span><span style="opacity:0.6">/' + max + '</span>';
    btnRow.innerHTML = '';
    const lvl = skills.state.prayer.level || 1;
    for (const p of PRAYERS) {
      const b = document.createElement('div');
      const unlocked = lvl >= p.level;
      const on = active.has(p.id);
      b.title = p.name + (unlocked ? (on ? ' (active)' : '') : ' — needs Prayer ' + p.level);
      b.textContent = p.icon;
      b.style.cssText = 'width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:15px;' +
        'border-radius:5px;cursor:' + (unlocked ? 'pointer' : 'default') + ';' +
        'background:' + (on ? 'rgba(120,180,255,0.5)' : 'rgba(20,28,40,0.55)') + ';' +
        'border:1px solid ' + (on ? '#9fd3ff' : 'rgba(140,180,255,0.3)') + ';' +
        'opacity:' + (unlocked ? '1' : '0.35') + ';transition:background 0.12s;';
      if (unlocked) b.addEventListener('click', () => toggle(p.id));
      btnRow.appendChild(b);
    }
  }
  refreshPanel();

  // --- per-frame: drain points + recharge-on-arrival ------------------------
  let last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    if (!window.eldenmoor || !window.eldenmoor.player) return;
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1;

    // drain for each active prayer
    if (active.size && points > 0) {
      let rate = 0;
      for (const p of PRAYERS) if (active.has(p.id)) rate += p.drain;
      points -= rate * dt;
      if (points <= 0) { points = 0; active.clear(); gameMessage('You have run out of prayer points.'); refreshPanel(); }
      else if (Math.random() < 0.06) refreshPanel();   // cheap periodic orb update
    }

    // arrive at the altar -> recharge
    if (walkToAltar) {
      const d = Math.hypot(player.position.x - ALTAR.x, player.position.z - ALTAR.z);
      if (d <= ALTAR_RANGE) { walkToAltar = false; if (points < maxPoints()) recharge(); }
    }
  }
  requestAnimationFrame(tick);

  return { bury, getBoosts, toggle, recharge, refreshPanel,
    get points() { return points; }, set points(v) { points = v; refreshPanel(); },
    PRAYERS };
}

// ----- self-initialize ------------------------------------------------------
(function boot() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.scene && em.camera && em.player && em.skills && em.inventory) {
      clearInterval(iv);
      try { em.prayer = startPrayer(em); }
      catch (err) { console.error('[prayer] failed to start', err); }
    } else if (tries > 600) { clearInterval(iv); }
  }, 100);
})();
