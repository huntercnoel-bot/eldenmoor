// controls.js — reads the keyboard and mouse, moves the hero, and floats the
// camera behind them (World-of-Warcraft style: drag to turn, scroll to zoom).

import * as THREE from '../vendor/three.module.js';

// Which keys do what. (e.code is the physical key, so it works on any layout.)
const KEYMAP = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back',    ArrowDown: 'back',
  KeyA: 'left',    ArrowLeft: 'left',
  KeyD: 'right',   ArrowRight: 'right',
};

const SPEED = 6.5;   // walking speed (world units per second)
const BOUNDS = 95;   // keep the hero inside the world

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Smoothly turn angle `a` toward `b` (handles the -180/180 wrap-around).
function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function setupControls(player, camera, dom) {
  const keys = { forward: false, back: false, left: false, right: false };

  // Camera orbit state.
  let yaw = Math.PI;   // start behind the hero (looking at their back)
  let pitch = 0.45;    // a little above the horizon
  let distance = 8;    // how far back the camera sits

  // --- Keyboard ---
  window.addEventListener('keydown', (e) => {
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) return; // don't move the hero while typing in a box
    const k = KEYMAP[e.code];
    if (k) { keys[k] = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code];
    if (k) keys[k] = false;
  });

  // --- Mouse drag to look around ---
  let dragging = false, lastX = 0, lastY = 0;
  dom.style.cursor = 'grab';
  dom.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;  // left-button drag only; right-click is for menus
    dragging = true; lastX = e.clientX; lastY = e.clientY; dom.style.cursor = 'grabbing';
  });
  window.addEventListener('mouseup', () => { dragging = false; dom.style.cursor = 'grab'; });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    yaw -= (e.clientX - lastX) * 0.005;
    pitch = clamp(pitch + (e.clientY - lastY) * 0.005, 0.15, 1.35);
    lastX = e.clientX; lastY = e.clientY;
  });

  // --- Scroll wheel to zoom ---
  dom.addEventListener('wheel', (e) => {
    distance = clamp(distance + e.deltaY * 0.01, 3, 16);
    e.preventDefault();
  }, { passive: false });

  // Reused each frame so we don't create new objects 60x a second.
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const move = new THREE.Vector3();

  // Runs every frame. Returns true if the hero is walking.
  function update(dt) {
    // "Forward" = where the camera is looking, flattened onto the ground.
    forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    right.set(-forward.z, 0, forward.x);

    move.set(0, 0, 0);
    if (keys.forward) move.add(forward);
    if (keys.back)    move.sub(forward);
    if (keys.right)   move.add(right);
    if (keys.left)    move.sub(right);

    const isMoving = move.lengthSq() > 0.0001;
    if (isMoving) {
      move.normalize();
      player.position.x = clamp(player.position.x + move.x * SPEED * dt, -BOUNDS, BOUNDS);
      player.position.z = clamp(player.position.z + move.z * SPEED * dt, -BOUNDS, BOUNDS);
      // Turn the hero to face the direction they're walking.
      player.rotation.y = lerpAngle(player.rotation.y, Math.atan2(move.x, move.z), 0.18);
    }

    // Float the camera behind/above the hero, looking at them.
    camera.position.set(
      player.position.x + Math.sin(yaw) * Math.cos(pitch) * distance,
      player.position.y + Math.sin(pitch) * distance,
      player.position.z + Math.cos(yaw) * Math.cos(pitch) * distance
    );
    camera.lookAt(player.position.x, player.position.y + 1.3, player.position.z);

    return isMoving;
  }

  return { update };
}
