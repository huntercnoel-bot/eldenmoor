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

  // 4) SYSTEMS.
  const controls = setupControls(player, camera, renderer.domElement);
  const skills = createSkills();
  const inventory = createInventory();
  const equipment = createEquipment(inventory);
  const shop = createShop(inventory);

  inventory.setClickHandler((itemId, def) => {
    if (shop.isOpen()) shop.sell(itemId);
    else if (def.equipable) equipment.equip(itemId);
  });

  // 5) SAVE (per account) + starter kit.
  const save = createSave(skills, inventory, equipment, username);
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
  });

  // 6) INTERACTIONS + right-click menus.
  const interactions = setupInteractions(scene, camera, player, renderer.domElement, skills, inventory, equipment, showLevelUp);
  const talkTo = (def) => gameMessage(def.name + ': "' + def.flavor + '"');
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

  let posTimer = 0, lastX = null, lastZ = null, lastRy = null;

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
    updateNpcs(npcs, dt, t);
    updateNpcLabels(npcs, camera);
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
  window.eldenmoor = { scene, camera, player, skills, inventory, equipment, interactions, shop, npcs, save, net, username, remotePlayers, collision, setFloor, getFloor: () => curFloor };

  // Cosmetic HUD extras (minimap dial + framed parchment tooltips). Reads
  // window.eldenmoor; safe no-ops if its DOM hooks are missing.
  initHudExtras();
}
