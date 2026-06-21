// fishing.js — Fishing, Cooking and Firemaking, built the same way the rest of
// Eldenmoor's gameplay modules are: fully self-contained & self-initializing.
//
//   * polls for window.eldenmoor (scene/camera/player/skills/inventory/...)
//   * builds a handful of FISHING SPOT click-targets at the water's edge (the
//     pond + the castle moat/canals), each with a small animated ripple marker
//   * installs its own capture-phase click/raycast handler on the game canvas:
//       - click a spot  -> walk to the shore, then fish on an OSRS-paced timer,
//         granting a raw fish + Fishing XP (level-gated by FISH_TIERS in skills.js)
//   * FIREMAKING: use a Tinderbox on Logs (left-click a tinderbox, or right-click
//     "Light fire") to light a temporary FIRE (~60s) granting Firemaking XP. The
//     fire counts as a COOKING source.
//   * COOKING: use a raw fish on a nearby FIRE or the kitchen RANGE -> a cooked
//     fish (chance to burn at low Cooking level -> burnt fish), granting Cooking XP.
//   * EATING: cooked fish are edible — left-click (or right-click "Eat") heals the
//     player (via window.eldenmoor.combat) and removes one from the bag.
//
// Touches no other module's source: skills.js/items.js carry the additive data
// (FISH_TIERS, fish items + heal values, fishing/cooking helpers); everything
// else is wired here at runtime against window.eldenmoor. Exposed as em.fishing.

import * as THREE from '../vendor/three.module.js';
import { ITEMS } from './items.js';
import { gameMessage } from './ui.js';

// ----- tuning ---------------------------------------------------------------
const FISH_RANGE = 2.8;       // how close to the spot you must stand to fish
const FISH_TIME = 2.6;        // seconds per cast attempt (OSRS-paced)
const SPOT_DEPLETE = 0.12;    // chance a spot "moves" (depletes) after a catch
const SPOT_RESPAWN = 7;       // seconds before a moved spot returns
const FIRE_LIFE = 60;         // a lit fire lasts ~60s
const COOK_RANGE = 2.4;       // how close to a fire/range to cook
const COOK_TIME = 1.8;        // seconds per cook
// The kitchen RANGE — a permanent cooking source by Bessa the castle cook
// (npc.js: 'cook' Bessa at x -18, z 37). We build a small stone range there.
const RANGE_POS = { x: -18, z: 39.2 };

// Where the fishing spots sit — dry shore points a touch outside the water so the
// hero stands on land and casts in. The pond is at (22,-16) r6 (world.js); the
// moat/canal shore points are read from water.js's layout. ~4-6 spots total.
const SPOT_DEFS = [
  { x: 22, z: -10.6 },   // pond, south shore
  { x: 16.0, z: -16 },   // pond, west shore
  { x: -10.4, z: 21 },   // front-west moat, by the causeway
  { x: 10.4, z: 21 },    // front-east moat, by the causeway
  { x: -34, z: 42 },     // west canal into the fields
  { x: 34, z: 42 },      // east canal into the fields
];

const rand = (a, b) => a + Math.random() * (b - a);

function startFishing(em) {
  const { scene, camera, player, skills, inventory } = em;

  // ---- build the fishing-spot markers -------------------------------------
  // Each spot is a small group of flat, expanding ripple rings just above the
  // water, plus an invisible disc that catches the raycast (so the thin rings are
  // easy to click). Tagged userData.kind='fishing_spot' like world resource nodes.
  const spots = [];
  const ringMat = () => new THREE.MeshBasicMaterial({
    color: 0xbfe6ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide,
    depthWrite: false, fog: true,
  });
  for (const def of SPOT_DEFS) {
    const g = new THREE.Group();
    g.position.set(def.x, 0.2, def.z);
    const rings = [];
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.34, 20), ringMat());
      r.rotation.x = -Math.PI / 2;
      r.userData.phase = i / 3;
      g.add(r); rings.push(r);
    }
    // fat invisible click pad
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(1.1, 16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    pad.rotation.x = -Math.PI / 2;
    g.add(pad);
    g.userData = { kind: 'fishing_spot', rings, depleted: false, respawnAt: 0 };
    scene.add(g);
    (scene.userData.outdoor = scene.userData.outdoor || []).push(g);
    spots.push(g);
  }
  scene.userData.fishingSpots = spots;

  // ---- targeting state -----------------------------------------------------
  let fishTarget = null;   // the spot we're walking to / fishing
  let fishTimer = 0;
  let clock = 0;

  // ---- raycasting / click handler -----------------------------------------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const canvas = (em.renderer && em.renderer.domElement) || document.querySelector('canvas');

  function pickSpot(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(spots, true);
    for (const h of hits) {
      let o = h.object;
      while (o && o.userData.kind !== 'fishing_spot') o = o.parent;
      if (o && !o.userData.depleted) return o;
    }
    return null;
  }

  let downX = 0, downY = 0;
  if (canvas) {
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { downX = e.clientX; downY = e.clientY; } }, true);
    canvas.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;   // a camera drag
      if ((em.getFloor ? em.getFloor() : 0) !== 0) { fishTarget = null; return; }   // only outdoors
      const s = pickSpot(e.clientX, e.clientY);
      if (s) { startFishingAt(s); e.stopPropagation(); }
      else fishTarget = null;   // a click elsewhere (walk/chop/attack) cancels fishing
    }, true);   // capture so we beat the walk-to-click handler when over a spot
  }

  function startFishingAt(spot) {
    if (em.interactions && em.interactions.stop) em.interactions.stop();   // drop chop/walk/attack
    fishTarget = spot; fishTimer = 0;
    // Walk to a point just short of the spot so we settle on land facing the water.
    if (em.interactions && em.interactions.setWalkTarget) {
      const dx = spot.position.x - player.position.x, dz = spot.position.z - player.position.z;
      const d = Math.max(0.001, Math.hypot(dx, dz));
      if (d > FISH_RANGE) {
        const k = (d - FISH_RANGE + 0.6) / d;
        em.interactions.setWalkTarget(new THREE.Vector3(player.position.x + dx * k, 0, player.position.z + dz * k));
      }
    }
  }

  // ---- right-click menu hooks (fishing spots in the world; cook/eat/light in
  //      the bag). We add our own contextmenu listeners; the existing menu in
  //      contextmenu.js still runs, so we only fire ours for things it ignores.
  installContextHooks();

  // ---- the kitchen RANGE: a permanent stone cooking source by Bessa --------
  buildRange(RANGE_POS.x, RANGE_POS.z);
  function buildRange(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const stone = new THREE.MeshStandardMaterial({ color: 0x8a847a, roughness: 0.95 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1.0), stone);
    body.position.y = 0.45; body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    // a glowing fire mouth on the front
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xff7a2a, emissive: 0xff6a1a, emissiveIntensity: 1.2 }));
    mouth.position.set(0, 0.4, 0.52); g.add(mouth);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 1.1), stone);
    top.position.y = 0.96; g.add(top);
    scene.add(g);
    (scene.userData.outdoor = scene.userData.outdoor || []).push(g);
    if (em.vfx && em.vfx.attachFire) em.vfx.attachFire(x, 0.5, z + 0.5, { rate: 16, emberRate: 2, scale: 0.7, intensity: 0.9, src: g });
    // keep it tagged so a right-click could examine it later
    g.userData = { kind: 'range' };
  }

  // ---- the FIRES we've lit (temporary cooking sources) --------------------
  const fires = [];   // { group, x, z, diesAt, vfx }

  function lightFire(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    // a little ring of charred logs
    const logMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1 });
    for (let i = 0; i < 5; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.8, 6), logMat);
      const a = (i / 5) * Math.PI * 2;
      log.position.set(Math.cos(a) * 0.18, 0.1, Math.sin(a) * 0.18);
      log.rotation.z = Math.PI / 2; log.rotation.y = a;
      log.castShadow = true;
      g.add(log);
    }
    scene.add(g);
    (scene.userData.outdoor = scene.userData.outdoor || []).push(g);
    let fxHandle = null;
    if (em.vfx && em.vfx.attachFire) {
      fxHandle = em.vfx.attachFire(x, 0.35, z, { rate: 30, emberRate: 4, scale: 1.1, intensity: 1.4, src: g });
    }
    if (em.audio && em.audio.play) em.audio.play('chop');   // a woody crackle stand-in
    const fire = { group: g, x, z, diesAt: clock + FIRE_LIFE, vfx: fxHandle };
    fires.push(fire);
    return fire;
  }

  // Nearest live cooking source (a lit fire, or the kitchen range) within range
  // of the player. Returns { x, z, onRange } or null.
  function nearestCookSource() {
    let best = null, bestD = COOK_RANGE * COOK_RANGE;
    for (const f of fires) {
      const dx = f.x - player.position.x, dz = f.z - player.position.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = { x: f.x, z: f.z, onRange: false }; }
    }
    // kitchen range (a fixed cooking spot in the castle/town kitchen)
    const dxr = RANGE_POS.x - player.position.x, dzr = RANGE_POS.z - player.position.z;
    if (dxr * dxr + dzr * dzr < bestD) best = { x: RANGE_POS.x, z: RANGE_POS.z, onRange: true };
    return best;
  }

  // ---- FIREMAKING: turn logs + a tinderbox into a fire at the player's feet --
  const ANY_LOG = ['logs', 'oak_logs', 'willow_logs', 'maple_logs', 'yew_logs', 'magic_logs'];
  function tryLightFire() {
    if (!inventory.count('tinderbox')) { gameMessage('You need a tinderbox to light a fire.'); return false; }
    const logId = ANY_LOG.find((id) => inventory.count(id) > 0);
    if (!logId) { gameMessage('You need some logs to light a fire.'); return false; }
    inventory.removeOne(logId);
    lightFire(player.position.x, player.position.z);
    const r = skills.addXp ? skills.addXp('firemaking', firemakingXp(logId)) : { leveledUp: false };
    gameMessage('The fire catches and crackles to life.');
    if (r && r.leveledUp) gameMessage('Congratulations, your Firemaking is now level ' + r.level + '!');
    return true;
  }
  // Firemaking XP per log, OSRS-paced (normal 40 → magic 304), scaled in line with
  // the rest of the game's whole-number XP.
  function firemakingXp(logId) {
    return ({ logs: 40, oak_logs: 60, willow_logs: 90, maple_logs: 135, yew_logs: 202, magic_logs: 304 })[logId] || 40;
  }

  // ---- COOKING: cook a raw fish at the nearest fire/range -------------------
  const RAW_TO_COOKED = {
    raw_shrimp: { cooked: 'cooked_shrimp', xp: 30, cookLevel: 1, noBurn: 34 },
    raw_sardine: { cooked: 'cooked_sardine', xp: 40, cookLevel: 1, noBurn: 38 },
    raw_trout: { cooked: 'cooked_trout', xp: 70, cookLevel: 15, noBurn: 50 },
    raw_salmon: { cooked: 'cooked_salmon', xp: 90, cookLevel: 25, noBurn: 58 },
    raw_lobster: { cooked: 'cooked_lobster', xp: 120, cookLevel: 40, noBurn: 74 },
  };
  function tryCook(rawId) {
    const rule = RAW_TO_COOKED[rawId];
    if (!rule) return false;
    if (!inventory.count(rawId)) return false;
    const src = nearestCookSource();
    if (!src) { gameMessage('You need to be standing by a fire or a range to cook.'); return false; }
    if ((skills.state.cooking.level || 1) < rule.cookLevel) {
      gameMessage('You need Cooking level ' + rule.cookLevel + ' to cook that.');
      return false;
    }
    inventory.removeOne(rawId);
    const burnP = skills.burnChance ? skills.burnChance(rule.cookLevel, rule.noBurn, src.onRange) : 0;
    if (Math.random() < burnP) {
      inventory.add('burnt_fish', 1);
      gameMessage('Oops! You accidentally burnt the ' + (ITEMS[rawId] ? ITEMS[rawId].name.toLowerCase() : 'fish') + '.');
      floatAt(src.x, src.z, 'Burnt!', '#ff7a5a');
    } else {
      inventory.add(rule.cooked, 1);
      const r = skills.addXp ? skills.addXp('cooking', rule.xp) : { leveledUp: false };
      gameMessage('You cook the ' + (ITEMS[rule.cooked] ? ITEMS[rule.cooked].name.toLowerCase() : 'fish') + '.');
      floatAt(src.x, src.z, '+' + rule.xp + ' xp', '#ffe07a');
      if (r && r.leveledUp) gameMessage('Congratulations, your Cooking is now level ' + r.level + '!');
    }
    if (em.vfx && em.vfx.burst) em.vfx.burst('gather', src.x, 0.6, src.z);
    return true;
  }
  // Cook everything cookable of one raw type that we're carrying (OSRS "cook all").
  function cookAll(rawId) {
    if (!RAW_TO_COOKED[rawId]) return;
    let n = 0;
    while (inventory.count(rawId) > 0 && nearestCookSource()) { if (!tryCook(rawId)) break; n++; if (n > 28) break; }
  }

  // ---- EATING: cooked fish heal the player ---------------------------------
  function tryEat(itemId) {
    const def = ITEMS[itemId];
    if (!def || !def.eat || !def.heal) return false;
    if (!inventory.count(itemId)) return false;
    const c = em.combat;
    const pstate = player.userData && player.userData.combat;
    if (!pstate) { gameMessage('You eat the ' + def.name.toLowerCase() + '.'); inventory.removeOne(itemId); return true; }
    if (pstate.hp >= pstate.maxHp) { gameMessage('You are already at full health.'); return false; }
    inventory.removeOne(itemId);
    const healed = Math.min(def.heal, pstate.maxHp - pstate.hp);
    if (c && c.setPlayerHp) c.setPlayerHp(pstate.hp + def.heal);
    else { pstate.hp = Math.min(pstate.maxHp, pstate.hp + def.heal); }
    gameMessage('You eat the ' + def.name.toLowerCase() + '. It heals ' + healed + ' hitpoints.');
    floatAt(player.position.x, player.position.z, '+' + healed, '#7fe24b');
    if (em.audio && em.audio.play) em.audio.play('pickup');
    return true;
  }

  // ---- left-click an inventory item: cooked fish "Eat", raw fish "Cook", a
  //      tinderbox "Light fire". inventory.js keeps a single click handler, so we
  //      re-install one that special-cases our items and re-expresses main.js's
  //      existing shop-sell / equip behaviour for everything else.
  inventory.setClickHandler((itemId, def) => {
    if (em.shop && em.shop.isOpen && em.shop.isOpen()) { em.shop.sell(itemId); return; }
    if (def && def.eat) { tryEat(itemId); return; }
    if (RAW_TO_COOKED[itemId]) { cookAll(itemId); return; }
    if (itemId === 'tinderbox') { tryLightFire(); return; }
    if (def && def.equipable && em.equipment) em.equipment.equip(itemId);
  });

  // ---- right-click context options on bag items + world fishing spots ------
  function installContextHooks() {
    // World: right-click a fishing spot -> "Fish" / "Examine".
    if (canvas) canvas.addEventListener('contextmenu', (e) => {
      if ((em.getFloor ? em.getFloor() : 0) !== 0) return;
      const s = pickSpot(e.clientX, e.clientY);
      if (!s) return;
      e.preventDefault(); e.stopPropagation();
      showMenu(e.clientX, e.clientY, 'Fishing spot', [
        { label: 'Fish <span class="ctx-yellow">Fishing spot</span>', action: () => startFishingAt(s) },
        { label: 'Examine', action: () => gameMessage('The water ripples — fish are biting here.') },
      ]);
    }, true);

    // Bag: right-click a raw fish -> "Cook", a cooked fish -> "Eat", a tinderbox
    // -> "Light fire". We piggy-back on the existing inv grid; capture phase so we
    // can pre-empt contextmenu.js for items it doesn't special-case.
    const invGrid = document.getElementById('inv-grid');
    if (invGrid) invGrid.addEventListener('contextmenu', (e) => {
      const slotEl = e.target.closest('.inv-slot');
      if (!slotEl || slotEl.dataset.slot === undefined) return;
      const s = inventory.slots[+slotEl.dataset.slot];
      if (!s) return;
      const def = ITEMS[s.id];
      let opts = null;
      if (def && def.eat) opts = [{ label: 'Eat <span class="ctx-yellow">' + def.name + '</span>', action: () => tryEat(s.id) }];
      else if (RAW_TO_COOKED[s.id]) opts = [{ label: 'Cook <span class="ctx-yellow">' + def.name + '</span>', action: () => cookAll(s.id) }];
      else if (s.id === 'tinderbox') opts = [{ label: 'Light <span class="ctx-yellow">fire</span>', action: () => tryLightFire() }];
      if (!opts) return;
      e.preventDefault(); e.stopPropagation();
      opts.push({ label: 'Examine', action: () => gameMessage(def.examine) });
      showMenu(e.clientX, e.clientY, def.name, opts);
    }, true);
  }

  // ---- a tiny self-contained context menu (mirrors contextmenu.js's look) ---
  let menuEl = null;
  function showMenu(x, y, title, options) {
    if (!menuEl) {
      menuEl = document.createElement('div');
      // Own id (avoid a duplicate-id clash with contextmenu.js's #ctxmenu) but
      // reuse the .ctx-head/.ctx-item classes + the id-only frame styling inline.
      menuEl.id = 'fishing-ctxmenu';
      menuEl.className = 'frame';
      menuEl.style.cssText = 'position:fixed;z-index:50;min-width:158px;overflow:hidden;' +
        'font-size:13px;border-radius:6px;pointer-events:auto;';
      document.body.appendChild(menuEl);
      window.addEventListener('click', () => { if (menuEl) menuEl.hidden = true; });
    }
    menuEl.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'ctx-head'; head.textContent = title;
    menuEl.appendChild(head);
    for (const opt of options.concat([{ label: 'Cancel' }])) {
      const row = document.createElement('div');
      row.className = 'ctx-item'; row.innerHTML = opt.label;
      row.addEventListener('click', (ev) => { ev.stopPropagation(); menuEl.hidden = true; if (opt.action) opt.action(); });
      menuEl.appendChild(row);
    }
    menuEl.style.left = x + 'px'; menuEl.style.top = y + 'px';
    menuEl.hidden = false;
    const r = menuEl.getBoundingClientRect();
    if (r.right > window.innerWidth) menuEl.style.left = (window.innerWidth - r.width - 6) + 'px';
    if (r.bottom > window.innerHeight) menuEl.style.top = (window.innerHeight - r.height - 6) + 'px';
  }

  // ---- floating text (small DOM overlay, like combat/interactions) ---------
  const proj = new THREE.Vector3();
  function floatAt(x, z, text, color) {
    proj.set(x, 1.6, z).project(camera);
    if (proj.z > 1) return;
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = 'position:fixed;left:' + ((proj.x * 0.5 + 0.5) * window.innerWidth) + 'px;top:' +
      ((-proj.y * 0.5 + 0.5) * window.innerHeight) + 'px;transform:translate(-50%,-50%);z-index:45;pointer-events:none;' +
      'font:700 16px Georgia,serif;color:' + (color || '#fff') + ';text-shadow:0 2px 3px #000;transition:opacity 1s,top 1s;';
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '0'; el.style.top = (parseFloat(el.style.top) - 36) + 'px'; });
    setTimeout(() => el.remove(), 1000);
  }

  // ---- the fishing reel: walk to the spot, then cast on a timer ------------
  function updateFishing(dt) {
    if (!fishTarget) return;
    if (fishTarget.userData.depleted) { fishTarget = null; return; }
    const dx = fishTarget.position.x - player.position.x, dz = fishTarget.position.z - player.position.z;
    const d = Math.hypot(dx, dz);
    // While out of range, interactions.js walks us to the shore point we set on
    // start. (A click elsewhere cancels fishTarget, so we never fight the player.)
    if (d > FISH_RANGE) { fishTimer = 0; return; }
    // in range: face the water and cast on a timer.
    player.rotation.y = Math.atan2(dx, dz);
    fishTimer += dt;
    if (fishTimer < FISH_TIME) return;
    fishTimer = 0;

    // pick the best fish our Fishing level allows, then roll the per-cast success.
    const tier = skills.bestFishTier ? skills.bestFishTier() : null;
    if (!tier) return;
    if (em.vfx && em.vfx.burst) em.vfx.burst('gather', fishTarget.position.x, 0.4, fishTarget.position.z);
    if (em.audio && em.audio.play) em.audio.play('chop');
    if (skills.fishSuccess && !skills.fishSuccess(tier.id)) return;   // a miss — keep casting
    if (inventory.add(tier.raw, 1) === false) {
      gameMessage('Your inventory is too full to hold any more fish.');
      fishTarget = null; return;
    }
    const r = skills.fishReward ? skills.fishReward(tier.id) : { xp: tier.xp, leveledUp: false };
    floatAt(fishTarget.position.x, fishTarget.position.z, '+' + r.xp + ' xp', '#bfe6ff');
    if (r.leveledUp) gameMessage('Congratulations, your Fishing is now level ' + r.level + '!');
    // occasionally the shoal moves on (spot depletes + respawns elsewhere on time).
    if (Math.random() < SPOT_DEPLETE) {
      fishTarget.userData.depleted = true;
      fishTarget.userData.respawnAt = clock + SPOT_RESPAWN;
      fishTarget.visible = false;
      fishTarget = null;
    }
  }

  // ---- per-frame upkeep: ripple animation, spot respawns, fire lifetime ----
  let last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    if (!window.eldenmoor || !window.eldenmoor.player) return;
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1;
    clock += dt;
    const onGround = (em.getFloor ? em.getFloor() : 0) === 0;

    // animate the ripple rings (expand + fade, looping) on visible spots
    for (const s of spots) {
      if (s.userData.depleted && clock >= s.userData.respawnAt) {
        s.userData.depleted = false; s.visible = onGround;
      }
      if (!s.visible) continue;
      for (const ring of s.userData.rings) {
        ring.userData.phase = (ring.userData.phase + dt * 0.5) % 1;
        const p = ring.userData.phase;
        ring.scale.setScalar(0.5 + p * 2.2);
        if (ring.material) ring.material.opacity = 0.6 * (1 - p);
      }
    }

    // fires burn down, then die (vfx detached, logs removed)
    for (let i = fires.length - 1; i >= 0; i--) {
      const f = fires[i];
      if (clock >= f.diesAt) {
        if (f.vfx && em.vfx && em.vfx.detach) em.vfx.detach(f.vfx);
        scene.remove(f.group);
        fires.splice(i, 1);
      }
    }

    updateFishing(dt);
  }
  requestAnimationFrame(tick);

  return {
    spots, fires,
    lightFire: () => tryLightFire(),
    cook: (rawId) => tryCook(rawId),
    eat: (itemId) => tryEat(itemId),
    fishAt: (i) => { if (spots[i]) startFishingAt(spots[i]); },
  };
}

// ----- self-initialize: wait for window.eldenmoor (skills + inventory ready) --
(function boot() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.scene && em.camera && em.player && em.skills && em.inventory) {
      clearInterval(iv);
      try { em.fishing = startFishing(em); }
      catch (err) { console.error('[fishing] failed to start', err); }
    } else if (tries > 600) { clearInterval(iv); }
  }, 100);
})();
