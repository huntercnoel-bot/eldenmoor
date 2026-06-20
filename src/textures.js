// textures.js — procedurally-drawn textures (no image files needed). Each is
// painted onto a <canvas> and uploaded as a THREE texture, giving surfaces real
// grain and depth instead of flat colours.

import * as THREE from '../vendor/three.module.js';

function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }
function finish(canvas, rep) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (rep) t.repeat.set(rep, rep);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function grassTexture(rep = 55) {
  const c = cv(128), g = c.getContext('2d');
  g.fillStyle = '#5f7a33'; g.fillRect(0, 0, 128, 128);                 // RuneScape-green turf
  for (let i = 0; i < 90; i++) {                                       // soft mottling for gentle variation
    const v = Math.random();
    g.fillStyle = `rgba(${(74 + v * 38) | 0},${(104 + v * 44) | 0},${(48 + v * 30) | 0},0.14)`;
    g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, 4 + Math.random() * 9, 0, 7); g.fill();
  }
  for (let i = 0; i < 1700; i++) {                                     // fine upright grass blades
    const v = Math.random(), x = Math.random() * 128, y = Math.random() * 128;
    g.strokeStyle = `rgba(${(66 + v * 58) | 0},${(98 + v * 62) | 0},${(44 + v * 36) | 0},0.5)`;
    g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 2, y - (2 + Math.random() * 3)); g.stroke();
  }
  return finish(c, rep);
}

export function dirtTexture(rep = 6) {
  const c = cv(128), g = c.getContext('2d');
  g.fillStyle = '#7c6336'; g.fillRect(0, 0, 128, 128);                 // packed earth
  for (let i = 0; i < 40; i++) {                                       // worn, trodden patches
    g.fillStyle = `rgba(70,55,30,${(0.06 + Math.random() * 0.08).toFixed(2)})`;
    g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, 6 + Math.random() * 16, 0, 7); g.fill();
  }
  for (let i = 0; i < 1800; i++) {                                     // earthy grain
    const v = Math.random();
    g.fillStyle = `rgba(${(108 + v * 46) | 0},${(86 + v * 36) | 0},${(52 + v * 28) | 0},0.45)`;
    g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, Math.random() * 2, 0, 7); g.fill();
  }
  for (let i = 0; i < 60; i++) {                                       // scattered pebbles
    const s = 1.4 + Math.random() * 2.2, gy = 120 + Math.random() * 40;
    g.fillStyle = `rgb(${gy | 0},${(gy - 6) | 0},${(gy - 16) | 0})`;
    g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, s, 0, 7); g.fill();
  }
  return finish(c, rep);
}

export function barkTexture() {
  const c = cv(64), g = c.getContext('2d');
  g.fillStyle = '#5e3f27'; g.fillRect(0, 0, 64, 64);
  for (let x = 0; x < 64; x += 4) {                                    // vertical bark staves
    const v = 58 + Math.random() * 40;
    g.fillStyle = `rgb(${v | 0},${(v * 0.66) | 0},${(v * 0.4) | 0})`;
    g.fillRect(x, 0, 3, 64);
  }
  for (let i = 0; i < 24; i++) {                                       // deep grooves between the staves
    const x = Math.random() * 64;
    g.strokeStyle = 'rgba(28,16,8,0.5)'; g.lineWidth = 1 + Math.random() * 1.5;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (Math.random() - 0.5) * 5, 64); g.stroke();
  }
  for (let i = 0; i < 12; i++) {                                       // catch-light ridges
    const x = Math.random() * 64;
    g.strokeStyle = 'rgba(150,112,72,0.22)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (Math.random() - 0.5) * 4, 64); g.stroke();
  }
  const t = finish(c); t.repeat.set(2, 2); return t;
}

// RuneScape-style ashlar masonry: chunky running-bond blocks, each a slightly
// different shade, with carved bevels (light top/left, dark bottom/right) and
// dark recessed mortar. Block tones come from a wrapped lattice hash so the
// pattern tiles seamlessly even on the half-offset courses. `opts` swaps the
// palette: warm Lumbridge sandstone vs. cool Varrock/Falador grey.
function ashlarTexture(rep, opts = {}) {
  const mortar = opts.mortar || '#544f47';
  const base = opts.base ?? 138, span = opts.span ?? 44;
  const tint = opts.tint || ((v) => [v + 13, v + 4, v - 11]);      // warm sandstone
  const S = 256, c = cv(S), g = c.getContext('2d');
  g.fillStyle = mortar; g.fillRect(0, 0, S, S);                    // dark mortar shows in the gaps
  const bw = 64, bh = 32, gap = 3, COLS = S / bw, ROWS = S / bh;  // tiles cleanly (4 x 8 blocks)
  const hash = (a, b) => { let h = ((a * 73856093) ^ (b * 19349663)) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return (h % 1000) / 1000; };
  for (let row = 0; row < ROWS; row++) {
    const y = row * bh, off = (row % 2) ? -bw / 2 : 0;
    for (let x = off - bw; x < S; x += bw) {
      const col = ((Math.round((x - off) / bw) % COLS) + COLS) % COLS;  // wrapped so seam blocks match
      const [r, gg, b] = tint(base + hash(col, row) * span);           // per-block tone
      const bx = x + gap, by = y + gap, w = bw - gap * 2, h = bh - gap * 2;
      g.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`;
      g.fillRect(bx, by, w, h);
      g.fillStyle = 'rgba(255,248,232,0.22)'; g.fillRect(bx, by, w, 2); g.fillRect(bx, by, 2, h);                  // carved highlight
      g.fillStyle = 'rgba(26,22,17,0.34)';    g.fillRect(bx, by + h - 2, w, 2); g.fillRect(bx + w - 2, by, 2, h);  // carved shadow
      for (let s = 0; s < 16; s++) {                                       // weathering speckle (deterministic = tileable)
        g.fillStyle = `rgba(70,62,50,${(0.10 + hash(col * 31 + s, row * 17) * 0.10).toFixed(2)})`;
        g.fillRect(bx + hash(s, col + row) * w, by + hash(s + 9, row) * h, 2, 2);
      }
    }
  }
  return finish(c, rep);
}

export function stoneTexture(rep = 2) { return ashlarTexture(rep); }   // warm Lumbridge sandstone

// Cool grey ashlar for the Varrock / Falador keep — bluish-grey blocks, cold mortar.
export function greyStoneTexture(rep = 2) {
  return ashlarTexture(rep, { mortar: '#41444a', base: 150, span: 40, tint: (v) => [v - 4, v - 1, v + 7] });
}

export function plasterTexture() {
  const c = cv(64), g = c.getContext('2d');
  g.fillStyle = '#e3d4ae'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 30; i++) {                                       // soft daub mottling
    g.fillStyle = `rgba(${(190 + Math.random() * 30) | 0},${(172 + Math.random() * 26) | 0},${(138 + Math.random() * 26) | 0},0.25)`;
    g.beginPath(); g.arc(Math.random() * 64, Math.random() * 64, 3 + Math.random() * 7, 0, 7); g.fill();
  }
  for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(${(205 + Math.random() * 30) | 0},${(188 + Math.random() * 25) | 0},${(152 + Math.random() * 25) | 0},0.4)`; g.fillRect(Math.random() * 64, Math.random() * 64, 2, 2); }
  g.strokeStyle = 'rgba(120,100,70,0.18)'; g.lineWidth = 1;            // hairline cracks
  for (let i = 0; i < 4; i++) { let x = Math.random() * 64, y = Math.random() * 64; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 3; k++) { x += (Math.random() - 0.5) * 14; y += (Math.random() - 0.5) * 14; g.lineTo(x, y); } g.stroke(); }
  return finish(c, 1);
}

// Roof tiles — neutral grey running-bond slate (a material's `color` tints it
// any roof hue). Crisp, slightly varied tiles with a top highlight read more
// like RuneScape slate roofing.
export function shingleTexture(rep = 4) {
  const c = cv(64), g = c.getContext('2d');
  g.fillStyle = '#7e7e7e'; g.fillRect(0, 0, 64, 64);
  const tw = 16, th = 10;
  for (let y = 0, row = 0; y < 64; y += th, row++) {
    const off = (row % 2) ? tw / 2 : 0;
    for (let x = off - tw; x < 64; x += tw) {
      const v = 150 + Math.random() * 46;
      g.fillStyle = `rgb(${v | 0},${v | 0},${(v + 5) | 0})`;
      g.fillRect(x + 1, y, tw - 2, th - 1);
      g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(x + 1, y, tw - 2, 1);          // top highlight
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1; g.strokeRect(x + 1, y, tw - 2, th - 1);
    }
  }
  return finish(c, rep);
}

// Wooden plank flooring.
export function woodFloorTexture(rep = 5) {
  const c = cv(128), g = c.getContext('2d');
  g.fillStyle = '#6b4a2c'; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 16) {
    g.fillStyle = `rgb(${(90 + Math.random() * 40) | 0},${(64 + Math.random() * 30) | 0},${(36 + Math.random() * 22) | 0})`;
    g.fillRect(0, y, 128, 15);
    g.strokeStyle = 'rgba(28,16,6,0.6)'; g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke();
    for (let i = 0; i < 26; i++) { g.strokeStyle = 'rgba(40,26,12,0.18)'; const xx = Math.random() * 128; g.beginPath(); g.moveTo(xx, y); g.lineTo(xx, y + 15); g.stroke(); }
  }
  return finish(c, rep);
}

// Pale veined marble for the throne room.
export function marbleTexture(rep = 3) {
  const c = cv(128), g = c.getContext('2d');
  g.fillStyle = '#e2dfe6'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 16; i++) {
    g.strokeStyle = `rgba(${(150 + Math.random() * 40) | 0},${(150 + Math.random() * 40) | 0},${(168 + Math.random() * 40) | 0},0.5)`;
    g.lineWidth = 0.5 + Math.random() * 1.5;
    let x = Math.random() * 128, y = 0; g.beginPath(); g.moveTo(x, y);
    while (y < 128) { x += (Math.random() - 0.5) * 22; y += 9; g.lineTo(x, y); } g.stroke();
  }
  for (let yy = 0; yy < 128; yy += 64) for (let xx = 0; xx < 128; xx += 64) {
    if (((xx + yy) / 64) % 2) { g.fillStyle = 'rgba(120,120,140,0.10)'; g.fillRect(xx, yy, 64, 64); }
  }
  return finish(c, rep);
}

// A hanging tapestry: a coloured field with a gold border and a central emblem.
export function tapestryTexture(field = '#6e1f2f', border = '#c9a24a') {
  const c = cv(64, 96), g = c.getContext('2d');
  g.fillStyle = field; g.fillRect(0, 0, 64, 96);
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; g.fillRect(Math.random() * 64, Math.random() * 96, 1, 2); }
  g.strokeStyle = border; g.lineWidth = 4; g.strokeRect(6, 6, 52, 84);
  g.lineWidth = 1.5; g.strokeRect(11, 11, 42, 74);
  g.fillStyle = border; g.beginPath(); g.moveTo(32, 30); g.lineTo(45, 48); g.lineTo(32, 66); g.lineTo(19, 48); g.closePath(); g.fill();
  g.fillStyle = field; g.beginPath(); g.moveTo(32, 39); g.lineTo(40, 48); g.lineTo(32, 57); g.lineTo(24, 48); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// A royal runner carpet: red field, gold side borders, a repeating motif (tiles along its length).
export function carpetTexture(rep = 6) {
  const c = cv(64), g = c.getContext('2d');
  g.fillStyle = '#7a1f2a'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.1})`; g.fillRect(Math.random() * 64, Math.random() * 64, 1, 2); }
  g.fillStyle = '#c9a24a'; g.fillRect(0, 0, 5, 64); g.fillRect(59, 0, 5, 64);
  g.fillStyle = '#5e1620'; g.fillRect(7, 0, 2, 64); g.fillRect(55, 0, 2, 64);
  g.strokeStyle = '#c9a24a'; g.lineWidth = 1.5;
  for (let y = 8; y < 64; y += 20) { g.beginPath(); g.moveTo(26, y); g.lineTo(32, y + 8); g.lineTo(38, y); g.lineTo(32, y - 8); g.closePath(); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, rep); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// Gothic stained-glass window — lead grid + coloured panes + a central rose (Stormwind cathedral).
export function stainedGlassTexture() {
  const c = cv(64, 96), g = c.getContext('2d');
  const cols = ['#c0392b', '#2980b9', '#27ae60', '#d4ac0d', '#8e44ad', '#e67e22'];
  g.fillStyle = '#15110c'; g.fillRect(0, 0, 64, 96);
  for (let y = 4, i = 0; y < 92; y += 14) for (let x = 4; x < 60; x += 14, i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(x, y, 12, 12); }
  g.fillStyle = '#f4d35e'; g.beginPath(); g.arc(32, 42, 10, 0, 7); g.fill();
  g.fillStyle = '#c0392b'; g.beginPath(); g.arc(32, 42, 4.5, 0, 7); g.fill();
  g.strokeStyle = '#0c0a07'; g.lineWidth = 2;
  for (let y = 4; y <= 92; y += 14) { g.beginPath(); g.moveTo(2, y); g.lineTo(62, y); g.stroke(); }
  for (let x = 4; x <= 60; x += 14) { g.beginPath(); g.moveTo(x, 2); g.lineTo(x, 94); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// A bookshelf — rows of coloured book spines.
export function bookshelfTexture() {
  const c = cv(64), g = c.getContext('2d');
  g.fillStyle = '#3a2415'; g.fillRect(0, 0, 64, 64);
  const cols = ['#7a2f2f', '#2f4f7a', '#2f7a4f', '#7a6a2f', '#5a2f6a', '#7a4a2f', '#444'];
  for (let shelf = 0; shelf < 4; shelf++) {
    const yb = shelf * 16 + 14;
    g.fillStyle = '#26160c'; g.fillRect(0, yb, 64, 2);
    let x = 2;
    while (x < 61) { const w = 3 + Math.random() * 4, h = 9 + Math.random() * 4; g.fillStyle = cols[(Math.random() * cols.length) | 0]; g.fillRect(x, yb - h, w, h); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, yb - h, 1, h); x += w + 1; }
  }
  return finish(c, 1);
}

// A heraldic banner — coloured field, gold trim, a shield with an upright sword (Stormwind-ish).
export function heraldryBannerTexture(field = '#27406e') {
  const c = cv(48, 80), g = c.getContext('2d');
  g.fillStyle = field; g.fillRect(0, 0, 48, 80);
  g.strokeStyle = '#d4ac0d'; g.lineWidth = 3; g.strokeRect(4, 4, 40, 72);
  g.fillStyle = '#d4ac0d'; g.beginPath(); g.moveTo(24, 20); g.lineTo(36, 26); g.lineTo(34, 50); g.lineTo(24, 60); g.lineTo(14, 50); g.lineTo(12, 26); g.closePath(); g.fill();
  g.fillStyle = field; g.beginPath(); g.moveTo(24, 24); g.lineTo(33, 29); g.lineTo(31, 48); g.lineTo(24, 56); g.lineTo(17, 48); g.lineTo(15, 29); g.closePath(); g.fill();
  g.fillStyle = '#e8e8ec'; g.fillRect(23, 28, 2, 18); g.fillStyle = '#d4ac0d'; g.fillRect(19, 43, 10, 2); g.fillRect(23, 45, 2, 5);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// Vertical wood paneling with a mid rail.
export function woodPanelTexture(rep = 2) {
  const c = cv(64), g = c.getContext('2d');
  g.fillStyle = '#5a3a22'; g.fillRect(0, 0, 64, 64);
  for (let x = 0; x < 64; x += 8) { g.fillStyle = `rgb(${(90 + Math.random() * 30) | 0},${(58 + Math.random() * 22) | 0},${(34 + Math.random() * 16) | 0})`; g.fillRect(x, 0, 7, 64); g.strokeStyle = 'rgba(20,12,6,0.5)'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 64); g.stroke(); }
  g.fillStyle = '#3a2415'; g.fillRect(0, 28, 64, 5);
  return finish(c, rep);
}

// Ornate tiled floor — checker with gold diamond inlays.
export function tiledFloorTexture(rep = 4) {
  const c = cv(64), g = c.getContext('2d');
  for (let y = 0; y < 64; y += 16) for (let x = 0; x < 64; x += 16) { g.fillStyle = ((x + y) / 16) % 2 ? '#cfc8bb' : '#8f897d'; g.fillRect(x, y, 16, 16); g.strokeStyle = 'rgba(40,38,34,0.4)'; g.strokeRect(x, y, 16, 16); }
  g.fillStyle = '#b9892f'; for (let y = 8; y < 64; y += 16) for (let x = 8; x < 64; x += 16) { g.beginPath(); g.moveTo(x, y - 3); g.lineTo(x + 3, y); g.lineTo(x, y + 3); g.lineTo(x - 3, y); g.closePath(); g.fill(); }
  return finish(c, rep);
}

// An ornate rug — deep field, gold border, central medallion.
export function rugTexture() {
  const c = cv(64), g = c.getContext('2d');
  g.fillStyle = '#3a2a5a'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#c9a24a'; g.lineWidth = 3; g.strokeRect(5, 5, 54, 54); g.lineWidth = 1; g.strokeRect(9, 9, 46, 46);
  g.fillStyle = '#c9a24a'; g.beginPath(); g.arc(32, 32, 10, 0, 7); g.fill();
  g.fillStyle = '#3a2a5a'; g.beginPath(); g.arc(32, 32, 6, 0, 7); g.fill();
  g.fillStyle = '#c9a24a'; g.beginPath(); g.arc(32, 32, 2.5, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// A wooden sign board with text (used for room signage so you know where you are).
export function signTexture(text, bg = '#6b4a2c') {
  const c = cv(128, 48), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 128, 48);
  g.strokeStyle = 'rgba(20,12,6,0.4)'; for (let x = 0; x < 128; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 48); g.stroke(); }
  g.fillStyle = '#3a2415'; g.fillRect(0, 0, 128, 4); g.fillRect(0, 44, 128, 4);
  g.fillStyle = '#f2e3c0'; g.font = 'bold 22px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 64, 26);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// A framed royal portrait for hall walls.
export function portraitTexture() {
  const c = cv(48, 64), g = c.getContext('2d');
  g.fillStyle = '#2a2a3a'; g.fillRect(0, 0, 48, 64);
  g.fillStyle = '#caa07a'; g.beginPath(); g.arc(24, 24, 7, 0, 7); g.fill();
  g.fillStyle = '#5e2a8a'; g.beginPath(); g.moveTo(12, 58); g.lineTo(16, 33); g.lineTo(32, 33); g.lineTo(36, 58); g.closePath(); g.fill();
  g.fillStyle = '#e9c33a'; g.fillRect(19, 13, 10, 4);
  g.strokeStyle = '#c9a24a'; g.lineWidth = 5; g.strokeRect(3, 3, 42, 58);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// A gradient sky dome (a big inverted sphere). Returns a ready-to-add mesh.
export function skyDome() {
  const c = cv(8, 256), g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#4a86c8');   // zenith
  grad.addColorStop(0.55, '#8fc0e6');
  grad.addColorStop(1, '#dde9f0');   // horizon haze
  g.fillStyle = grad; g.fillRect(0, 0, 8, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(440, 24, 16), mat);
  dome.renderOrder = -1;
  return dome;
}
