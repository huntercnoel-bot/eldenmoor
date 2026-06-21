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

// --- Smoothing rates (higher = snappier, lower = floatier) ---
// These are exponential-decay rates in "per second". We turn them into a
// frame-rate-independent blend factor each frame with 1 - exp(-rate * dt),
// so the feel is identical at 30, 60 or 144 fps.
const CAM_POS_RATE  = 14;  // camera body chasing its orbit point — tight, small lag
const CAM_LOOK_RATE = 18;  // look-at target — a touch quicker so framing stays centered
const ZOOM_RATE     = 12;  // distance gliding toward the scroll target
const ORBIT_RATE    = 30;  // yaw/pitch easing toward drag target — subtle, still direct
const TURN_RATE     = 14;  // hero turning to face their movement direction

const MAX_DT = 1 / 20;     // clamp big frame gaps (tab-out, hitches) so nothing overshoots

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Frame-rate-independent smoothing factor for a given decay rate and dt.
const smoothFactor = (rate, dt) => 1 - Math.exp(-rate * dt);

// Smoothly turn angle `a` toward `b` (handles the -180/180 wrap-around).
function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function setupControls(player, camera, dom) {
  const keys = { forward: false, back: false, left: false, right: false };

  // Camera orbit state. Each value has a `target` (where input wants it) and a
  // smoothed current value that eases toward the target every frame.
  let yawTarget = Math.PI, yaw = yawTarget;        // start behind the hero
  let pitchTarget = 0.45,  pitch = pitchTarget;    // a little above the horizon
  let distTarget = 8,      distance = distTarget;  // how far back the camera sits

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
    yawTarget -= (e.clientX - lastX) * 0.005;
    pitchTarget = clamp(pitchTarget + (e.clientY - lastY) * 0.005, 0.15, 1.35);
    lastX = e.clientX; lastY = e.clientY;
  });

  // --- Scroll wheel to zoom ---
  dom.addEventListener('wheel', (e) => {
    distTarget = clamp(distTarget + e.deltaY * 0.01, 3, 16);
    e.preventDefault();
  }, { passive: false });

  // Reused each frame so we don't create new objects 60x a second.
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const move = new THREE.Vector3();
  const desiredPos = new THREE.Vector3();   // orbit point the camera chases
  const lookTarget = new THREE.Vector3();   // smoothed point the camera looks at

  // Seed the look-at target so the first frame doesn't lurch from the origin.
  lookTarget.set(player.position.x, player.position.y + 1.3, player.position.z);
  let seeded = false;

  // Runs every frame. Returns true if the hero is walking.
  function update(dt) {
    // A big frame gap (tab-out, GC hitch) would otherwise let the smoothing
    // overshoot — clamp it so motion stays stable no matter the framerate.
    dt = Math.min(dt, MAX_DT);

    // Pre-compute this frame's smoothing factors once (each is a Math.exp) and
    // reuse them — same feel, but no recomputing the same rate twice per frame.
    const fOrbit = smoothFactor(ORBIT_RATE, dt);
    const fZoom  = smoothFactor(ZOOM_RATE, dt);
    const fPos   = smoothFactor(CAM_POS_RATE, dt);
    const fLook  = smoothFactor(CAM_LOOK_RATE, dt);

    // Ease the orbit toward where the mouse/scroll wants it. Subtle on yaw/pitch
    // so flicks read as smooth, not laggy; the zoom glides instead of stepping.
    yaw      = lerpAngle(yaw, yawTarget, fOrbit);
    pitch   += (pitchTarget - pitch) * fOrbit;
    distance += (distTarget - distance) * fZoom;

    // "Forward" = where the camera is looking, flattened onto the ground.
    // Use the live (eased) yaw so movement direction tracks the camera tightly.
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
      // Turn the hero to face the direction they're walking (frame-rate independent).
      player.rotation.y = lerpAngle(player.rotation.y, Math.atan2(move.x, move.z), smoothFactor(TURN_RATE, dt));
    }

    // Where the camera *wants* to be: floating behind/above the hero.
    desiredPos.set(
      player.position.x + Math.sin(yaw) * Math.cos(pitch) * distance,
      player.position.y + Math.sin(pitch) * distance,
      player.position.z + Math.cos(yaw) * Math.cos(pitch) * distance
    );

    if (!seeded) {
      // First frame: jump straight to the ideal pose so there's no opening swoop.
      camera.position.copy(desiredPos);
      seeded = true;
    } else {
      // Damped follow: glide the camera body toward its orbit point.
      camera.position.lerp(desiredPos, fPos);
    }

    // Smooth the look-at target too, so the framing settles gently.
    lookTarget.x += (player.position.x       - lookTarget.x) * fLook;
    lookTarget.y += (player.position.y + 1.3 - lookTarget.y) * fLook;
    lookTarget.z += (player.position.z       - lookTarget.z) * fLook;
    camera.lookAt(lookTarget);

    return isMoving;
  }

  return { update };
}
