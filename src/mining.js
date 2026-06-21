// mining.js — Mining & Smithing, built the same way as Woodcutting.
//
// Self-contained and self-initializing (the vfx.js / combat.js pattern): it polls
// for window.eldenmoor (set up by main.js once the game starts), then:
//
//   * QUARRY — scatters ~9 ore ROCK nodes in a quarry NE of town (reusing the
//     three nat_Rock GLBs), each gated to a Mining level (copper/tin 1, iron 15,
//     coal 30, mithril 55). Click a node -> walk to it -> swing your pickaxe ->
//     on a successful roll you get the ore + Mining XP. The node depletes
//     (darkens to bare stone) and respawns after a few seconds, exactly like the
//     trees do for Woodcutting.
//
//   * SMITHING — a FURNACE and an ANVIL placed by the town blacksmith. Click the
//     furnace to smelt ores into bars (copper+tin->bronze, iron->iron,
//     iron+coal->steel, mithril+coal->mithril). Click the anvil (with a hammer in
//     your bag) to hammer bars into daggers/swords/scimitars/helms/platebodies at
//     OSRS bar costs + Smithing levels. Both grant Smithing XP.
//
// It owns its own click handling (capture-phase, so it can claim a click on an
// ore node / furnace / anvil before interactions.js treats it as walk-to-ground)
// and its own update loop. Nothing in main.js needs editing — but if you want the
// quarry nodes to also block movement, see the one-line note at the bottom.

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js';
import { gameMessage } from './ui.js';
import { ITEMS } from './items.js';

const ENV = './assets/models/env/';
const ROCK_MODELS = ['nat_Rock_1', 'nat_Rock_2', 'nat_Rock_3'];
const MINE_RANGE = 2.8;        // how close you must stand to swing
const WALK_SPEED = 6.5;        // matches interactions.js
const RESPAWN_TIME = 5.5;      // seconds a depleted node stays bare
const DEPLETE_CHANCE = 0.30;   // chance a successful swing exhausts the node
const GEM_CHANCE = 0.02;       // rare uncut-gem-style bonus (a bird's-nest analogue)

// --- GLB proto loader (same merge approach world.js uses for one-mesh GLBs) ----
const gltfLoader = new GLTFLoader();
const protoCache = {};
function loadProto(name) {
  if (!protoCache[name]) {
    protoCache[name] = new Promise((resolve, reject) => {
      gltfLoader.load(ENV + name + '.glb', (gltf) => {
        gltf.scene.updateWorldMatrix(true, true);
        const geos = [], mats = [];
        gltf.scene.traverse((o) => {
          if (!o.isMesh) return;
          let g = o.geometry.clone();
          g.applyMatrix4(o.matrixWorld);
          for (const a of Object.keys(g.attributes)) { if (a !== 'position' && a !== 'normal') g.deleteAttribute(a); }
          if (g.index) g = g.toNonIndexed();
          geos.push(g);
          const m = (o.material.isMaterial ? o.material : o.material[0]).clone();
          m.userData.__toonDone = true;
          mats.push(m);
        });
        if (!geos.length) { reject(new Error('no mesh in ' + name)); return; }
        const geometry = geos.length === 1 ? geos[0] : mergeGeometries(geos, true);
        const material = geos.length === 1 ? mats[0] : mats;
        geometry.computeBoundingBox();
        const bb = geometry.boundingBox;
        const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
        geometry.translate(-cx, -bb.min.y, -cz);
        geometry.computeBoundingBox();
        resolve({ geometry, material, size: geometry.boundingBox.getSize(new THREE.Vector3()) });
      }, undefined, reject);
    });
  }
  return protoCache[name];
}

// One ore node: a host Group (positioned + scaled synchronously) with a cloned
// rock mesh dropped in once it loads. Carries its ore tier in userData so the
// swing awards the right ore + XP. Depleting tints the rock dark; respawn restores
// its lit tier colour. The rock material is cloned per-node so tinting one node
// doesn't tint them all.
function makeOreNode(scene, x, z, tierId, oreTierFn) {
  const tier = oreTierFn(tierId);
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = Math.random() * Math.PI * 2;
  g.scale.setScalar(1.0 + Math.random() * 0.5);
  g.userData = { kind: 'ore', tier: tierId, depleted: false, respawnAt: 0, shake: 0, mats: [], litColor: tier.color };

  const name = ROCK_MODELS[(Math.random() * ROCK_MODELS.length) | 0];
  loadProto(name).then(({ geometry, material, size }) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.__toonDone = true;
    mesh.scale.setScalar(0.95 / (size.y || 1));   // normalise the three models to a common height
    g.add(mesh);
    // Clone + tint the material(s) toward this ore's colour so each rock reads as
    // a copper / iron / coal / mithril vein at a glance. Remember the lit colours
    // so depletion can darken and respawn can restore them.
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mesh.material = mats.map((m) => {
      const c = m.clone(); c.userData.__toonDone = true;
      c.color = new THREE.Color(tier.color);
      g.userData.mats.push(c);
      return c;
    });
    if (mesh.material.length === 1) mesh.material = mesh.material[0];
    if (g.userData.depleted) darken(g, true);
    const em = window.eldenmoor; if (em && em.applyToonTo) em.applyToonTo(g);
  }).catch((e) => console.error('[mining] node load failed', name, e));
  return g;
}

function darken(node, on) {
  for (const m of node.userData.mats) {
    m.color.set(on ? 0x2a2a2c : node.userData.litColor);
  }
}

// ============================================================================
//  Boot
// ============================================================================
let tries = 0;
const boot = setInterval(() => {
  const em = window.eldenmoor;
  if (++tries > 250) { clearInterval(boot); return; }
  if (!em || !em.scene || !em.skills || !em.inventory || !em.player || !em.camera || !em.renderer) return;
  if (em.__miningReady) { clearInterval(boot); return; }
  if (typeof em.skills.mineReward !== 'function') return;  // skills extension not present
  em.__miningReady = true;
  clearInterval(boot);
  start(em);
}, 80);

function start(em) {
  const { scene, skills, inventory, player, camera, renderer } = em;
  const dom = renderer.domElement;
  const msg = (t) => gameMessage(t);

  // --- Place the quarry: ~9 ore nodes NE of town on clear ground -------------
  // Hand-placed so they sit in a tidy quarry bowl (x ~30..45, z ~-20..-40) away
  // from buildings, with the higher tiers tucked toward the back of the pit.
  const QUARRY = [
    { x: 31, z: -22, tier: 'copper' },
    { x: 34, z: -25, tier: 'tin' },
    { x: 38, z: -23, tier: 'copper' },
    { x: 41, z: -27, tier: 'tin' },
    { x: 35, z: -30, tier: 'iron' },
    { x: 39, z: -32, tier: 'iron' },
    { x: 43, z: -33, tier: 'coal' },
    { x: 37, z: -37, tier: 'coal' },
    { x: 42, z: -39, tier: 'mithril' },
  ];
  const nodes = [];
  for (const q of QUARRY) {
    const n = makeOreNode(scene, q.x, q.z, q.tier, skills.oreTier);
    scene.add(n);
    nodes.push(n);
    (scene.userData.outdoor = scene.userData.outdoor || []).push(n);
  }
  scene.userData.oreNodes = nodes;

  // --- Build the furnace + anvil by the blacksmith (Garrett @ x10 z6) --------
  const furnace = buildFurnace(); furnace.position.set(7, 0, 2);
  const anvil = buildAnvil(); anvil.position.set(11, 0, 3);
  scene.add(furnace); scene.add(anvil);
  (scene.userData.outdoor = scene.userData.outdoor || []).push(furnace, anvil);
  furnace.userData = { kind: 'furnace' };
  anvil.userData = { kind: 'anvil' };
  if (em.applyToonTo) { em.applyToonTo(furnace); em.applyToonTo(anvil); }

  // --- Click handling (capture phase, claims ore/furnace/anvil clicks) -------
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let mineTarget = null;     // ore node we're walking to / swinging at
  let walkObj = null;        // furnace/anvil we're walking to, then open its menu
  let onArrive = null;
  let swingTimer = 0;
  let downX = 0, downY = 0;

  function aim(x, y) {
    const r = dom.getBoundingClientRect();
    mouse.x = ((x - r.left) / r.width) * 2 - 1;
    mouse.y = -((y - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
  }
  function pickNode(x, y) {
    aim(x, y);
    const hits = raycaster.intersectObjects(nodes, true);
    for (const h of hits) { let o = h.object; while (o && o.userData.kind !== 'ore') o = o.parent; if (o && !o.userData.depleted) return o; }
    return null;
  }
  function pickStation(x, y) {
    aim(x, y);
    const hits = raycaster.intersectObjects([furnace, anvil], true);
    for (const h of hits) { let o = h.object; while (o && !o.userData.kind) o = o.parent; if (o) return o; }
    return null;
  }

  dom.addEventListener('mousedown', (e) => { if (e.button === 0) { downX = e.clientX; downY = e.clientY; } }, true);
  dom.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return; // a camera drag
    if (panelOpen()) return;
    const node = pickNode(e.clientX, e.clientY);
    if (node) {
      mineTarget = node; walkObj = null; onArrive = null; swingTimer = 0;
      if (em.interactions && em.interactions.stop) em.interactions.stop();
      e.stopImmediatePropagation();   // don't let interactions.js also walk-to-ground
      return;
    }
    const st = pickStation(e.clientX, e.clientY);
    if (st) {
      mineTarget = null; walkObj = st;
      onArrive = st.userData.kind === 'furnace' ? openFurnace : openAnvil;
      if (em.interactions && em.interactions.stop) em.interactions.stop();
      e.stopImmediatePropagation();
      return;
    }
    // Clicked elsewhere (ground / tree / npc / monster): cancel any mining intent
    // so interactions.js's walk/chop/attack takes over cleanly. We don't claim it.
    mineTarget = null; walkObj = null; onArrive = null; setPlayerSwing(false);
  }, true);

  // --- Helpers ---------------------------------------------------------------
  const dir = new THREE.Vector3();
  function faceWalk(tx, tz, dt, range) {
    dir.set(tx - player.position.x, 0, tz - player.position.z);
    const d = dir.length();
    if (d > 0.0001) player.rotation.y = Math.atan2(dir.x, dir.z);
    if (d > range) {
      dir.normalize();
      const nx = player.position.x + dir.x * WALK_SPEED * dt;
      const nz = player.position.z + dir.z * WALK_SPEED * dt;
      const fixed = em.collision ? em.collision.resolve(player.position.x, player.position.z, nx, nz) : { x: nx, z: nz };
      player.position.x = fixed.x; player.position.z = fixed.z;
      return false; // still walking
    }
    return true; // arrived
  }
  function floater(x, y, z, text, color) {
    const el = document.createElement('div');
    el.className = 'xpfloat'; el.textContent = text;
    if (color) el.style.color = color;
    document.body.appendChild(el);
    const pos = new THREE.Vector3(x, y, z); let life = 1.4;
    const tmp = new THREE.Vector3();
    (function tick() {
      life -= 0.016; pos.y += 0.016 * 0.8;
      tmp.copy(pos).project(camera);
      el.style.left = (tmp.x * 0.5 + 0.5) * window.innerWidth + 'px';
      el.style.top = (-tmp.y * 0.5 + 0.5) * window.innerHeight + 'px';
      el.style.opacity = Math.max(0, Math.min(1, life));
      if (life > 0) requestAnimationFrame(tick); else el.remove();
    })();
  }

  // --- Our own update loop (separate rAF; main.js untouched) -----------------
  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.1); last = now;
    const onGround = !em.getFloor || em.getFloor() === 0;
    updateNodes(dt);
    if (!onGround) { mineTarget = null; walkObj = null; return; }

    // Walk to a furnace / anvil, then open its menu.
    if (walkObj) {
      if (faceWalk(walkObj.position.x, walkObj.position.z, dt, 2.6)) {
        const act = onArrive; walkObj = null; onArrive = null;
        if (act) act();
      }
      return;
    }

    // Mine an ore node: walk in, then swing the pickaxe on a timer.
    if (mineTarget) {
      if (mineTarget.userData.depleted) { mineTarget = null; return; }
      const arrived = faceWalk(mineTarget.position.x, mineTarget.position.z, dt, MINE_RANGE);
      if (!arrived) { swingTimer = 0; setPlayerSwing(true); return; }

      const pick = em.equipment && em.equipment.getWeapon();
      if (!pick || pick.tool !== 'pickaxe') {
        msg('You need a pickaxe equipped to mine. (Wield one from your bag.)');
        floater(player.position.x, 2.4, player.position.z, 'No pickaxe equipped!', '#ff9a8a');
        mineTarget = null; setPlayerSwing(false); return;
      }
      if ((skills.state.mining.level || 1) < (pick.mineLevel || 1)) {
        msg('You need Mining level ' + pick.mineLevel + ' to use the ' + pick.name + '.');
        mineTarget = null; setPlayerSwing(false); return;
      }
      const tierId = mineTarget.userData.tier;
      if (!skills.canMineTier(tierId)) {
        const tier = skills.oreTier(tierId);
        msg('You need Mining level ' + tier.level + ' to mine the ' + tier.name.toLowerCase() + '.');
        mineTarget = null; setPlayerSwing(false); return;
      }

      setPlayerSwing(true);
      swingTimer += dt;
      if (swingTimer >= (pick.mineTime || 1.8)) {
        swingTimer = 0;
        // feedback every swing
        const p = mineTarget.position;
        if (em.vfx && em.vfx.burst) em.vfx.burst('gather', p.x, 0.9, p.z);
        if (em.audio && em.audio.play) em.audio.play('chop');
        mineTarget.userData.shake = 0.25;
        if (skills.mineSuccess(tierId)) {
          const r = skills.mineReward(tierId);
          inventory.add(r.ore, 1);
          floater(p.x, 2.4, p.z, '+' + r.xp + ' xp');
          if (r.leveledUp) showMiningLevel(r.level);
          if (Math.random() < GEM_CHANCE) {
            inventory.add('birds_nest', 1);   // an existing stackable trinket
            floater(p.x + 0.4, 3.0, p.z, 'A glint in the rock!', '#ffe08a');
          }
          if (Math.random() < DEPLETE_CHANCE) {
            mineTarget.userData.depleted = true;
            mineTarget.userData.respawnAt = performance.now() / 1000 + RESPAWN_TIME;
            darken(mineTarget, true);
            mineTarget = null; setPlayerSwing(false);
          }
        }
      }
      return;
    }
    setPlayerSwing(false);
  }
  requestAnimationFrame(loop);

  function updateNodes(dt) {
    const t = performance.now() / 1000;
    for (const n of nodes) {
      if (n.userData.depleted && t >= n.userData.respawnAt) {
        n.userData.depleted = false;
        darken(n, false);
      }
      if (n.userData.shake > 0) {
        n.userData.shake = Math.max(0, n.userData.shake - dt);
        n.rotation.z = Math.sin(t * 40) * n.userData.shake * 0.10;
      } else if (n.rotation.z !== 0) n.rotation.z = 0;
    }
  }

  // Drive the hero's chop/swing pose (the pickaxe reads like the axe swing).
  // main.js calls player.userData.setPlayerChop(act.chopping) every frame with
  // `false` during mining, which would cancel our swing — so we wrap that hook
  // once to OR-in our own mining-swing flag. The wrapped hook keeps the swing
  // pose on while we're mining and otherwise defers to whatever main.js passes.
  if (player.userData.setPlayerChop && !player.userData.__miningWrapped) {
    const orig = player.userData.setPlayerChop;
    player.userData.__miningSwing = false;
    player.userData.setPlayerChop = (bool) => orig(!!bool || !!player.userData.__miningSwing);
    player.userData.__miningWrapped = true;
  }
  function setPlayerSwing(on) {
    player.userData.__miningSwing = !!on;
    if (player.userData.setPlayerChop) player.userData.setPlayerChop(!!on);
  }
  function showMiningLevel(level) {
    const el = document.getElementById('levelup');
    if (el) { el.textContent = '🎉 Mining Level ' + level + '!'; el.hidden = false; setTimeout(() => { el.hidden = true; }, 2500); }
    msg('Congratulations! You reached Mining level ' + level + '.');
  }
  function showSmithLevel(level) {
    const el = document.getElementById('levelup');
    if (el) { el.textContent = '🎉 Smithing Level ' + level + '!'; el.hidden = false; setTimeout(() => { el.hidden = true; }, 2500); }
    msg('Congratulations! You reached Smithing level ' + level + '.');
  }

  // ==========================================================================
  //  Furnace (smelting) + Anvil (smithing) panels
  // ==========================================================================
  let panel = null;
  function panelOpen() { return !!panel; }
  function closePanel() { if (panel) { panel.remove(); panel = null; } }

  function makePanel(title) {
    closePanel();
    panel = document.createElement('div');
    panel.className = 'mining-panel';
    panel.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:300;min-width:320px;max-width:420px;max-height:72vh;overflow:auto;background:rgba(24,18,10,0.96);border:2px solid #b9892f;border-radius:10px;padding:14px 16px;color:#f0e4c8;font:14px Georgia,serif;box-shadow:0 8px 30px rgba(0,0,0,0.6);';
    const h = document.createElement('div');
    h.style.cssText = 'display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #6b5a2f;padding-bottom:6px;margin-bottom:10px;';
    h.innerHTML = '<b style="font-size:17px;color:#ffd24a">' + title + '</b>';
    const x = document.createElement('button');
    x.textContent = '✕';
    x.style.cssText = 'background:#5a2020;color:#fff;border:1px solid #b9892f;border-radius:5px;cursor:pointer;padding:2px 9px;';
    x.onclick = closePanel;
    h.appendChild(x);
    panel.appendChild(h);
    document.body.appendChild(panel);
    return panel;
  }

  function recipeRow(label, sub, enabled, hint, onMake) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 4px;border-bottom:1px solid #3a3020;';
    const left = document.createElement('div');
    left.innerHTML = '<div style="font-weight:600;color:' + (enabled ? '#f0e4c8' : '#8a8276') + '">' + label + '</div>' +
      '<div style="font-size:12px;color:' + (enabled ? '#b9a878' : '#7a6f5a') + '">' + sub + '</div>';
    const btn = document.createElement('button');
    btn.textContent = enabled ? 'Make' : '✗';
    btn.title = hint || '';
    btn.disabled = !enabled;
    btn.style.cssText = 'min-width:64px;padding:5px 10px;border-radius:5px;border:1px solid #b9892f;cursor:' + (enabled ? 'pointer' : 'not-allowed') + ';background:' + (enabled ? '#2f6e3a' : '#3a352c') + ';color:' + (enabled ? '#fff' : '#8a8276') + ';';
    if (enabled) btn.onclick = onMake;
    row.appendChild(left); row.appendChild(btn);
    return row;
  }

  function openFurnace() {
    const p = makePanel('⚒ Furnace — Smelting');
    const note = document.createElement('div');
    note.style.cssText = 'font-size:12px;color:#b9a878;margin-bottom:8px;';
    note.textContent = 'Smelt ores into metal bars.';
    p.appendChild(note);
    for (const r of skills.SMELT_RECIPES) {
      const haveLvl = skills.canSmith(r.level);
      const costStr = Object.entries(r.cost).map(([id, n]) => n + '× ' + (ITEMS[id] ? ITEMS[id].name : id)).join(' + ');
      const haveMats = Object.entries(r.cost).every(([id, n]) => inventory.count(id) >= n);
      const enabled = haveLvl && haveMats;
      const hint = !haveLvl ? 'Needs Smithing ' + r.level : (!haveMats ? 'Not enough ore' : '');
      p.appendChild(recipeRow(
        r.name + (haveLvl ? '' : '  (lvl ' + r.level + ')'),
        costStr + '  ·  ' + r.xp + ' xp',
        enabled, hint,
        () => {
          for (const [id, n] of Object.entries(r.cost)) inventory.removeN(id, n);
          inventory.add(r.bar, 1);
          const res = skills.smithReward(r.xp);
          if (em.audio && em.audio.play) em.audio.play('chop');
          msg('You smelt a ' + r.name.toLowerCase() + '.');
          if (res.leveledUp) showSmithLevel(res.level);
          openFurnace();   // refresh availability
        }
      ));
    }
  }

  function openAnvil() {
    if (inventory.count('hammer') <= 0) {
      msg('You need a hammer to work the anvil. (Buy one, or find one in your bag.)');
      return;
    }
    const p = makePanel('🔨 Anvil — Smithing');
    const note = document.createElement('div');
    note.style.cssText = 'font-size:12px;color:#b9a878;margin-bottom:8px;';
    note.textContent = 'Hammer bars into weapons and armour.';
    p.appendChild(note);
    for (const r of skills.SMITH_RECIPES) {
      const haveLvl = skills.canSmith(r.level);
      const haveBars = inventory.count(r.bar) >= r.bars;
      const enabled = haveLvl && haveBars;
      const barName = ITEMS[r.bar] ? ITEMS[r.bar].name : r.bar;
      const hint = !haveLvl ? 'Needs Smithing ' + r.level : (!haveBars ? 'Needs ' + r.bars + ' ' + barName : '');
      p.appendChild(recipeRow(
        r.name + (haveLvl ? '' : '  (lvl ' + r.level + ')'),
        r.bars + '× ' + barName + '  ·  ' + r.xp + ' xp',
        enabled, hint,
        () => {
          inventory.removeN(r.bar, r.bars);
          inventory.add(r.makes, 1);
          const res = skills.smithReward(r.xp);
          if (em.audio && em.audio.play) em.audio.play('hit');
          msg('You hammer out a ' + r.name.toLowerCase() + '.');
          if (res.leveledUp) showSmithLevel(res.level);
          openAnvil();
        }
      ));
    }
  }

  // Close panels on Escape.
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

  // Expose for debugging / context-menu wiring.
  em.mining = { nodes, furnace, anvil, openFurnace, openAnvil };
  console.log('[mining] quarry + furnace/anvil ready (' + nodes.length + ' ore nodes)');
}

// ============================================================================
//  Furnace + anvil meshes (low-poly, hand-built; toon-ified by main.js's pass)
// ============================================================================
function mat(color, rough = 0.9, metal = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, flatShading: true });
}
function box(w, h, d, m, x, y, z) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o;
}
function cyl(rt, rb, h, seg, m, x, y, z) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o;
}

function buildFurnace() {
  const g = new THREE.Group();
  const stone = mat(0x6b6258), dark = mat(0x3a352f), ember = mat(0xff7a2a);
  ember.emissive = new THREE.Color(0xff5a16); ember.emissiveIntensity = 0.9;
  // squat stone furnace body
  g.add(box(2.4, 2.0, 2.0, stone, 0, 1.0, 0));
  // mouth with glowing embers
  g.add(box(1.1, 1.0, 0.3, dark, 0, 0.8, 1.0));
  g.add(box(0.9, 0.7, 0.25, ember, 0, 0.75, 1.08));
  // chimney
  g.add(cyl(0.45, 0.55, 1.6, 8, stone, 0, 2.8, -0.3));
  g.add(cyl(0.5, 0.45, 0.3, 8, dark, 0, 3.7, -0.3));
  // a warm glow light at the mouth so vfx.js anchors a flame here too
  const pl = new THREE.PointLight(0xff7a2a, 3.5, 9, 2); pl.position.set(0, 0.9, 1.1); g.add(pl);
  return g;
}

function buildAnvil() {
  const g = new THREE.Group();
  const iron = mat(0x3a3a40, 0.6, 0.3), wood = mat(0x6b4a2f);
  // wooden stump base
  g.add(cyl(0.42, 0.5, 0.7, 10, wood, 0, 0.35, 0));
  // anvil body: a block with a horn
  g.add(box(0.55, 0.28, 1.0, iron, 0, 0.86, 0));      // face
  g.add(box(0.34, 0.30, 0.55, iron, 0, 0.58, 0));     // waist
  g.add(box(0.55, 0.16, 0.7, iron, 0, 0.44, 0));      // base flare
  // horn
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 8), iron);
  horn.rotation.z = -Math.PI / 2; horn.position.set(0, 0.86, 0.62); horn.castShadow = true;
  g.add(horn);
  return g;
}

// ---------------------------------------------------------------------------
// OPTIONAL one-line hook for the human (collision): mining.js builds its own
// collision-aware walking, so the quarry already works without touching main.js.
// If you also want the ore nodes to physically BLOCK the hero (like trees/rocks),
// add this ONE line in main.js right BEFORE `const collision = createCollision(scene);`
// is called — i.e. after buildWorld(scene) — is NOT possible (nodes load later),
// so instead push them as colliders before collision is built by adding to world.js,
// OR simply leave them walk-through (recommended; they're small and it plays fine).
// ---------------------------------------------------------------------------
