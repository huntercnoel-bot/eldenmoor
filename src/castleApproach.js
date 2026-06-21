// castleApproach.js — a GRAND ceremonial approach to the home castle's gate.
//
// The castle sits at world (0,0,46); its front (gate) faces -z, so the gate
// mouth is at world z ≈ 24 (local front HD=22) with the opening at world x
// [-2.5, 2.5]. buildings.js already raises a moat-bridge causeway + barbican
// over the front moat (world z ≈ 17.5..23). In FRONT of that (z < ~17, toward
// the town) the ground was just flat grass — you simply walked up to the gate.
//
// This module dresses that final stretch into a majestic descending stone
// staircase: a wide tiered flight flanked by sculpted balustrades, gilt-topped
// newel posts crowned with glowing braziers, heraldic banners framing the path,
// and a paved processional avenue continuing toward the town square.
//
// IMPORTANT — the player controller keeps a FIXED height (controls.js never
// changes player.position.y; movement is purely XZ on flat ground). So a real
// climbable staircase is impossible — the hero would clip through it. Instead
// every piece here is DECORATIVE (userData.noCollide = true): the steps are a
// shallow, low-profile flight the hero strides smoothly over at ground level,
// reading as a grand entrance without ever blocking or floating the player. The
// central avenue is deliberately kept clear so town → gate stays fully walkable.
//
// Self-contained: polls window.eldenmoor until the castle's ground floor exists,
// then parents a THREE.Group under scene.userData.keep.ground (so it shows/hides
// with that floor). Cohesive with the castle via the shared procedural stone /
// marble / slate textures from textures.js.

import * as THREE from '../vendor/three.module.js';
import { greyStoneTexture, marbleTexture, stoneTexture, shingleTexture } from './textures.js';

const CX = 0, CZ = 46;            // castle centre (world)
const GATE_Z = CZ - 22;           // world z of the gate mouth (≈ 24)

// The staircase runs along -z from just outside the barbican toward town.
// Barbican mouth ≈ world z 17.5; we start the top tread a touch in front of it
// and step DOWN toward the town (decreasing z). Avenue continues beyond.
const STAIR_TOP_Z = 16.5;         // world z of the topmost (gate-side) tread
const STEP_DEPTH = 1.5;           // tread depth (along z)
const STEP_RISE = 0.42;           // riser height of the FLANKING terraces (decorative)
const N_STEPS = 7;                // number of tiers in the flight
const STAIR_HALF_W = 5.8;         // half-width of the flight (x)

// ---- shared, castle-cohesive materials --------------------------------------
let MATS = null;
function mats() {
  if (MATS) return MATS;
  const grey = greyStoneTexture(2);          // cool Falador/Varrock ashlar (matches keep)
  const greyBig = greyStoneTexture(4);
  const marble = marbleTexture(2);           // pale tread nosings & balustrade caps
  const road = stoneTexture(6);              // warm flagstone for the avenue
  const slate = shingleTexture(4);
  for (const t of [grey, greyBig, marble, road, slate]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  MATS = {
    riser:   new THREE.MeshStandardMaterial({ map: greyBig, color: 0xb8b4ab, roughness: 0.95, metalness: 0 }),
    tread:   new THREE.MeshStandardMaterial({ map: marble, color: 0xd7d1c2, roughness: 0.85, metalness: 0 }),
    balus:   new THREE.MeshStandardMaterial({ map: grey, color: 0xc3bfb4, roughness: 0.92, metalness: 0 }),
    cap:     new THREE.MeshStandardMaterial({ map: marble, color: 0xcfc9ba, roughness: 0.8, metalness: 0 }),
    paving:  new THREE.MeshStandardMaterial({ map: road, color: 0x9c968a, roughness: 0.96, metalness: 0 }),
    pavingDk:new THREE.MeshStandardMaterial({ map: road, color: 0x807a70, roughness: 0.96, metalness: 0 }),
    gilt:    new THREE.MeshStandardMaterial({ color: 0xd8b24a, roughness: 0.45, metalness: 0.35 }),
    wood:    new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.9 }),
    ember:   new THREE.MeshStandardMaterial({ color: 0xffb24a, emissive: 0xff6a16, emissiveIntensity: 2.0, roughness: 0.5 }),
    flame:   new THREE.MeshBasicMaterial({ color: 0xffd66a }),
  };
  return MATS;
}

// All approach geometry is decoration the hero walks over — never a collider.
function deco(o) {
  o.traverse((m) => {
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
    o.userData.__toonDone = true;
    o.userData.noCollide = true;
  });
  return o;
}

const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (rt, rb, h, s, m) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), m);

// ---- a sculpted balustrade run: a low plinth with turned balusters and a
// smooth rounded coping rail on top. Built along +x for length `len`, centred
// at the origin; caller positions/rotates it. -----------------------------------
function balustrade(len, height = 1.0) {
  const M = mats();
  const g = new THREE.Group();
  const railTop = height;
  // continuous plinth (kick) at the base
  g.add(box(len, 0.34, 0.5, M.balus).translateY(0.17));
  // smooth rounded coping rail — a cylinder laid along x reads as a turned cap
  const rail = cyl(0.26, 0.26, len, 12, M.cap);
  rail.rotation.z = Math.PI / 2;
  rail.position.y = railTop;
  g.add(rail);
  // a flat under-rail board the balusters seat against
  g.add(box(len, 0.14, 0.42, M.cap).translateY(railTop - 0.32));
  // turned balusters: pinched waists for a vase profile (two stacked cones)
  const n = Math.max(2, Math.round(len / 0.62));
  const bh = railTop - 0.5;        // baluster height between plinth top & under-rail
  for (let i = 0; i <= n; i++) {
    const x = -len / 2 + (len / n) * i;
    const lo = cyl(0.1, 0.17, bh * 0.5, 8, M.balus);
    lo.position.set(x, 0.34 + bh * 0.25, 0);
    const hi = cyl(0.17, 0.1, bh * 0.5, 8, M.balus);
    hi.position.set(x, 0.34 + bh * 0.75, 0);
    g.add(lo, hi);
  }
  return g;
}

// ---- a grand newel post: a stout chamfered pier with a moulded base & cap,
// topped by a stone brazier bowl with glowing embers + a warm point light. ------
function newelBrazier() {
  const M = mats();
  const g = new THREE.Group();
  // stepped base
  g.add(box(1.5, 0.4, 1.5, M.balus).translateY(0.2));
  g.add(box(1.25, 0.35, 1.25, M.balus).translateY(0.55));
  // tapered pier shaft (octagonal-ish via a many-sided cylinder for a sculpted feel)
  g.add(cyl(0.5, 0.62, 2.0, 8, M.balus).translateY(1.7));
  // moulded cap
  g.add(box(1.15, 0.3, 1.15, M.cap).translateY(2.85));
  g.add(cyl(0.7, 0.55, 0.4, 12, M.balus).translateY(3.2));
  // brazier bowl
  g.add(cyl(0.85, 0.4, 0.7, 16, M.balus).translateY(3.6));
  g.add(cyl(0.58, 0.58, 0.12, 16, M.gilt).translateY(3.95));   // gilt rim
  // glowing embers + flame
  const ember = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.ember);
  ember.position.y = 4.0; ember.scale.y = 0.55;
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.1, 10), M.flame);
  fire.position.y = 4.6;
  g.add(ember, fire);
  const light = new THREE.PointLight(0xffa53a, 7, 20, 2);
  light.position.y = 4.7;
  g.add(light);
  g.userData.__flicker = { light, fire, base: 7 };
  return g;
}

// ---- a tall heraldic banner on a sculpted pole (reuses the castle's blue/gold
// crest palette). Cloth hangs to one side; caller faces it inward. --------------
let _bannerTex = null;
function bannerTexture() {
  const c = document.createElement('canvas'); c.width = 96; c.height = 200;
  const x = c.getContext('2d');
  x.fillStyle = '#27406e'; x.fillRect(0, 0, 96, 200);
  x.fillStyle = '#1f3358'; for (let i = 0; i < 200; i += 12) x.fillRect(0, i, 96, 2);
  x.strokeStyle = '#d8b24a'; x.lineWidth = 6; x.strokeRect(6, 6, 84, 188);
  x.fillStyle = '#d8b24a';
  x.beginPath(); x.moveTo(48, 54); x.lineTo(74, 100); x.lineTo(48, 150); x.lineTo(22, 100); x.closePath(); x.fill();
  x.fillStyle = '#27406e'; x.font = 'bold 34px serif'; x.textAlign = 'center';
  x.fillText('E', 48, 114);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function bannerPole() {
  const M = mats();
  if (!_bannerTex) _bannerTex = bannerTexture();
  const g = new THREE.Group();
  const pole = cyl(0.15, 0.15, 9.5, 10, M.wood); pole.position.y = 4.75;
  const finial = cyl(0.22, 0, 0.55, 10, M.gilt); finial.position.y = 9.8;
  const arm = cyl(0.1, 0.1, 2.6, 8, M.wood); arm.rotation.z = Math.PI / 2; arm.position.set(1.1, 9.0, 0);
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(2.3, 5.6),
    new THREE.MeshStandardMaterial({ map: _bannerTex, side: THREE.DoubleSide, roughness: 0.85 }));
  cloth.position.set(1.1, 5.9, 0);
  g.add(pole, finial, arm, cloth);
  return g;
}

// ---- the full approach -------------------------------------------------------
function buildApproach() {
  const M = mats();
  const root = new THREE.Group();
  root.name = 'castle-grand-approach';

  // ===== grand ceremonial flight =====
  // The hero controller keeps a FIXED y, so a real climbable stair is impossible.
  // We instead build the silhouette of a great staircase as a wide stepped MASS:
  // a flat central processional strip (walkable, player stays at y≈0) flanked by
  // bold tiered terraces that rise toward the gate. Each tier is a tall, clearly
  // shadowed riser + a deep tread slab — read at a glance as a monumental flight,
  // while the hero simply strides up the flat central lane between the terraces.
  const stairs = new THREE.Group();
  const fullW = STAIR_HALF_W * 2;
  const LANE_HW = 2.2;                 // half-width of the clear central walking lane
  const flightLen = (N_STEPS - 1) * STEP_DEPTH + STEP_DEPTH;
  const footZ = STAIR_TOP_Z - (N_STEPS - 1) * STEP_DEPTH - STEP_DEPTH / 2;

  for (let i = 0; i < N_STEPS; i++) {
    const z = STAIR_TOP_Z - i * STEP_DEPTH;             // moves toward town
    const topY = STEP_RISE * (N_STEPS - 1 - i);         // this tier's tread height (rises to the gate)
    // central flat processional band for this tread span (thin — the hero walks it)
    const lane = box(LANE_HW * 2, 0.12, STEP_DEPTH + 0.1, M.paving);
    lane.position.set(0, 0.06, z);
    stairs.add(lane);
    // bold flanking tiers on each side of the lane — full-height stone masses
    for (const sx of [-1, 1]) {
      const tierW = STAIR_HALF_W - LANE_HW;
      // solid riser block from ground up to this tier's tread top
      const block = box(tierW, topY + 0.24, STEP_DEPTH + 0.06, M.riser);
      block.position.set(sx * (LANE_HW + tierW / 2), (topY + 0.24) / 2, z);
      stairs.add(block);
      // crisp pale marble nosing capping the leading lip of the tread
      const nosing = box(tierW + 0.12, 0.1, 0.4, M.tread);
      nosing.position.set(sx * (LANE_HW + tierW / 2), topY + 0.2, z - STEP_DEPTH / 2);
      stairs.add(nosing);
      // a thin shadow-catching riser face so each step reads sharply
      const face = box(tierW, STEP_RISE + 0.06, 0.12, M.riser);
      face.position.set(sx * (LANE_HW + tierW / 2), topY + STEP_RISE / 2, z + STEP_DEPTH / 2);
      stairs.add(face);
    }
  }
  // broad rounded landing apron fanning out at the foot of the flight (town side)
  const landing = new THREE.Mesh(
    new THREE.CylinderGeometry(STAIR_HALF_W + 1.8, STAIR_HALF_W + 1.8, 0.16, 36, 1, false, -Math.PI / 2, Math.PI),
    M.tread);
  landing.position.set(0, 0.05, footZ);
  stairs.add(landing);
  root.add(stairs);

  // ===== sculpted balustrades capping the OUTER edge of each terrace =====
  const midZ = STAIR_TOP_Z - (N_STEPS - 1) * STEP_DEPTH / 2;
  const topTierY = STEP_RISE * (N_STEPS - 1);
  for (const sx of [-1, 1]) {
    // a raking rail: sit it atop the terraces, sloped down toward town. We fake
    // the rake with a flat rail at the mean terrace height (reads grand enough).
    const rail = balustrade(flightLen + 0.8, 1.1);
    rail.rotation.y = Math.PI / 2;                       // run along z
    rail.position.set(sx * (STAIR_HALF_W - 0.05), topTierY * 0.5 + 0.1, midZ);
    root.add(rail);
  }

  // ===== grand newel piers with braziers at the head & foot of each rail =====
  const flickers = [];
  for (const sx of [-1, 1]) {
    // head (gate side) — perched on the top terrace
    const head = newelBrazier();
    head.position.set(sx * (STAIR_HALF_W - 0.05), topTierY, STAIR_TOP_Z + 0.5);
    root.add(head); flickers.push(head.userData.__flicker);
    // foot (town side) — on the ground at the apron
    const foot = newelBrazier();
    foot.position.set(sx * (STAIR_HALF_W + 0.2), 0, footZ - 0.3);
    root.add(foot); flickers.push(foot.userData.__flicker);
  }

  // ===== heraldic banners framing the head of the flight (gate side) =====
  for (const sx of [-1, 1]) {
    const bn = bannerPole();
    bn.position.set(sx * (STAIR_HALF_W + 2.6), 0, STAIR_TOP_Z + 1.0);
    bn.rotation.y = sx < 0 ? -Math.PI / 2 : Math.PI / 2;   // arm/cloth face inward over the path
    root.add(bn);
  }

  // ===== paved processional avenue from the stair foot toward the town =====
  // A flagstone carpet centred on x=0 running from the landing down to z≈4,
  // with a darker bordered margin so it reads as a deliberate ceremonial road.
  const aveTopZ = footZ - 1.0;
  const aveBotZ = 4.0;
  const aveLen = aveTopZ - aveBotZ;
  const aveMidZ = (aveTopZ + aveBotZ) / 2;
  const aveW = fullW + 1.2;
  const margin = box(aveW + 1.4, 0.06, aveLen + 1.2, M.pavingDk);
  margin.position.set(0, 0.025, aveMidZ);
  const avenue = box(aveW, 0.08, aveLen, M.paving);
  avenue.position.set(0, 0.05, aveMidZ);
  root.add(margin, avenue);
  // a slim central runner band of pale marble down the avenue's spine
  const runner = box(2.4, 0.02, aveLen, M.tread);
  runner.position.set(0, 0.095, aveMidZ);
  root.add(runner);
  // low kerb posts marching down both edges of the avenue
  const nPosts = Math.max(2, Math.round(aveLen / 4.5));
  for (const sx of [-1, 1]) for (let i = 0; i <= nPosts; i++) {
    const z = aveTopZ - (aveLen / nPosts) * i;
    const kerb = new THREE.Group();
    kerb.add(cyl(0.26, 0.32, 1.1, 10, M.balus).translateY(0.55));   // turned post
    kerb.add(cyl(0.34, 0.26, 0.22, 10, M.cap).translateY(1.18));    // moulded cap
    kerb.position.set(sx * (aveW / 2 + 0.45), 0, z);
    root.add(kerb);
  }

  deco(root);

  // gentle brazier flicker (its own RAF; cheap)
  (function tick() {
    requestAnimationFrame(tick);
    const t = performance.now() * 0.006;
    for (let i = 0; i < flickers.length; i++) {
      const f = flickers[i]; if (!f) continue;
      const s = 0.82 + Math.sin(t + i * 1.7) * 0.12 + Math.sin(t * 2.3 + i) * 0.06;
      f.light.intensity = f.base * s;
      if (f.fire) f.fire.scale.y = 0.92 + (s - 0.82) * 1.4;
    }
  })();

  return root;
}

// ----- self-initialize --------------------------------------------------------
(function boot() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const em = window.eldenmoor;
    const keep = em && em.scene && em.scene.userData.keep;
    if (em && em.player && keep && keep.ground) {
      clearInterval(iv);
      try {
        const approach = buildApproach();
        keep.ground.add(approach);
      } catch (err) {
        console.error('[castleApproach] build failed', err);
      }
    } else if (tries > 800) {
      clearInterval(iv);
    }
  }, 100);
})();
