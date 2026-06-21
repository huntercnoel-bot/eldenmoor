// questmarkers.js — WoW-style floating quest markers above NPCs.
//
//   "!"  (class .quest-marker.available)   → an NPC has a quest you can START
//   "?"  (class .quest-marker.in-progress) → a quest is ON, objectives underway
//   "?"  (class .quest-marker.ready)       → objectives DONE — return to hand in
//
// Each marker is a DOM node created in JS and positioned every frame by
// projecting the NPC's head world-position to screen — the same technique
// `updateNpcLabels` in npc.js uses (read there for the projection math). Marker
// state is driven by the quest system (`quests.markerFor(npcId)`), and a marker
// is hidden whenever its NPC is hidden (e.g. on another floor) or off-screen.
//
// Markers carry clear classes so the UI agent can theme them; we set just enough
// inline style to make them visible/positioned out of the box. The 'ready' marker
// also gets a gentle bob to catch the eye, and every marker carries a title
// tooltip naming the quest's current stage so it reads at a glance — so the
// over-head marker tracks each new stage of the quest as it advances.

import * as THREE from '../vendor/three.module.js';

const _v = new THREE.Vector3();

// Glyphs per state. Kept here so behaviour stays in JS even if the UI restyles.
const GLYPH = { available: '!', 'in-progress': '?', ready: '?' };
// Default hues per state (the UI agent can override via the .quest-marker classes).
const HUE = { available: '#ffd100', 'in-progress': '#cfe2ff', ready: '#ffe066' };

// A short tooltip describing where the quest stands, so hovering a marker (or a
// future UI reading the title) reflects the live stage.
function tooltipFor(quests, npcId) {
  const id = quests.questIdForGiver(npcId);
  if (!id) return '';
  const def = quests.QUEST_DEFS[id];
  const name = (def && def.name) || 'Quest';
  if (quests.canStart(id)) return name + ' — new quest available!';
  if (quests.readyToComplete(id)) return name + ' — ready to hand in';
  if (quests.isActive(id)) {
    const st = def && def.stages[Math.min(quests.stage(id), def.stages.length - 1)];
    return name + (st ? ' — ' + st.name : ' — in progress');
  }
  return name;
}

export function createQuestMarkers(npcs, quests) {
  // One marker DOM node per quest-giver NPC, created lazily.
  const markers = new Map(); // npcId -> { el, npc, state, stage }

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
  // `dt` is optional; the 'ready' bob falls back to a real-time clock so it still
  // animates even when the caller passes no delta.
  function update(camera, dt) {
    const clock = (typeof dt === 'number') ? (update._clock = (update._clock || 0) + dt)
      : performance.now() / 1000;
    for (const n of givers) {
      const state = quests.markerFor(n.def.id); // 'available' | 'in-progress' | 'ready' | null
      let m = markers.get(n.def.id);

      // No active marker for this NPC right now → hide if it exists.
      if (!state) { if (m) m.el.style.display = 'none'; continue; }

      if (!m) { m = { el: makeEl(), npc: n, state: null, stage: -1 }; markers.set(n.def.id, m); }

      // Hidden NPC (different floor / culled) → hide the marker too.
      if (!n.group.visible) { m.el.style.display = 'none'; continue; }

      // Update glyph + class + tooltip when the state OR the stage changes (so the
      // marker reflects each stage of the quest, while keeping the DOM cheap).
      const stg = quests.stage(n.def.id);
      if (m.state !== state || m.stage !== stg) {
        m.state = state; m.stage = stg;
        m.el.className = 'quest-marker ' + state;
        m.el.textContent = GLYPH[state] || '';
        m.el.style.color = HUE[state] || '#ffd100';
        // A brighter, warmer glow when the quest is ready to be handed in.
        m.el.style.textShadow = state === 'ready'
          ? '0 0 8px #ffcf4a,0 0 4px #000,0 2px 4px rgba(0,0,0,0.8)'
          : '0 0 4px #000,0 2px 4px rgba(0,0,0,0.8)';
        m.el.title = tooltipFor(quests, n.def.id);
      }

      // Project the NPC head (y ≈ 2.7, just above the name label at 2.4). The
      // 'ready' marker bobs gently to draw the eye back to the quest-giver.
      const bob = state === 'ready' ? Math.sin(clock * 4) * 0.12 : 0;
      _v.set(n.group.position.x, 2.7 + bob, n.group.position.z).project(camera);
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
