// player.js — a smooth, human-like hero built from capsules and spheres with a
// jointed rig (hips+knees, shoulders+elbows) so the walk and chop look natural.
// The base hero wears a plain shirt + pants; armour is added on top by
// setWornGear() whenever an equipment slot changes (mirrors setHeldWeapon).

import * as THREE from '../vendor/three.module.js';

function mat(color, flat = false) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: flat });
}

export function createPlayer() {
  const player = new THREE.Group();
  const body = new THREE.Group();
  player.add(body);

  const skin = mat(0xe8b48f), shirt = mat(0x2e6e6e), pants = mat(0x3a3326),
        boot = mat(0x33251a), hair = mat(0x5b3f29), eye = mat(0x141414),
        belt = mat(0x4a3220);

  const cap = (r, len, m, x, y, z) => { const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };
  const ball = (r, m, x, y, z) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };
  const cyl = (rt, rb, h, m, x, y, z) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 16), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };

  // legs: hip group → thigh, then a knee (lower) group → shin + foot
  const makeLeg = () => {
    const hip = new THREE.Group();
    hip.add(cap(0.135, 0.24, pants, 0, -0.21, 0));
    const lower = new THREE.Group(); lower.position.set(0, -0.42, 0);
    lower.add(cap(0.115, 0.24, pants, 0, -0.2, 0));
    const foot = ball(0.15, boot, 0, -0.44, 0.08); foot.scale.set(1, 0.6, 1.5); lower.add(foot);
    hip.add(lower); hip.userData.lower = lower;
    return hip;
  };
  const legL = makeLeg(); legL.position.set(0.15, 0.86, 0);
  const legR = makeLeg(); legR.position.set(-0.15, 0.86, 0);
  body.add(legL, legR);

  // pelvis + heroic V-tapered torso (broad chest → trim waist) + shoulders + belt
  body.add(cyl(0.24, 0.27, 0.3, pants, 0, 0.92, 0));                       // hips
  body.add(cyl(0.33, 0.26, 0.42, shirt, 0, 1.44, 0));                      // broad chest
  body.add(cyl(0.26, 0.24, 0.32, shirt, 0, 1.08, 0));                      // trim waist
  for (const sx of [-1, 1]) { const d = ball(0.15, shirt, sx * 0.29, 1.55, 0); d.scale.set(1, 0.92, 1.05); body.add(d); } // deltoids
  body.add(cyl(0.27, 0.27, 0.12, belt, 0, 0.97, 0));                       // belt
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, 0.05), mat(0x9a7b34)); buckle.position.set(0, 0.97, 0.27); buckle.castShadow = true; body.add(buckle);

  // arms: shoulder group → upper arm, then an elbow (lower) group → forearm + bare hand
  const makeArm = () => {
    const sh = new THREE.Group();
    sh.add(cap(0.1, 0.2, shirt, 0, -0.16, 0));
    const lower = new THREE.Group(); lower.position.set(0, -0.34, 0);
    lower.add(cap(0.088, 0.2, shirt, 0, -0.15, 0));
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.1), skin); palm.position.set(0, -0.34, 0.02); palm.castShadow = true; lower.add(palm);
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.05), skin); thumb.position.set(0.07, -0.3, 0.04); thumb.castShadow = true; lower.add(thumb);
    sh.add(lower); sh.userData.lower = lower;
    return sh;
  };
  const armL = makeArm(); armL.position.set(0.33, 1.5, 0); armL.rotation.z = 0.1;
  const armR = makeArm(); armR.position.set(-0.33, 1.5, 0); armR.rotation.z = -0.1;
  body.add(armL, armR);

  // neck, head, face, hair
  body.add(cyl(0.09, 0.11, 0.16, skin, 0, 1.64, 0));
  const head = ball(0.26, skin, 0, 1.86, 0); head.scale.set(0.92, 1.06, 0.95); body.add(head);
  body.add(ball(0.048, eye, 0.1, 1.9, 0.21)); body.add(ball(0.048, eye, -0.1, 1.9, 0.21));
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.13, 10), skin); nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.84, 0.25); body.add(nose);
  const mouth = ball(0.05, mat(0x9a5b50), 0, 1.75, 0.23); mouth.scale.set(1.7, 0.45, 0.5); body.add(mouth);
  for (const sx of [-1, 1]) body.add(ball(0.06, skin, sx * 0.25, 1.86, 0.01));         // ears
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.045, 0.08), skin); brow.position.set(0, 1.96, 0.2); brow.castShadow = true; body.add(brow); // brow ridge
  const jaw = ball(0.18, skin, 0, 1.76, 0.05); jaw.scale.set(0.95, 0.7, 0.95); body.add(jaw); // defined jaw
  const hcap = ball(0.28, hair, 0, 1.96, -0.04); hcap.scale.set(1.04, 0.86, 1.06); body.add(hcap);
  const fringe = ball(0.23, hair, 0, 2.0, 0.14); fringe.scale.set(1.25, 0.5, 0.7); body.add(fringe);

  player.userData = { body, legL, legR, armL, armR, held: null, worn: {}, hairParts: [hcap, fringe] };
  player.position.set(0, 0, 0);
  return player;
}

// Put a weapon in the hero's hand (a child of the right forearm, so it swings).
export function setHeldWeapon(player, def) {
  const hand = player.userData.armR.userData.lower;
  if (player.userData.held) { hand.remove(player.userData.held); player.userData.held = null; }
  if (!def || def.tool !== 'axe') return;

  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x5b3d22, roughness: 0.9 });
  const blade = new THREE.MeshStandardMaterial({ color: def.headColor || 0xbfc4cc, roughness: 0.5, metalness: 0.4 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.9, 8), wood); handle.castShadow = true; g.add(handle);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.44), blade); head.position.set(0, 0.4, 0.13); head.castShadow = true; g.add(head);
  g.position.set(0, -0.4, 0.12); g.rotation.x = 0.3;
  hand.add(g);
  player.userData.held = g;
}

// Put on / take off a piece of armour. `slot` is an equipment slot id (head,
// body, legs, hands, feet, shield, cape); `def` is the item (or null to remove).
// The gear leans Old-School-RuneScape silhouette × World-of-Warcraft heroics:
// chunky readable plates, oversized flared pauldrons, gold filigree and a glowing
// gem. Each piece is parented to the matching rig part so it moves with the hero.
export function setWornGear(player, slot, def) {
  const ud = player.userData;
  ud.worn = ud.worn || {};

  // take off whatever is currently in this slot
  const prev = ud.worn[slot];
  if (prev) { for (const [parent, obj] of prev) parent.remove(obj); ud.worn[slot] = null; }
  if (slot === 'head') for (const h of ud.hairParts) h.visible = true;   // hair back unless a helm hides it
  if (!def) return;

  const { body, legL, legR, armL, armR } = ud;
  const PS = (c, r, m) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const plate = PS(def.plate ?? 0xccd2da, 0.3, 0.62);      // bright steel
  const dark = PS(0x5c6068, 0.5, 0.5);                     // shadowed steel
  const gold = PS(def.trim ?? 0xe8c24a, 0.24, 0.85);       // bright gold filigree
  const gemC = def.gem ?? 0x38a8ff;
  const gem = new THREE.MeshStandardMaterial({ color: gemC, emissive: gemC, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.1 });
  const cloth = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });

  const pieces = [];
  // primitive builders — all geometry is positioned/rotated/scaled with at()
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const cyl = (rt, rb, h, m, s = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), m);
  const sph = (r, m) => new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), m);
  const cone = (r, h, m, s = 14) => new THREE.Mesh(new THREE.ConeGeometry(r, h, s), m);
  const ring = (r, t, m) => new THREE.Mesh(new THREE.TorusGeometry(r, t, 10, 22), m);
  const at = (o, x, y, z, rx = 0, ry = 0, rz = 0, sx, sy, sz) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); if (sx !== undefined) o.scale.set(sx, sy, sz); return o; };
  const reg = (parent, o) => { o.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } }); parent.add(o); pieces.push([parent, o]); return o; };

  if (slot === 'head') {
    for (const h of ud.hairParts) h.visible = false;                                    // helm hides the hair
    reg(body, at(sph(0.285, plate), 0, 2.05, -0.01, 0, 0, 0, 1.02, 0.95, 1.06));        // skull dome
    reg(body, at(cyl(0.295, 0.305, 0.13, gold), 0, 1.93, -0.01));                       // gold brow band
    reg(body, at(box(0.055, 0.22, 0.06, plate), 0, 1.9, 0.25));                         // nasal bar
    for (const sx of [-1, 1]) reg(body, at(box(0.09, 0.26, 0.18, plate), sx * 0.24, 1.88, 0.06)); // cheek guards
    reg(body, at(box(0.07, 0.07, 0.07, gem), 0, 1.99, 0.23, 0, 0, Math.PI / 4));        // brow gem
    reg(body, at(box(0.05, 0.2, 0.5, gold), 0, 2.32, -0.03));                           // crest fin
    for (const cz of [0.16, 0, -0.16]) reg(body, at(cone(0.05, 0.2, gold, 4), 0, 2.44, cz - 0.03)); // crest comb

  } else if (slot === 'body') {
    reg(body, at(cyl(0.345, 0.27, 0.54, plate), 0, 1.43, 0));                           // cuirass
    reg(body, at(box(0.12, 0.42, 0.12, plate), 0, 1.45, 0.27));                         // central ridge
    reg(body, at(ring(0.33, 0.035, gold), 0, 1.66, 0, Math.PI / 2, 0, 0));              // collar trim
    reg(body, at(box(0.12, 0.12, 0.08, gem), 0, 1.5, 0.31, 0, 0, Math.PI / 4));         // chest gem
    reg(body, at(ring(0.1, 0.025, gold), 0, 1.5, 0.29));                                // gem setting
    reg(body, at(cyl(0.31, 0.37, 0.13, plate), 0, 1.14, 0));                            // faulds tier 1
    reg(body, at(cyl(0.28, 0.34, 0.11, plate), 0, 1.04, 0));                            // faulds tier 2
    reg(body, at(ring(0.36, 0.03, gold), 0, 1.09, 0, Math.PI / 2, 0, 0));               // fauld trim
    reg(body, at(cyl(0.25, 0.3, 0.13, dark), 0, 1.6, 0));                               // gorget
    const tab = cloth(def.tabard ?? 0x7a1f2f);
    reg(body, at(box(0.3, 0.66, 0.04, tab), 0, 1.32, 0.31));                            // tabard
    for (const sx of [-1, 1]) reg(body, at(box(0.035, 0.66, 0.05, gold), sx * 0.14, 1.32, 0.315));
    reg(body, at(box(0.13, 0.13, 0.05, gold), 0, 1.46, 0.33, 0, 0, Math.PI / 4));       // tabard emblem
    // oversized WoW pauldrons — flared up-and-out, gold-rimmed, spiked
    for (const sx of [-1, 1]) {
      const pa = new THREE.Group();
      pa.add(at(sph(0.3, plate), 0, 0, 0, 0, 0, 0, 1.3, 0.95, 1.2));                    // main dome
      pa.add(at(sph(0.2, plate), 0, 0.13, 0.02, 0, 0, 0, 1.25, 0.7, 1.2));             // upper tier
      pa.add(at(ring(0.3, 0.05, gold), 0, -0.04, 0, Math.PI / 2, 0, 0));                // rim
      pa.add(at(cone(0.09, 0.36, gold, 6), 0.1, 0.24, 0, 0, 0, -sx * 0.5));             // spike
      reg(body, at(pa, sx * 0.46, 1.63, 0, 0, 0, -sx * 0.38));
    }

  } else if (slot === 'legs') {
    for (const leg of [legL, legR]) {
      const lo = leg.userData.lower;
      reg(leg, at(box(0.22, 0.3, 0.18, plate), 0, -0.22, 0.03));                        // thigh plate
      reg(lo, at(cone(0.14, 0.16, plate, 8), 0, -0.02, 0.11, Math.PI / 2, 0, 0));       // pointed knee cop
      reg(lo, at(ring(0.12, 0.03, gold), 0, -0.02, 0.06));                              // knee trim
      reg(lo, at(box(0.22, 0.32, 0.14, plate), 0, -0.2, 0.09));                         // shin greave
      reg(lo, at(box(0.04, 0.32, 0.16, gold), 0, -0.2, 0.1));                           // greave fuller
    }

  } else if (slot === 'hands') {
    for (const arm of [armL, armR]) {
      const lo = arm.userData.lower;
      reg(lo, at(cyl(0.12, 0.17, 0.18, plate), 0, -0.17, 0));                           // flared bracer cuff
      reg(lo, at(ring(0.16, 0.03, gold), 0, -0.26, 0, Math.PI / 2, 0, 0));              // cuff trim
      reg(lo, at(box(0.17, 0.18, 0.22, plate), 0, -0.37, 0.03));                        // gauntlet fist
      for (const kx of [-0.05, 0, 0.05]) reg(lo, at(cone(0.025, 0.08, gold, 4), kx, -0.35, 0.15, Math.PI / 2, 0, 0)); // knuckle studs
    }

  } else if (slot === 'feet') {
    for (const leg of [legL, legR]) {
      const lo = leg.userData.lower;
      reg(lo, at(box(0.22, 0.16, 0.28, plate), 0, -0.45, 0.05));                        // sabaton shell
      reg(lo, at(cone(0.12, 0.22, plate, 4), 0, -0.46, 0.26, Math.PI / 2, Math.PI / 4, 0)); // pointed toe
      reg(lo, at(box(0.2, 0.14, 0.16, plate), 0, -0.33, 0.0));                          // ankle guard
      reg(lo, at(box(0.23, 0.04, 0.28, gold), 0, -0.39, 0.05));                         // gold trim
    }

  } else if (slot === 'shield') {
    const lo = armL.userData.lower;                                                      // held on the left arm
    const g = new THREE.Group();
    g.add(at(cyl(0.35, 0.35, 0.07, plate, 6), 0, 0, 0, Math.PI / 2, 0, 0));             // hex steel backing
    g.add(at(cyl(0.29, 0.29, 0.1, cloth(def.face ?? 0x2f5aa0), 6), 0, 0, 0.01, Math.PI / 2, 0, 0)); // coloured field
    g.add(at(ring(0.34, 0.04, gold), 0, 0, 0.02));                                       // gold border
    g.add(at(box(0.07, 0.66, 0.02, gold), 0, 0, 0.07));                                  // heraldic cross
    g.add(at(box(0.66, 0.07, 0.02, gold), 0, 0, 0.07));
    g.add(at(sph(0.1, gem), 0, 0, 0.09));                                                // gem boss
    g.add(at(ring(0.12, 0.03, gold), 0, 0, 0.07));
    reg(lo, at(g, 0.05, -0.36, 0.12, 0, 0, 0.12));

  } else if (slot === 'cape') {
    const cl = cloth(def.cape ?? 0xa83232);
    reg(body, at(box(0.2, 0.1, 0.08, gold), 0, 1.64, -0.22));                            // shoulder clasp
    reg(body, at(box(0.56, 0.5, 0.04, cl), 0, 1.42, -0.28));                             // upper cape
    reg(body, at(box(0.5, 0.84, 0.04, cl), 0, 0.8, -0.35, -0.14, 0, 0));                 // long flowing lower
    reg(body, at(box(0.5, 0.05, 0.05, gold), 0, 0.4, -0.43, -0.14, 0, 0));               // hem trim
  }

  ud.worn[slot] = pieces;
}

// Called every frame. Picks an animation: chopping > walking > idle.
export function updatePlayerAnimation(player, isMoving, t, isChopping = false) {
  const { body, legL, legR, armL, armR } = player.userData;
  const lk = (g) => g.userData.lower;

  if (isChopping) {
    const swing = 0.5 + 0.5 * Math.sin(t * 9);
    armR.rotation.x = -2.0 + swing * 1.6; lk(armR).rotation.x = -0.4 - swing * 0.6;
    armL.rotation.x = -0.3; lk(armL).rotation.x = -0.5;
    legL.rotation.x = 0.1; legR.rotation.x = -0.1; lk(legL).rotation.x = 0.2; lk(legR).rotation.x = 0.2;
    body.rotation.x = 0.12; body.position.y = 0.02 * Math.sin(t * 2);
    return;
  }
  body.rotation.x = 0;

  if (isMoving) {
    const s = Math.sin(t * 9);
    legL.rotation.x = s * 0.62; legR.rotation.x = -s * 0.62;
    lk(legL).rotation.x = Math.max(0, -s) * 0.8; lk(legR).rotation.x = Math.max(0, s) * 0.8;   // knees bend on the lift
    armL.rotation.x = -s * 0.5; armR.rotation.x = s * 0.5;
    lk(armL).rotation.x = -0.3; lk(armR).rotation.x = -0.3;
    body.position.y = 0.06 * Math.abs(Math.sin(t * 9));
  } else {
    legL.rotation.x *= 0.8; legR.rotation.x *= 0.8; armL.rotation.x *= 0.8; armR.rotation.x *= 0.8;
    lk(legL).rotation.x *= 0.8; lk(legR).rotation.x *= 0.8;
    lk(armL).rotation.x = -0.25; lk(armR).rotation.x = -0.25;
    body.position.y = 0.02 * Math.sin(t * 2);
  }
}
