// main.js — entry point. Shows the login screen, talks to the multiplayer
// server, and only starts the actual game once you're logged in.

import * as THREE from '../vendor/three.module.js';
import { buildWorld } from './world.js';
import { createPlayer, updatePlayerAnimation, setHeldWeapon, setWornGear } from './player.js';
import { setupControls } from './controls.js';
import { createSkills } from './skills.js';
import { createInventory } from './inventory.js';
import { createEquipment } from './equipment.js';
import { createSave } from './save.js';
import { setupInteractions } from './interactions.js';
import { setupContextMenu } from './contextmenu.js';
import { buildNpcs, updateNpcLabels, setNpcsFloor, updateNpcs } from './npc.js';
import { createCollision } from './collision.js';
import { createShop } from './shop.js';
import { gameMessage, initHudExtras } from './ui.js';
import { createNet } from './net.js';
import { createRemotePlayers } from './players.js';
import { setupSocial } from './social.js';
import { showDialogue } from './dialogue.js';
import { createQuests, QUEST_DEFS } from './quests.js';
import { createQuestMarkers } from './questmarkers.js';
import { toonify, applyToonTo } from './toon.js';
import './vfx.js';
import './audio.js';
import './combat.js';
import './ambient.js';
import './assets.js';
import './showcase.js';
import './villageModels.js';
import './storeModels.js';

// ============================ LOGIN ============================
const net = createNet();
const loginEl = document.getElementById('login');
const msgEl = document.getElementById('login-msg');
const userEl = document.getElementById('login-user');
const passEl = document.getElementById('login-pass');

function setMsg(text, ok) {
  if (!msgEl) return;
  msgEl.textContent = text;
  msgEl.style.color = ok ? '#b6ffa6' : '#ff9a8a';
}

net.on('registered', (d) => setMsg(d.msg, d.ok));
net.on('logged_in', (d) => {
  if (!d.ok) { setMsg(d.msg, false); return; }
  if (loginEl) loginEl.remove();
  startGame(d.user);
});

function doRegister() {
  if (!net.ready()) { setMsg('Not connected to the server.', false); return; }
  setMsg('Creating account…', true);
  net.send({ t: 'register', u: userEl.value, p: passEl.value });
}
function doLogin() {
  if (!net.ready()) { setMsg('Not connected to the server.', false); return; }
  setMsg('Logging in…', true);
  net.send({ t: 'login', u: userEl.value, p: passEl.value });
}
document.getElementById('login-go').onclick = doLogin;
document.getElementById('login-reg').onclick = doRegister;
passEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

// Solo / offline play — needs no server, so the hosted (GitHub Pages) build is playable.
function playSolo() { if (loginEl) loginEl.remove(); startGame(((userEl && userEl.value) || 'Adventurer').trim() || 'Adventurer'); }
const soloBtn = document.createElement('button');
soloBtn.id = 'login-solo'; soloBtn.textContent = '⚔  Play Solo';
soloBtn.style.cssText = 'margin-top:10px;width:100%;padding:9px;cursor:pointer;background:#2f6e3a;color:#fff;border:1px solid #b9892f;border-radius:6px;font:600 15px Georgia,serif;';
soloBtn.onclick = playSolo;
const goBtn = document.getElementById('login-go');
if (goBtn) goBtn.insertAdjacentElement('afterend', soloBtn);

net.connect()
  .then(() => setMsg('Connected. Log in for multiplayer, or just Play Solo.', true))
  .catch(() => setMsg('No multiplayer server found — click “Play Solo” to play offline.', false));

// ============================ GAME ============================
function startGame(username) {
  // 1) RENDERER (antialias OFF — some new GPU drivers render black with MSAA).
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;   // cinematic, richer contrast + highlights
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  // 2) SCENE + CAMERA.
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);

  // 3) WORLD, hero, townsfolk.
  buildWorld(scene);
  const player = createPlayer();
  scene.add(player);
  const npcs = buildNpcs(scene);
  const collision = createCollision(scene);   // walls/towers/buildings/trees block movement

  // GLOBAL CEL-SHADE PASS — re-skin the finished world, hero and townsfolk into
  // flat toon bands + inverted-hull outlines. Idempotent, so we can re-run it
  // freely after dynamic meshes (worn gear, weapons, monsters) appear.
  toonify(scene);

  // 4) SYSTEMS.
  const controls = setupControls(player, camera, renderer.domElement);
  const skills = createSkills();
  const inventory = createInventory();
  const equipment = createEquipment(inventory);
  const shop = createShop(inventory);
  const quests = createQuests({ skills, inventory, equipment });
  // WoW-style "!" / "?" markers floating above quest-giver NPCs.
  const questMarkers = createQuestMarkers(npcs, quests);

  inventory.setClickHandler((itemId, def) => {
    if (shop.isOpen()) shop.sell(itemId);
    else if (def.equipable) equipment.equip(itemId);
  });

  // 5) SAVE (per account) + starter kit.
  const save = createSave(skills, inventory, equipment, username, quests);
  const hadSave = save.load();
  if (!hadSave) {
    inventory.add('bronze_axe', 1);
    inventory.add('wooden_shield', 1);
    inventory.add('coins', 25);
    // a starter set of wearable steel armour — equip from the bag to put it on
    for (const g of ['steel_helm', 'steel_platebody', 'steel_platelegs', 'steel_gauntlets', 'steel_boots', 'steel_kiteshield', 'adventurer_cape']) inventory.add(g, 1);
  }
  if (!equipment.getWeapon()) {
    if (inventory.count('bronze_axe') > 0) equipment.equip('bronze_axe');
    else if (inventory.count('steel_axe') > 0) equipment.equip('steel_axe');
  }

  // Update the 3D hero whenever any slot changes: weapon → in-hand axe, the rest → worn armour.
  equipment.setEquipChangeHandler((slot, def) => {
    if (slot === 'weapon') setHeldWeapon(player, def);
    else setWornGear(player, slot, def);
    applyToonTo(player);   // cel-shade newly-attached gear / weapon meshes
  });

  // 6) INTERACTIONS + right-click menus.
  const interactions = setupInteractions(scene, camera, player, renderer.domElement, skills, inventory, equipment, showLevelUp);

  // --- Talking: quest-givers route through the quest system; everyone else
  //     gets a greeting + a little "ask about..." topic menu (OSRS style). NPCs
  //     with only `dialogue` lines (and no `topics`) page through those; `flavor`
  //     is the last-ditch fallback.
  function talkTo(def) {
    if (def.quest) { talkQuestGiver(def); return; }
    if (def.id === 'cook') { talkCook(def); return; }
    if (Array.isArray(def.topics) && def.topics.length) { talkTopics(def); return; }
    if (Array.isArray(def.dialogue) && def.dialogue.length) showDialogue(def.dialogue, { speaker: def.name });
    else showDialogue(def.flavor || '...', { speaker: def.name });
  }

  // A branching "ask about..." chat. `def.greeting` is shown first (string or
  // array of lines), then a menu built from `def.topics` (each { q, a }). Picking
  // a topic pages through its answer lines and returns to the menu; "Goodbye"
  // closes. Topics can also carry their own nested menu via `a` being a function.
  function talkTopics(def) {
    const greeting = def.greeting != null ? def.greeting
      : (Array.isArray(def.dialogue) && def.dialogue.length ? def.dialogue[0] : (def.flavor || '...'));
    const greetPages = (Array.isArray(greeting) ? greeting : [greeting])
      .map((t) => ({ speaker: def.name, text: t }));

    function asPages(a) {
      const arr = Array.isArray(a) ? a : [a];
      return arr.map((t) => (typeof t === 'string' ? { speaker: def.name, text: t } : t));
    }
    function showMenu() {
      const options = def.topics.map((t) => ({
        label: t.q,
        onSelect: () => showDialogue(asPages(t.a), { speaker: def.name, onDone: showMenu }),
      }));
      options.push({ label: '(Goodbye.)', onSelect: () => {} });
      showDialogue({ speaker: def.name, text: def.prompt || 'What would you like to ask about?', options });
    }
    showDialogue(greetPages, { speaker: def.name, onDone: showMenu });
  }

  // King Aldric — the giver of "The King's Hearth".
  function talkQuestGiver(def) {
    const id = def.quest;
    if (quests.isComplete(id)) { showDialogue(QUEST_DEFS[id].doneDialogue, { speaker: def.name }); return; }
    if (quests.isActive(id)) {
      // Ready to hand in? Reward + complete. Otherwise nudge for the current stage.
      if (quests.readyToComplete(id)) {
        showDialogue(QUEST_DEFS[id].completeDialogue, { speaker: def.name, onDone: () => quests.complete(id) });
      } else {
        const st = QUEST_DEFS[id].stages[quests.stage(id)];
        showDialogue((st && st.nudge) || [{ speaker: def.name, text: 'You\'ve work yet to do, friend.' }], { speaker: def.name });
        quests.tryAdvance(id);
      }
      return;
    }
    // Not started — offer it.
    showDialogue(QUEST_DEFS[id].startDialogue, {
      speaker: def.name,
      onDone: () => showDialogue({
        speaker: def.name, text: 'So — will you help warm the great hall of Eldenmoor?',
        options: [
          { label: 'Yes, your Majesty. I\'ll fetch the firewood.', onSelect: () => { quests.start(id); showDialogue([
            { speaker: def.name, text: 'Ha! A true friend of the Crown. I knew it the moment you walked in — one can always tell.' },
            { speaker: def.name, text: 'Off you go, then. Find an axe, take to the woods beyond the square, and bring me 5 logs for the hearth. Bessa the cook will lay the fire.' },
          ], { speaker: def.name }); } },
          { label: 'Tell me more about this hearth.', onSelect: () => showDialogue([
            { speaker: def.name, text: 'The great hall\'s hearth has burned in this keep for three hundred years — through siege, storm, and one very memorable royal wedding.' },
            { speaker: def.name, text: 'To let it go cold would be an ill omen for the realm. And, frankly, my toes are like ice. Will you help?' },
          ], { speaker: def.name, onDone: () => talkQuestGiver(def) }) },
          { label: 'Not just now.', onSelect: () => showDialogue('A pity. The hearth waits for no one — and winter least of all. Return when your courage warms to it.', { speaker: def.name }) },
        ],
      }),
    });
  }

  // Bessa the cook — advances the King's quest once you've gathered the wood.
  function talkCook(def) {
    if (quests.isActive('king') && quests.stage('king') === 1 && !quests.progress.king.flags.toldCook) {
      showDialogue([
        { speaker: def.name, text: 'Logs for the hall? Bless you, dear — His Majesty\'s been shivering on that throne for a week.' },
        { speaker: def.name, text: 'I\'ll lay the fire at once. Run back and tell the King the hearth is set!' },
      ], { speaker: def.name, onDone: () => quests.setFlag('king', 'toldCook', true) });
      return;
    }
    if (Array.isArray(def.topics) && def.topics.length) { talkTopics(def); return; }
    if (Array.isArray(def.dialogue) && def.dialogue.length) showDialogue(def.dialogue, { speaker: def.name });
    else showDialogue(def.flavor || '...', { speaker: def.name });
  }

  const tradeNpc = (def) => { if (def.shop) shop.open(def.shop); };
  interactions.setNpcDefault((def) => { if (def.type === 'shop') shop.open(def.shop); else talkTo(def); });
  setupContextMenu({ dom: renderer.domElement, interactions, inventory, equipment, onTalk: talkTo, onTrade: tradeNpc });

  const levelupEl = document.getElementById('levelup');
  let levelupTimer = null;
  function showLevelUp(level) {
    if (!levelupEl) return;
    levelupEl.textContent = '🎉 Woodcutting Level ' + level + '!';
    levelupEl.hidden = false;
    clearTimeout(levelupTimer);
    levelupTimer = setTimeout(() => { levelupEl.hidden = true; }, 2500);
  }

  gameMessage('Welcome to Eldenmoor, ' + username + '!');

  // Log-out button (top-right) — drops the connection and returns to the login screen.
  const logoutBtn = document.getElementById('logout');
  if (logoutBtn) {
    logoutBtn.textContent = '⎋ ' + username + ' · Log out';
    logoutBtn.onclick = () => { if (net.send) net.send({ t: 'logout' }); location.reload(); };
  }

  // --- MULTIPLAYER: render other players + wire the friends/chat UI ---
  const remotePlayers = createRemotePlayers(scene, camera);
  net.on('players', (d) => (d.list || []).forEach((p) => remotePlayers.setTarget(p.user, p.x, p.z, p.ry)));
  net.on('pjoin', (d) => { remotePlayers.setTarget(d.user, d.x, d.z, d.ry); net.send({ t: 'friend_list' }); gameMessage(d.user + ' has entered Eldenmoor.'); });
  net.on('pleave', (d) => { remotePlayers.remove(d.user); net.send({ t: 'friend_list' }); });
  net.on('ppos', (d) => remotePlayers.setTarget(d.user, d.x, d.z, d.ry));
  setupSocial(net);

  // --- FLOORS: ground (0), upper (1), cellar (-1) — OSRS-style level switching ---
  const keep = scene.userData.keep || {};
  const stairsList = scene.userData.stairs || [];
  const FLOOR_NAMES = { '-1': '⬇ The Cellar', '0': 'Castle — Ground Floor', '1': '⬆ Royal Upper Floor' };
  let curFloor = 0, stairLatch = false;
  const floorEl = document.createElement('div');
  floorEl.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:50;padding:4px 14px;border:1px solid #b9892f;border-radius:6px;background:rgba(20,16,10,0.82);color:#ffd100;font:600 14px Georgia,serif;letter-spacing:0.5px;pointer-events:none;';
  floorEl.textContent = FLOOR_NAMES['0'];
  document.body.appendChild(floorEl);
  function setFloor(n) {
    curFloor = n;
    if (keep.ground) keep.ground.visible = (n === 0);
    if (keep.upper) keep.upper.visible = (n === 1);
    if (keep.basement) keep.basement.visible = (n === -1);
    for (const o of scene.userData.outdoor || []) o.visible = (n === 0);   // town/trees/water/ground
    if (scene.userData.sky) scene.userData.sky.visible = (n !== -1);        // no sky underground
    if (scene.userData.hemi) scene.userData.hemi.intensity = (n === -1) ? 0.32 : 1.0;
    if (scene.userData.sun) scene.userData.sun.intensity = (n === -1) ? 0.25 : 2.7;
    scene.background = new THREE.Color(n === -1 ? 0x100c08 : 0xdde9f0);
    scene.fog = (n === -1) ? new THREE.Fog(0x100c08, 10, 55) : new THREE.Fog(0xc6dcee, 55, 180);
    collision.setActiveFloor(n);
    setNpcsFloor(npcs, n);
    remotePlayers.setVisible(n === 0);
    floorEl.textContent = FLOOR_NAMES[String(n)];
    gameMessage(n === 0 ? 'You step onto the ground floor.' : n === 1 ? 'You climb to the upper floor.' : 'You descend into the cellar.');
  }

  let posTimer = 0, lastX = null, lastZ = null, lastRy = null, questPollTimer = 0;

  // 7) THE GAME LOOP.
  const clock = new THREE.Clock();
  const coordsEl = document.getElementById('coords');

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;

    const prevX = player.position.x, prevZ = player.position.z;
    const wasd = controls.update(dt);
    const act = interactions.update(dt, wasd);
    const triedX = player.position.x, triedZ = player.position.z;
    const fixed = collision.resolve(prevX, prevZ, triedX, triedZ);   // stop at walls (with sliding)
    player.position.x = fixed.x; player.position.z = fixed.z;
    if ((triedX !== prevX || triedZ !== prevZ) && fixed.x === prevX && fixed.z === prevZ) interactions.stop();
    // hide a building's roof while you're inside it, so you can see the interior
    for (const e of scene.userData.enterables || []) {
      const f = e.footprint, p = player.position;
      if (e.roof) e.roof.visible = !(p.x > f.minX && p.x < f.maxX && p.z > f.minZ && p.z < f.maxZ);
    }
    // stairs — step onto one to change floor (move to the landing, then swap)
    if (stairsList.length) {
      let on = null;
      for (const s of stairsList) { if (s.floor === curFloor) { const dx = player.position.x - s.x, dz = player.position.z - s.z; if (dx * dx + dz * dz < s.r * s.r) { on = s; break; } } }
      if (on && !stairLatch) { stairLatch = true; player.position.x = on.lx; player.position.z = on.lz; setFloor(on.to); }
      else if (!on) stairLatch = false;
    }
    updatePlayerAnimation(player, wasd || act.walking, t, act.chopping);
    questPollTimer += dt;
    if (questPollTimer >= 0.5) { questPollTimer = 0; quests.poll(); }
    updateNpcs(npcs, dt, t);
    updateNpcLabels(npcs, camera);
    questMarkers.update(camera);
    remotePlayers.update(dt, t);
    posTimer += dt;
    if (posTimer >= 0.08) {
      posTimer = 0;
      const px = +player.position.x.toFixed(2), pz = +player.position.z.toFixed(2), pry = +player.rotation.y.toFixed(2);
      if (px !== lastX || pz !== lastZ || pry !== lastRy) { net.send({ t: 'pos', x: px, z: pz, ry: pry }); lastX = px; lastZ = pz; lastRy = pry; }
    }

    if (coordsEl) {
      coordsEl.textContent = `x: ${player.position.x.toFixed(1)}   z: ${player.position.z.toFixed(1)}`;
    }
    renderer.render(scene, camera);
  });

  // 8) RESIZE.
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Exposed for debugging / tinkering.
  window.eldenmoor = { scene, camera, player, skills, inventory, equipment, interactions, shop, npcs, save, quests, questMarkers, net, username, remotePlayers, collision, setFloor, getFloor: () => curFloor,
    // cel-shade helper exposed so async-spawned meshes (monsters) can toon-ify themselves
    applyToonTo,
    // talk(npcId) — runs the same talk flow a click would (handy for testing/wiring).
    talk: (npcId) => { const n = npcs.find((x) => x.def.id === npcId); if (n) talkTo(n.def); } };

  // Cosmetic HUD extras (minimap dial + framed parchment tooltips). Reads
  // window.eldenmoor; safe no-ops if its DOM hooks are missing.
  initHudExtras();
}
