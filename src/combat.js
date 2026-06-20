// combat.js — Eldenmoor's first combat system.
//
// Click a monster (built by monsters.js) to attack it. The player walks into
// melee range, then trades blows on a timer using the equipped weapon. Damage
// numbers float up as DOM overlays; on death the monster fades out, drops loot
// you can walk over to pick up, and respawns after a delay.
//
// Fully self-contained & self-initializing:
//   * polls for window.eldenmoor (+ its monsters list)
//   * installs its own click/raycast handler on the game canvas
//   * runs its own requestAnimationFrame loop
//   * stores all combat state on userData / window.eldenmoor.player.userData
//   * uses window.eldenmoor.vfx.burst('hit', x,y,z) for sparks when present
//
// Exposed via window.eldenmoor.combat.

import * as THREE from '../vendor/three.module.js';
import { ITEMS } from './items.js';
import './monsters.js';   // monsters self-initialize; combat reads em.monsters

// ----- tuning ----------------------------------------------------------------
const PLAYER_MAX_HP = 30;
const PLAYER_ATTACK_SPEED = 1.4;   // seconds between player swings
const MELEE_RANGE = 1.8;           // how close to trade blows
const RESPAWN_DELAY = 8;           // seconds before a slain monster returns
const LOOT_PICKUP_RANGE = 1.6;
const FADE_TIME = 1.1;             // death fade duration

// Damage a weapon does, derived from its catalogue entry. Eldenmoor weapons are
// woodcutting axes today, so we map their tier (headColor / value) to a punch.
function weaponDamage(weaponDef) {
  if (!weaponDef) return { min: 1, max: 2, speed: 2.0, name: 'Fists' };
  // value is a decent proxy for tier across the existing axe progression
  const v = weaponDef.value || 10;
  const base = Math.max(2, Math.round(2 + v / 60));
  const top = base + Math.max(2, Math.round(2 + v / 30));
  const speed = weaponDef.chopTime ? Math.max(0.8, weaponDef.chopTime * 0.85) : 1.5;
  return { min: base, max: top, speed, name: weaponDef.name };
}

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));

function startCombat(em) {
  const { scene, camera, player } = em;

  // ----- player combat state (lives on the player's userData) ---------------
  const pstate = player.userData.combat = {
    hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP,
    inCombat: false, target: null, lastAttack: 0, dead: false,
  };

  // ----- DOM overlay for floating damage numbers + player HP bar ------------
  const layer = document.createElement('div');
  layer.id = 'combat-layer';
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:40;overflow:hidden;font-family:Georgia,serif;';
  document.body.appendChild(layer);

  // player vitals bar (top-left, under any existing HUD it sits high enough)
  const hpWrap = document.createElement('div');
  hpWrap.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:42;width:190px;font:600 13px Georgia,serif;color:#f3ead2;pointer-events:none;';
  hpWrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;text-shadow:0 1px 2px #000;">
      <span>❤ Hitpoints</span><span id="cmb-hp-txt">${PLAYER_MAX_HP} / ${PLAYER_MAX_HP}</span>
    </div>
    <div style="height:14px;border:1px solid #2a1d10;border-radius:7px;background:#3a1414;box-shadow:inset 0 1px 3px #000;overflow:hidden;">
      <div id="cmb-hp-fill" style="height:100%;width:100%;background:linear-gradient(#e24b4b,#a01e1e);transition:width .15s;"></div>
    </div>`;
  document.body.appendChild(hpWrap);
  const hpFill = hpWrap.querySelector('#cmb-hp-fill');
  const hpTxt = hpWrap.querySelector('#cmb-hp-txt');
  function refreshPlayerHp() {
    const f = Math.max(0, pstate.hp) / pstate.maxHp;
    hpFill.style.width = (f * 100) + '%';
    hpTxt.textContent = Math.max(0, Math.round(pstate.hp)) + ' / ' + pstate.maxHp;
  }
  refreshPlayerHp();

  // project a world point to screen px
  const proj = new THREE.Vector3();
  function toScreen(x, y, z) {
    proj.set(x, y, z).project(camera);
    return {
      x: (proj.x * 0.5 + 0.5) * window.innerWidth,
      y: (-proj.y * 0.5 + 0.5) * window.innerHeight,
      behind: proj.z > 1,
    };
  }

  // floating number: dmg (red), miss (grey), heal/loot (gold)
  function floatNumber(x, y, z, text, kind) {
    const s = toScreen(x, y, z);
    if (s.behind) return;
    const el = document.createElement('div');
    const colors = { dmg: '#ff5a4a', big: '#ffd24a', miss: '#cfcfcf', loot: '#ffe07a', self: '#ff8080' };
    el.textContent = text;
    el.style.cssText = `position:absolute;left:${s.x}px;top:${s.y}px;transform:translate(-50%,-50%);` +
      `font:700 ${kind === 'big' ? 22 : 17}px Georgia,serif;color:${colors[kind] || '#fff'};` +
      `text-shadow:0 2px 3px #000,0 0 4px #000;will-change:transform,opacity;pointer-events:none;`;
    layer.appendChild(el);
    const driftX = rand(-14, 14);
    const start = performance.now();
    const dur = 900;
    (function anim(now) {
      const k = Math.min(1, (now - start) / dur);
      el.style.transform = `translate(calc(-50% + ${driftX * k}px), calc(-50% - ${42 * k}px)) scale(${1 + 0.2 * (1 - k)})`;
      el.style.opacity = String(1 - k * k);
      if (k < 1) requestAnimationFrame(anim); else el.remove();
    })(start);
  }

  // ----- per-monster floating HP bar (DOM, only while engaged) --------------
  const barFor = new Map();   // monsterGroup -> {wrap, fill}
  function ensureBar(g) {
    let b = barFor.get(g);
    if (b) return b;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;width:54px;height:7px;border:1px solid #1a1410;border-radius:4px;background:#3a1414;transform:translate(-50%,-50%);box-shadow:0 1px 3px #000;';
    const fill = document.createElement('div');
    fill.style.cssText = 'height:100%;width:100%;background:linear-gradient(#7fe24b,#3aa01e);border-radius:3px;';
    wrap.appendChild(fill);
    layer.appendChild(wrap);
    b = { wrap, fill };
    barFor.set(g, b);
    return b;
  }
  function removeBar(g) {
    const b = barFor.get(g);
    if (b) { b.wrap.remove(); barFor.delete(g); }
  }

  // ----- loot drops on the ground -------------------------------------------
  const drops = [];   // { group, itemId, qty, born }
  function dropLoot(typeDef, x, z) {
    for (const entry of typeDef.loot || []) {
      if (Math.random() > entry.chance) continue;
      const qty = entry.min === entry.max ? entry.min : randInt(entry.min, entry.max);
      spawnDrop(entry.id, qty, x + rand(-0.4, 0.4), z + rand(-0.4, 0.4));
    }
  }
  function spawnDrop(itemId, qty, x, z) {
    const isCoin = itemId === 'coins';
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({
      color: isCoin ? 0xf2cf4e : 0xb98a3a, roughness: 0.5, metalness: isCoin ? 0.6 : 0.2,
      emissive: isCoin ? 0x4a3a00 : 0x2a1f08, emissiveIntensity: 0.5,
    });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 16), m);
    disc.castShadow = true; g.add(disc);
    if (!isCoin) { const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), m); knob.position.y = 0.08; g.add(knob); }
    g.position.set(x, 0.3, z);
    scene.add(g);
    if (em.vfx && em.vfx.burst) em.vfx.burst(isCoin ? 'coin' : 'hit', x, 0.4, z);
    drops.push({ group: g, itemId, qty, born: performance.now() / 1000 });
  }
  function updateDrops(dt, t) {
    const onGround = (em.getFloor ? em.getFloor() : 0) === 0;
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.group.visible = onGround;
      d.group.rotation.y += dt * 1.5;
      d.group.position.y = 0.3 + Math.sin(t * 2 + i) * 0.06;
      if (!onGround) continue;
      const dx = player.position.x - d.group.position.x, dz = player.position.z - d.group.position.z;
      if (Math.hypot(dx, dz) < LOOT_PICKUP_RANGE) {
        const inv = em.inventory;
        if (inv && inv.add(d.itemId, d.qty)) {
          const def = ITEMS[d.itemId];
          floatNumber(d.group.position.x, 0.9, d.group.position.z,
            '+' + d.qty + ' ' + (def ? def.name : d.itemId), 'loot');
          if (em.vfx && em.vfx.burst) em.vfx.burst('coin', d.group.position.x, 0.5, d.group.position.z);
          scene.remove(d.group); drops.splice(i, 1);
        }
      } else if (t - d.born > 90) {   // despawn old loot
        scene.remove(d.group); drops.splice(i, 1);
      }
    }
  }

  // ----- targeting / click handler ------------------------------------------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const canvas = (em.renderer && em.renderer.domElement) || document.querySelector('canvas');

  function monstersList() { return (em.monsters && em.monsters.list) || []; }

  function pickMonster(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const list = monstersList().filter((g) => g.visible && g.userData.monster && g.userData.monster.alive);
    const hits = raycaster.intersectObjects(list, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.monsterRoot) o = o.parent;
      if (o && o.userData.monsterRoot) return o.userData.monsterRoot;
    }
    return null;
  }

  let downX = 0, downY = 0;
  if (canvas) {
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { downX = e.clientX; downY = e.clientY; } }, true);
    canvas.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;   // a camera drag, not a click
      const g = pickMonster(e.clientX, e.clientY);
      if (g) { engage(g); e.stopPropagation(); }
    }, true);   // capture so we beat the move-to-click handler when over a monster
  }

  function engage(g) {
    if (pstate.dead) return;
    const md = g.userData.monster;
    if (!md || !md.alive) return;
    pstate.target = g;
    pstate.inCombat = true;
    md.state = 'chase';   // make it come at you too
    if (em.gameMessage) em.gameMessage('You attack the ' + md.type.name + '!');
  }

  // ----- combat resolution ---------------------------------------------------
  function hitMonster(g) {
    const md = g.userData.monster;
    const wd = weaponDamage(em.equipment && em.equipment.getWeapon && em.equipment.getWeapon());
    // simple accuracy vs defense
    const hitChance = Math.max(0.35, 1 - md.type.defense * 0.06);
    const bx = g.position.x, by = g.position.y + (md.type.hpBarY || 1.2), bz = g.position.z;
    if (Math.random() > hitChance) {
      floatNumber(bx, by, bz, '0', 'miss');
      return;
    }
    const dmg = randInt(wd.min, wd.max);
    md.hp -= dmg;
    floatNumber(bx, by, bz, String(dmg), dmg >= wd.max ? 'big' : 'dmg');
    if (em.vfx && em.vfx.burst) em.vfx.burst('hit', bx, by, bz);
    if (md.hp <= 0) killMonster(g);
  }

  function hitPlayer(g) {
    const md = g.userData.monster;
    const [lo, hi] = md.type.dmg;
    const dmg = randInt(lo, hi);
    pstate.hp -= dmg;
    refreshPlayerHp();
    const s = player.position;
    floatNumber(s.x, 1.9, s.z, '-' + dmg, 'self');
    if (em.vfx && em.vfx.burst) em.vfx.burst('hit', s.x, 1.4, s.z);
    if (pstate.hp <= 0) playerDie();
  }

  function killMonster(g) {
    const md = g.userData.monster;
    md.alive = false; md.state = 'dead';
    md.hp = 0;
    removeBar(g);
    if (pstate.target === g) { pstate.target = null; pstate.inCombat = false; }
    if (em.gameMessage) em.gameMessage('You have slain the ' + md.type.name + '.');
    floatNumber(g.position.x, g.position.y + 1.4, g.position.z, '+' + md.type.xp + ' xp', 'loot');
    dropLoot(md.type, g.position.x, g.position.z);
    // grant a little woodcutting/combat xp if a skills system is around
    try { if (em.skills && em.skills.addXp) em.skills.addXp('attack', md.type.xp); } catch (e) {}
    // fade out, then remove + schedule respawn
    md.fadeStart = performance.now() / 1000;
    md.respawnHome = md.home;
    md.respawnType = md.typeId;
  }

  function playerDie() {
    if (pstate.dead) return;
    pstate.dead = true;
    pstate.inCombat = false; pstate.target = null;
    pstate.hp = 0; refreshPlayerHp();
    if (em.gameMessage) em.gameMessage('Oh dear, you are dead! You will recover shortly...');
    const banner = document.createElement('div');
    banner.textContent = 'You died';
    banner.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:60;background:rgba(60,0,0,0.35);color:#ffcaca;font:700 54px Georgia,serif;text-shadow:0 3px 8px #000;transition:opacity 1s;';
    document.body.appendChild(banner);
    setTimeout(() => {
      pstate.hp = pstate.maxHp; pstate.dead = false; refreshPlayerHp();
      banner.style.opacity = '0';
      setTimeout(() => banner.remove(), 1000);
      if (em.gameMessage) em.gameMessage('You feel your strength return.');
    }, 3000);
  }

  // ----- fade + respawn bookkeeping -----------------------------------------
  function setOpacity(g, a) {
    g.traverse((o) => {
      if (o.material) {
        o.material.transparent = true;
        o.material.opacity = a;
      }
    });
  }

  // ----- main loop -----------------------------------------------------------
  let last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    if (!window.eldenmoor || !window.eldenmoor.player) return;
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1;
    const t = now / 1000;

    // 1) player melee tick against the current target
    const g = pstate.target;
    if (g && g.userData.monster && g.userData.monster.alive && !pstate.dead) {
      const md = g.userData.monster;
      const dx = g.position.x - player.position.x, dz = g.position.z - player.position.z;
      const dist = Math.hypot(dx, dz);
      // face the monster
      player.rotation.y = Math.atan2(dx, dz);
      if (dist <= MELEE_RANGE) {
        const wd = weaponDamage(em.equipment && em.equipment.getWeapon && em.equipment.getWeapon());
        if (t - pstate.lastAttack >= wd.speed) { pstate.lastAttack = t; hitMonster(g); }
      }
    } else if (g && (!g.userData.monster || !g.userData.monster.alive)) {
      pstate.target = null; pstate.inCombat = false;
    }

    // 2) monster melee tick against the player (any aggro'd, in-range monster)
    if (!pstate.dead) {
      for (const mg of monstersList()) {
        const md = mg.userData.monster;
        if (!md || !md.alive || md.state !== 'chase' || !mg.visible) continue;
        const dx = mg.position.x - player.position.x, dz = mg.position.z - player.position.z;
        if (Math.hypot(dx, dz) <= MELEE_RANGE + 0.3) {
          if (t - md.lastAttack >= md.type.attackSpeed) { md.lastAttack = t; hitPlayer(mg); }
        }
      }
    }

    // 3) per-monster HP bars (only for damaged / engaged monsters)
    for (const mg of monstersList()) {
      const md = mg.userData.monster;
      if (!md) continue;
      const engaged = md.alive && mg.visible && (md.hp < md.maxHp || md.state === 'chase');
      if (engaged) {
        const b = ensureBar(mg);
        const s = toScreen(mg.position.x, mg.position.y + (md.type.hpBarY || 1.2) + 0.35, mg.position.z);
        if (s.behind) { b.wrap.style.display = 'none'; }
        else {
          b.wrap.style.display = 'block';
          b.wrap.style.left = s.x + 'px';
          b.wrap.style.top = s.y + 'px';
          b.fill.style.width = Math.max(0, (md.hp / md.maxHp) * 100) + '%';
        }
      } else if (barFor.has(mg)) {
        removeBar(mg);
      }
    }

    // 4) dead monster fade + remove + respawn
    for (const mg of monstersList().slice()) {
      const md = mg.userData.monster;
      if (!md || md.state !== 'dead' || md.fadeStart == null) continue;
      const k = (t - md.fadeStart) / FADE_TIME;
      if (k < 1) {
        setOpacity(mg, 1 - k);
        mg.position.y = -k * 0.4;
      } else {
        const home = md.respawnHome, type = md.respawnType;
        em.monsters.remove(mg);
        removeBar(mg);
        setTimeout(() => { if (em.monsters && em.monsters.respawn) em.monsters.respawn(type, home); }, RESPAWN_DELAY * 1000);
      }
    }

    // 5) loot drops
    updateDrops(dt, t);
  }
  requestAnimationFrame(tick);

  return {
    state: pstate,
    attack: engage,
    setPlayerHp: (n) => { pstate.hp = Math.max(0, Math.min(pstate.maxHp, n)); refreshPlayerHp(); },
    list: monstersList,
    dropLoot,
  };
}

// ----- self-initialize: wait for window.eldenmoor (and ideally monsters) -----
(function boot() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.scene && em.camera && em.player) {
      clearInterval(iv);
      try { em.combat = startCombat(em); }
      catch (err) { console.error('[combat] failed to start', err); }
    } else if (tries > 600) { clearInterval(iv); }
  }, 100);
})();
