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
import { gameMessage } from './ui.js';
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
    spec: 100, specArmed: false, specAcc: 0,
  };

  // ----- DOM overlay for floating damage numbers + player HP bar ------------
  const layer = document.createElement('div');
  layer.id = 'combat-layer';
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:40;overflow:hidden;font-family:Georgia,serif;';
  document.body.appendChild(layer);

  // Player HP lives in the existing top-left vitals bar (#hp-bar / #hp-text) —
  // no separate floating overlay (it used to collide with the chat box).
  const hpFill = document.getElementById('hp-bar');
  const hpTxt = document.getElementById('hp-text');
  function refreshPlayerHp() {
    const f = Math.max(0, pstate.hp) / pstate.maxHp;
    if (hpFill) hpFill.style.width = (f * 100) + '%';
    if (hpTxt) hpTxt.textContent = Math.max(0, Math.round(pstate.hp)) + ' / ' + pstate.maxHp;
  }
  refreshPlayerHp();

  // ----- Special-attack energy bar (bottom-centre) --------------------------
  // A clickable ⚡ bar that arms a weapon special; the next swing spends energy
  // for a bigger/multi-hit blow. Press F or click to arm. Energy regenerates.
  const specWrap = document.createElement('div');
  specWrap.id = 'spec-bar';
  specWrap.title = 'Special attack (F) — arm it, then your next hit unleashes your weapon’s special';
  specWrap.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:24;' +
    'width:188px;height:22px;border:1px solid #b9892f;border-radius:11px;background:rgba(20,16,10,0.7);' +
    'cursor:pointer;user-select:none;overflow:hidden;font-family:Georgia,serif;box-shadow:0 2px 6px rgba(0,0,0,0.5);';
  const specFill = document.createElement('div');
  specFill.style.cssText = 'position:absolute;inset:0;width:100%;background:linear-gradient(180deg,#ffd86a,#d98a2a);transition:width 0.2s;';
  const specLbl = document.createElement('div');
  specLbl.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
    'font-size:12px;font-weight:700;color:#2a1c08;text-shadow:0 1px 0 rgba(255,255,255,0.3);';
  specWrap.appendChild(specFill); specWrap.appendChild(specLbl);
  document.body.appendChild(specWrap);
  function refreshSpec() {
    const pct = Math.max(0, Math.min(100, pstate.spec));
    specFill.style.width = pct + '%';
    specLbl.textContent = '⚡ Special ' + Math.floor(pct) + '%' + (pstate.specArmed ? ' ◄ARMED' : '');
    specWrap.style.borderColor = pstate.specArmed ? '#ffe89a' : '#b9892f';
  }
  function armSpec() {
    if (pstate.spec < 25) { gameMessage('Not enough special attack energy.'); return; }
    pstate.specArmed = !pstate.specArmed; refreshSpec();
    if (em.audio && em.audio.play) em.audio.play('click');
  }
  specWrap.addEventListener('click', armSpec);
  window.addEventListener('keydown', (e) => {
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
    if (e.code === 'KeyF') { e.preventDefault(); armSpec(); }
  });
  refreshSpec();

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
  // Tint a ground item by its rough category so drops read at a glance:
  // gold coins, bone-white bones, red meat/hide, green/themed trophies, steel gear.
  function dropColor(itemId) {
    if (itemId === 'coins') return { color: 0xf2cf4e, emissive: 0x4a3a00, metal: 0.6 };
    if (itemId === 'bones' || itemId === 'big_bones') return { color: 0xece3cf, emissive: 0x2a2618, metal: 0.0 };
    if (itemId === 'feather') return { color: 0xf2efe6, emissive: 0x2a2820, metal: 0.0 };
    if (/raw_|_meat|cowhide|_hide|frog_leg/.test(itemId)) return { color: 0xb85a56, emissive: 0x2a1010, metal: 0.0 };
    if (/dagger|sword|axe/.test(itemId)) return { color: 0xb8bcc4, emissive: 0x14181c, metal: 0.7 };
    if (itemId === 'emerald') return { color: 0x3fbf6a, emissive: 0x0a3a18, metal: 0.3 };
    if (/charm|fang|stinger|ear|tail|leather_body/.test(itemId)) return { color: 0x8a7a4a, emissive: 0x201808, metal: 0.1 };
    return { color: 0xb98a3a, emissive: 0x2a1f08, metal: 0.2 };
  }
  function spawnDrop(itemId, qty, x, z) {
    const isCoin = itemId === 'coins';
    const c = dropColor(itemId);
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({
      color: c.color, roughness: 0.5, metalness: c.metal,
      emissive: c.emissive, emissiveIntensity: 0.5,
    });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 16), m);
    disc.castShadow = true; g.add(disc);
    if (!isCoin) { const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), m); knob.position.y = 0.08; g.add(knob); }
    g.position.set(x, 0.3, z);
    scene.add(g);
    if (em.vfx && em.vfx.burst) em.vfx.burst(isCoin ? 'coin' : 'hit', x, 0.4, z);
    // OSRS-style floating ground-item name label (DOM), clears on pickup/despawn.
    const def = ITEMS[itemId];
    const label = document.createElement('div');
    label.textContent = (qty > 1 ? qty + ' ' : '') + (def ? def.name : itemId);
    label.style.cssText = 'position:absolute;transform:translate(-50%,-50%);font:600 12px Georgia,serif;' +
      'color:#ffe9a8;text-shadow:0 1px 2px #000,0 0 3px #000;pointer-events:none;white-space:nowrap;';
    layer.appendChild(label);
    drops.push({ group: g, itemId, qty, born: performance.now() / 1000, label });
  }
  function removeDrop(d, i) {
    scene.remove(d.group);
    d.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    if (d.label) d.label.remove();
    drops.splice(i, 1);
  }
  function updateDrops(dt, t) {
    const onGround = (em.getFloor ? em.getFloor() : 0) === 0;
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.group.visible = onGround;
      d.group.rotation.y += dt * 1.5;
      d.group.position.y = 0.3 + Math.sin(t * 2 + i) * 0.06;
      // position the floating name label above the item
      if (d.label) {
        const s = toScreen(d.group.position.x, 0.95, d.group.position.z);
        if (!onGround || s.behind) { d.label.style.display = 'none'; }
        else { d.label.style.display = 'block'; d.label.style.left = s.x + 'px'; d.label.style.top = s.y + 'px'; }
      }
      if (!onGround) continue;
      const dx = player.position.x - d.group.position.x, dz = player.position.z - d.group.position.z;
      if (Math.hypot(dx, dz) < LOOT_PICKUP_RANGE) {
        const inv = em.inventory;
        if (inv && inv.add(d.itemId, d.qty)) {
          const def = ITEMS[d.itemId];
          floatNumber(d.group.position.x, 0.9, d.group.position.z,
            '+' + d.qty + ' ' + (def ? def.name : d.itemId), 'loot');
          if (em.vfx && em.vfx.burst) em.vfx.burst('coin', d.group.position.x, 0.5, d.group.position.z);
          removeDrop(d, i);
        }
      } else if (t - d.born > 90) {   // despawn old loot
        removeDrop(d, i);
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

  // Raycast against ground-item drops; returns the drops[] index under the cursor.
  function pickDropIndex(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const groups = drops.map((d) => d.group).filter((g) => g.visible);
    const hits = raycaster.intersectObjects(groups, true);
    if (!hits.length) return -1;
    let o = hits[0].object; while (o && o.parent && o.parent !== scene) o = o.parent;
    return drops.findIndex((d) => d.group === o);
  }

  let downX = 0, downY = 0;
  if (canvas) {
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { downX = e.clientX; downY = e.clientY; } }, true);
    canvas.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;   // a camera drag, not a click
      const g = pickMonster(e.clientX, e.clientY);
      if (g) { engage(g); e.stopPropagation(); return; }
      // Clicking a dropped item picks it straight up (OSRS-style "Take").
      const di = pickDropIndex(e.clientX, e.clientY);
      if (di >= 0) {
        const d = drops[di], inv = em.inventory;
        if (inv && inv.add(d.itemId, d.qty)) {
          const def = ITEMS[d.itemId];
          floatNumber(d.group.position.x, 0.9, d.group.position.z, '+' + d.qty + ' ' + (def ? def.name : d.itemId), 'loot');
          if (em.vfx && em.vfx.burst) em.vfx.burst('coin', d.group.position.x, 0.5, d.group.position.z);
          removeDrop(d, di);
        }
        e.stopPropagation();
      }
    }, true);   // capture so we beat the move-to-click handler when over a monster
  }

  function engage(g) {
    if (pstate.dead) return;
    const md = g.userData.monster;
    if (!md || !md.alive) return;
    const fresh = pstate.target !== g;
    pstate.target = g;
    pstate.inCombat = true;
    md.state = 'chase';   // make it come at you too
    // Hand the walk-up to interactions.js: it owns player movement, so the hero
    // auto-walks into melee reach (and the existing main.js loop plays the sword
    // swing whenever interactions reports we're attacking). Clears any prior
    // chop/walk/talk target in the process.
    if (em.interactions && em.interactions.setAttackTarget) em.interactions.setAttackTarget(g);
    if (fresh) gameMessage('You attack the ' + md.type.name + '!');
  }

  // ----- combat resolution ---------------------------------------------------
  // Read a combat skill level off the skills system (defaults if absent so combat
  // still works before/without skills wiring).
  function lvl(id, dflt) {
    try { const s = em.skills && em.skills.state && em.skills.state[id]; return (s && s.level) || dflt; }
    catch (e) { return dflt; }
  }

  function gearBonuses() {
    try { return (em.equipment && em.equipment.getBonuses && em.equipment.getBonuses()) || { attack: 0, strength: 0, defence: 0 }; }
    catch (e) { return { attack: 0, strength: 0, defence: 0 }; }
  }
  function prayerBoosts() {
    try { return (em.prayer && em.prayer.getBoosts && em.prayer.getBoosts()) || { attack: 1, strength: 1, defence: 1 }; }
    catch (e) { return { attack: 1, strength: 1, defence: 1 }; }
  }

  // The special attack each weapon performs (spacebar/⚡): cost in spec energy,
  // how many hits, a damage multiplier, and an accuracy multiplier. Keyed by a
  // weapon "kind" derived from the equipped item so we never touch items.js.
  const SPECIALS = {
    hollow_blade: { name: 'Soul Cleave',  cost: 50, hits: 2, mul: 1.45, acc: 2.4 },
    scimitar:     { name: 'Sever',        cost: 55, hits: 1, mul: 1.7,  acc: 2.2 },
    dagger:       { name: 'Puncture',     cost: 25, hits: 2, mul: 1.2,  acc: 2.6 },
    sword:        { name: 'Cleave',       cost: 50, hits: 1, mul: 1.45, acc: 1.9 },
    axe:          { name: 'Hack',         cost: 50, hits: 1, mul: 1.5,  acc: 1.7 },
    fists:        { name: 'Flurry',       cost: 50, hits: 2, mul: 1.1,  acc: 1.6 },
  };
  function weaponSpecialKind(def) {
    if (!def) return 'fists';
    if (def.id === 'hollow_blade') return 'hollow_blade';
    if (/scimitar/.test(def.id || '')) return 'scimitar';
    if (/dagger/.test(def.id || '')) return 'dagger';
    if (def.tool === 'axe') return 'axe';
    return 'sword';
  }

  // One melee swing's damage roll against a monster. `opts.accMul`/`opts.dmgMul`
  // let a special attack boost accuracy / damage; returns the damage dealt.
  function rollMelee(g, opts) {
    opts = opts || {};
    const md = g.userData.monster;
    const wd = weaponDamage(em.equipment && em.equipment.getWeapon && em.equipment.getWeapon());
    const eb = gearBonuses();
    const pb = prayerBoosts();
    const atk = lvl('attack', 1), str = lvl('strength', 1);
    const effAtk = (atk + 4 + eb.attack * 0.6) * pb.attack * (opts.accMul || 1);
    const hitChance = Math.max(0.45, Math.min(0.99, effAtk / (effAtk + md.type.defense * 2.4)));
    const bx = g.position.x, by = g.position.y + (md.type.hpBarY || 1.2), bz = g.position.z;
    if (Math.random() > hitChance) { floatNumber(bx, by, bz, '0', 'miss'); return 0; }
    const maxHit = Math.max(wd.min, Math.round((wd.max + eb.strength * 0.35) * (1 + (str - 1) * 0.05) * pb.strength * (opts.dmgMul || 1)));
    const dmg = randInt(0, maxHit);
    md.hp -= dmg;
    floatNumber(bx, by, bz, String(dmg), opts.special ? 'big' : (dmg >= maxHit && dmg > 0 ? 'big' : (dmg === 0 ? 'miss' : 'dmg')));
    if (em.vfx && em.vfx.burst) em.vfx.burst('hit', bx, by, bz);
    return dmg;
  }

  function hitMonster(g) {
    const md = g.userData.monster;
    // If the player armed a special and has the energy for it, fire it now.
    if (pstate.specArmed) {
      pstate.specArmed = false;
      const def = em.equipment && em.equipment.getWeapon && em.equipment.getWeapon();
      const spec = SPECIALS[weaponSpecialKind(def)] || SPECIALS.sword;
      if (pstate.spec >= spec.cost) {
        pstate.spec -= spec.cost; refreshSpec();
        floatNumber(g.position.x, g.position.y + (md.type.hpBarY || 1.2) + 0.4, g.position.z, spec.name + '!', 'loot');
        if (em.audio && em.audio.play) em.audio.play('levelup');
        for (let i = 0; i < spec.hits && md.hp > 0; i++) rollMelee(g, { accMul: spec.acc, dmgMul: spec.mul, special: true });
        if (md.hp <= 0) killMonster(g);
        return;
      } else {
        gameMessage('Not enough special attack energy.');
      }
    }
    rollMelee(g);
    if (md.hp <= 0) killMonster(g);
  }

  function hitPlayer(g) {
    const md = g.userData.monster;
    const [lo, hi] = md.type.dmg;
    let dmg = randInt(lo, hi);
    // Worn Defence bonus + Defence level give a chance to soak part of the blow,
    // so armour you smith/buy visibly keeps you alive longer.
    const eb = gearBonuses();
    const defLvl = lvl('defence', 1);
    const soak = (eb.defence + defLvl * 0.5) * prayerBoosts().defence;
    if (dmg > 0 && Math.random() < soak / (soak + 30)) dmg = Math.max(0, dmg - 1 - Math.floor(eb.defence / 12));
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
    if (em.interactions && em.interactions.getAttackTarget && em.interactions.getAttackTarget() === g && em.interactions.stop) em.interactions.stop();
    gameMessage('You have slain the ' + md.type.name + '.');
    floatNumber(g.position.x, g.position.y + 1.4, g.position.z, '+' + md.type.xp + ' xp', 'loot');
    dropLoot(md.type, g.position.x, g.position.z);
    // Award combat XP OSRS-style, routed by the chosen ATTACK STYLE (Combat tab):
    //   accurate -> Attack, aggressive -> Strength, defensive -> Defence,
    //   controlled -> split evenly across all three. Hitpoints always gets a
    //   third. Defensive try/catch so a missing skill id never breaks the kill.
    try {
      if (em.skills && em.skills.addXp) {
        const xp = md.type.xp;
        const style = (em.attackStyle) || (function () { try { return localStorage.getItem('eldenmoor.attackStyle'); } catch (e) { return null; } })() || 'accurate';
        const routes = { accurate: ['attack'], aggressive: ['strength'], defensive: ['defence'], controlled: ['attack', 'strength', 'defence'] };
        const ids = routes[style] || routes.accurate;
        const share = xp / ids.length;
        let leveled = null;
        for (const id of ids) {
          const r = em.skills.addXp(id, share);
          if (r && r.leveledUp) leveled = { id, level: r.level };
        }
        const rh = em.skills.addXp('hitpoints', Math.max(1, Math.round(xp / 3)));
        if (rh && rh.leveledUp) leveled = { id: 'hitpoints', level: rh.level };
        if (leveled) gameMessage('Congratulations, your ' + leveled.id + ' is now level ' + leveled.level + '!');
      }
    } catch (e) {}
    // fade out, then remove + schedule respawn
    md.fadeStart = performance.now() / 1000;
    md.respawnHome = md.home;
    md.respawnType = md.typeId;
    // Let active quests count this kill toward their objectives.
    try { if (em.quests && em.quests.onMonsterKill) em.quests.onMonsterKill(md.typeId); } catch (e) {}
  }

  function playerDie() {
    if (pstate.dead) return;
    pstate.dead = true;
    pstate.inCombat = false; pstate.target = null;
    pstate.hp = 0; refreshPlayerHp();
    gameMessage('Oh dear, you are dead! You will recover shortly...');
    const banner = document.createElement('div');
    banner.textContent = 'You died';
    banner.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:60;background:rgba(60,0,0,0.35);color:#ffcaca;font:700 54px Georgia,serif;text-shadow:0 3px 8px #000;transition:opacity 1s;';
    document.body.appendChild(banner);
    setTimeout(() => {
      pstate.hp = pstate.maxHp; pstate.dead = false; refreshPlayerHp();
      banner.style.opacity = '0';
      setTimeout(() => banner.remove(), 1000);
      gameMessage('You feel your strength return.');
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

    // Slow natural Hitpoints regeneration (OSRS-style): ~1 HP every few seconds
    // while alive and hurt, so you recover between fights without always eating.
    // Max HP tracks the Hitpoints level if skills are available.
    if (!pstate.dead) {
      const hpLvl = (em.skills && em.skills.maxHp && em.skills.maxHp()) || pstate.maxHp;
      if (hpLvl > pstate.maxHp) pstate.maxHp = hpLvl;   // never shrink below current
      if (pstate.hp < pstate.maxHp) {
        pstate.regenAcc = (pstate.regenAcc || 0) + dt;
        if (pstate.regenAcc >= 4.5) { pstate.regenAcc = 0; pstate.hp = Math.min(pstate.maxHp, pstate.hp + 1); refreshPlayerHp(); }
      }
      // special-attack energy regenerates to full over ~45s
      if (pstate.spec < 100) {
        pstate.spec = Math.min(100, pstate.spec + dt * (100 / 45));
        pstate.specAcc = (pstate.specAcc || 0) + dt;
        if (pstate.specAcc >= 0.4) { pstate.specAcc = 0; refreshSpec(); }
      }
    }

    // Keep our target in sync with interactions.js. If the player clicked a tree,
    // an NPC, or the ground, interactions clears its attack target — so we drop
    // ours too and stop fighting (no more phantom swings at a thing we walked off).
    if (em.interactions && em.interactions.getAttackTarget) {
      const at = em.interactions.getAttackTarget();
      if (pstate.target && at !== pstate.target) { pstate.target = null; pstate.inCombat = false; }
    }

    // 1) player melee tick against the current target.
    //    interactions.js walks the hero into range and plays the swing pose; here
    //    we just time the blows once we're actually close enough to land them.
    const setChop = player.userData && player.userData.setPlayerChop;
    const g = pstate.target;
    if (g && g.userData.monster && g.userData.monster.alive && !pstate.dead) {
      const md = g.userData.monster;
      const dx = g.position.x - player.position.x, dz = g.position.z - player.position.z;
      const dist = Math.hypot(dx, dz);
      player.rotation.y = Math.atan2(dx, dz);   // face the monster
      if (dist <= MELEE_RANGE) {
        const wd = weaponDamage(em.equipment && em.equipment.getWeapon && em.equipment.getWeapon());
        if (t - pstate.lastAttack >= wd.speed) {
          pstate.lastAttack = t;
          if (setChop) try { setChop(true); } catch (e) {}   // sword-swing clip (hero model API, when present)
          hitMonster(g);
        } else if (setChop && t - pstate.lastAttack > 0.35) {
          try { setChop(false); } catch (e) {}               // relax between swings
        }
      } else if (setChop) {
        try { setChop(false); } catch (e) {}
      }
    } else {
      if (g && (!g.userData.monster || !g.userData.monster.alive)) { pstate.target = null; pstate.inCombat = false; }
      if (setChop) try { setChop(false); } catch (e) {}
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

  // Apply a chunk of damage to a monster from an external source (e.g. a Magic
  // spell), routing through the normal floating-number, HP-bar and kill/loot/XP
  // path so spells feel identical to melee. Returns the damage actually dealt.
  function damageMonster(g, dmg, kind) {
    if (!g || !g.userData || !g.userData.monster) return 0;
    const md = g.userData.monster;
    if (!md.alive) return 0;
    dmg = Math.max(0, Math.round(dmg));
    md.hp -= dmg;
    const bx = g.position.x, by = g.position.y + (md.type.hpBarY || 1.2), bz = g.position.z;
    floatNumber(bx, by, bz, String(dmg), dmg === 0 ? 'miss' : (kind || 'dmg'));
    ensureBar(g);
    if (md.hp <= 0) killMonster(g);
    return dmg;
  }

  return {
    state: pstate,
    attack: engage,
    damageMonster,
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
