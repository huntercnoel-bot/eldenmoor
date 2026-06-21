// wizardTower.js — the Wizard's Tower: a tall arcane landmark anchoring the new
// Magic skill, OSRS / WoW-Classic styled (smooth, sculpted, never blocky).
//
// Self-contained and self-initializing (the dungeon.js / vfx.js / mining.js
// pattern): it polls for window.eldenmoor (set up by main.js once the game
// starts), then builds a THREE.Group — a round tapering stone tower crowned with
// a steep slate-blue conic spire and a glowing arcane orb — and drops it into a
// clear stretch of the SE field, well beyond the town, the forest (~range 78),
// the NE quarry and the far-NW crypt. It is purely a decorative set-piece, so no
// collision wiring is needed.
//
// Stone body / timber / standing stones are built in smooth toon primitives and
// left for the global cel-shade pass to band + outline. The EMISSIVE arcane bits
// (the finial orb, the window glow, the orbiting runes, the arcane brazier
// flames) are tagged userData.__toonDone so the shader leaves their glow alone.
// Everything is pushed into scene.userData.outdoor so it hides on floor change.

import * as THREE from '../vendor/three.module.js';
import { greyStoneTexture } from './textures.js';

// --- placement: SE field, clear of town/forest/quarry/crypt -----------------
const TX = 88, TZ = 70;            // tower centre on the 300x300 ground
const FACE = -Math.PI * 0.7;       // yaw the door faces (back toward town/NW)

// arcane palette (matches the chapel stone family + magical blues/purples)
const C_WALL   = 0xc9c2af;         // warm ashlar stone (tints the grey texture)
const C_SLATE  = 0x5a4a73;         // slate-blue spire
const C_TIMBER = 0x6b4a2c;         // oak door / beams
const C_GILT   = 0xd8b24a;         // gilt trim
const C_ARCANE = 0x8a6cff;         // bright arcane glow

let TEX = null;
function tex() { if (!TEX) TEX = { wall: greyStoneTexture(2) }; return TEX; }

// ---------------------------------------------------------------------------
//  smooth-primitive helpers (match town.js / dungeon.js art style)
// ---------------------------------------------------------------------------
function mat(color, rough = 0.92, metal = 0.0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}
function mapped(map, color = 0xffffff, rough = 0.9) {
  return new THREE.MeshStandardMaterial({ map, color, roughness: rough, metalness: 0 });
}
// emissive material that keeps its glow through the cel-shade pass
function emissive(color, glow, intensity = 1.2) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.0 });
  m.emissive = new THREE.Color(glow); m.emissiveIntensity = intensity;
  m.userData.__toonDone = true;
  return m;
}
const box = (w, h, d, m, x, y, z, ry = 0) => {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = true; o.receiveShadow = true; return o;
};
const cyl = (rt, rb, h, seg, m, x, y, z) => {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o;
};
const cone = (r, h, seg, m, x, y, z) => {
  const o = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), m);
  o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o;
};
const ball = (r, m, x, y, z, seg = 18) => {
  const o = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg - 4)), m);
  o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o;
};
const torus = (r, tube, m, x, y, z, rx = Math.PI / 2) => {
  const o = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 28), m);
  o.position.set(x, y, z); o.rotation.x = rx; o.castShadow = true; o.receiveShadow = true; return o;
};

// An arched opening: a panel (door/glass) topped with a half-disc, framed by a
// slim surround — so the door + windows curve, never square holes. Faces -z;
// `ry` rotates it. Glass panels are usually emissive (passed in as panelMat).
function archedOpening(w, h, panelMat, frameMat, x, y, z, ry = 0) {
  const g = new THREE.Group();
  const r = w / 2, fr = 0.1;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), panelMat); g.add(panel);
  const top = new THREE.Mesh(new THREE.CircleGeometry(r, 16, 0, Math.PI), panelMat);
  top.position.y = h / 2; g.add(top);
  const jamb = (s) => box(fr, h, fr * 1.4, frameMat, s * (r + fr * 0.5), 0, 0.04);
  g.add(jamb(-1)); g.add(jamb(1));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r + fr * 0.25, fr * 0.65, 6, 18, Math.PI), frameMat);
  ring.position.set(0, h / 2, 0.04); g.add(ring);
  g.rotation.y = ry; g.position.set(x, y, z); return g;
}

// ---------------------------------------------------------------------------
//  the tower
// ---------------------------------------------------------------------------
function buildTower() {
  const g = new THREE.Group();
  const T = tex();
  const stone = mapped(T.wall, C_WALL, 0.94);
  const slate = mat(C_SLATE, 0.7);
  const timber = mat(C_TIMBER, 0.85);
  const gilt = mat(C_GILT, 0.5, 0.4);
  const glass = emissive(0x2a2466, C_ARCANE, 1.0);     // window glow (animated)

  // --- splayed stone plinth / base the tower rises from ---------------------
  g.add(cyl(4.6, 5.6, 0.7, 28, stone, 0, 0.35, 0));        // wide footing
  g.add(cyl(4.2, 4.6, 0.5, 28, stone, 0, 0.9, 0));         // step

  // --- the tapering tower body (stacked smooth drums, each a touch narrower) --
  // Smooth cylinders, NOT box prisms — the silhouette tapers as it climbs.
  const drums = [
    { rt: 3.4, rb: 3.7, h: 5.0, y: 3.6 },   // ground storey
    { rt: 3.0, rb: 3.3, h: 4.6, y: 8.3 },   // first storey
    { rt: 2.6, rb: 2.9, h: 4.2, y: 12.6 },  // second storey
    { rt: 2.3, rb: 2.5, h: 3.6, y: 16.5 },  // belfry storey
  ];
  for (const d of drums) g.add(cyl(d.rt, d.rb, d.h, 26, stone, 0, d.y, 0));

  // string-course mouldings between storeys (flared rings — sculpted, not stacked cubes)
  const courses = [[3.85, 6.1], [3.45, 10.6], [3.05, 14.7], [2.6, 18.3]];
  for (const [r, y] of courses) g.add(cyl(r, r + 0.18, 0.4, 26, stone, 0, y, 0));

  // --- arched windows glowing arcane blue, spiralling up the storeys ---------
  // Placed around each drum; the glass is emissive (tagged __toonDone).
  const winSpots = [
    { y: 4.0, r: 3.55, n: 3, w: 1.0, h: 1.8 },
    { y: 8.6, r: 3.15, n: 4, w: 0.9, h: 1.6 },
    { y: 12.8, r: 2.75, n: 4, w: 0.85, h: 1.5 },
  ];
  const windowGlows = [];
  for (const s of winSpots) {
    for (let i = 0; i < s.n; i++) {
      const a = (i / s.n) * Math.PI * 2 + s.y * 0.4;   // spiral the rings round
      const ax = Math.cos(a), az = Math.sin(a);
      const w = archedOpening(s.w, s.h, glass, gilt,
        ax * s.r, s.y, az * s.r, Math.atan2(ax, az));
      g.add(w);
      windowGlows.push(w);
    }
  }

  // --- belfry: open arched lantern just under the spire ----------------------
  // a ring of slim gilt colonettes framing the glowing arcane lantern
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const ax = Math.cos(a), az = Math.sin(a);
    g.add(cyl(0.13, 0.13, 2.4, 8, gilt, ax * 2.35, 17.7, az * 2.35));
  }
  // glowing arcane lantern core inside the belfry
  const lantern = ball(1.1, emissive(0x3a2f80, C_ARCANE, 1.6), 0, 17.9, 0, 20);
  lantern.scale.set(1, 1.2, 1);
  g.add(lantern);

  // --- the steep conic slate-blue spire --------------------------------------
  g.add(cyl(2.5, 2.6, 0.5, 26, slate, 0, 19.1, 0));        // eave ring under the spire
  const spire = cone(2.7, 7.5, 26, slate, 0, 23.3, 0);     // tall smooth cone
  g.add(spire);
  // a couple of band rings on the spire (sculpted detail)
  g.add(cone(2.0, 0.5, 26, mat(0x4a3d63, 0.7), 0, 21.6, 0));
  g.add(cone(1.2, 0.4, 26, mat(0x4a3d63, 0.7), 0, 24.6, 0));

  // --- the glowing arcane finial orb on the very top -------------------------
  g.add(cyl(0.16, 0.22, 1.0, 8, gilt, 0, 27.4, 0));        // gilt stalk
  const orb = ball(0.85, emissive(0x4a3aa0, 0x9a7cff, 2.2), 0, 28.7, 0, 22);
  orb.userData.__orb = true;
  g.add(orb);
  // two gilt halo rings around the orb (counter-rotate in the tick loop)
  const halo1 = torus(1.25, 0.07, gilt, 0, 28.7, 0, Math.PI / 2);
  const halo2 = torus(1.25, 0.07, gilt, 0, 28.7, 0, 0);
  halo2.rotation.z = Math.PI / 2;
  g.add(halo1); g.add(halo2);
  // a soft arcane point-light radiating from the orb
  const orbLight = new THREE.PointLight(C_ARCANE, 3.4, 30, 2);
  orbLight.position.set(0, 28.7, 0);
  g.add(orbLight);

  // --- the wooden arched entrance at the base --------------------------------
  g.add(archedOpening(1.9, 2.7, timber, gilt, 0, 1.55, 3.78, 0));
  // an arched stone hood / dripstone over the door
  g.add(cyl(1.35, 1.35, 0.28, 14, stone, 0, 3.1, 3.8));
  // two short steps up to the threshold
  g.add(box(2.6, 0.25, 0.7, stone, 0, 0.85, 4.3));
  g.add(box(2.2, 0.25, 0.5, stone, 0, 1.05, 4.7));

  // --- a pair of slim arcane braziers either side of the door ----------------
  const braziers = [];
  for (const sx of [-1, 1]) {
    const b = new THREE.Group();
    b.add(cyl(0.16, 0.2, 1.6, 8, stone, 0, 0.8, 0));              // post
    b.add(cyl(0.34, 0.22, 0.3, 12, stone, 0, 1.7, 0));           // bowl
    const fl = cone(0.26, 0.7, 10, emissive(0xc7b6ff, C_ARCANE, 1.8), 0, 2.1, 0);
    fl.userData.__flame = true; b.add(fl);
    const core = cone(0.13, 0.4, 8, emissive(0xe7e0ff, 0xb9a6ff, 2.4), 0, 2.05, 0);
    b.add(core);
    const lt = new THREE.PointLight(C_ARCANE, 2.2, 12, 2); lt.position.set(0, 2.2, 0); b.add(lt);
    b.position.set(sx * 2.4, 0, 3.4);
    b.userData = { flame: fl, core, light: lt, phase: Math.random() * 10 };
    g.add(b); braziers.push(b);
  }

  return { group: g, windowGlows, orb, orbLight, halo1, halo2, lantern, braziers };
}

// A ring of standing stones around the tower base, with faint rune carvings that
// glow arcane. Decorative menhirs in smooth, weathered toon stone.
function buildStandingStones() {
  const g = new THREE.Group();
  const stoneM = mat(0x8b857a, 0.95);
  const runeM = emissive(0x2a2055, C_ARCANE, 1.3);
  const runes = [];
  const N = 8, R = 9.5;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const sx = Math.cos(a) * R, sz = Math.sin(a) * R;
    const h = 2.6 + (i % 3) * 0.5;
    const menhir = box(1.0, h, 0.6, stoneM, sx, h / 2, sz, a + Math.PI / 2);
    menhir.rotation.z = (Math.random() - 0.5) * 0.12;
    g.add(menhir);
    // a glowing rune quad facing the centre
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), runeM);
    rune.position.set(sx * 0.9, h * 0.55, sz * 0.9);
    rune.lookAt(0, h * 0.55, 0);
    g.add(rune); runes.push(rune);
  }
  g.userData = { runes };
  return g;
}

// ---------------------------------------------------------------------------
//  build + wire into the scene
// ---------------------------------------------------------------------------
function buildWizardTower(em) {
  const { scene } = em;
  const root = new THREE.Group();
  root.name = 'wizard-tower';
  root.position.set(TX, 0, TZ);
  root.rotation.y = FACE;

  const tower = buildTower();
  root.add(tower.group);

  const stones = buildStandingStones();
  root.add(stones);

  // a darkened arcane ground-glow patch under the tower so the orb light reads
  const glowPatch = new THREE.Mesh(new THREE.CircleGeometry(11, 30),
    emissive(0x241d3a, 0x2a2255, 0.35));
  glowPatch.rotation.x = -Math.PI / 2; glowPatch.position.y = 0.02;
  glowPatch.receiveShadow = true;
  root.add(glowPatch);

  // a wide, dim arcane ambient fill over the clearing
  const ambient = new THREE.PointLight(0x4a3a8a, 1.2, 40, 1.6);
  ambient.position.set(0, 10, 0);
  root.add(ambient);

  scene.add(root);

  // cel-shade the procedural stone/timber work; emissive bits are tagged
  // __toonDone so the pass leaves their glow alone.
  if (em.applyToonTo) em.applyToonTo(root);

  // hide the whole landmark when the player goes upstairs / underground
  (scene.userData.outdoor = scene.userData.outdoor || []).push(root);

  // ----- slow arcane animation loop ----------------------------------------
  const orbiters = new THREE.Group();   // free-floating glow runes orbiting the spire
  const runeM = emissive(0x2a2055, 0x9a7cff, 2.0);
  const floatRunes = [];
  for (let i = 0; i < 5; i++) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), runeM);
    r.userData = { a: (i / 5) * Math.PI * 2, rad: 4.2 + (i % 2) * 0.8, h: 22 + (i % 3) * 1.2, spin: 0.6 + Math.random() * 0.6 };
    floatRunes.push(r); orbiters.add(r);
  }
  tower.group.add(orbiters);

  let last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = (now - last) / 1000; last = now;
    const t = now / 1000;

    // orb gently pulses + halos counter-rotate
    const pulse = 0.85 + Math.sin(t * 1.6) * 0.15;
    if (tower.orbLight) tower.orbLight.intensity = 3.4 * pulse;
    if (tower.lantern) tower.lantern.material.emissiveIntensity = 1.6 * (0.85 + Math.sin(t * 1.3) * 0.15);
    if (tower.halo1) tower.halo1.rotation.z += dt * 0.5;
    if (tower.halo2) tower.halo2.rotation.x += dt * 0.4;
    if (tower.orb) tower.orb.rotation.y += dt * 0.3;

    // the windows breathe their glow (a "lit at night" shimmer)
    for (let i = 0; i < tower.windowGlows.length; i++) {
      const w = tower.windowGlows[i];
      const f = 0.7 + Math.sin(t * 1.1 + i * 0.9) * 0.3;
      w.children.forEach((ch) => {
        if (ch.material && ch.material.userData && ch.material.userData.__toonDone && ch.material.emissiveIntensity != null) {
          ch.material.emissiveIntensity = f;
        }
      });
    }

    // standing-stone runes shimmer
    for (let i = 0; i < stones.userData.runes.length; i++) {
      stones.userData.runes[i].material.emissiveIntensity = 1.0 + Math.sin(t * 0.9 + i) * 0.4;
    }

    // floating runes slowly orbit the spire and spin
    for (const r of floatRunes) {
      r.userData.a += dt * 0.35;
      r.position.set(Math.cos(r.userData.a) * r.userData.rad, r.userData.h, Math.sin(r.userData.a) * r.userData.rad);
      r.rotation.y += dt * r.userData.spin;
    }

    // brazier flames flicker
    for (const b of tower.braziers) {
      const f = 0.8 + Math.sin(t * 8 + b.userData.phase) * 0.12 + Math.sin(t * 19 + b.userData.phase) * 0.06;
      b.userData.light.intensity = 2.2 * f;
      b.userData.flame.scale.y = 0.85 + f * 0.3;
      b.userData.flame.rotation.y += dt * 1.4;
    }
  }
  requestAnimationFrame(tick);

  return { root, tower, center: { x: TX, z: TZ } };
}

// ----- self-initialize -------------------------------------------------------
(function boot() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.scene) {
      clearInterval(iv);
      try { em.wizardTower = buildWizardTower(em); }
      catch (err) { console.error('[wizardTower] failed to build', err); }
    } else if (tries > 600) { clearInterval(iv); }
  }, 100);
})();
