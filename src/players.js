// players.js — renders OTHER players in the world. Each remote player is a hero
// figure with a name label that smoothly follows the positions the server sends.

import * as THREE from '../vendor/three.module.js';
import { createPlayer, updatePlayerAnimation } from './player.js';

export function createRemotePlayers(scene, camera) {
  const remotes = {}; // username -> { group, tx, tz, tr, label }
  const _v = new THREE.Vector3();
  let shown = true;   // remote players are only shown on the ground floor

  function add(user, x, z, ry) {
    if (remotes[user]) return;
    const group = createPlayer();
    group.position.set(x, 0, z);
    group.rotation.y = ry || 0;
    scene.add(group);
    const label = document.createElement('div');
    label.className = 'player-label';
    label.textContent = user;
    document.body.appendChild(label);
    remotes[user] = { group, tx: x, tz: z, tr: ry || 0, label };
  }

  function remove(user) {
    const r = remotes[user];
    if (!r) return;
    scene.remove(r.group);
    r.label.remove();
    delete remotes[user];
  }

  // Update where a player is heading (the server sends these as they move).
  function setTarget(user, x, z, ry) {
    let r = remotes[user];
    if (!r) { add(user, x, z, ry); return; }
    r.tx = x; r.tz = z; r.tr = ry;
  }

  function clear() { for (const u of Object.keys(remotes)) remove(u); }
  function setVisible(v) { shown = v; }

  function update(dt, t) {
    const k = Math.min(1, dt * 10);
    for (const u of Object.keys(remotes)) {
      const r = remotes[u];
      if (!shown) { r.group.visible = false; r.label.style.display = 'none'; continue; }
      r.group.visible = true;
      const dx = r.tx - r.group.position.x, dz = r.tz - r.group.position.z;
      const moving = (dx * dx + dz * dz) > 0.004;       // still travelling toward target?
      r.group.position.x += dx * k;                      // smoothly glide there
      r.group.position.z += dz * k;
      r.group.rotation.y = r.tr;
      updatePlayerAnimation(r.group, moving, t, false);  // walk animation while moving

      _v.set(r.group.position.x, 2.5, r.group.position.z).project(camera);
      if (_v.z > 1 || _v.x < -1.1 || _v.x > 1.1) { r.label.style.display = 'none'; continue; }
      r.label.style.display = 'block';
      r.label.style.left = (_v.x * 0.5 + 0.5) * window.innerWidth + 'px';
      r.label.style.top = (-_v.y * 0.5 + 0.5) * window.innerHeight + 'px';
    }
  }

  return { add, remove, setTarget, update, clear, setVisible, remotes };
}
