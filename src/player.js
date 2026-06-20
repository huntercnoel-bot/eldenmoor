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

  // pelvis + plain shirt torso + a simple belt
  body.add(cyl(0.23, 0.26, 0.28, pants, 0, 0.92, 0));
  body.add(cyl(0.3, 0.22, 0.66, shirt, 0, 1.3, 0));
  body.add(cyl(0.31, 0.31, 0.12, belt, 0, 1.0, 0));
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.05), mat(0x9a7b34)); buckle.position.set(0, 1.0, 0.31); buckle.castShadow = true; body.add(buckle);

  // arms: shoulder group → upper arm, then an elbow (lower) group → forearm + bare hand
  const makeArm = () => {
    const sh = new THREE.Group();
    sh.add(cap(0.1, 0.2, shirt, 0, -0.16, 0));
    const lower = new THREE.Group(); lower.position.set(0, -0.34, 0);
    lower.add(cap(0.088, 0.2, shirt, 0, -0.15, 0));
    lower.add(ball(0.1, skin, 0, -0.34, 0.02));
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
  for (const sx of [-1, 1]) body.add(ball(0.06, skin, sx * 0.25, 1.86, 0.01));
  const hcap = ball(0.28, hair, 0, 1.95, -0.04); hcap.scale.set(1.02, 0.85, 1.05); body.add(hcap);
  const fringe = ball(0.22, hair, 0, 2.0, 0.13); fringe.scale.set(1.2, 0.5, 0.7); body.add(fringe);

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
// Each piece is parented to the matching rig part so it moves with the hero.
export function setWornGear(player, slot, def) {
  const ud = player.userData;
  ud.worn = ud.worn || {};

  // take off whatever is currently in this slot
  const prev = ud.worn[slot];
  if (prev) { for (const [parent, obj] of prev) parent.remove(obj); ud.worn[slot] = null; }
  if (slot === 'head') for (const h of ud.hairParts) h.visible = true;   // hair back unless a helm hides it
  if (!def) return;

  const { body, legL, legR, armL, armR } = ud;
  const M = (c, r = 0.4, mtl = 0.55) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: mtl });
  const plate = M(def.plate ?? 0xc2c7ce, 0.35, 0.62), steel = M(0x9aa0a8, 0.45, 0.55),
        gold = M(def.trim ?? 0xd8b24a, 0.4, 0.5), cloth = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });

  const pieces = [];
  const B = (w, h, d, m, x, y, z, ax = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.z = ax; o.castShadow = o.receiveShadow = true; return o; };
  const C = (rt, rb, h, m, x, y, z) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 16), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; return o; };
  const Sp = (r, m, x, y, z, sc) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m); o.position.set(x, y, z); if (sc) o.scale.set(sc[0], sc[1], sc[2]); o.castShadow = o.receiveShadow = true; return o; };
  const add = (parent, obj) => { parent.add(obj); pieces.push([parent, obj]); };

  if (slot === 'head') {
    for (const h of ud.hairParts) h.visible = false;                       // helm hides the hair
    add(body, C(0.275, 0.285, 0.2, plate, 0, 2.02, -0.01));                // band
    add(body, Sp(0.275, plate, 0, 2.08, -0.01, [1.02, 0.8, 1.05]));        // dome
    add(body, B(0.05, 0.2, 0.05, plate, 0, 1.92, 0.24));                   // nasal bar
    for (const sx of [-1, 1]) add(body, B(0.08, 0.24, 0.16, plate, sx * 0.235, 1.9, 0.05)); // cheek guards
    add(body, C(0.285, 0.285, 0.04, gold, 0, 1.93, -0.01));                // gold rim

  } else if (slot === 'body') {
    add(body, C(0.33, 0.27, 0.5, plate, 0, 1.43, 0));                      // breastplate
    add(body, C(0.3, 0.35, 0.16, plate, 0, 1.12, 0));                      // faulds
    const tab = cloth(def.tabard ?? 0x6e1f2f);
    add(body, B(0.34, 0.62, 0.05, tab, 0, 1.34, 0.31));                    // tabard
    for (const sx of [-1, 1]) add(body, B(0.035, 0.62, 0.055, gold, sx * 0.155, 1.34, 0.315));
    add(body, B(0.34, 0.045, 0.055, gold, 0, 1.05, 0.315));
    add(body, B(0.11, 0.11, 0.05, gold, 0, 1.45, 0.32, Math.PI / 4));      // emblem
    add(body, C(0.26, 0.3, 0.13, steel, 0, 1.6, 0));                       // gorget
    for (const sx of [-1, 1]) { add(body, Sp(0.22, plate, sx * 0.34, 1.58, 0, [1.15, 0.72, 1.1])); add(body, C(0.1, 0.16, 0.05, gold, sx * 0.34, 1.69, 0)); }

  } else if (slot === 'legs') {
    for (const leg of [legL, legR]) {
      add(leg, B(0.2, 0.26, 0.16, plate, 0, -0.24, 0.03));                 // thigh plate
      add(leg.userData.lower, B(0.21, 0.3, 0.13, plate, 0, -0.18, 0.09));  // shin greave
    }

  } else if (slot === 'hands') {
    for (const arm of [armL, armR]) {
      const lo = arm.userData.lower;
      add(lo, C(0.105, 0.115, 0.1, plate, 0, -0.2, 0));                    // bracer
      add(lo, B(0.16, 0.17, 0.2, plate, 0, -0.35, 0.03));                  // gauntlet
    }

  } else if (slot === 'feet') {
    for (const leg of [legL, legR]) {
      const lo = leg.userData.lower;
      add(lo, B(0.22, 0.15, 0.26, plate, 0, -0.46, 0.04));                 // boot shell
      add(lo, B(0.2, 0.12, 0.2, plate, 0, -0.45, 0.2));                    // toe cap
    }

  } else if (slot === 'shield') {
    const lo = armL.userData.lower;                                         // held on the left arm
    const g = new THREE.Group(); g.position.set(0.04, -0.34, 0.08); g.rotation.set(Math.PI / 2, 0, 0.1);
    g.add(C(0.3, 0.3, 0.07, steel, 0, 0, 0));
    g.add(C(0.25, 0.25, 0.1, cloth(def.face ?? 0x6e2f2f), 0, 0, 0));
    g.add(C(0.07, 0.07, 0.13, gold, 0, 0, 0));
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    add(lo, g);

  } else if (slot === 'cape') {
    const cl = cloth(def.cape ?? 0xa83232);
    add(body, B(0.16, 0.1, 0.08, gold, 0, 1.64, -0.22));                   // clasp
    add(body, B(0.54, 0.55, 0.05, cl, 0, 1.4, -0.27));
    const low = B(0.48, 0.66, 0.05, cl, 0, 0.9, -0.32); low.rotation.x = -0.12; add(body, low);
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
