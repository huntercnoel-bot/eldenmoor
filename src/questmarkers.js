// questmarkers.js — WoW-style floating quest markers above NPCs.
//
//   "!"  (class .quest-marker.available)   → an NPC has a quest you can START
//   "?"  (class .quest-marker.in-progress) → a quest is on / READY TO HAND IN
//
// Each marker is a DOM node created in JS and positioned every frame by
// projecting the NPC's head world-position to screen — the same technique
// `updateNpcLabels` in npc.js uses (read there for the projection math). Marker
// state is driven by the quest system (`quests.markerFor(npcId)`), and a marker
// is hidden whenever its NPC is hidden (e.g. on another floor) or off-screen.
//
// Markers carry clear classes so the UI agent can theme them; we set just enough
// inline style to make them visible/positioned out of the box.

import * as THREE from '../vendor/three.module.js';

const _v = new THREE.Vector3();

// Glyphs per state. Kept here so behaviour stays in JS even if the UI restyles.
const GLYPH = { available: '!', 'in-progress': '?' };

export function createQuestMarkers(npcs, quests) {
  // One marker DOM node per quest-giver NPC, created lazily.
  const markers = new Map(); // npcId -> { el, npc, state }

  // Which NPCs are quest-givers? Anything the quest system recognises as a giver.
  const givers = npcs.filter((n) => n.def && quests.questIdForGiver(n.def.id));

  function makeEl() {
    const el = document.createElement('div');
    el.className = 'quest-marker';
    // Minimal inline styling — the UI agent can override via the classes.
    el.style.cssText =
      'position:fixed;z-index:95;pointer-events:none;transform:translate(-50%,-100%);' +
      'font:700 26px Georgia,serif;line-height:1;text-align:center;' +
      'color:#ffd100;text-shadow:0 0 4px #000,0 2px 4px rgba(0,0,0,0.8);' +
      'will-change:left,top;display:none;';
    document.body.appendChild(el);
    return el;
  }

  // Call every frame from the game loop. Mirrors updateNpcLabels' projection.
  function update(camera) {
    for (const n of givers) {
      const state = quests.markerFor(n.def.id); // 'available' | 'in-progress' | null
      let m = markers.get(n.def.id);

      // No active marker for this NPC right now → hide if it exists.
      if (!state) { if (m) m.el.style.display = 'none'; continue; }

      if (!m) { m = { el: makeEl(), npc: n, state: null }; markers.set(n.def.id, m); }

      // Hidden NPC (different floor / culled) → hide the marker too.
      if (!n.group.visible) { m.el.style.display = 'none'; continue; }

      // Update glyph + class only when the state changes (keeps the DOM cheap).
      if (m.state !== state) {
        m.state = state;
        m.el.className = 'quest-marker ' + state;
        m.el.textContent = GLYPH[state] || '';
        // A distinct default hue per state so they read before the UI themes them.
        m.el.style.color = state === 'in-progress' ? '#cfe2ff' : '#ffd100';
      }

      // Project the NPC head (y ≈ 2.7, just above the name label at 2.4).
      _v.set(n.group.position.x, 2.7, n.group.position.z).project(camera);
      if (_v.z > 1 || _v.x < -1.1 || _v.x > 1.1) { m.el.style.display = 'none'; continue; }
      m.el.style.display = 'block';
      m.el.style.left = (_v.x * 0.5 + 0.5) * window.innerWidth + 'px';
      m.el.style.top = (-_v.y * 0.5 + 0.5) * window.innerHeight + 'px';
    }
  }

  function dispose() {
    for (const m of markers.values()) m.el.remove();
    markers.clear();
  }

  return { update, dispose };
}
