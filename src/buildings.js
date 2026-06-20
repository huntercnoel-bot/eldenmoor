// buildings.js — the grand home-base CASTLE (Stormwind × Lumbridge) and the two
// big, walk-in shops. Built from low-poly shapes + procedural textures. Colliders
// are auto-generated from these meshes by collision.js (gaps = doors/gates), and
// shop roofs are hidden while you're inside (see main.js).

import * as THREE from '../vendor/three.module.js';
import { stoneTexture, plasterTexture, dirtTexture, shingleTexture, woodFloorTexture, marbleTexture, tapestryTexture, carpetTexture, stainedGlassTexture, bookshelfTexture, heraldryBannerTexture, woodPanelTexture, tiledFloorTexture, rugTexture, signTexture, portraitTexture } from './textures.js';

// Footprints world.js uses to keep trees from growing inside things.
export const STRUCTURES = [
  { x: 0,   z: 46, r: 32 },  // castle
  { x: -15, z: 12, r: 8 },   // general store
  { x: 15,  z: 12, r: 8 },   // axe shop
];

let TX = null;
function tex() {
  if (!TX) TX = {
    wall: stoneTexture(2), floor: stoneTexture(5), road: stoneTexture(8),
    plaster: plasterTexture(), dirt: dirtTexture(4),
    shingle: shingleTexture(4), wood: woodFloorTexture(4), marble: marbleTexture(3),
    carpet: carpetTexture(6), tapestry: tapestryTexture('#6e1f2f', '#c9a24a'), tapestryB: tapestryTexture('#27406e', '#c9a24a'),
    stainedGlass: stainedGlassTexture(), bookshelf: bookshelfTexture(), heraldry: heraldryBannerTexture('#27406e'),
    woodPanel: woodPanelTexture(2), tiled: tiledFloorTexture(4), rug: rugTexture(), portrait: portraitTexture(),
  };
  return TX;
}

const flat = (color, rough = 0.95) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, flatShading: true });
const mapped = (map, color = 0xffffff, rough = 0.92) => new THREE.MeshStandardMaterial({ map, color, roughness: rough, metalness: 0 });
const deco = (m) => { m.userData.noCollide = true; return m; };

function box(w, h, d, material, x, y, z, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; return m;
}
function cyl(rt, rb, h, seg, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}

// ---------------------------------------------------------------------------
// A big walk-in shop with a hideable roof. opts: { wall, roof, wares }
// ---------------------------------------------------------------------------
function makeShop(opts) {
  const T = tex();
  const g = new THREE.Group();
  const HW = 6, HD = 5, H = 3.4, TH = 0.4, DOOR = 1.6;
  const wallMat = mapped(T.plaster, opts.wall), beam = flat(0x4a3220),
        floorMat = mapped(T.wood), woodMat = flat(0x6b4a2c), stoneMat = mapped(T.wall);
  const glass = new THREE.MeshStandardMaterial({ color: 0x86bcd6, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.55 });

  g.add(deco(box(HW * 2, 0.2, HD * 2, floorMat, 0, 0.06, 0, false)));            // wood floor
  g.add(deco(box(DOOR * 2 + 1, 0.18, 1.2, mapped(T.road), 0, 0.05, -HD - 0.6, false))); // doorstep

  const wallSeg = (x0, z0, x1, z1) => {
    const w = Math.max(TH, Math.abs(x1 - x0)), d = Math.max(TH, Math.abs(z1 - z0));
    g.add(box(w, H, d, wallMat, (x0 + x1) / 2, H / 2, (z0 + z1) / 2));
  };
  wallSeg(-HW, HD, HW, HD); wallSeg(-HW, -HD, -HW, HD); wallSeg(HW, -HD, HW, HD); // back + sides
  wallSeg(-HW, -HD, -DOOR, -HD); wallSeg(DOOR, -HD, HW, -HD);                     // front (door gap)
  for (const sx of [-1, 1]) g.add(box(0.3, 2.6, 0.5, beam, sx * DOOR, 1.3, -HD)); // door frame
  g.add(box(DOOR * 2 + 0.6, 0.4, 0.5, beam, 0, 2.6, -HD));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.3, H, 0.3, beam, sx * HW, H / 2, sz * HD)); // corner posts
  for (const sz of [-1, 1]) g.add(deco(box(HW * 2, 0.25, 0.32, beam, 0, H - 0.5, sz * HD)));                 // timber band
  for (const sz of [-2.2, 2.2]) for (const sx of [-1, 1]) g.add(deco(box(0.18, 1.3, 1.5, glass, sx * (HW - 0.02), 1.9, sz))); // windows

  // hideable roof
  const roof = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), mapped(T.shingle, opts.roof));
  cone.scale.set(HW + 1.3, 3.4, HD + 1.3); cone.position.y = H + 1.6; cone.rotation.y = Math.PI / 4; cone.castShadow = true; deco(cone); roof.add(cone);
  roof.add(deco(box(HW * 2 + 1.6, 0.35, HD * 2 + 1.6, beam, 0, H + 0.05, 0)));   // eaves
  roof.add(deco(box(0.8, 2.4, 0.8, stoneMat, HW - 1.4, H + 1.7, HD - 1.4)));      // chimney
  g.add(roof);

  // interior
  g.add(box(HW * 1.5, 1.1, 0.7, woodMat, 0, 0.55, HD - 1.6));                     // counter
  g.add(deco(box(HW * 1.5 + 0.2, 0.14, 0.95, flat(0x5a3a22), 0, 1.18, HD - 1.6)));
  for (const sx of [-1, 1]) {
    g.add(box(0.5, H - 0.7, HD * 1.5, woodMat, sx * (HW - 0.5), (H - 0.7) / 2, 0.3)); // shelf unit
    for (let r = 0; r < 3; r++) g.add(deco(box(0.46, 0.06, HD * 1.5, flat(0x4a3018), sx * (HW - 0.5), 0.7 + r * 0.8, 0.3)));
  }
  const wc = opts.wares || [0x8a1f1f, 0x2f6ea5, 0xc9a24a, 0x3f6e44, 0x7a3a2a];
  for (let i = 0; i < 12; i++) {
    const sx = i < 6 ? -1 : 1, yy = 0.85 + (i % 3) * 0.8, zz = -2.6 + ((i % 6) / 6) * HD * 1.3;
    g.add(deco(box(0.4, 0.45, 0.4, flat(wc[i % wc.length]), sx * (HW - 0.8), yy, zz)));
  }
  for (const p of [[-HW + 1.6, -HD + 1.6], [HW - 1.6, -HD + 1.7]]) g.add(cyl(0.4, 0.46, 0.95, 10, woodMat, p[0], 0.47, p[1])); // barrels
  g.add(box(0.9, 0.9, 0.9, woodMat, 1.7, 0.45, -HD + 1.7));                       // crate
  g.add(deco(box(0.34, 0.42, 0.34, new THREE.MeshStandardMaterial({ color: 0xffe6a3, emissive: 0xffb142, emissiveIntensity: 1.3, roughness: 0.5 }), 0, 2.6, -HD + 1.4))); // lantern

  g.userData.roof = roof; g.userData.hw = HW + 0.8; g.userData.hd = HD + 0.8;
  return g;
}

// ---------------------------------------------------------------------------
// The castle. Local: front (gate) = -z, throne at the back (+z).
// ---------------------------------------------------------------------------
function makeCastle() {
  const T = tex();
  const g = new THREE.Group();
  const HW = 23, HD = 22, WH = 6, TH = 0.9;
  const stone = mapped(T.wall), floorMat = mapped(T.floor, 0xb6b1a6), marble = mapped(T.marble),
        roofMat = mapped(T.shingle, 0x6e2f2f), wood = flat(0x4a3320), gold = flat(0xd8b24a, 0.4),
        red = flat(0x8a1f1f), purple = flat(0x4a2c6e);
  const ember = new THREE.MeshStandardMaterial({ color: 0xff7a1e, emissive: 0xff5500, emissiveIntensity: 1.1, roughness: 0.7 });
  const flameMat = new THREE.MeshStandardMaterial({ color: 0xffb33a, emissive: 0xff7b00, emissiveIntensity: 1.7, roughness: 0.5 });
  const glassCols = [0x3a6ea5, 0x8a1f1f, 0x2f8a4a, 0xc9a24a, 0x6e3a8a];

  const merlons = (x0, z0, x1, z1, y, step = 1.7) => {
    const dx = x1 - x0, dz = z1 - z0, n = Math.max(1, Math.round(Math.hypot(dx, dz) / step));
    for (let i = 0; i <= n; i++) { const t = i / n; g.add(deco(box(0.7, 0.8, 0.7, stone, x0 + dx * t, y, z0 + dz * t))); }
  };
  const wallSeg = (x0, z0, x1, z1, h = WH, th = TH, cren = true) => {
    const w = Math.max(th, Math.abs(x1 - x0)), d = Math.max(th, Math.abs(z1 - z0));
    g.add(box(w, h, d, stone, (x0 + x1) / 2, h / 2, (z0 + z1) / 2));
    if (cren) merlons(x0, z0, x1, z1, h + 0.4);
  };
  const tower = (tx, tz, r = 2.4, h = 14) => {
    g.add(cyl(r, r + 0.3, h, 14, stone, tx, h / 2, tz));
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.add(deco(box(0.6, 0.8, 0.6, stone, tx + Math.cos(a) * (r - 0.1), h + 0.4, tz + Math.sin(a) * (r - 0.1)))); }
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r + 0.9, 4.4, 14), roofMat); cone.position.set(tx, h + 2.6, tz); cone.castShadow = true; deco(cone); g.add(cone);
    g.add(deco(box(0.12, 2.2, 0.12, wood, tx, h + 5.4, tz)));
    g.add(deco(box(1.2, 0.7, 0.05, red, tx + 0.66, h + 5.6, tz)));
  };
  const brazier = (x, z, light = false) => {
    g.add(cyl(0.35, 0.22, 0.8, 8, stone, x, 0.4, z));
    g.add(deco(box(0.5, 0.3, 0.5, flameMat, x, 1.0, z)));
    if (light) { const pl = new THREE.PointLight(0xffa53a, 7, 16, 2); pl.position.set(x, 1.4, z); g.add(pl); }
  };
  const column = (x, z) => {
    g.add(cyl(0.55, 0.6, WH + 1.5, 12, stone, x, (WH + 1.5) / 2, z));
    g.add(deco(box(1.4, 0.4, 1.4, stone, x, 0.2, z)));
    g.add(deco(box(1.4, 0.5, 1.4, stone, x, WH + 1.5, z)));
  };
  const statue = (x, z) => {
    g.add(box(1.4, 1.0, 1.4, stone, x, 0.5, z));                 // pedestal (solid)
    g.add(deco(cyl(0.3, 0.4, 1.6, 8, marble, x, 1.8, z)));
    g.add(deco(box(0.5, 0.5, 0.45, marble, x, 2.8, z)));
    g.add(deco(box(0.12, 1.4, 0.12, marble, x + 0.35, 2.2, z)));
  };

  // floors + carpet
  g.add(deco(box(HW * 2, 0.2, HD * 2, floorMat, 0, -0.08, 0, false)));               // base flagstones (top ~0.02)
  g.add(deco(box(20, 0.16, HD - 1, marble, 0, 0.0, HD / 2 + 0.5, false)));            // central hall marble (top ~0.08)
  g.add(deco(box(6, 0.06, 19, mapped(T.carpet), 0, 0.11, 9.5, false)));               // royal aisle carpet

  // curtain walls (gate gap at front)
  wallSeg(-HW, -HD, -2.5, -HD); wallSeg(2.5, -HD, HW, -HD);
  wallSeg(-HW, HD, HW, HD);
  wallSeg(-HW, -HD, -HW, HD); wallSeg(HW, -HD, HW, HD);

  // towers: 4 corners + 2 side-mids + 2 gatehouse
  tower(-HW, -HD); tower(HW, -HD); tower(-HW, HD); tower(HW, HD);
  tower(-HW, 0); tower(HW, 0);
  tower(-4, -HD, 1.8, 11); tower(4, -HD, 1.8, 11);
  g.add(deco(box(9, 1.6, 1.4, stone, 0, WH + 0.8, -HD)));        // gate lintel
  g.add(deco(box(5.2, 0.4, 0.5, wood, 0, WH - 0.4, -HD)));       // portcullis

  // inner dividing wall (courtyard | keep) with a grand arch
  wallSeg(-HW, 0, -3, 0, 5, 0.7); wallSeg(3, 0, HW, 0, 5, 0.7);
  g.add(deco(box(7.5, 1.6, 1.2, stone, 0, 5.3, 0)));

  // great-hall columns (central aisle stays clear)
  for (const sx of [-1, 1]) for (const z of [5.5, 16.5]) column(sx * 9, z);   // hall colonnade (clear of doorways)

  // throne room (back)
  g.add(deco(box(12, 0.4, 5, marble, 0, 0.32, HD - 3, false)));   // dais step 1
  g.add(deco(box(8, 0.4, 3.5, marble, 0, 0.6, HD - 3, false)));   // dais step 2
  g.add(deco(box(2.0, 0.9, 1.6, gold, 0, 1.25, HD - 2.4)));       // throne seat
  g.add(deco(box(2.0, 3.0, 0.4, gold, 0, 2.6, HD - 1.7)));        // throne back
  for (const sx of [-1, 1]) g.add(deco(box(0.3, 1.6, 1.6, gold, sx * 1.05, 1.6, HD - 2.4)));
  g.add(deco(box(1.7, 0.3, 1.3, red, 0, 1.85, HD - 2.5)));        // cushion
  g.add(deco(box(0.5, 0.6, 0.5, gold, 0, 4.3, HD - 1.7)));        // finial
  const sgThrone = new THREE.MeshStandardMaterial({ map: T.stainedGlass, emissive: 0xffffff, emissiveMap: T.stainedGlass, emissiveIntensity: 0.55, roughness: 0.3 });
  for (let i = 0; i < 5; i++) g.add(deco(box(2.2, 3.8, 0.2, sgThrone, -8 + i * 4, 4.3, HD - 0.6)));  // stained glass
  for (const sx of [-1, 1]) g.add(deco(box(2.4, 5.0, 0.12, mapped(T.heraldry), sx * 5.5, 4.0, HD - 0.7)));  // heraldic banners
  brazier(-3.5, HD - 3.2, true); brazier(3.5, HD - 3.2, true);

  brazier(-6, 6); brazier(6, 6); brazier(-6, 15, true); brazier(6, 15, true);   // aisle braziers

  // courtyard: a central approach (well, statues, braziers) flanked by four rooms
  g.add(cyl(1.1, 1.25, 1.0, 12, stone, -6, 0.5, -7));                                       // well
  g.add(deco(box(1.7, 0.06, 1.7, flat(0x244055), -6, 0.9, -7, false)));
  for (const sx of [-1, 1]) g.add(deco(box(0.18, 1.9, 0.18, wood, -6 + sx * 1.05, 1.0, -7)));
  { const wr = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.0, 4), roofMat); wr.position.set(-6, 2.4, -7); wr.rotation.y = Math.PI / 4; wr.castShadow = true; deco(wr); g.add(wr); }
  statue(-6, -18); statue(6, -18);
  brazier(-6, -11); brazier(6, -11);

  // four courtyard rooms: dividers at x ±10 (doorways z -18..-15 & z -7..-4) + cross-walls at z -11
  const cDivider = (x) => { wallSeg(x, -21, x, -18, 5, 0.6, false); wallSeg(x, -15, x, -7, 5, 0.6, false); wallSeg(x, -4, x, -1, 5, 0.6, false); };
  cDivider(-10); cDivider(10);
  wallSeg(-22.5, -11, -10, -11, 5, 0.6, false); wallSeg(10, -11, 22.5, -11, 5, 0.6, false);
  g.add(deco(box(12.5, 0.16, 10, mapped(T.floor, 0xb6b1a6), -16.2, 0.0, -16, false)));     // armoury floor
  g.add(deco(box(12.5, 0.16, 10, mapped(T.wood), -16.2, 0.0, -6, false)));                 // kitchen floor
  g.add(deco(box(12.5, 0.16, 10, mapped(T.wood), 16.2, 0.0, -16, false)));                 // bedchamber floor
  g.add(deco(box(12.5, 0.16, 10, mapped(T.tiled), 16.2, 0.0, -6, false)));                 // treasury floor

  // Kitchen (back-left)
  g.add(box(2.2, 2.1, 1.5, stone, -21, 1.05, -9));                                          // range/oven
  g.add(deco(box(1.1, 0.7, 0.2, ember, -19.9, 0.8, -9)));
  g.add(deco(box(0.7, 1.6, 0.7, stone, -21, 3.1, -9)));                                     // chimney
  g.add(deco(cyl(0.4, 0.45, 0.5, 10, flat(0x3a3a3e), -19.9, 2.05, -9)));                    // stew pot
  g.add(box(2.4, 0.9, 1.1, wood, -16, 0.45, -5));                                           // butcher table
  for (const f of [[0xb5651d, -16.9], [0xece0c0, -16], [0x8a1f1f, -15.2]]) g.add(deco(box(0.4, 0.3, 0.4, flat(f[0]), f[1], 1.05, -5)));
  for (const p of [[-21, -3], [-20.2, -3.8]]) g.add(cyl(0.4, 0.45, 0.9, 10, wood, p[0], 0.45, p[1]));    // ale barrels
  for (let r = 0; r < 3; r++) g.add(deco(box(3.0, 0.06, 0.4, flat(0x4a3018), -16, 1.7 + r * 0.7, -1.4)));  // larder shelves

  // Treasury (back-right)
  g.add(box(4.4, 1.1, 0.6, wood, 17, 0.55, -6));                                            // counter
  g.add(deco(box(4.4, 0.14, 0.8, flat(0x5a3a22), 17, 1.16, -6)));
  for (const p of [[19, -3], [19.8, -3], [19.4, -3.8], [20.6, -3]]) g.add(deco(box(0.6, 0.5, 0.6, gold, p[0], 0.25, p[1])));   // gold stacks
  for (const cx of [13.5, 20.5]) { g.add(box(1.3, 0.8, 0.9, wood, cx, 0.4, -2)); g.add(deco(box(1.1, 0.34, 0.7, gold, cx, 0.85, -2))); }   // chests of gold
  g.add(box(2.0, 2.4, 0.5, flat(0x55585e), 21.9, 1.2, -8)); g.add(deco(cyl(0.4, 0.4, 0.14, 10, gold, 21.6, 1.2, -8)));   // vault door + wheel

  // ===================== castle dressing (the grand interior) =====================
  const steel = flat(0x9aa0a8, 0.5), silver = flat(0xc8ccd2, 0.4);
  const tapA = mapped(T.tapestry), tapB = mapped(T.tapestryB), carpetMat = mapped(T.carpet);
  const candle = new THREE.MeshStandardMaterial({ color: 0xffe6a3, emissive: 0xffcf6a, emissiveIntensity: 1.6, roughness: 0.5 });

  // a suit of armour on a pedestal
  const knight = (x, z) => {
    g.add(deco(box(1.2, 0.4, 1.2, stone, x, 0.2, z)));
    g.add(deco(cyl(0.3, 0.36, 1.2, 8, steel, x, 1.0, z)));
    g.add(deco(box(0.74, 0.4, 0.5, steel, x, 1.75, z)));
    g.add(deco(box(0.42, 0.46, 0.42, silver, x, 2.18, z)));
    g.add(deco(box(0.12, 0.34, 0.12, red, x, 2.55, z)));            // helm plume
    g.add(deco(box(0.1, 1.9, 0.1, wood, x + 0.5, 1.45, z)));        // spear
    g.add(deco(cyl(0.12, 0, 0.42, 6, silver, x + 0.5, 2.55, z)));
    g.add(deco(box(0.55, 0.78, 0.1, red, x - 0.5, 1.5, z)));        // shield
  };
  const wallTorch = (x, z) => { g.add(deco(box(0.16, 0.5, 0.16, wood, x, 3.0, z))); g.add(deco(box(0.26, 0.32, 0.26, flameMat, x, 3.45, z))); };
  const tapestry = (x, z, m) => { g.add(deco(box(2.6, 0.18, 0.16, wood, x, 5.4, z))); g.add(deco(box(2.4, 4.4, 0.12, m, x, 3.2, z))); };
  const chandelier = (z, lit) => {
    g.add(deco(box(0.06, 2.2, 0.06, flat(0x2a2622), 0, 7.6, z)));
    g.add(deco(cyl(1.1, 1.1, 0.14, 12, gold, 0, 6.4, z)));
    g.add(deco(cyl(0.7, 0.7, 0.1, 12, gold, 0, 6.7, z)));
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.add(deco(box(0.12, 0.34, 0.12, candle, Math.cos(a), 6.7, z + Math.sin(a)))); }
    if (lit) { const pl = new THREE.PointLight(0xffce7a, 5, 20, 2); pl.position.set(0, 6.2, z); g.add(pl); }
  };

  for (const sx of [-1, 1]) for (const z of [3, 7, 11, 15]) knight(sx * 5, z);           // knights line the aisle
  tapestry(-22.4, 4, tapA); tapestry(-22.4, 16, tapB);   // library wall (right wall = chapel stained glass)
  for (const sx of [-1, 1]) for (const z of [2.5, 8.5, 14.5, -6, -12, -18]) wallTorch(sx * 22.4, z);
  chandelier(6, true); chandelier(13, true); chandelier(HD - 2.5, true);

  // great fireplace (left hall wall, in the Library)
  const fpx = -22.4, fpz = 10;
  g.add(deco(box(0.5, 4.6, 4.6, stone, fpx, 2.3, fpz)));
  g.add(deco(box(0.7, 2.2, 3.0, flat(0x1c1814), fpx + 0.2, 1.1, fpz)));
  g.add(deco(box(0.5, 1.0, 2.4, ember, fpx + 0.35, 0.6, fpz)));
  g.add(deco(box(0.9, 0.4, 3.8, stone, fpx + 0.1, 2.5, fpz)));
  { const pl = new THREE.PointLight(0xff7a2a, 4.5, 13, 2); pl.position.set(fpx + 1.2, 1.3, fpz); g.add(pl); }

  // throne dressing: rug + candelabra
  g.add(deco(box(4, 0.05, 3, carpetMat, 0, 0.84, HD - 3.2, false)));   // rug on the dais (sits on top of the steps)
  for (const sx of [-1, 1]) { g.add(deco(cyl(0.18, 0.24, 1.9, 8, gold, sx * 2.4, 0.95, HD - 2.6))); g.add(deco(box(0.26, 0.32, 0.26, candle, sx * 2.4, 2.05, HD - 2.6))); }

  // --- Armoury (front-left courtyard room) ---
  g.add(box(2.2, 1.5, 1.6, stone, -20.4, 0.75, -19));                                        // forge
  g.add(deco(box(1.1, 0.7, 0.2, ember, -19.3, 0.7, -19)));
  g.add(deco(box(0.55, 1.5, 0.55, stone, -20.4, 2.2, -19)));                                 // forge chimney
  g.add(box(0.8, 0.5, 0.4, flat(0x3a3a3e), -17.5, 0.6, -18)); g.add(deco(cyl(0.26, 0.32, 0.55, 6, flat(0x3a3a3e), -17.5, 0.28, -18)));  // anvil
  knight(-12.5, -19); knight(-12.5, -13);                                                    // armour stands
  g.add(box(0.4, 1.3, 3.4, wood, -22.1, 0.65, -13.5));                                        // weapon rack backing
  for (let i = 0; i < 5; i++) { g.add(deco(box(0.08, 1.9, 0.08, wood, -21.9, 1.0, -15 + i * 0.75))); g.add(deco(cyl(0.1, 0, 0.4, 6, silver, -21.9, 2.0, -15 + i * 0.75))); } // spears
  for (let i = 0; i < 3; i++) g.add(deco(box(1.0, 1.2, 0.12, mapped(T.heraldry), -18.5 + i * 2.2, 2.5, -21.5)));  // shields on the wall
  for (const p of [[-12, -20.5], [-12.9, -20.2]]) g.add(box(0.9, 0.9, 0.9, wood, p[0], 0.45, p[1]));  // crates

  // --- Royal Bedchamber (front-right courtyard room) ---
  g.add(deco(box(7, 0.05, 5, mapped(T.rug), 16, 0.11, -15, false)));                          // rug
  g.add(box(3.2, 0.7, 4.2, wood, 16, 0.35, -17));                                            // bed frame
  g.add(deco(box(3.0, 0.4, 4.0, flat(0x8a1f2a), 16, 0.75, -17)));                            // blanket
  g.add(deco(box(2.8, 0.3, 0.8, flat(0xece0c0), 16, 1.0, -18.7)));                           // pillows
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(deco(box(0.2, 2.6, 0.2, wood, 16 + sx * 1.5, 1.3, -17 + sz * 2)));  // posts
  g.add(deco(box(3.6, 0.25, 4.6, flat(0x6e1f2f), 16, 2.6, -17)));                            // canopy
  g.add(box(2.0, 2.6, 0.9, wood, 21, 1.3, -13)); g.add(deco(box(2.0, 0.2, 0.9, flat(0x3a2415), 21, 2.6, -13)));  // wardrobe
  g.add(box(1.2, 0.8, 0.8, wood, 12, 0.4, -20)); g.add(deco(box(1.25, 0.16, 0.85, flat(0x3a2415), 12, 0.85, -20)));  // chest
  g.add(deco(box(0.7, 0.6, 0.7, wood, 13.2, 0.3, -14))); g.add(deco(box(0.18, 0.4, 0.18, candle, 13.2, 0.8, -14)));  // side table + candle

  // crests beside the inner gate
  for (const sx of [-1, 1]) { g.add(deco(box(1.1, 1.3, 0.12, red, sx * 4, 3.4, 0.4))); g.add(deco(box(0.5, 0.5, 0.14, gold, sx * 4, 3.5, 0.46))); }

  // ===================== side rooms: a Library (left) and a Chapel (right) =====================
  const woodMat = mapped(T.wood), books = mapped(T.bookshelf), tile = mapped(T.tiled), rugMat = mapped(T.rug), panel = mapped(T.woodPanel),
        sgWin = new THREE.MeshStandardMaterial({ map: T.stainedGlass, emissive: 0xffffff, emissiveMap: T.stainedGlass, emissiveIntensity: 0.55, roughness: 0.3 });

  // divider walls between the central hall and each side room (doorway gap at z 8..11)
  const divider = (x) => { wallSeg(x, 0, x, 8, 5, 0.6, false); wallSeg(x, 11, x, 21, 5, 0.6, false); };
  divider(-10); divider(10);

  // --- Library (left) ---
  g.add(deco(box(12.5, 0.16, 21, woodMat, -16.2, 0.0, 10.5, false)));
  g.add(deco(box(8, 0.05, 6, rugMat, -16, 0.11, 9, false)));
  for (const z of [3, 7, 19]) g.add(deco(box(0.5, 3.4, 3.4, books, -22.0, 1.9, z)));            // shelves on the outer wall
  for (const x of [-20, -16, -12.5]) g.add(deco(box(3.4, 3.4, 0.5, books, x, 1.9, 20.5)));      // shelves on the back wall
  g.add(box(3.2, 0.95, 1.4, woodMat, -16, 0.48, 8));                                             // reading table
  g.add(deco(box(3.4, 0.12, 1.6, flat(0x4a3018), -16, 1.0, 8)));
  g.add(deco(box(0.5, 0.55, 0.5, woodMat, -16, 0.28, 9.5))); g.add(deco(box(0.5, 1.0, 0.12, woodMat, -16, 0.8, 9.75))); // chair
  g.add(deco(box(0.8, 0.1, 0.55, flat(0xece0c0), -16.4, 1.06, 8)));                              // open book
  g.add(deco(cyl(0.5, 0.55, 0.55, 12, flat(0x6a8db5), -14, 1.4, 8))); g.add(deco(cyl(0.16, 0.2, 0.5, 8, gold, -14, 1.0, 8))); // globe
  g.add(deco(box(0.14, 0.34, 0.14, candle, -17.4, 1.25, 8)));                                    // desk candle

  // --- Chapel (right) ---
  g.add(deco(box(12.5, 0.16, 21, tile, 16.2, 0.0, 10.5, false)));
  for (const z of [4, 8, 12, 16]) g.add(deco(box(0.2, 3.6, 2.2, sgWin, 22.3, 2.8, z)));          // stained-glass windows
  g.add(deco(box(2.4, 3.8, 0.2, sgWin, 16, 2.9, 20.6)));                                          // great window behind the altar
  g.add(box(2.6, 1.1, 1.2, stone, 16, 0.55, 19));                                                 // altar
  g.add(deco(box(2.9, 0.12, 1.4, flat(0x6e1f2f), 16, 1.16, 19)));
  for (const sx of [-1, 1]) { g.add(deco(cyl(0.09, 0.11, 0.8, 8, gold, 16 + sx, 1.6, 19))); g.add(deco(box(0.12, 0.34, 0.12, candle, 16 + sx, 2.2, 19))); }
  g.add(deco(box(0.22, 1.7, 0.22, gold, 16, 2.6, 19.3))); g.add(deco(box(0.95, 0.22, 0.22, gold, 16, 2.95, 19.3))); // cross
  for (const z of [9, 13]) for (const px of [13.4, 18.6]) { g.add(box(2.2, 0.45, 0.5, woodMat, px, 0.25, z)); g.add(deco(box(2.2, 0.7, 0.12, woodMat, px, 0.6, z - 0.32))); } // pews
  column(11.5, 6); column(11.5, 15);
  g.add(deco(cyl(0.7, 0.7, 0.1, 10, gold, 16, 4.6, 12)));
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.add(deco(box(0.1, 0.3, 0.1, candle, 16 + Math.cos(a) * 0.7, 4.7, 12 + Math.sin(a) * 0.7))); }

  // --- baldachin over the throne ---
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(deco(box(0.18, 4.2, 0.18, gold, sx * 1.7, 2.1, HD - 2.4 + sz)));
  g.add(deco(box(4.0, 0.3, 3.0, flat(0x6e1f2f), 0, 4.3, HD - 2.4)));
  g.add(deco(box(4.2, 0.5, 0.4, gold, 0, 4.55, HD - 3.9)));

  // --- extra grandeur: portraits, banners, sconces, urns, runner, room signs ---
  const portrait = mapped(T.portrait), heraldry = mapped(T.heraldry);
  for (const sx of [-1, 1]) for (const z of [5, 12, 18]) g.add(deco(box(0.1, 1.5, 1.1, portrait, sx * 9.78, 2.7, z)));   // hall portraits
  for (const sx of [-1, 1]) for (const z of [5.5, 16.5]) g.add(deco(box(0.1, 3.2, 1.5, heraldry, sx * 8.6, 3.5, z)));    // hanging banners
  const sconceG = (x, z) => { g.add(deco(box(0.14, 0.45, 0.14, wood, x, 2.7, z))); g.add(deco(box(0.24, 0.3, 0.24, flameMat, x, 3.0, z))); };
  for (const sx of [-1, 1]) for (const z of [3, 9, 15, -5, -11, -17]) sconceG(sx * 9.8, z);
  const urn = (x, z) => { g.add(deco(cyl(0.45, 0.3, 0.9, 10, stone, x, 0.45, z))); const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), flat(0x3f6e3a)); b.position.set(x, 1.15, z); b.scale.y = 0.9; b.castShadow = true; deco(b); g.add(b); };
  for (const sx of [-1, 1]) { urn(sx * 4, 1.5); urn(sx * 3, HD - 4.5); }
  g.add(deco(box(3, 0.06, 20, mapped(T.carpet), 0, 0.12, -11, false)));                                                 // courtyard runner
  statue(-9, -8); statue(9, -8);
  roomSign(g, 'ELDENMOOR KEEP', 0, 7.7, -22.5, Math.PI, 6, 1.3);
  roomSign(g, 'THRONE ROOM', 0, 5.6, HD - 0.8, Math.PI, 4, 0.9);
  roomSign(g, 'LIBRARY', -9.7, 3.5, 9.5, Math.PI / 2);
  roomSign(g, 'CHAPEL', 9.7, 3.5, 9.5, -Math.PI / 2);
  roomSign(g, 'ARMOURY', -9.7, 3.3, -16.5, Math.PI / 2);
  roomSign(g, 'KITCHEN', -9.7, 3.3, -5.5, Math.PI / 2);
  roomSign(g, 'BEDCHAMBER', 9.7, 3.3, -16.5, -Math.PI / 2);
  roomSign(g, 'TREASURY', 9.7, 3.3, -5.5, -Math.PI / 2);

  // --- castle exterior: giant banners, torch-lit causeway, raised portcullis ---
  const heraldryX = mapped(T.heraldry);
  for (const sx of [-1, 1]) g.add(deco(box(3, 6, 0.2, heraldryX, sx * 7, 3.3, -22.2)));   // banners flanking the gate
  const extBraz = (x, z) => { g.add(cyl(0.35, 0.22, 0.9, 8, stone, x, 0.45, z)); g.add(deco(box(0.5, 0.35, 0.5, flameMat, x, 1.1, z))); };
  extBraz(-7, -23.5); extBraz(7, -23.5); extBraz(-7, -26.5); extBraz(7, -26.5);          // braziers down the causeway
  for (let i = -2; i <= 2; i++) g.add(deco(box(0.16, 1.0, 0.16, flat(0x3a3a3e), i * 0.9, 5.2, -22)));   // raised portcullis teeth
  g.add(deco(box(5, 0.2, 0.3, flat(0x3a3a3e), 0, 5.7, -22)));

  // --- staircases (right = up to the solar; left = down to the cellar) ---
  const upS = makeStairs('up', 'UPPER FLOOR'); upS.position.set(8, 0, 3); g.add(upS);
  const dnS = makeStairs('down', 'CELLAR'); dnS.position.set(-8, 0, 3); g.add(dnS);

  return g;
}

// A flight of stone steps with a sign. Decorative — the floor swap is triggered
// when the player steps onto it (see scene.userData.stairs + main.js).
function makeStairs(dir, label) {
  const g = new THREE.Group();
  const stone = flat(0x8d877c), wood = flat(0x4a3320), dark = flat(0x120f0c);
  const up = dir === 'up';
  for (let i = 0; i < 6; i++) g.add(deco(box(2.6, 0.3, 0.55, stone, 0, up ? 0.15 + i * 0.32 : -0.15 - i * 0.32, i * 0.55)));
  if (!up) g.add(deco(box(2.9, 0.1, 3.6, dark, 0, -2.0, 1.4)));
  for (const sx of [-1, 1]) g.add(deco(box(0.2, 1.1, 3.6, wood, sx * 1.45, up ? 1.4 : -0.5, 1.4)));
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.7, 0.12), new THREE.MeshStandardMaterial({ map: signTexture(label), roughness: 0.85 }));
  sign.position.set(0, 2.6, -0.4); deco(sign); g.add(sign);
  return g;
}

// A flat, always-readable sign board facing direction `ry` (radians around Y).
function roomSign(g, text, x, y, z, ry, w = 2.4, h = 0.7) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTexture(text), side: THREE.DoubleSide }));
  m.position.set(x, y, z); m.rotation.y = ry; m.userData.noCollide = true; m.renderOrder = 1; g.add(m);
}

// ---------------------------------------------------------------------------
// UPPER FLOOR — the royal apartments (open gallery with furnished zones).
// ---------------------------------------------------------------------------
function makeUpper() {
  const T = tex();
  const g = new THREE.Group();
  const HW = 22, HD = 21, WH = 3.6, TH = 0.6;
  const stone = mapped(T.wall), woodF = mapped(T.wood), rugMat = mapped(T.rug), books = mapped(T.bookshelf),
        wood = flat(0x4a3320), gold = flat(0xd8b24a, 0.4), red = flat(0x8a1f1f), steel = flat(0x9aa0a8, 0.5);
  const candle = new THREE.MeshStandardMaterial({ color: 0xffe6a3, emissive: 0xffcf6a, emissiveIntensity: 1.5, roughness: 0.5 });
  const sg = new THREE.MeshStandardMaterial({ map: T.stainedGlass, emissive: 0xffffff, emissiveMap: T.stainedGlass, emissiveIntensity: 0.5, roughness: 0.3 });
  const wallSeg = (x0, z0, x1, z1, h = WH, th = TH) => { const w = Math.max(th, Math.abs(x1 - x0)), d = Math.max(th, Math.abs(z1 - z0)); g.add(box(w, h, d, stone, (x0 + x1) / 2, h / 2, (z0 + z1) / 2)); };
  const merlon = (x0, z0, x1, z1) => { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.6)); for (let i = 0; i <= n; i++) { const t = i / n; g.add(deco(box(0.5, 0.5, 0.5, stone, x0 + (x1 - x0) * t, WH + 0.25, z0 + (z1 - z0) * t))); } };
  const sconce = (x, z) => { g.add(deco(box(0.14, 0.4, 0.14, wood, x, 2.3, z))); g.add(deco(box(0.24, 0.28, 0.24, candle, x, 2.6, z))); };
  const chandelier = (x, z, lit) => { g.add(deco(box(0.05, 1.6, 0.05, flat(0x2a2622), x, 4.4, z))); g.add(deco(cyl(0.9, 0.9, 0.12, 12, gold, x, 3.5, z))); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.add(deco(box(0.1, 0.28, 0.1, candle, x + Math.cos(a) * 0.8, 3.7, z + Math.sin(a) * 0.8))); } if (lit) { const pl = new THREE.PointLight(0xffce7a, 4, 18, 2); pl.position.set(x, 3.3, z); g.add(pl); } };

  g.add(deco(box(HW * 2, 0.16, HD * 2, woodF, 0, 0.0, 0, false)));                 // wood floor
  wallSeg(-HW, HD, HW, HD); merlon(-HW, HD, HW, HD);
  wallSeg(-HW, -HD, -HW, HD); merlon(-HW, -HD, -HW, HD);
  wallSeg(HW, -HD, HW, HD); merlon(HW, -HD, HW, HD);
  wallSeg(-HW, -HD, -6, -HD); wallSeg(6, -HD, HW, -HD);                            // front wall (balcony gap)
  for (let x = -6; x <= 6; x += 1.3) g.add(deco(box(0.16, 0.9, 0.16, stone, x, 0.45, -HD)));   // balcony railing
  g.add(deco(box(12.6, 0.2, 0.3, stone, 0, 0.9, -HD)));
  for (const sx of [-1, 1]) for (const z of [-12, -4, 6, 14]) g.add(deco(box(0.2, 2.4, 1.6, sg, sx * (HW - 0.04), 1.8, z)));
  for (const x of [-12, 0, 12]) g.add(deco(box(1.6, 2.4, 0.2, sg, x, 1.8, HD - 0.04)));
  for (const sx of [-1, 1]) for (const z of [-14, -6, 4, 12]) sconce(sx * (HW - 0.5), z);
  chandelier(0, 2, true); chandelier(0, 14, true);

  const dn = makeStairs('down', 'GROUND FLOOR'); dn.position.set(8, 0, 3); g.add(dn);

  // central seating + rug
  g.add(deco(box(10, 0.05, 7, rugMat, 0, 0.1, 4, false)));
  g.add(box(2.2, 0.4, 1.0, wood, -3, 0.4, 4)); g.add(deco(box(0.5, 0.7, 0.1, wood, -3, 0.9, 3.6)));     // a chair

  // Royal Solar (back-centre)
  g.add(box(2.0, 1.0, 1.2, gold, 0, 0.55, HD - 3)); g.add(deco(box(2.0, 1.6, 0.3, red, 0, 1.6, HD - 2.5)));   // royal seat
  for (const z of [HD - 6, HD - 3]) g.add(deco(box(0.5, 2.6, 3.0, books, -HW + 0.7, 1.3, z)));               // bookshelves
  g.add(deco(box(1.2, 1.6, 0.12, mapped(T.portrait), 5, 2.2, HD - 0.3)));                                     // royal portrait
  g.add(deco(box(0.5, 3.0, 3.0, stone, HW - 0.3, 1.5, HD - 4)));                                              // fireplace breast
  g.add(deco(box(0.5, 1.0, 2.0, new THREE.MeshStandardMaterial({ color: 0xff7a1e, emissive: 0xff5500, emissiveIntensity: 1.1, roughness: 0.7 }), HW - 0.5, 0.6, HD - 4)));

  // War Room (left)
  g.add(box(5, 0.9, 3.4, wood, -13, 0.45, -10)); g.add(deco(box(5.2, 0.1, 3.6, flat(0x3f6e3a), -13, 0.95, -10)));   // map table
  for (let i = 0; i < 8; i++) g.add(deco(box(0.2, 0.4, 0.2, i % 2 ? steel : gold, -15 + (i % 4) * 1.3, 1.2, -11 + (i > 3 ? 1.4 : 0))));
  for (const sx of [-1, 1]) g.add(deco(box(1.6, 2.6, 0.1, mapped(T.heraldry), -13 + sx * 2.4, 2.0, -13)));

  // Royal Bedchamber (right)
  g.add(box(3.2, 0.7, 4.2, wood, 13, 0.35, -12)); g.add(deco(box(3.0, 0.4, 4.0, red, 13, 0.75, -12)));
  g.add(deco(box(2.8, 0.3, 0.8, flat(0xece0c0), 13, 1.0, -13.7)));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(deco(box(0.2, 2.6, 0.2, wood, 13 + sx * 1.5, 1.3, -12 + sz * 2)));
  g.add(deco(box(3.6, 0.25, 4.6, flat(0x6e1f2f), 13, 2.6, -12)));
  g.add(box(2.0, 2.6, 0.9, wood, 19, 1.3, -8));                                                               // wardrobe

  // --- upper-floor detail + signs ---
  const portraitU = mapped(T.portrait);
  roomSign(g, 'ROYAL SOLAR', 0, 3.1, HD - 5.5, Math.PI);
  roomSign(g, 'WAR ROOM', -13, 3.1, -5.5, 0);
  roomSign(g, 'ROYAL BEDCHAMBER', 13, 3.1, -6.5, 0);
  roomSign(g, 'BALCONY', 0, 2.4, -HD + 2, 0, 3, 0.8);
  g.add(box(2.4, 0.9, 1.1, wood, -5, 0.45, HD - 4));                                                          // writing desk
  g.add(deco(box(0.8, 0.1, 0.55, flat(0xece0c0), -5.2, 0.96, HD - 4)));
  g.add(deco(cyl(0.5, 0.55, 0.55, 12, flat(0x6a8db5), -7, 1.3, HD - 4)));                                     // globe
  g.add(deco(box(0.6, 0.9, 0.25, wood, 6, 1.0, HD - 4))); g.add(deco(box(0.14, 1.3, 0.14, wood, 6, 1.9, HD - 4)));   // lute
  for (const sx of [-1, 1]) { g.add(deco(cyl(0.16, 0.2, 1.6, 8, gold, sx * 5, 0.8, HD - 1.6))); g.add(deco(box(0.22, 0.3, 0.22, candle, sx * 5, 1.7, HD - 1.6))); }
  g.add(box(0.4, 1.6, 2.6, wood, -HW + 0.6, 0.8, -6));                                                        // war-room scroll rack
  for (let i = 0; i < 4; i++) g.add(deco(cyl(0.09, 0.09, 0.5, 6, flat(0xece0c0), -HW + 0.9, 1.0 + (i % 2) * 0.5, -7 + i * 0.5)));
  for (let i = 0; i < 6; i++) g.add(deco(box(0.18, 0.42, 0.18, i % 2 ? steel : gold, -15 + (i % 3) * 1.4, 1.2, -8.6)));
  g.add(deco(box(0.7, 0.6, 0.7, wood, 9.5, 0.3, -13.5))); g.add(deco(box(0.18, 0.4, 0.18, candle, 9.5, 0.8, -13.5)));   // nightstand
  g.add(box(1.3, 0.7, 0.8, wood, 9.5, 0.35, -9)); g.add(deco(box(1.1, 0.16, 0.7, flat(0x3a2415), 9.5, 0.78, -9)));     // chest
  g.add(deco(box(0.2, 2.2, 1.0, flat(0x9ec6d8), 17, 1.3, -14)));                                              // mirror
  for (const sx of [-1, 1]) { g.add(deco(cyl(0.4, 0.3, 0.7, 8, stone, sx * 9, 0.35, -HD + 2))); const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), flat(0x3f6e3a)); b.position.set(sx * 9, 1.0, -HD + 2); deco(b); g.add(b); }
  g.add(deco(cyl(0.1, 0.1, 1.3, 8, flat(0x2a2a30), 0, 0.9, -HD + 3))); g.add(deco(cyl(0.16, 0.1, 0.6, 8, gold, 0.4, 1.5, -HD + 3.4)));   // telescope
  for (const sx of [-1, 1]) g.add(box(2.2, 0.4, 0.5, wood, sx * 4, 0.2, -HD + 3.2));                          // benches
  for (const z of [-8, 4, 14]) { g.add(deco(box(0.1, 1.4, 1.0, portraitU, -HW + 0.3, 2.4, z))); g.add(deco(box(0.1, 1.4, 1.0, portraitU, HW - 0.3, 2.4, z))); }
  for (const sx of [-1, 1]) for (const z of [-10, 0, 10]) sconce(sx * (HW - 0.5), z);
  chandelier(0, -8, false);

  // --- richly furnish the royal floor (rugs, council hall, library wall, hearth) ---
  const tapU = mapped(T.tapestry), tapB2 = mapped(T.tapestryB);
  g.add(deco(box(12, 0.05, 8, rugMat, 0, 0.1, HD - 6, false)));                              // solar rug
  g.add(deco(box(9, 0.05, 9, mapped(T.carpet), -13, 0.1, -7, false)));                       // war-room runner
  g.add(deco(box(8, 0.05, 8, rugMat, 13, 0.1, -10, false)));                                 // bedchamber rug
  const baluster = (x0, z0, x1, z1) => { const dx = x1 - x0, dz = z1 - z0, n = Math.max(1, Math.round(Math.hypot(dx, dz) / 0.7)); for (let i = 0; i <= n; i++) { const t = i / n; g.add(deco(cyl(0.07, 0.09, 0.85, 8, stone, x0 + dx * t, 0.42, z0 + dz * t))); } g.add(deco(box(Math.max(0.1, Math.abs(dx)) + 0.12, 0.16, Math.max(0.1, Math.abs(dz)) + 0.12, stone, (x0 + x1) / 2, 0.9, (z0 + z1) / 2))); };
  baluster(-11, -3, -11, 6); baluster(11, -3, 11, 6);
  // council table + chairs + candelabra (solar)
  g.add(box(2.2, 0.85, 6, wood, 0, 0.42, HD - 6)); g.add(deco(box(2.4, 0.12, 6.2, flat(0x5a3a22), 0, 0.9, HD - 6)));
  for (const sz of [HD - 8, HD - 6, HD - 4]) for (const sx of [-1, 1]) { g.add(box(0.5, 0.5, 0.5, wood, sx * 1.7, 0.25, sz)); g.add(deco(box(0.5, 0.8, 0.12, wood, sx * 1.95, 0.7, sz))); }
  for (const sz of [HD - 7.5, HD - 4.5]) { g.add(deco(cyl(0.1, 0.13, 0.4, 8, gold, 0, 1.1, sz))); g.add(deco(box(0.14, 0.26, 0.14, candle, 0, 1.4, sz))); }
  // back-wall library + tapestries
  for (const x of [-19, -15, 15, 19]) g.add(deco(box(3.4, 2.6, 0.4, books, x, 1.3, HD - 0.4)));
  g.add(deco(box(2.4, 3.0, 0.1, tapU, -8.5, 1.9, HD - 0.3))); g.add(deco(box(2.4, 3.0, 0.1, tapB2, 8.5, 1.9, HD - 0.3)));
  // hearth on the left wall + mantel
  g.add(deco(box(0.4, 3.0, 3, stone, -HW + 0.2, 1.5, 3))); g.add(deco(box(0.5, 1.2, 2, new THREE.MeshStandardMaterial({ color: 0xff7a1e, emissive: 0xff5500, emissiveIntensity: 1.1, roughness: 0.7 }), -HW + 0.45, 0.7, 3))); g.add(deco(box(0.7, 0.3, 3.4, stone, -HW + 0.3, 3.1, 3)));
  // potted plants in the corners + wall portraits
  const plant = (x, z) => { g.add(deco(cyl(0.34, 0.26, 0.6, 8, stone, x, 0.3, z))); const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), flat(0x3f6e3a)); b.position.set(x, 0.95, z); b.castShadow = true; deco(b); g.add(b); };
  for (const p of [[-HW + 1.5, -HD + 2], [HW - 1.5, -HD + 2], [-HW + 1.5, HD - 2], [HW - 1.5, HD - 2]]) plant(p[0], p[1]);
  for (const z of [-12, -2]) { g.add(deco(box(0.1, 1.3, 0.95, portraitU, -HW + 0.3, 2.3, z))); g.add(deco(box(0.1, 1.3, 0.95, portraitU, HW - 0.3, 2.3, z))); }

  return g;
}

// ---------------------------------------------------------------------------
// BASEMENT — cellar / dungeon / crypt / vault (dark, torch-lit).
// ---------------------------------------------------------------------------
function makeBasement() {
  const T = tex();
  const g = new THREE.Group();
  const HW = 22, HD = 21, WH = 4, TH = 0.7;
  const stone = mapped(T.wall, 0x6f6a60), floorD = mapped(T.dirt, 0x9a8a6a),
        wood = flat(0x4a3320), dark = flat(0x141210), bone = flat(0xcfc8b6), gold = flat(0xd8b24a, 0.4);
  const torchM = new THREE.MeshStandardMaterial({ color: 0xffb33a, emissive: 0xff7b00, emissiveIntensity: 1.8, roughness: 0.5 });
  const wallSeg = (x0, z0, x1, z1, h = WH, th = TH) => { const w = Math.max(th, Math.abs(x1 - x0)), d = Math.max(th, Math.abs(z1 - z0)); g.add(box(w, h, d, stone, (x0 + x1) / 2, h / 2, (z0 + z1) / 2)); };
  const torch = (x, z, lit) => { g.add(deco(box(0.14, 0.5, 0.14, wood, x, 2.0, z))); g.add(deco(box(0.24, 0.3, 0.24, torchM, x, 2.4, z))); if (lit) { const pl = new THREE.PointLight(0xffa53a, 5, 13, 2); pl.position.set(x, 2.4, z); g.add(pl); } };
  const bars = (x0, z0, x1, z1) => { const n = Math.max(2, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.5)); for (let i = 0; i <= n; i++) { const t = i / n; g.add(deco(box(0.1, 2.6, 0.1, dark, x0 + (x1 - x0) * t, 1.3, z0 + (z1 - z0) * t))); } };

  g.add(deco(box(HW * 2, 0.16, HD * 2, floorD, 0, 0.0, 0, false)));               // dirt floor
  wallSeg(-HW, HD, HW, HD); wallSeg(-HW, -HD, -HW, HD); wallSeg(HW, -HD, HW, HD); wallSeg(-HW, -HD, HW, -HD);
  for (const sx of [-1, 1]) for (const z of [-14, -2, 10]) torch(sx * (HW - 0.6), z, true);
  torch(-6, 18, false); torch(6, 18, false);

  const up = makeStairs('up', 'GROUND FLOOR'); up.position.set(-8, 0, 3); g.add(up);

  // Wine cellar (left)
  for (const z of [-16, -13, -10]) for (const sx of [0, 1]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.6, 12), wood); b.rotation.z = Math.PI / 2; b.position.set(-HW + 2.5 + sx * 1.6, 0.7, z); deco(b); g.add(b); }
  g.add(deco(box(0.4, 2.4, 7, wood, -HW + 0.6, 1.2, -13)));

  // Dungeon cells (back-left)
  wallSeg(-HW, 6, -12, 6, WH, 0.5); wallSeg(-12, 6, -12, 18, WH, 0.5);
  bars(-12, 6, -12, 11); bars(-12, 13, -12, 18);                                   // barred fronts (gap z11-13 = cell door)
  bars(-HW, 12, -12, 12);                                                          // divider between two cells
  g.add(deco(box(1.6, 0.4, 0.6, wood, -17, 0.25, 8))); g.add(deco(box(1.6, 0.4, 0.6, wood, -17, 0.25, 15)));   // cots

  // Crypt (back-right)
  for (const z of [9, 13, 17]) { g.add(box(2.4, 1.0, 1.2, stone, HW - 3, 0.5, z)); g.add(deco(box(2.6, 0.12, 1.4, stone, HW - 3, 1.06, z))); g.add(deco(box(0.4, 0.5, 1.2, bone, HW - 1.3, 0.3, z))); }
  for (const sx of [-1, 1]) g.add(deco(box(1.4, 1.4, 0.04, new THREE.MeshStandardMaterial({ color: 0xdfdcd0, transparent: true, opacity: 0.22 }), HW - 0.8, 3.0, 13)));

  // Vault (centre-back)
  g.add(box(3.0, 2.6, 0.6, flat(0x55585e), 0, 1.3, HD - 0.6)); g.add(deco(cyl(0.5, 0.5, 0.16, 12, gold, 0, 1.3, HD - 0.9)));
  for (const p of [[-1.5, HD - 3], [-0.6, HD - 3], [0.4, HD - 3.4], [1.3, HD - 3]]) g.add(deco(box(0.6, 0.5, 0.6, gold, p[0], 0.25, p[1])));
  for (const cx of [-2, 2]) { g.add(box(1.3, 0.8, 0.9, wood, cx, 0.4, HD - 4)); g.add(deco(box(1.1, 0.34, 0.7, gold, cx, 0.85, HD - 4))); }

  // Storeroom (centre-front)
  for (const p of [[-3, -12], [-2, -12], [-2.6, -13], [3, -13], [2, -12]]) g.add(box(0.9, 0.9, 0.9, wood, p[0], 0.45, p[1]));
  for (const p of [[0, -15], [1.2, -15], [-1.2, -15.4]]) g.add(deco(cyl(0.5, 0.6, 0.9, 8, flat(0xc9a24a), p[0], 0.45, p[1])));

  // --- basement detail + signs ---
  const gem = (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.3 });
  roomSign(g, 'WINE CELLAR', -HW + 3, 2.4, -7, Math.PI / 2);
  roomSign(g, 'DUNGEON', -16, 2.6, 5, 0);
  roomSign(g, 'CRYPT', HW - 4, 2.6, 7, 0);
  roomSign(g, 'VAULT', 0, 2.6, HD - 3.5, Math.PI);
  roomSign(g, 'STOREROOM', 0, 2.2, -16.5, 0);
  for (const sx of [-1, 1]) for (const z of [-6, 8]) { g.add(cyl(0.6, 0.7, WH, 10, stone, sx * 7, WH / 2, z)); g.add(deco(box(1.2, 0.4, 1.2, stone, sx * 7, WH - 0.2, z))); }   // vaulted pillars
  for (const sx of [-1, 1]) g.add(deco(box(0.6, 0.5, 15, stone, sx * 7, WH - 0.1, 1)));                        // arch beams
  g.add(deco(box(0.3, 0.12, 1.4, bone, -18, 0.32, 15))); g.add(deco(box(0.4, 0.4, 0.4, bone, -18, 0.42, 14.2)));   // skeleton
  for (const z of [8, 16]) { g.add(deco(box(0.05, 1.2, 0.05, dark, -21.8, 1.6, z))); g.add(deco(box(0.2, 0.2, 0.2, flat(0x55585e), -21.8, 1.0, z))); }   // chains + manacles
  g.add(box(1.6, 0.6, 0.5, wood, -14.5, 0.3, 8.5)); g.add(deco(box(0.2, 1.2, 0.2, wood, -15.2, 0.6, 8.5)));    // rack
  for (const p of [[-19, 9], [-16.5, 16.5]]) g.add(deco(box(1.2, 0.16, 1.2, flat(0xc9a24a), p[0], 0.12, p[1])));   // straw
  g.add(deco(box(0.5, 0.3, 1.6, bone, HW - 3, 1.18, 13)));                                                     // effigy on a tomb
  for (const z of [9, 17]) { g.add(deco(cyl(0.14, 0.18, 1.4, 8, dark, HW - 5, 0.7, z))); g.add(deco(box(0.22, 0.3, 0.22, torchM, HW - 5, 1.5, z))); }   // crypt candelabra
  for (const p of [[HW - 1.4, 11], [HW - 1.6, 15]]) g.add(deco(box(0.32, 0.3, 0.28, bone, p[0], 0.25, p[1])));   // skulls
  g.add(box(0.4, 2.2, 5, wood, -HW + 0.5, 1.1, -10));                                                          // wine rack
  for (let i = 0; i < 12; i++) g.add(deco(box(0.18, 0.5, 0.18, gem(0x3a6e3a), -HW + 0.95, 0.6 + (i % 3) * 0.6, -12 + Math.floor(i / 3) * 1.2)));
  g.add(box(1.6, 0.8, 1.0, wood, -18, 0.4, -6)); for (const sx of [-1, 1]) g.add(deco(cyl(0.06, 0.08, 0.2, 6, gold, -18 + sx * 0.4, 0.9, -6)));   // tasting table
  for (const p of [[-1.5, HD - 5], [0, HD - 5.5], [1.5, HD - 5]]) g.add(deco(cyl(0.6, 0, 0.5, 8, gold, p[0], 0.25, p[1])));   // gold piles
  for (const c of [[0xc0392b, -1.2], [0x2980b9, -0.3], [0x27ae60, 0.6], [0xd4ac0d, 1.4]]) g.add(deco(box(0.22, 0.2, 0.22, gem(c[0]), c[1], 0.2, HD - 4.4)));   // gems
  for (const p of [[-3, -16], [-2, -16.5], [-3.5, -15.3], [3, -16], [2.2, -16.6]]) g.add(deco(cyl(0.45, 0.55, 0.9, 8, flat(0xb8a06a), p[0], 0.45, p[1])));   // grain sacks
  for (const x of [-1, 0.6]) { g.add(deco(box(0.06, 0.8, 0.06, dark, x, 2.0, -18))); g.add(deco(box(0.4, 0.5, 0.3, flat(0x8a3a2a), x, 1.4, -18))); }   // hanging meat
  torch(0, -2, true); torch(-3, HD - 6, true); torch(3, HD - 6, true);                                        // more torches

  return g;
}

// A cosy tavern — enterable, with a hideable roof, a bar, a hearth and tables.
function makeTavern() {
  const T = tex();
  const g = new THREE.Group();
  const HW = 6.5, HD = 5.5, H = 3.6, TH = 0.4, DOOR = 1.7;
  const wallMat = mapped(T.plaster, 0xb89a6a), beam = flat(0x4a3220), floorMat = mapped(T.wood),
        woodMat = flat(0x6b4a2c), stoneMat = mapped(T.wall);
  const glass = new THREE.MeshStandardMaterial({ color: 0x86bcd6, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.55 });
  const ember = new THREE.MeshStandardMaterial({ color: 0xff7a1e, emissive: 0xff5500, emissiveIntensity: 1.1, roughness: 0.7 });
  const candle = new THREE.MeshStandardMaterial({ color: 0xffe6a3, emissive: 0xffb142, emissiveIntensity: 1.3, roughness: 0.5 });
  const wallSeg = (x0, z0, x1, z1) => { const w = Math.max(TH, Math.abs(x1 - x0)), d = Math.max(TH, Math.abs(z1 - z0)); g.add(box(w, H, d, wallMat, (x0 + x1) / 2, H / 2, (z0 + z1) / 2)); };

  g.add(deco(box(HW * 2, 0.2, HD * 2, floorMat, 0, 0.06, 0, false)));
  wallSeg(-HW, -HD, HW, -HD);                                   // back
  wallSeg(-HW, -HD, -HW, HD); wallSeg(HW, -HD, HW, HD);         // sides
  wallSeg(-HW, HD, -DOOR, HD); wallSeg(DOOR, HD, HW, HD);       // front (door faces +z, the town)
  for (const sx of [-1, 1]) g.add(box(0.3, 2.6, 0.5, beam, sx * DOOR, 1.3, HD));
  g.add(box(DOOR * 2 + 0.6, 0.4, 0.5, beam, 0, 2.6, HD));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.3, H, 0.3, beam, sx * HW, H / 2, sz * HD));
  for (const sz of [-1, 1]) g.add(deco(box(HW * 2, 0.25, 0.32, beam, 0, H - 0.5, sz * HD)));
  for (const sz of [-2.5, 2.5]) for (const sx of [-1, 1]) g.add(deco(box(0.18, 1.3, 1.5, glass, sx * (HW - 0.02), 1.9, sz)));
  // hideable roof + chimney + signpost
  const roof = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), mapped(T.shingle, 0x5a3a2a)); cone.scale.set(HW + 1.4, 3.6, HD + 1.4); cone.position.y = H + 1.7; cone.rotation.y = Math.PI / 4; cone.castShadow = true; deco(cone); roof.add(cone);
  roof.add(deco(box(HW * 2 + 1.6, 0.35, HD * 2 + 1.6, beam, 0, H + 0.05, 0)));
  roof.add(deco(box(0.8, 2.4, 0.8, stoneMat, HW - 1.4, H + 1.7, -HD + 1.4)));
  g.add(roof);
  // bar + back shelf with bottles + stools
  g.add(box(6, 1.1, 0.9, woodMat, 0, 0.55, -HD + 1.4));
  g.add(deco(box(6.2, 0.14, 1.1, flat(0x5a3a22), 0, 1.16, -HD + 1.4)));
  g.add(box(5.5, H - 1.0, 0.4, woodMat, 0, (H - 1.0) / 2, -HD + 0.3));
  for (let i = 0; i < 10; i++) g.add(deco(box(0.16, 0.4, 0.16, flat([0x3a6e3a, 0x8a3a2a, 0x6a4a8a][i % 3]), -2.4 + i * 0.55, 0.7 + (i % 2) * 0.7, -HD + 0.35)));
  for (const x of [-2, 0, 2]) g.add(deco(cyl(0.22, 0.24, 0.55, 8, woodMat, x, 0.27, -HD + 2.6)));
  // hearth (right wall) + light
  g.add(deco(box(0.5, 3.4, 3, stoneMat, HW - 0.2, 1.7, -HD + 3)));
  g.add(deco(box(0.6, 1.4, 2, ember, HW - 0.5, 0.85, -HD + 3)));
  { const pl = new THREE.PointLight(0xffa53a, 4, 14, 2); pl.position.set(HW - 2, 1.4, -HD + 3); g.add(pl); }
  // tables + stools + mugs
  const table = (x, z) => {
    g.add(box(1.5, 0.85, 1.5, woodMat, x, 0.42, z)); g.add(deco(box(1.7, 0.12, 1.7, flat(0x5a3a22), x, 0.9, z)));
    for (let a = 0; a < 4; a++) { const an = a / 4 * Math.PI * 2; g.add(deco(cyl(0.2, 0.22, 0.45, 8, woodMat, x + Math.cos(an) * 1.15, 0.22, z + Math.sin(an) * 1.15))); }
    g.add(deco(cyl(0.12, 0.14, 0.22, 8, flat(0xb8a06a), x + 0.3, 1.05, z)));
  };
  table(2.8, 2.6); table(-2.8, 2.6); table(2.8, -1); table(-3, -1.5);
  // chandelier + barrels
  g.add(deco(box(0.05, 1.3, 0.05, beam, 0, 3.5, 1))); g.add(deco(cyl(0.8, 0.8, 0.1, 10, beam, 0, 2.9, 1)));
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.add(deco(box(0.1, 0.26, 0.1, candle, Math.cos(a) * 0.7, 3.1, 1 + Math.sin(a) * 0.7))); }
  for (const p of [[-HW + 1, HD - 1.5], [HW - 1, HD - 2]]) g.add(cyl(0.4, 0.46, 0.95, 10, woodMat, p[0], 0.47, p[1]));

  g.userData.roof = roof; g.userData.hw = HW + 0.8; g.userData.hd = HD + 0.8;
  return g;
}

function footprintOf(b) {
  return { minX: b.position.x - b.userData.hw, maxX: b.position.x + b.userData.hw, minZ: b.position.z - b.userData.hd, maxZ: b.position.z + b.userData.hd };
}

export function buildStructures(scene) {
  const castle = makeCastle(); castle.position.set(0, 0, 46); scene.add(castle);

  const general = makeShop({ wall: 0xcdb98c, roof: 0x7a4a2a, wares: [0x8a1f1f, 0x2f6ea5, 0xc9a24a, 0x3f6e44, 0x9a6a2a] });
  general.position.set(-15, 0, 12); scene.add(general);

  const axes = makeShop({ wall: 0x9a9690, roof: 0x46586a, wares: [0x8a8f96, 0x5fb0e6, 0x9a6cff, 0xc9a24a, 0x6e3a3a] });
  axes.position.set(15, 0, 12); scene.add(axes);

  const tavern = makeTavern(); tavern.position.set(-16, 0, -14); scene.add(tavern);

  // upper floor + basement (hidden until you take the stairs)
  const upper = makeUpper(); upper.position.set(0, 0, 46); upper.visible = false; scene.add(upper);
  const basement = makeBasement(); basement.position.set(0, 0, 46); basement.visible = false; scene.add(basement);

  scene.userData.buildings = [castle, general, axes, tavern];
  scene.userData.upperBuildings = [upper];
  scene.userData.basementBuildings = [basement];
  scene.userData.keep = { ground: castle, upper, basement };
  (scene.userData.outdoor = scene.userData.outdoor || []).push(general, axes, tavern);
  scene.userData.stairs = [
    { floor: 0, x: 8, z: 49, r: 1.7, to: 1, lx: 8, lz: 52 },    // ground → upper
    { floor: 0, x: -8, z: 49, r: 1.7, to: -1, lx: -8, lz: 52 }, // ground → cellar
    { floor: 1, x: 8, z: 49, r: 1.7, to: 0, lx: 8, lz: 52 },    // upper → ground
    { floor: -1, x: -8, z: 49, r: 1.7, to: 0, lx: -8, lz: 52 }, // cellar → ground
  ];
  scene.userData.enterables = [
    { roof: general.userData.roof, footprint: footprintOf(general) },
    { roof: axes.userData.roof, footprint: footprintOf(axes) },
    { roof: tavern.userData.roof, footprint: footprintOf(tavern) },
  ];
}
