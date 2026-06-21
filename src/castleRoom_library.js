// castleRoom_library.js — furnishes the castle's LIBRARY (left-front side room)
// with rich scholarly props: packed bookshelves, reading desks with open books,
// candles, quills + ink, a standing globe, scroll pigeonholes, a rolling library
// ladder, a cosy high-backed reading chair, stacked book piles, a side table, a
// rug, and a warm hanging chandelier (1 PointLight max).
//
// Self-contained: polls window.eldenmoor until the castle's ground floor exists,
// then adds a THREE.Group of props as a child of scene.userData.keep.ground so it
// inherits that floor's show/hide. Castle is at world (0,0,46); we work in LOCAL
// space (gate -z front, throne +z back, floor y~0). The Library footprint is
// x in [-22,-10], z in [1,20], divider doorway gap at z 8..11 (kept clear).
//
// Complements the procedural library already in buildings.js — does not duplicate
// or block the existing reading table (-16,*,8), globe (-14,*,8), fireplace
// (-22.4,*,10), rug (-16,*,9), or the outer/back-wall shelves.

import * as THREE from '../vendor/three.module.js';

const FELT = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } o.userData.__toonDone = true; o.userData.noCollide = true; }); return o; };

// ---- shared materials --------------------------------------------------------
const M = {
  oak:    new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 0.78 }),
  oakDk:  new THREE.MeshStandardMaterial({ color: 0x35230f, roughness: 0.82 }),
  walnut: new THREE.MeshStandardMaterial({ color: 0x5a3d22, roughness: 0.72 }),
  gilt:   new THREE.MeshStandardMaterial({ color: 0xc9a23e, metalness: 0.45, roughness: 0.4 }),
  brass:  new THREE.MeshStandardMaterial({ color: 0xb8902f, metalness: 0.55, roughness: 0.42 }),
  velvet: new THREE.MeshStandardMaterial({ color: 0x6e1322, roughness: 0.88 }),
  green:  new THREE.MeshStandardMaterial({ color: 0x2f5d3a, roughness: 0.85 }),
  paper:  new THREE.MeshStandardMaterial({ color: 0xe9ddbe, roughness: 0.92 }),
  parch:  new THREE.MeshStandardMaterial({ color: 0xd9c79a, roughness: 0.9 }),
  ink:    new THREE.MeshStandardMaterial({ color: 0x16110b, roughness: 0.5 }),
  candle: new THREE.MeshStandardMaterial({ color: 0xf2e6c0, roughness: 0.7 }),
  flame:  new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff8a1e, emissiveIntensity: 1.4, roughness: 0.5 }),
  iron:   new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.6, metalness: 0.4 }),
};
// rotating roster of book-spine colours (warm leather library palette)
const SPINE = [0x7e1322, 0x2f4d7a, 0x2f5d3a, 0x6b4a1e, 0x5a2a6e, 0x8a4a1e, 0x35230f, 0x9a8540, 0x3a6a6a, 0x6e1f2f];

const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (rt, rb, h, s, m) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), m);

// ---- a tall bookshelf packed with colourful spines --------------------------
// Faces +x by default (open side toward +x); set ry to face a wall.
function bookshelf(x, z, ry = 0, w = 3.0, h = 3.6) {
  const g = new THREE.Group();
  const d = 0.55;
  // carcass
  g.add(box(w, h, d, M.oakDk));
  // open face frame (so it reads as a cabinet, not a solid block)
  g.add(box(0.12, h, d + 0.02, M.walnut).translateX(-w / 2 + 0.06).translateZ(0.01));
  g.add(box(0.12, h, d + 0.02, M.walnut).translateX(w / 2 - 0.06).translateZ(0.01));
  g.add(box(w, 0.12, d + 0.02, M.walnut).translateY(h / 2 - 0.06).translateZ(0.01));
  g.add(box(w, 0.14, d + 0.02, M.walnut).translateY(-h / 2 + 0.07).translateZ(0.01)); // plinth
  // little pediment cornice
  g.add(box(w + 0.2, 0.16, d + 0.2, M.walnut).translateY(h / 2 + 0.08));
  const shelves = 4;
  const inH = h - 0.4, gap = inH / shelves;
  for (let s = 0; s < shelves; s++) {
    const sy = -h / 2 + 0.34 + s * gap;
    g.add(box(w - 0.24, 0.06, d - 0.06, M.walnut).translateY(sy - gap * 0.5 + 0.03)); // shelf board
    // row of books along this shelf, varied heights / lean
    let bx = -w / 2 + 0.22;
    while (bx < w / 2 - 0.22) {
      const bw = 0.1 + Math.random() * 0.14;
      const bh = gap * (0.62 + Math.random() * 0.26);
      const lean = (Math.random() < 0.12) ? (Math.random() - 0.5) * 0.5 : 0;
      const mat = new THREE.MeshStandardMaterial({ color: SPINE[(Math.random() * SPINE.length) | 0], roughness: 0.85 });
      const b = box(bw, bh, d - 0.16, mat);
      b.position.set(bx + bw / 2, sy + bh / 2 - 0.02, 0.04);
      b.rotation.z = lean;
      // thin gilt band on some spines
      if (Math.random() < 0.4) { const band = box(bw + 0.005, 0.03, d - 0.15, M.gilt); band.position.set(bx + bw / 2, sy + bh * 0.7 - 0.02, 0.05); band.rotation.z = lean; g.add(band); }
      g.add(b);
      bx += bw + 0.015 + Math.random() * 0.03;
    }
    // an occasional book laid flat on top of the row
    if (Math.random() < 0.5) {
      const lw = 0.32, lmat = new THREE.MeshStandardMaterial({ color: SPINE[(Math.random() * SPINE.length) | 0], roughness: 0.85 });
      g.add(box(lw, 0.08, d - 0.2, lmat).translateX(-w / 4 + Math.random() * w / 2).translateY(sy + gap * 0.4));
    }
  }
  g.position.set(x, h / 2, z);
  g.rotation.y = ry;
  return FELT(g);
}

// ---- an open book on a surface ----------------------------------------------
function openBook(x, y, z, ry = 0, s = 1) {
  const g = new THREE.Group();
  const cover = new THREE.MeshStandardMaterial({ color: SPINE[(Math.random() * SPINE.length) | 0], roughness: 0.85 });
  g.add(box(0.72 * s, 0.05 * s, 0.5 * s, cover));                       // back cover
  const L = box(0.34 * s, 0.04 * s, 0.46 * s, M.paper); L.position.set(-0.185 * s, 0.045 * s, 0); L.rotation.z = 0.06; g.add(L);
  const R = box(0.34 * s, 0.04 * s, 0.46 * s, M.paper); R.position.set(0.185 * s, 0.045 * s, 0); R.rotation.z = -0.06; g.add(R);
  g.add(box(0.02 * s, 0.06 * s, 0.46 * s, M.oakDk).translateY(0.04 * s)); // spine ridge
  g.position.set(x, y, z); g.rotation.y = ry;
  return FELT(g);
}

// ---- quill + inkpot ----------------------------------------------------------
function quillInk(x, y, z) {
  const g = new THREE.Group();
  g.add(cyl(0.07, 0.085, 0.1, 10, M.ink).translateY(0.05));            // inkpot body
  g.add(cyl(0.05, 0.05, 0.02, 10, M.iron).translateY(0.105));          // rim
  const q = cyl(0.006, 0.018, 0.5, 6, M.paper); q.position.set(0.04, 0.28, 0); q.rotation.z = -0.5; g.add(q); // quill feather
  g.position.set(x, y, z);
  return FELT(g);
}

// ---- a candlestick with a glowing flame -------------------------------------
function candlestick(x, y, z, h = 0.46) {
  const g = new THREE.Group();
  g.add(cyl(0.1, 0.14, 0.05, 10, M.brass).translateY(0.025));          // base
  g.add(cyl(0.04, 0.05, 0.16, 8, M.brass).translateY(0.13));           // stem
  g.add(cyl(0.07, 0.06, 0.05, 10, M.brass).translateY(0.21));          // cup
  g.add(cyl(0.05, 0.055, h - 0.2, 8, M.candle).translateY(0.24 + (h - 0.2) / 2)); // wax
  const f = cyl(0.0, 0.035, 0.12, 6, M.flame); f.position.set(0, h + 0.1, 0); g.add(f); // flame
  g.position.set(x, y, z);
  return FELT(g);
}

// ---- stacked pile of books on the floor / table -----------------------------
function bookStack(x, y, z, n = 4) {
  const g = new THREE.Group();
  let yy = 0;
  for (let i = 0; i < n; i++) {
    const w = 0.42 + Math.random() * 0.18, d = 0.32 + Math.random() * 0.14, h = 0.08 + Math.random() * 0.05;
    const mat = new THREE.MeshStandardMaterial({ color: SPINE[(Math.random() * SPINE.length) | 0], roughness: 0.85 });
    const b = box(w, h, d, mat); b.position.set((Math.random() - 0.5) * 0.12, yy + h / 2, (Math.random() - 0.5) * 0.1);
    b.rotation.y = (Math.random() - 0.5) * 0.5; g.add(b);
    yy += h + 0.005;
  }
  g.position.set(x, y, z);
  return FELT(g);
}

// ---- a standing globe on a turned wooden stand ------------------------------
function standingGlobe(x, z) {
  const g = new THREE.Group();
  // tripod stand
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; const leg = box(0.07, 1.0, 0.07, M.walnut); leg.position.set(Math.cos(a) * 0.32, 0.5, Math.sin(a) * 0.32); leg.rotation.set(Math.cos(a) * 0.18, 0, -Math.sin(a) * 0.18); g.add(leg); }
  g.add(cyl(0.06, 0.06, 0.3, 8, M.walnut).translateY(1.05));           // central column
  g.add(cyl(0.16, 0.16, 0.05, 8, M.walnut).translateY(1.22));          // collar
  // brass meridian ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.022, 8, 28), M.brass); ring.position.y = 1.7; ring.rotation.x = Math.PI / 2; ring.rotation.z = 0.3; g.add(ring);
  // the sphere — an antique sea-blue map globe
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), new THREE.MeshStandardMaterial({ color: 0x3f6f9a, roughness: 0.75 }));
  globe.position.y = 1.7; globe.rotation.z = 0.3; g.add(globe);
  // a few "land mass" patches
  for (let k = 0; k < 5; k++) {
    const a = Math.random() * Math.PI * 2, b = (Math.random() - 0.5) * 1.4;
    const land = new THREE.Mesh(new THREE.SphereGeometry(0.13 + Math.random() * 0.08, 8, 6), M.green);
    land.position.set(Math.cos(a) * Math.cos(b) * 0.4, 1.7 + Math.sin(b) * 0.4, Math.sin(a) * Math.cos(b) * 0.4);
    land.scale.set(1, 0.5, 1); g.add(land);
  }
  g.position.set(x, 0, z);
  return FELT(g);
}

// ---- scroll pigeonholes (a grid of cubbies stuffed with rolled scrolls) -----
function scrollRack(x, z, ry = 0, cols = 4, rows = 3) {
  const g = new THREE.Group();
  const cw = 0.42, ch = 0.42, d = 0.5;
  const w = cols * cw + 0.12, h = rows * ch + 0.12;
  g.add(box(w, h, d, M.oakDk));                                        // carcass
  g.add(box(w + 0.1, 0.12, d + 0.1, M.walnut).translateY(h / 2 + 0.04)); // cornice
  for (let c = 0; c <= cols; c++) g.add(box(0.05, h - 0.1, d - 0.04, M.walnut).translateX(-w / 2 + 0.06 + c * cw).translateZ(0.02));
  for (let r = 0; r <= rows; r++) g.add(box(w - 0.1, 0.05, d - 0.04, M.walnut).translateY(-h / 2 + 0.06 + r * ch).translateZ(0.02));
  // rolled scrolls poking out of cubbies
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    if (Math.random() < 0.78) {
      const n = 1 + (Math.random() * 3 | 0);
      for (let i = 0; i < n; i++) {
        const sc = cyl(0.045, 0.045, 0.42, 8, Math.random() < 0.5 ? M.parch : M.paper);
        sc.rotation.x = Math.PI / 2;
        sc.position.set(-w / 2 + 0.06 + c * cw + cw / 2 + (Math.random() - 0.5) * 0.18,
                        -h / 2 + 0.06 + r * ch + ch / 2 + (Math.random() - 0.5) * 0.1,
                        0.12 + (Math.random() - 0.5) * 0.04);
        g.add(sc);
        // a tiny red ribbon on some
        if (Math.random() < 0.3) g.add(box(0.012, 0.06, 0.04, M.velvet).translateX(sc.position.x).translateY(sc.position.y).translateZ(0.28));
      }
    }
  }
  g.position.set(x, h / 2, z); g.rotation.y = ry;
  return FELT(g);
}

// ---- a rolling library ladder leaning on the shelves ------------------------
function libraryLadder(x, z, ry = 0) {
  const g = new THREE.Group();
  const H = 3.3, lean = 0.16;
  for (const sx of [-0.32, 0.32]) {
    const rail = box(0.08, H, 0.08, M.walnut); rail.position.set(sx, H / 2, 0); rail.rotation.x = lean; g.add(rail);
  }
  for (let r = 0; r < 8; r++) {
    const ry2 = 0.25 + r * (H - 0.4) / 7;
    const rung = cyl(0.035, 0.035, 0.72, 8, M.walnut); rung.rotation.z = Math.PI / 2;
    rung.position.set(0, ry2, -Math.sin(lean) * (ry2 - H / 2)); g.add(rung);
  }
  // little brass wheels at the foot + a top hook
  for (const sx of [-0.32, 0.32]) { const w = cyl(0.08, 0.08, 0.05, 10, M.brass); w.rotation.z = Math.PI / 2; w.position.set(sx, 0.08, Math.sin(lean) * H / 2); g.add(w); }
  g.position.set(x, 0, z); g.rotation.y = ry;
  return FELT(g);
}

// ---- a cosy high-backed reading chair (wing chair, velvet) ------------------
function readingChair(x, z, ry = 0) {
  const g = new THREE.Group();
  // legs
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.1, 0.5, 0.1, M.oakDk).translateX(sx * 0.42).translateY(0.25).translateZ(sz * 0.42));
  g.add(box(1.05, 0.28, 1.05, M.velvet).translateY(0.62));            // seat cushion
  g.add(box(1.1, 1.5, 0.2, M.velvet).translateY(1.35).translateZ(-0.45)); // tall back
  // wings
  for (const sx of [-1, 1]) g.add(box(0.18, 0.9, 0.6, M.velvet).translateX(sx * 0.55).translateY(1.15).translateZ(-0.18));
  // arms
  for (const sx of [-1, 1]) { g.add(box(0.2, 0.45, 0.95, M.velvet).translateX(sx * 0.55).translateY(0.85).translateZ(0.05)); }
  // gilt finials on the back top corners
  for (const sx of [-1, 1]) g.add(cyl(0.05, 0.05, 0.16, 8, M.gilt).translateX(sx * 0.5).translateY(2.18).translateZ(-0.45));
  g.position.set(x, 0, z); g.rotation.y = ry;
  return FELT(g);
}

// ---- a small round side table -----------------------------------------------
function sideTable(x, z) {
  const g = new THREE.Group();
  g.add(cyl(0.45, 0.42, 0.06, 16, M.walnut).translateY(0.62));        // top
  g.add(cyl(0.07, 0.07, 0.6, 10, M.oakDk).translateY(0.3));           // pedestal
  g.add(cyl(0.26, 0.26, 0.05, 12, M.oakDk).translateY(0.04));         // foot
  g.position.set(x, 0, z);
  return FELT(g);
}

// ---- a hanging iron-ring chandelier with candles (1 PointLight) -------------
function chandelier(x, z, ceil = 5.8) {
  const g = new THREE.Group();
  g.add(cyl(0.02, 0.02, ceil - 4.0, 6, M.iron).translateY((ceil + 4.0) / 2)); // chain
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.045, 8, 24), M.iron); ring.position.y = 4.0; ring.rotation.x = Math.PI / 2; g.add(ring);
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; const sp = cyl(0.015, 0.015, 1.0, 6, M.iron); sp.position.set(Math.cos(a) * 0.5, 4.5, Math.sin(a) * 0.5); sp.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); g.add(sp); }
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * Math.PI * 2, cx = Math.cos(a) * 0.7, cz = Math.sin(a) * 0.7;
    g.add(cyl(0.05, 0.05, 0.06, 8, M.iron).translateX(cx).translateY(4.04).translateZ(cz)); // cup
    g.add(cyl(0.04, 0.045, 0.22, 8, M.candle).translateX(cx).translateY(4.18).translateZ(cz)); // candle
    g.add(cyl(0.0, 0.03, 0.1, 6, M.flame).translateX(cx).translateY(4.34).translateZ(cz));     // flame
  }
  const pl = new THREE.PointLight(0xffba66, 4.2, 14, 2); pl.position.set(0, 4.0, 0); g.add(pl);
  g.position.set(x, 0, z);
  FELT(g);
  return g;
}

// ---- a second study desk with a green felt blotter --------------------------
function studyDesk(x, z, ry = 0) {
  const g = new THREE.Group();
  g.add(box(1.9, 0.1, 1.0, M.walnut).translateY(0.78));               // top
  g.add(box(1.84, 0.06, 0.94, M.green).translateY(0.84));             // green felt blotter
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.12, 0.78, 0.12, M.oakDk).translateX(sx * 0.82).translateY(0.39).translateZ(sz * 0.4));
  g.add(box(1.84, 0.32, 0.16, M.walnut).translateY(0.6).translateZ(-0.42)); // drawer apron
  g.add(box(1.84, 0.04, 0.94, M.oakDk).translateY(0.44));             // under-shelf
  g.position.set(x, 0, z); g.rotation.y = ry;
  return FELT(g);
}

// ---- a small woven rug (extra, by the reading nook) -------------------------
function nookRug(x, z, w = 3.0, d = 2.2) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 48;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5a2233'; ctx.fillRect(0, 0, 64, 48);
  ctx.fillStyle = '#7a3346'; ctx.fillRect(6, 5, 52, 38);
  ctx.strokeStyle = '#c9a23e'; ctx.lineWidth = 3; ctx.strokeRect(4, 4, 56, 40);
  ctx.lineWidth = 1.5; ctx.strokeRect(12, 11, 40, 26);
  ctx.fillStyle = '#c9a23e'; ctx.beginPath(); ctx.moveTo(32, 16); ctx.lineTo(40, 24); ctx.lineTo(32, 32); ctx.lineTo(24, 24); ctx.closePath(); ctx.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.13, z);
  return FELT(m);
}

// =============================================================================
function buildLibrary(floor) {
  const root = new THREE.Group(); root.name = 'castle-library-furniture';

  // --- pack the BACK wall (z=20.5) with more shelves, filling between the
  //     existing ones at x=-20,-16,-12.5 (face -z, into the room) ---
  root.add(bookshelf(-21.4, 20.0, -Math.PI / 2, 3.0, 3.6));  // tall pair on the far back-left corner
  root.add(scrollRack(-13.0, 19.9, Math.PI, 4, 3));          // scroll pigeonholes against back wall (faces -z)

  // --- OUTER wall (x=-22) — the fireplace sits at z=10 and existing shelves at
  //     z=3,7,19; add scholarly shelving in the open stretch z 12..15 (faces +x) ---
  root.add(bookshelf(-21.5, 13.5, Math.PI / 2, 3.4, 3.8));   // tall packed shelf (clears fireplace at z10)
  root.add(scrollRack(-21.6, 17.0, Math.PI / 2, 3, 3));      // scrolls beside it
  // a rolling ladder leaning on that outer-wall shelf
  root.add(libraryLadder(-21.0, 12.0, 0));

  // --- a SECOND study desk near the back, with books, quill, ink, candle ---
  const dz = 15.0, dx = -16.5;
  root.add(studyDesk(dx, dz, Math.PI));                      // faces -z
  root.add(openBook(dx - 0.3, 0.86, dz, 0.2, 1.05));
  root.add(bookStack(dx + 0.55, 0.84, dz + 0.15, 3));
  root.add(quillInk(dx + 0.7, 0.84, dz - 0.2));
  root.add(candlestick(dx - 0.75, 0.84, dz + 0.2, 0.5));
  // a plain wooden stool tucked at the desk
  { const st = new THREE.Group(); st.add(cyl(0.22, 0.24, 0.07, 12, M.velvet).translateY(0.5)); for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; st.add(cyl(0.035, 0.035, 0.5, 6, M.oakDk).translateX(Math.cos(a) * 0.17).translateY(0.25).translateZ(Math.sin(a) * 0.17)); } st.position.set(dx, 0, dz - 1.1); root.add(FELT(st)); }

  // --- a cosy reading NOOK in the front-left of the room (away from doorway) ---
  root.add(nookRug(-18.5, 4.5, 4.0, 3.2));
  root.add(readingChair(-19.0, 4.5, Math.PI / 2 - 0.15));    // faces toward the room
  root.add(sideTable(-19.6, 6.0));
  root.add(candlestick(-19.6, 0.65, 6.0, 0.46));
  root.add(openBook(-19.55, 0.66, 5.85, -0.4, 0.85));
  root.add(bookStack(-17.4, 0.0, 3.0, 5));                   // a tall floor stack by the chair
  root.add(bookStack(-17.9, 0.0, 6.2, 3));

  // --- a grand STANDING GLOBE on its own stand (the buildings.js globe is a
  //     small table globe at (-14,*,8); this is a bigger floor piece) ---
  root.add(standingGlobe(-13.0, 4.5));
  root.add(bookStack(-12.3, 0.0, 6.0, 4));

  // --- dress the existing reading table at (-16,*,8) with a quill + candle so
  //     it feels in-use (table top is at y~1.06) — clears the doorway at z8..11
  //     by hugging the table itself ---
  root.add(quillInk(-16.9, 1.06, 8.4));
  root.add(candlestick(-15.0, 1.06, 8.3, 0.42));
  root.add(bookStack(-16.6, 1.06, 7.6, 2));

  // --- warm hanging chandelier centred over the room (1 PointLight max) ---
  root.add(chandelier(-16.0, 12.5, 5.9));

  floor.add(root);
  return root;
}

(function boot() {
  let tries = 0, built = false;
  const iv = setInterval(() => {
    tries++;
    const em = window.eldenmoor;
    const keep = em && em.scene && em.scene.userData && em.scene.userData.keep;
    if (!built && keep && keep.ground) {
      built = true;
      clearInterval(iv);
      try { buildLibrary(keep.ground); }
      catch (err) { console.error('[castleRoom_library] failed', err); }
    } else if (tries > 800) { clearInterval(iv); }
  }, 100);
})();
