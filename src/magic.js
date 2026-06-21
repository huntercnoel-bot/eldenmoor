// magic.js — the Magic skill: a combat spellbook of elemental strike/bolt spells.
// Self-contained & self-initializing (polls window.eldenmoor). It:
//
//   * draws a SPELLBOOK panel (left side) of attack spells you've unlocked;
//   * lets you ARM a spell (click it) — the armed spell is highlighted;
//   * when a spell is armed, LEFT-CLICK A MONSTER to cast it instead of meleeing:
//       checks your Magic level + runes, consumes the runes, flies a coloured
//       bolt from your hand to the target, then deals magic damage and grants
//       Magic XP via the shared combat path (em.combat.damageMonster).
//
// Exposed as window.eldenmoor.magic.

import * as THREE from '../vendor/three.module.js';
import { ITEMS } from './items.js';
import { gameMessage } from './ui.js';

// Spell list, low -> high (OSRS standard-book strikes + a bolt). `runes` maps a
// rune item id to how many it costs. `max` is the spell's max hit; `xp` the Magic
// XP per cast. `color` tints the bolt + splash.
const SPELLS = [
  { id: 'wind_strike',  name: 'Wind Strike',  level: 1,  max: 2, xp: 5.5,  color: 0xbfe6ff, runes: { air_rune: 1, mind_rune: 1 } },
  { id: 'water_strike', name: 'Water Strike', level: 5,  max: 4, xp: 7.5,  color: 0x5a9bff, runes: { water_rune: 1, air_rune: 1, mind_rune: 1 } },
  { id: 'earth_strike', name: 'Earth Strike', level: 9,  max: 6, xp: 9.5,  color: 0x8a6a3a, runes: { earth_rune: 2, air_rune: 1, mind_rune: 1 } },
  { id: 'fire_strike',  name: 'Fire Strike',  level: 13, max: 8, xp: 11.5, color: 0xff7a3a, runes: { fire_rune: 3, air_rune: 2, mind_rune: 1 } },
  { id: 'wind_bolt',    name: 'Wind Bolt',    level: 17, max: 9, xp: 13.5, color: 0xdaf2ff, runes: { air_rune: 2, chaos_rune: 1 } },
  { id: 'fire_bolt',    name: 'Fire Bolt',    level: 35, max: 12, xp: 22.5, color: 0xff5a2a, runes: { fire_rune: 4, air_rune: 3, chaos_rune: 1 } },
];

function startMagic(em) {
  const { scene, camera, player, skills, inventory } = em;
  let armed = null;   // the currently armed spell id (autocast)

  const magicLevel = () => (skills.state.magic && skills.state.magic.level) || 1;

  function haveRunes(spell) {
    for (const id in spell.runes) if (inventory.count(id) < spell.runes[id]) return false;
    return true;
  }
  function consumeRunes(spell) { for (const id in spell.runes) inventory.removeN(id, spell.runes[id]); }
  function runeText(spell) { return Object.keys(spell.runes).map((id) => spell.runes[id] + '× ' + ITEMS[id].name).join(', '); }

  // --- the spellbook panel --------------------------------------------------
  const panel = document.createElement('div');
  panel.id = 'spellbook-panel';
  panel.style.cssText = 'position:fixed;left:12px;top:230px;z-index:24;display:flex;flex-direction:column;gap:3px;' +
    'font-family:Georgia,serif;pointer-events:auto;user-select:none;max-width:150px;';
  document.body.appendChild(panel);
  const head = document.createElement('div');
  head.textContent = '✨ Spellbook';
  head.style.cssText = 'color:#e8d8ff;font-weight:700;font-size:13px;text-shadow:0 1px 2px #000;margin-bottom:1px;';
  panel.appendChild(head);
  const list = document.createElement('div');
  list.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
  panel.appendChild(list);

  function refreshPanel() {
    list.innerHTML = '';
    const lvl = magicLevel();
    for (const sp of SPELLS) {
      const unlocked = lvl >= sp.level;
      const can = unlocked && haveRunes(sp);
      const on = armed === sp.id;
      const b = document.createElement('div');
      b.title = sp.name + ' — ' + (unlocked ? 'needs ' + runeText(sp) : 'Magic level ' + sp.level + ' required');
      b.innerHTML = '<span style="font-size:13px">' + sp.name + '</span>' +
        '<span style="float:right;opacity:0.7">' + sp.max + '</span>';
      b.style.cssText = 'padding:3px 8px;border-radius:5px;font-size:12px;color:#ecdfff;' +
        'cursor:' + (unlocked ? 'pointer' : 'default') + ';' +
        'background:' + (on ? 'rgba(170,120,255,0.55)' : 'rgba(28,22,44,0.6)') + ';' +
        'border:1px solid ' + (on ? '#d0b0ff' : (can ? 'rgba(170,120,255,0.35)' : 'rgba(120,120,140,0.25)')) + ';' +
        'opacity:' + (unlocked ? (can ? '1' : '0.6') : '0.32') + ';text-shadow:0 1px 1px #000;transition:background 0.12s;';
      if (unlocked) b.addEventListener('click', () => {
        armed = (armed === sp.id) ? null : sp.id;
        gameMessage(armed ? ('You ready ' + sp.name + '. Click a target to cast.') : 'You lower your staff.');
        if (em.audio && em.audio.play) em.audio.play('click');
        refreshPanel();
      });
      list.appendChild(b);
    }
  }
  refreshPanel();
  // keep the book's rune availability fresh as the bag changes
  setInterval(refreshPanel, 1500);

  // --- click a monster while armed to cast ----------------------------------
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

  let downX = 0, downY = 0;
  if (canvas) {
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { downX = e.clientX; downY = e.clientY; } }, true);
    canvas.addEventListener('mouseup', (e) => {
      if (e.button !== 0 || !armed) return;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      const g = pickMonster(e.clientX, e.clientY);
      if (g) { e.stopPropagation(); cast(g); }
    }, true);   // capture so an armed cast beats the melee-engage click
  }

  // --- casting --------------------------------------------------------------
  const bolts = [];   // in-flight projectiles {mesh, from, to, t, spell, target}
  function cast(g) {
    const spell = SPELLS.find((s) => s.id === armed);
    if (!spell) return;
    if (magicLevel() < spell.level) { gameMessage('You need Magic level ' + spell.level + ' to cast ' + spell.name + '.'); return; }
    if (!haveRunes(spell)) { gameMessage('You do not have enough runes to cast ' + spell.name + '.'); refreshPanel(); return; }
    // face + (if far) walk toward the target so casting has the same feel as melee
    const dx = g.position.x - player.position.x, dz = g.position.z - player.position.z;
    player.rotation.y = Math.atan2(dx, dz);
    consumeRunes(spell);
    if (em.audio && em.audio.play) em.audio.play('chop');
    // bolt mesh
    const geo = new THREE.SphereGeometry(0.22, 10, 10);
    const mat = new THREE.MeshBasicMaterial({ color: spell.color, transparent: true, opacity: 0.95 });
    const mesh = new THREE.Mesh(geo, mat); mesh.userData.__toonDone = true;
    const from = new THREE.Vector3(player.position.x, 1.4, player.position.z);
    mesh.position.copy(from);
    scene.add(mesh);
    bolts.push({ mesh, from, target: g, t: 0, spell });
    refreshPanel();
  }

  function landBolt(b) {
    const spell = b.spell, g = b.target;
    scene.remove(b.mesh);
    if (b.mesh.geometry) b.mesh.geometry.dispose();
    if (!g || !g.userData || !g.userData.monster || !g.userData.monster.alive) return;
    // magic accuracy: Magic level vs target defence; a miss "splashes" for 0.
    const def = g.userData.monster.type.defense || 1;
    const acc = Math.max(0.35, Math.min(0.95, (magicLevel() + 8) / (magicLevel() + 8 + def * 2.0)));
    let dmg = 0;
    if (Math.random() < acc) dmg = 1 + Math.floor(Math.random() * spell.max);
    if (em.vfx && em.vfx.burst) em.vfx.burst('hit', g.position.x, g.position.y + 1.0, g.position.z);
    if (em.combat && em.combat.damageMonster) em.combat.damageMonster(g, dmg, dmg === 0 ? 'miss' : 'big');
    // Magic XP: OSRS gives the spell's base XP plus 2 per damage dealt.
    const r = skills.addXp('magic', spell.xp + dmg * 2);
    if (r && r.leveledUp) { gameMessage('Congratulations, your Magic is now level ' + r.level + '!'); refreshPanel(); }
  }

  // --- per-frame: fly the bolts ---------------------------------------------
  let last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    if (!window.eldenmoor || !window.eldenmoor.player) return;
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1;
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.t += dt * 3.2;   // ~0.3s flight
      const to = b.target && b.target.position
        ? new THREE.Vector3(b.target.position.x, (b.target.position.y || 0) + 1.0, b.target.position.z)
        : b.from;
      b.mesh.position.lerpVectors(b.from, to, Math.min(1, b.t));
      if (b.t >= 1) { landBolt(b); bolts.splice(i, 1); }
    }
  }
  requestAnimationFrame(tick);

  return { cast: (g) => cast(g), arm: (id) => { armed = id; refreshPanel(); }, refreshPanel, SPELLS,
    get armed() { return armed; } };
}

// ----- self-initialize ------------------------------------------------------
(function boot() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.scene && em.camera && em.player && em.skills && em.inventory) {
      clearInterval(iv);
      try { em.magic = startMagic(em); }
      catch (err) { console.error('[magic] failed to start', err); }
    } else if (tries > 600) { clearInterval(iv); }
  }, 100);
})();
