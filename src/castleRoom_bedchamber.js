// castleRoom_bedchamber.js — furnishes the castle's ground-floor ROYAL BEDCHAMBER
// (front-right courtyard room) into an opulent, cosy king's private chamber.
//
// A basic bed / wardrobe / chest already exist in buildings.js around local
// (x16, z-15..-17). This module ENHANCES the room AROUND them with a grand
// four-poster canopy bed dressing, fur rug + throw, vanity with mirror, fireplace
// with warm glow, washstand, comfy chair, nightstand candle, tapestries and
// framed portraits — without blocking the doorways.
//
// Castle-local space: gate = -z, throne = +z, floor y≈0. Room footprint:
//   x ∈ [11, 21], z ∈ [-21, -12]; walls x=10 (inner) & x=22 (outer),
//   cross-wall near z=-11, back wall z=-22. Inner-wall doorway gaps are at
//   z -18..-15 and z -7..-4 (kept clear).
//
// Self-contained: polls for window.eldenmoor, then builds a THREE.Group added as
// a CHILD of scene.userData.keep.ground so it inherits the floor's visibility.
// All meshes tagged __toonDone (no cel-shade) + noCollide (decoration only).

import * as THREE from '../vendor/three.module.js';

// ---- tiny material/mesh helpers --------------------------------------------
function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85 }, opts));
}
function box(g, w, h, d, m, x, y, z, ry = 0) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z); o.rotation.y = ry;
  o.castShadow = true; o.receiveShadow = true;
  o.userData.__toonDone = true; o.userData.noCollide = true;
  g.add(o); return o;
}
function cyl(g, rt, rb, h, seg, m, x, y, z) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  o.position.set(x, y, z);
  o.castShadow = true; o.receiveShadow = true;
  o.userData.__toonDone = true; o.userData.noCollide = true;
  g.add(o); return o;
}
function sph(g, r, seg, m, x, y, z) {
  const o = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1)), m);
  o.position.set(x, y, z);
  o.castShadow = true; o.receiveShadow = true;
  o.userData.__toonDone = true; o.userData.noCollide = true;
  g.add(o); return o;
}
function plane(g, w, h, m, x, y, z, rx, ry) {
  const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  o.position.set(x, y, z); o.rotation.set(rx || 0, ry || 0, 0);
  o.receiveShadow = true;
  o.userData.__toonDone = true; o.userData.noCollide = true;
  g.add(o); return o;
}

// ---- procedural textures (canvas, tileable-ish) ----------------------------
function furTexture(base, light) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1600; i++) {
    const px = Math.random() * 128, py = Math.random() * 128, len = 2 + Math.random() * 5;
    x.strokeStyle = Math.random() < 0.5 ? light : base;
    x.lineWidth = 0.6 + Math.random() * 0.8;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + (Math.random() - 0.5) * 3, py + len); x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function damaskTexture(bg, fg) {
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 96, 96);
  x.strokeStyle = fg; x.fillStyle = fg; x.lineWidth = 2;
  for (let gy = 0; gy < 96; gy += 48) for (let gx = 0; gx < 96; gx += 48) {
    const cx = gx + 24, cy = gy + 24;
    x.beginPath();
    for (let a = 0; a < Math.PI * 2; a += 0.2) {
      const r = 9 + 4 * Math.sin(a * 4);
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * 1.3;
      a === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.closePath(); x.stroke();
    x.beginPath(); x.arc(cx, cy, 2.4, 0, Math.PI * 2); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function portraitTexture(skin, robe) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 80;
  const x = c.getContext('2d');
  x.fillStyle = '#2a2118'; x.fillRect(0, 0, 64, 80);
  x.fillStyle = robe; x.fillRect(14, 40, 36, 40);            // robe/shoulders
  x.fillStyle = skin; x.beginPath(); x.arc(32, 32, 12, 0, Math.PI * 2); x.fill();  // face
  x.fillStyle = '#4a3a26'; x.fillRect(20, 18, 24, 8);        // hair/crown band
  x.fillStyle = '#d8b24a';                                   // little crown
  for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(20 + i * 8, 18); x.lineTo(24 + i * 8, 10); x.lineTo(28 + i * 8, 18); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function tapestryTexture() {
  const c = document.createElement('canvas'); c.width = 96; c.height = 160;
  const x = c.getContext('2d');
  x.fillStyle = '#3a2d55'; x.fillRect(0, 0, 96, 160);
  x.strokeStyle = '#c7a23e'; x.lineWidth = 6; x.strokeRect(7, 7, 82, 146);
  x.lineWidth = 2; x.strokeRect(15, 15, 66, 130);
  // central rampant lion motif (stylised)
  x.fillStyle = '#c7a23e';
  x.beginPath(); x.ellipse(48, 80, 16, 28, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#3a2d55'; x.beginPath(); x.ellipse(48, 80, 9, 20, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#c7a23e';
  for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(48, 36 + i * 32, 4, 0, Math.PI * 2); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---- the build -------------------------------------------------------------
function build(ground) {
  const g = new THREE.Group(); g.name = 'royal-bedchamber';

  // palette
  const oak = mat(0x4a3320, { roughness: 0.7 });
  const darkOak = mat(0x352414, { roughness: 0.75 });
  const gilt = mat(0xd8b24a, { metalness: 0.45, roughness: 0.4 });
  const royalRed = mat(0x7e1322, { roughness: 0.88 });
  const deepRed = mat(0x5a0f1b, { roughness: 0.9 });
  const cream = mat(0xece0c0, { roughness: 0.85 });
  const stone = mat(0x6f6a62, { roughness: 0.95 });
  const darkStone = mat(0x4a463f, { roughness: 0.95 });
  const ember = mat(0xff6a1e, { emissive: 0xff4400, emissiveIntensity: 1.3, roughness: 0.7 });
  const candleMat = mat(0xffe6a3, { emissive: 0xffcf6a, emissiveIntensity: 1.7, roughness: 0.5 });
  const glass = mat(0xbcd6e0, { metalness: 0.4, roughness: 0.15 });
  const porcelain = mat(0xf2efe6, { roughness: 0.4 });
  const damaskMat = new THREE.MeshStandardMaterial({ map: damaskTexture('#7e1322', '#caa23e'), roughness: 0.9 });
  const damaskMat2 = damaskMat.clone(); damaskMat2.map = damaskMat.map; damaskMat2.map.repeat.set(1, 1);
  const furMat = new THREE.MeshStandardMaterial({ map: furTexture('#e6e2d4', '#ffffff'), roughness: 1.0 });
  const tapMat = new THREE.MeshStandardMaterial({ map: tapestryTexture(), side: THREE.DoubleSide, roughness: 0.92 });

  // ============================================================
  // GRAND FOUR-POSTER CANOPY BED — built around existing bed at (16, *, -17)
  // existing: frame 3.2x0.7x4.2 @y0.35, blanket @y0.75, pillows @-18.7, posts to y2.6
  // We add: turned/gilded posts, a full pelmet canopy, side drapes, fur throw,
  // extra plump pillows, a headboard, and a footboard — making it regal.
  // ============================================================
  const BX = 16, BZ = -17;       // bed centre
  const HEADZ = BZ - 2.1;        // head end (toward back wall)
  const FOOTZ = BZ + 2.1;        // foot end (toward gate)

  // tall carved headboard
  box(g, 3.4, 1.9, 0.22, oak, BX, 1.35, HEADZ - 0.05);
  box(g, 3.0, 1.4, 0.1, damaskMat, BX, 1.45, HEADZ + 0.06);          // padded panel
  cyl(g, 0.18, 0.18, 2.2, 14, gilt, BX - 1.6, 1.5, HEADZ - 0.05);    // gilt corner
  cyl(g, 0.18, 0.18, 2.2, 14, gilt, BX + 1.6, 1.5, HEADZ - 0.05);
  sph(g, 0.22, 14, gilt, BX - 1.6, 2.7, HEADZ - 0.05);
  sph(g, 0.22, 14, gilt, BX + 1.6, 2.7, HEADZ - 0.05);
  // low footboard
  box(g, 3.4, 0.7, 0.2, oak, BX, 0.85, FOOTZ + 0.1);
  box(g, 3.0, 0.4, 0.08, gilt, BX, 1.0, FOOTZ + 0.18);

  // four turned, gilded posts (taller than the basic ones, capped with finials)
  const POSTH = 3.4;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const px = BX + sx * 1.5, pz = BZ + sz * 2.0;
    cyl(g, 0.13, 0.16, POSTH, 12, oak, px, POSTH / 2 + 0.3, pz);
    cyl(g, 0.17, 0.17, 0.25, 12, gilt, px, 0.5, pz);                 // gilt base ring
    cyl(g, 0.15, 0.1, 0.4, 12, gilt, px, POSTH + 0.35, pz);         // gilt cap
    sph(g, 0.16, 12, gilt, px, POSTH + 0.65, pz);                    // finial orb
  }

  // canopy frame (rails between post tops) + a rich pelmet skirt
  const CY = POSTH + 0.35;
  for (const sx of [-1, 1]) box(g, 0.12, 0.12, 4.3, gilt, BX + sx * 1.5, CY, BZ);   // side rails
  for (const sz of [-1, 1]) box(g, 3.2, 0.12, 0.12, gilt, BX, CY, BZ + sz * 2.05);  // end rails
  // canopy roof cloth (slightly domed look via two stepped boxes)
  box(g, 3.4, 0.18, 4.5, deepRed, BX, CY + 0.25, BZ);
  box(g, 3.0, 0.16, 4.1, royalRed, BX, CY + 0.42, BZ);
  // pelmet / valance hanging from the rails (gilt-trimmed damask)
  for (const sz of [-1, 1]) {
    box(g, 3.5, 0.55, 0.06, damaskMat, BX, CY - 0.2, BZ + sz * 2.1);
    box(g, 3.5, 0.1, 0.07, gilt, BX, CY - 0.45, BZ + sz * 2.1);
  }
  for (const sx of [-1, 1]) {
    box(g, 0.06, 0.55, 4.4, damaskMat, BX + sx * 1.55, CY - 0.2, BZ);
    box(g, 0.07, 0.1, 4.4, gilt, BX + sx * 1.55, CY - 0.45, BZ);
  }
  // tied-back side drapes flowing down the head posts
  for (const sx of [-1, 1]) {
    const dr = box(g, 0.12, 2.6, 0.9, damaskMat, BX + sx * 1.55, CY - 1.6, HEADZ + 0.3);
    dr.scale.z = 1.0;
    box(g, 0.2, 0.18, 1.0, gilt, BX + sx * 1.55, CY - 1.9, HEADZ + 0.3);   // gold tieback
  }

  // plush bedding on top of the existing blanket: a royal coverlet + fur throw
  box(g, 3.0, 0.22, 4.0, royalRed, BX, 1.0, BZ);                 // smooth coverlet
  box(g, 3.04, 0.06, 0.5, gilt, BX, 1.12, FOOTZ - 0.2);          // gold hem near foot
  // folded white fur throw across the foot of the bed
  box(g, 3.1, 0.28, 1.3, furMat, BX, 1.12, FOOTZ - 0.3);
  // a stack of plump pillows at the head (beyond the existing cream pillows)
  box(g, 1.3, 0.34, 0.7, cream, BX - 0.75, 1.25, HEADZ + 0.55);
  box(g, 1.3, 0.34, 0.7, cream, BX + 0.75, 1.25, HEADZ + 0.55);
  box(g, 1.4, 0.3, 0.6, royalRed, BX, 1.55, HEADZ + 0.5);        // small accent cushion
  box(g, 0.5, 0.32, 0.5, gilt, BX, 1.55, HEADZ + 0.5);           // tasselled centre

  // ============================================================
  // FUR RUG beside the bed (between bed and outer wall) — lozenge of fur
  // ============================================================
  plane(g, 3.4, 2.4, furMat, 19.4, 0.13, -17, -Math.PI / 2, 0);

  // ============================================================
  // FIREPLACE with mantel + warm glow — on the OUTER wall (x≈22), clear of bed
  // placed toward the back of the room (z≈-20)
  // ============================================================
  const FPX = 21.6, FPZ = -20;
  box(g, 0.7, 3.2, 3.4, stone, FPX, 1.6, FPZ);                   // chimney breast
  box(g, 0.4, 1.7, 2.2, darkStone, FPX - 0.25, 1.0, FPZ);       // firebox recess (dark)
  box(g, 0.45, 0.8, 1.9, ember, FPX - 0.32, 0.55, FPZ);         // glowing embers/logs
  cyl(g, 0.12, 0.12, 1.9, 8, oak, FPX - 0.38, 0.5, FPZ);        // a log (rotated below)
  g.children[g.children.length - 1].rotation.x = Math.PI / 2;
  // carved stone mantel + gilt trim
  box(g, 0.9, 0.28, 3.0, stone, FPX - 0.1, 2.05, FPZ);
  box(g, 0.92, 0.08, 3.0, gilt, FPX - 0.1, 2.23, FPZ);
  // chimney hood tapering up
  box(g, 0.6, 0.9, 1.4, stone, FPX, 2.75, FPZ);
  // mantel ornaments: a pair of candlesticks + a clock-ish gilt urn
  for (const sz of [-1, 1]) { cyl(g, 0.08, 0.1, 0.32, 8, gilt, FPX - 0.2, 2.35, FPZ + sz * 1.1); box(g, 0.12, 0.26, 0.12, candleMat, FPX - 0.2, 2.6, FPZ + sz * 1.1); }
  cyl(g, 0.22, 0.28, 0.4, 12, gilt, FPX - 0.2, 2.4, FPZ);       // centre urn
  sph(g, 0.16, 12, gilt, FPX - 0.2, 2.68, FPZ);
  // warm point light (the ONE PointLight) from the hearth
  const fire = new THREE.PointLight(0xff8a3a, 6.0, 16, 2);
  fire.position.set(FPX - 1.0, 1.1, FPZ);
  fire.castShadow = false;
  g.add(fire);
  // fire flicker
  const baseI = 6.0;
  fire.userData.__flicker = 0;

  // ============================================================
  // VANITY / DRESSING TABLE with MIRROR + trinkets — back wall (z≈-21.4)
  // ============================================================
  const VX = 13.5, VZ = -21.2;
  box(g, 2.0, 0.85, 0.7, oak, VX, 0.45, VZ);                     // table body
  box(g, 2.1, 0.1, 0.78, darkOak, VX, 0.9, VZ);                 // table top
  for (const sx of [-1, 1]) cyl(g, 0.06, 0.08, 0.85, 8, oak, VX + sx * 0.85, 0.42, VZ + 0.25);  // front legs
  // ornate framed oval mirror standing on the table, against the back wall,
  // its reflective face turned into the room (+z toward the gate side)
  const mirror = new THREE.Mesh(new THREE.CircleGeometry(0.78, 28), glass);
  mirror.position.set(VX, 1.95, VZ - 0.3); mirror.userData.__toonDone = true; mirror.userData.noCollide = true; g.add(mirror);
  // gilt oval frame (torus, squashed to an oval)
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.09, 10, 28), gilt);
  frame.position.set(VX, 1.95, VZ - 0.28); frame.scale.y = 1.15;
  frame.userData.__toonDone = true; frame.userData.noCollide = true; frame.castShadow = true; g.add(frame);
  sph(g, 0.12, 10, gilt, VX, 2.95, VZ - 0.28);                  // crest finial
  // trinkets on the vanity top
  cyl(g, 0.07, 0.09, 0.18, 8, gilt, VX - 0.6, 1.04, VZ);        // perfume bottle
  sph(g, 0.06, 8, glass, VX - 0.6, 1.18, VZ);
  box(g, 0.34, 0.16, 0.24, royalRed, VX + 0.55, 1.03, VZ);      // jewellery box
  box(g, 0.36, 0.04, 0.26, gilt, VX + 0.55, 1.13, VZ);
  sph(g, 0.05, 8, gilt, VX + 0.2, 0.99, VZ + 0.18);            // stray ring/coin
  // padded vanity stool
  cyl(g, 0.32, 0.32, 0.12, 14, royalRed, VX, 0.55, VZ + 1.0);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; cyl(g, 0.04, 0.04, 0.5, 6, oak, VX + Math.cos(a) * 0.22, 0.25, VZ + 1.0 + Math.sin(a) * 0.22); }

  // ============================================================
  // WASHSTAND with basin + ewer — near the back, between vanity & fireplace
  // ============================================================
  const WX = 17.5, WZ = -21.0;
  box(g, 0.9, 0.95, 0.7, oak, WX, 0.48, WZ);                     // stand
  box(g, 0.95, 0.08, 0.75, darkOak, WX, 0.96, WZ);
  cyl(g, 0.33, 0.26, 0.16, 16, porcelain, WX, 1.06, WZ);        // basin
  cyl(g, 0.27, 0.2, 0.1, 16, glass, WX, 1.08, WZ);              // water
  // ewer (jug) beside the basin
  cyl(g, 0.13, 0.17, 0.34, 12, porcelain, WX + 0.32, 1.2, WZ - 0.05);
  cyl(g, 0.06, 0.1, 0.12, 10, porcelain, WX + 0.32, 1.43, WZ - 0.05);  // neck
  const folded = box(g, 0.45, 0.06, 0.3, cream, WX - 0.28, 1.03, WZ + 0.15);  // folded towel

  // ============================================================
  // NIGHTSTAND CANDLE — enhance the existing side table at (13.2, *, -14)
  // add a taller candelabrum + a book
  // ============================================================
  const NX = 13.0, NZ = -14.0;
  cyl(g, 0.06, 0.08, 0.5, 8, gilt, NX, 1.1, NZ);                // candle stand stem
  cyl(g, 0.14, 0.18, 0.06, 10, gilt, NX, 0.86, NZ);            // base
  box(g, 0.12, 0.3, 0.12, candleMat, NX, 1.45, NZ);            // candle
  sph(g, 0.07, 8, ember, NX, 1.62, NZ);                        // flame glow
  box(g, 0.34, 0.1, 0.26, deepRed, NX - 0.28, 0.95, NZ + 0.1); // a book
  box(g, 0.32, 0.04, 0.24, cream, NX - 0.28, 1.02, NZ + 0.1);  // pages

  // ============================================================
  // COMFY CHAIR by the fireplace — facing the hearth
  // ============================================================
  const CHX = 18.5, CHZ = -18.0;
  box(g, 1.1, 0.5, 1.1, oak, CHX, 0.35, CHZ);                  // seat base
  box(g, 1.0, 0.3, 1.0, royalRed, CHX, 0.62, CHZ);            // seat cushion
  box(g, 1.1, 1.4, 0.22, oak, CHX, 1.05, CHZ - 0.45);        // tall back
  box(g, 0.9, 1.1, 0.16, damaskMat, CHX, 1.1, CHZ - 0.34);   // padded back
  for (const sx of [-1, 1]) box(g, 0.2, 0.6, 1.0, oak, CHX + sx * 0.55, 0.7, CHZ);  // armrests
  sph(g, 0.1, 10, gilt, CHX - 0.55, 1.05, CHZ + 0.45);       // arm finials
  sph(g, 0.1, 10, gilt, CHX + 0.55, 1.05, CHZ + 0.45);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, 0.06, 0.06, 0.35, 8, oak, CHX + sx * 0.45, 0.18, CHZ + sz * 0.45);  // legs
  // a small footstool + draped throw on the chair
  box(g, 0.7, 0.3, 0.5, oak, CHX, 0.15, CHZ + 0.9);
  box(g, 0.72, 0.12, 0.52, furMat, CHX, 0.34, CHZ + 0.9);
  box(g, 0.7, 0.5, 0.12, royalRed, CHX - 0.15, 0.85, CHZ + 0.1);  // throw over arm

  // ============================================================
  // WARDROBE dressing — enhance the existing wardrobe at (21, *, -13)
  // add gilt panel trim, handles, and a little crown crest
  // ============================================================
  const WDX = 21.0, WDZ = -13.0;
  for (const sx of [-1, 1]) box(g, 0.06, 2.0, 0.36, gilt, WDX + sx * 0.5, 1.4, WDZ + 0.46);  // door trim
  box(g, 1.7, 0.06, 0.36, gilt, WDX, 0.5, WDZ + 0.46);        // bottom rail
  box(g, 1.7, 0.06, 0.36, gilt, WDX, 2.3, WDZ + 0.46);       // top rail
  sph(g, 0.06, 8, gilt, WDX - 0.12, 1.4, WDZ + 0.48);        // handles
  sph(g, 0.06, 8, gilt, WDX + 0.12, 1.4, WDZ + 0.48);
  box(g, 1.4, 0.4, 0.12, oak, WDX, 2.85, WDZ);              // pediment crown
  for (let i = 0; i < 3; i++) box(g, 0.16, 0.22, 0.16, gilt, WDX - 0.4 + i * 0.4, 3.1, WDZ);  // crown points

  // ============================================================
  // CHEST dressing — enhance the existing foot-of-bed chest at (12, *, -20)
  // add iron straps + a small lock; also a coiled fur/rug nearby
  // ============================================================
  const CTX = 12.0, CTZ = -20.0;
  for (const sx of [-1, 1]) box(g, 0.06, 0.85, 0.86, darkStone, CTX + sx * 0.5, 0.45, CTZ);  // iron straps
  box(g, 1.25, 0.06, 0.9, darkStone, CTX, 0.5, CTZ);          // top strap
  box(g, 0.18, 0.18, 0.1, gilt, CTX, 0.55, CTZ + 0.46);      // lock plate

  // ============================================================
  // WALL ART — a tapestry on the back wall + framed portraits on inner wall
  // ============================================================
  // tapestry on back wall (z≈-21.7), centred between vanity & fireplace gap
  const tap = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.8), tapMat);
  tap.position.set(15.7, 2.7, -21.7); tap.userData.__toonDone = true; tap.userData.noCollide = true; g.add(tap);
  box(g, 1.9, 0.14, 0.1, oak, 15.7, 4.2, -21.7);             // tapestry rod
  cyl(g, 0.08, 0.08, 0.16, 8, gilt, 15.7 - 0.98, 4.2, -21.7); g.children[g.children.length - 1].rotation.z = Math.PI / 2;
  cyl(g, 0.08, 0.08, 0.16, 8, gilt, 15.7 + 0.98, 4.2, -21.7); g.children[g.children.length - 1].rotation.z = Math.PI / 2;

  // framed portraits on the inner wall (x≈10.4), facing into the room (+x)
  const pmats = [
    new THREE.MeshStandardMaterial({ map: portraitTexture('#d9b48f', '#7e1322'), roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ map: portraitTexture('#e0c2a0', '#2a3f72'), roughness: 0.85 }),
  ];
  const pzs = [-19, -13.5];
  for (let i = 0; i < 2; i++) {
    const fx = 10.45;
    box(g, 0.12, 1.5, 1.15, gilt, fx, 2.6, pzs[i]);          // gilt frame
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.3), pmats[i]);
    pic.position.set(fx + 0.07, 2.6, pzs[i]); pic.rotation.y = Math.PI / 2;
    pic.userData.__toonDone = true; pic.userData.noCollide = true; g.add(pic);
  }

  // ============================================================
  // WALL SCONCES for ambience (no extra lights — fireplace is the only one)
  // small flame meshes (emissive) on the inner & back walls
  // ============================================================
  const sconce = (x, z, ry) => {
    cyl(g, 0.06, 0.08, 0.3, 8, gilt, x, 2.7, z);
    sph(g, 0.12, 8, ember, x, 2.95, z);
  };
  sconce(10.55, -16.5); sconce(10.55, -12.5);

  ground.add(g);

  // gentle hearth flicker animation, hooked into the render loop if available
  let t0 = performance.now();
  function tick() {
    const t = performance.now() * 0.004;
    fire.intensity = baseI + Math.sin(t) * 0.6 + Math.sin(t * 2.3) * 0.35;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return g;
}

// ---- boot ------------------------------------------------------------------
(function boot() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const em = window.eldenmoor;
    const ground = em && em.scene && em.scene.userData.keep && em.scene.userData.keep.ground;
    if (ground) {
      clearInterval(iv);
      try { build(ground); }
      catch (err) { console.error('[castleRoom_bedchamber] failed', err); }
    } else if (tries > 800) {
      clearInterval(iv);
    }
  }, 100);
})();
