// player.js — a smooth, heroic stylized hero (RS3/WoW flavour) built entirely
// from rounded organic primitives: capsules, spheres, lathe & tube curves, and
// tapered smooth cylinders with smooth normals (no flatShading, no hard boxes
// for body/armour). A jointed rig (hips+knees, shoulders+elbows) keeps the walk
// and chop natural. The base hero wears a plain shirt + pants; armour is added
// on top by setWornGear() whenever an equipment slot changes (mirrors
// setHeldWeapon).
//
// RIG CONTRACT (do not change): player.userData = { body, legL, legR, armL,
// armR, held, worn, hairParts }; each limb is a Group with .userData.lower;
// exports setHeldWeapon + setWornGear(player, slot, def); slot ids are
// head/body/legs/hands/feet/shield/cape.

import * as THREE from '../vendor/three.module.js';

function mat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0 });
}

// Derive a metal tint from a smithed item id when the def carries no explicit
// colour. Palette matches the icon fills in items.js so the 3D gear reads as the
// same metal as its inventory icon. Unknown ids fall back to steel-grey.
function metalTint(id) {
  if (!id) return null;
  if (id.includes('bronze')) return 0xc8842f;   // warm copper
  if (id.includes('mithril')) return 0x6f9bd6;   // steely blue
  if (id.includes('steel')) return 0xc2c7ce;     // bright steel
  if (id.includes('iron')) return 0xb8b0a8;      // dull grey iron
  return null;
}

// A smooth lathe-of-revolution solid from a list of [radius, height] profile
// points (bottom→top). Great for tapered organic limbs/torsos with soft caps.
function lathe(profile, m, seg = 24) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y));
  const g = new THREE.LatheGeometry(pts, seg);
  g.computeVertexNormals();
  const o = new THREE.Mesh(g, m);
  o.castShadow = true; o.receiveShadow = true;
  return o;
}

export function createPlayer() {
  const player = new THREE.Group();
  const body = new THREE.Group();
  player.add(body);

  const skin = mat(0xe8b48f), shirt = mat(0x2e6e6e), pants = mat(0x3a3326),
        boot = mat(0x33251a), hair = mat(0x5b3f29), eye = mat(0x141414),
        belt = mat(0x4a3220);

  const cap = (r, len, m, x, y, z) => { const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 10, 20), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };
  const ball = (r, m, x, y, z) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 18), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };

  // legs: hip group → smooth tapered thigh, then a knee (lower) group → shin +
  // rounded foot. Thigh swells at the muscle and tucks toward the knee.
  const makeLeg = () => {
    const hip = new THREE.Group();
    const thigh = lathe([[0.10, -0.42], [0.155, -0.30], [0.165, -0.16], [0.13, -0.02], [0.12, 0.06]], pants);
    hip.add(thigh);
    const lower = new THREE.Group(); lower.position.set(0, -0.42, 0);
    const shin = lathe([[0.075, -0.42], [0.12, -0.30], [0.135, -0.12], [0.115, 0.0], [0.12, 0.04]], pants);
    lower.add(shin);
    const foot = ball(0.15, boot, 0, -0.44, 0.06); foot.scale.set(1, 0.6, 1.6); lower.add(foot);
    const heel = ball(0.11, boot, 0, -0.43, -0.06); heel.scale.set(1, 0.7, 1); lower.add(heel);
    hip.add(lower); hip.userData.lower = lower;
    return hip;
  };
  const legL = makeLeg(); legL.position.set(0.15, 0.86, 0);
  const legR = makeLeg(); legR.position.set(-0.15, 0.86, 0);
  body.add(legL, legR);

  // pelvis + heroic V-tapered torso (broad chest → trim waist) as one smooth
  // lathe solid, plus soft deltoid swells, pectoral curve and a rounded belt.
  body.add(lathe([
    [0.27, 0.72], [0.30, 0.86], [0.28, 1.00], [0.255, 1.14],   // pelvis → waist (trim)
    [0.30, 1.30], [0.345, 1.46], [0.33, 1.58], [0.255, 1.66],  // broad chest → shoulders
    [0.12, 1.70], [0.10, 1.74],                                // trapezius into neck
  ], shirt));
  for (const sx of [-1, 1]) { const d = ball(0.16, shirt, sx * 0.30, 1.56, 0); d.scale.set(1.0, 0.95, 1.1); body.add(d); }  // deltoids
  for (const sx of [-1, 1]) { const p = ball(0.15, shirt, sx * 0.13, 1.42, 0.2); p.scale.set(1.1, 0.85, 0.7); body.add(p); } // pectorals
  const beltMesh = lathe([[0.27, -0.07], [0.30, -0.03], [0.30, 0.03], [0.275, 0.07]], belt, 24); beltMesh.position.set(0, 0.99, 0); body.add(beltMesh);  // rounded belt
  const buckle = ball(0.07, mat(0x9a7b34), 0, 0.99, 0.30); buckle.scale.set(1.4, 1.1, 0.6); buckle.castShadow = true; body.add(buckle);

  // arms: shoulder group → smooth biceps capsule taper, then an elbow (lower)
  // group → forearm + a rounded hand (palm sphere + thumb).
  const makeArm = () => {
    const sh = new THREE.Group();
    sh.add(lathe([[0.085, -0.34], [0.105, -0.22], [0.11, -0.10], [0.09, 0.02], [0.10, 0.08]], shirt, 18));   // biceps
    const lower = new THREE.Group(); lower.position.set(0, -0.34, 0);
    lower.add(lathe([[0.07, -0.32], [0.092, -0.20], [0.094, -0.06], [0.085, 0.02], [0.092, 0.06]], shirt, 18)); // forearm
    const palm = ball(0.082, skin, 0, -0.34, 0.02); palm.scale.set(1.0, 1.25, 0.85); lower.add(palm);
    const thumb = cap(0.028, 0.05, skin, 0.06, -0.31, 0.05); thumb.rotation.z = 0.6; lower.add(thumb);
    sh.add(lower); sh.userData.lower = lower;
    return sh;
  };
  const armL = makeArm(); armL.position.set(0.33, 1.5, 0); armL.rotation.z = 0.1;
  const armR = makeArm(); armR.position.set(-0.33, 1.5, 0); armR.rotation.z = -0.1;
  body.add(armL, armR);

  // neck, head, soft face, hair
  const neck = lathe([[0.09, -0.08], [0.10, -0.02], [0.105, 0.04], [0.12, 0.09]], skin, 20); neck.position.set(0, 1.66, 0); body.add(neck);  // neck flaring into jaw
  const head = ball(0.26, skin, 0, 1.87, 0); head.scale.set(0.94, 1.07, 0.97); body.add(head);
  const jaw = ball(0.205, skin, 0, 1.76, 0.04); jaw.scale.set(0.96, 0.78, 1.0); body.add(jaw);            // soft rounded jaw
  body.add(ball(0.046, eye, 0.1, 1.9, 0.215)); body.add(ball(0.046, eye, -0.1, 1.9, 0.215));
  const nose = cap(0.04, 0.06, skin, 0, 1.85, 0.25); nose.rotation.x = 0.5; body.add(nose);               // soft nose
  const mouth = ball(0.05, mat(0x9a5b50), 0, 1.76, 0.235); mouth.scale.set(1.6, 0.45, 0.5); body.add(mouth);
  for (const sx of [-1, 1]) { const ear = ball(0.058, skin, sx * 0.25, 1.87, 0.01); ear.scale.set(0.7, 1.1, 0.9); body.add(ear); }
  for (const sx of [-1, 1]) { const b = cap(0.03, 0.1, skin, sx * 0.09, 1.97, 0.21); b.rotation.set(Math.PI / 2, 0, sx * 0.25); body.add(b); }  // soft brows
  const hcap = ball(0.285, hair, 0, 1.96, -0.03); hcap.scale.set(1.04, 0.9, 1.08); body.add(hcap);        // rounded hair cap
  const fringe = lathe([[0.0, 0], [0.18, 0.02], [0.24, 0.06], [0.2, 0.12], [0.0, 0.16]], hair, 22);
  fringe.position.set(0, 1.96, 0.12); fringe.scale.set(1.2, 1.0, 0.8); body.add(fringe);                  // swept fringe

  player.userData = { body, legL, legR, armL, armR, held: null, worn: {}, hairParts: [hcap, fringe] };
  player.position.set(0, 0, 0);
  return player;
}

// Put a weapon in the hero's hand (a child of the right forearm, so it swings).
export function setHeldWeapon(player, def) {
  const hand = player.userData.armR.userData.lower;
  if (player.userData.held) { hand.remove(player.userData.held); player.userData.held = null; }
  if (!def) return;

  // Blade colour: an explicit headColor wins (axes); otherwise derive a metal
  // tint from the smithed item id so bronze/iron/steel/mithril blades show in
  // their own colour. Falls back to steel-grey when unknown.
  const bladeColor = def.headColor ?? metalTint(def.id) ?? 0xbfc4cc;
  const blade = new THREE.MeshStandardMaterial({ color: bladeColor, roughness: 0.4, metalness: 0.5 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x5b3d22, roughness: 0.9 });

  if (def.tool === 'axe') {
    const g = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 14), wood); handle.castShadow = true; g.add(handle);
    // smooth crescent axe head from a lathe-swept blade + rounded poll
    const head = new THREE.Mesh(new THREE.LatheGeometry(
      [new THREE.Vector2(0.02, -0.15), new THREE.Vector2(0.22, -0.05), new THREE.Vector2(0.26, 0.05),
       new THREE.Vector2(0.2, 0.13), new THREE.Vector2(0.02, 0.16)], 18), blade);
    head.scale.set(0.5, 1, 1); head.rotation.z = Math.PI / 2; head.position.set(0, 0.4, 0.14); head.castShadow = true; g.add(head);
    const poll = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 12), blade); poll.position.set(0, 0.4, -0.02); poll.castShadow = true; g.add(poll);
    g.position.set(0, -0.4, 0.12); g.rotation.x = 0.3;
    hand.add(g);
    player.userData.held = g;
    return;
  }

  if (def.tool === 'sword') {
    // Smithed melee arm: smooth pommel + grip + crossguard, then a blade whose
    // shape varies by kind (read from the id): dagger short & straight, sword
    // longer & straight, scimitar long with a swept curve.
    const id = def.id || '';
    const kind = id.includes('scimitar') ? 'scim' : id.includes('dagger') ? 'dagger' : 'sword';
    const len = kind === 'dagger' ? 0.34 : kind === 'scim' ? 0.66 : 0.6;
    const halfW = kind === 'dagger' ? 0.032 : 0.04;
    const steelGuard = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.35, metalness: 0.6 });

    const g = new THREE.Group();
    // rounded pommel + leather grip
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), steelGuard); pommel.position.set(0, -0.04, 0); pommel.castShadow = true; g.add(pommel);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.17, 14), wood); grip.position.set(0, 0.06, 0); grip.castShadow = true; g.add(grip);
    // crossguard as a smooth capsule
    const guard = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.18, 6, 14), steelGuard);
    guard.rotation.z = Math.PI / 2; guard.position.set(0, 0.15, 0); guard.castShadow = true; g.add(guard);

    // blade: a smooth tapered lathe (diamond cross-section flattened) from guard
    // to a rounded point.
    const blProfile = [
      [0.01, 0.0], [halfW, 0.04], [halfW, len * 0.55], [halfW * 0.7, len * 0.82], [0.005, len],
    ].map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y));
    const bl = new THREE.Mesh(new THREE.LatheGeometry(blProfile, 16), blade);
    bl.scale.set(1, 1, 0.32);   // flatten into an edged blade
    bl.position.set(0, 0.18, 0); bl.castShadow = true;
    if (kind === 'scim') {
      // bend the scimitar: tilt the blade so it sweeps forward like a curved sabre
      const curve = new THREE.Group();
      curve.add(bl);
      bl.rotation.x = -0.32; bl.position.set(0, 0.16, 0.02);
      curve.position.set(0, 0, 0);
      g.add(curve);
    } else {
      g.add(bl);
    }
    g.position.set(0, -0.34, 0.12); g.rotation.x = 0.4;
    hand.add(g);
    player.userData.held = g;
    return;
  }
}

// Put on / take off a piece of armour. `slot` is an equipment slot id (head,
// body, legs, hands, feet, shield, cape); `def` is the item (or null to remove).
// The gear leans RS3 × WoW heroics expressed in SMOOTH curved geometry: rounded
// helms, flared sculpted pauldrons, a curved breastplate, gold filigree rings
// and a glowing gem. Each piece is parented to the matching rig part so it
// moves with the hero.
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
  // Plate colour: an explicit `plate` field wins; otherwise derive a metal tint
  // from the smithed item id (bronze/iron/steel/mithril) so the armour reads as
  // its forged metal. Steel's tint matches the previous default, so the existing
  // steel set looks unchanged.
  const plate = PS(def.plate ?? metalTint(def.id) ?? 0xccd2da, 0.28, 0.7);
  const dark = PS(0x5c6068, 0.45, 0.6);                    // shadowed steel
  const gold = PS(def.trim ?? 0xe8c24a, 0.22, 0.9);        // bright gold filigree
  const gemC = def.gem ?? 0x38a8ff;
  const gem = new THREE.MeshStandardMaterial({ color: gemC, emissive: gemC, emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.1 });
  const cloth = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });

  const pieces = [];
  // smooth primitive builders — all geometry is positioned/rotated/scaled with at()
  const sph = (r, m) => new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), m);
  const ring = (r, t, m) => new THREE.Mesh(new THREE.TorusGeometry(r, t, 14, 30), m);
  const caps = (r, l, m) => new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 8, 18), m);
  // a smooth lathe solid from [radius,height] profile points
  const lat = (profile, m, s = 24) => {
    const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), s);
    g.computeVertexNormals();
    return new THREE.Mesh(g, m);
  };
  // a faceted gem cut (octahedron reads jewel-like)
  const jewel = (r, m) => new THREE.Mesh(new THREE.OctahedronGeometry(r, 0), m);
  const at = (o, x, y, z, rx = 0, ry = 0, rz = 0, sx, sy, sz) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); if (sx !== undefined) o.scale.set(sx, sy, sz); return o; };
  const reg = (parent, o) => { o.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } }); parent.add(o); pieces.push([parent, o]); return o; };

  if (slot === 'head') {
    for (const h of ud.hairParts) h.visible = false;                                    // helm hides the hair
    // smooth domed skullcap (lathe) hugging the head, gold brow band, rounded
    // cheek guards and a swept crest — no slabs.
    reg(body, at(lat([[0.0, 0.30], [0.16, 0.26], [0.26, 0.16], [0.30, 0.04], [0.30, -0.06], [0.295, -0.12]], plate), 0, 1.91, -0.01));
    reg(body, at(ring(0.298, 0.03, gold), 0, 1.91, -0.01, Math.PI / 2, 0, 0));          // gold brow band
    reg(body, at(caps(0.028, 0.18, plate), 0, 1.86, 0.255, Math.PI / 2 + 0.2, 0, 0));   // smooth nasal bar
    for (const sx of [-1, 1]) reg(body, at(lat([[0.0, 0.13], [0.09, 0.08], [0.1, -0.02], [0.07, -0.12], [0.0, -0.15]], plate), sx * 0.245, 1.86, 0.05, 0, sx * 0.3, 0, 0.7, 1, 1.4)); // cheek guards
    reg(body, at(jewel(0.05, gem), 0, 1.99, 0.235, 0, 0, Math.PI / 4));                  // brow gem
    reg(body, at(lat([[0.0, -0.22], [0.05, -0.1], [0.06, 0.08], [0.03, 0.2], [0.0, 0.24]], gold, 12), 0, 2.18, -0.03, 0, 0, 0, 0.5, 1, 1)); // crest fin
    for (const cz of [0.14, 0, -0.14]) reg(body, at(sph(0.05, gold), 0, 2.40, cz - 0.03, 0, 0, 0, 1, 1.6, 1)); // crest comb beads

  } else if (slot === 'body') {
    // sculpted curved breastplate as a single smooth lathe shell, with pectoral
    // swells, a soft gorget, rounded faulds tier and gold ring trim.
    reg(body, at(lat([
      [0.255, 1.10], [0.31, 1.18], [0.355, 1.34], [0.35, 1.48], [0.30, 1.60], [0.24, 1.66], [0.18, 1.70],
    ], plate), 0, 0, 0));
    for (const sx of [-1, 1]) reg(body, at(sph(0.16, plate), sx * 0.13, 1.44, 0.21, 0, 0, 0, 1.1, 0.9, 0.75)); // pectoral swells
    reg(body, at(ring(0.27, 0.035, gold), 0, 1.62, 0, Math.PI / 2, 0, 0));               // collar trim
    reg(body, at(lat([[0.0, 0.10], [0.12, 0.06], [0.14, -0.02], [0.1, -0.1], [0.0, -0.13]], dark), 0, 1.66, 0, 0, 0, 0)); // soft gorget
    reg(body, at(jewel(0.07, gem), 0, 1.50, 0.32, 0, 0, Math.PI / 4));                   // chest gem
    reg(body, at(ring(0.1, 0.022, gold), 0, 1.50, 0.30));                                // gem setting
    // rounded faulds (skirt) as a flared lathe with a gold rim
    reg(body, at(lat([[0.27, 1.18], [0.32, 1.10], [0.37, 1.00], [0.36, 0.94]], plate), 0, 0, 0));
    reg(body, at(ring(0.36, 0.028, gold), 0, 1.04, 0, Math.PI / 2, 0, 0));               // fauld trim
    const tab = cloth(def.tabard ?? 0x7a1f2f);
    reg(body, at(lat([[0.12, -0.33], [0.16, -0.1], [0.17, 0.1], [0.16, 0.3], [0.15, 0.33]], tab, 20), 0, 1.32, 0.30, 0, 0, 0, 1, 1, 0.18)); // curved tabard
    reg(body, at(jewel(0.06, gold), 0, 1.46, 0.34, 0, 0, Math.PI / 4));                  // tabard emblem
    // oversized WoW pauldrons — smooth flared layered domes, gold-rimmed, soft horn
    for (const sx of [-1, 1]) {
      const pa = new THREE.Group();
      pa.add(at(lat([[0.0, 0.14], [0.16, 0.1], [0.28, 0.0], [0.32, -0.1], [0.3, -0.18], [0.22, -0.22]], plate, 24), 0, 0, 0, 0, 0, 0, 1.25, 1.0, 1.2)); // main flared dome
      pa.add(at(sph(0.18, plate), 0, 0.14, 0.02, 0, 0, 0, 1.2, 0.7, 1.1));               // upper tier
      pa.add(at(ring(0.3, 0.045, gold), 0, -0.04, 0, Math.PI / 2, 0, 0));                // rim
      pa.add(at(caps(0.05, 0.22, gold), 0.12, 0.22, 0, 0, 0, -sx * 0.6));                // smooth horn
      reg(body, at(pa, sx * 0.47, 1.62, 0, 0, 0, -sx * 0.38));
    }

  } else if (slot === 'legs') {
    for (const leg of [legL, legR]) {
      const lo = leg.userData.lower;
      reg(leg, at(lat([[0.13, -0.36], [0.18, -0.22], [0.19, -0.08], [0.16, 0.04], [0.15, 0.08]], plate), 0, 0, 0)); // smooth thigh tasset
      reg(lo, at(sph(0.135, plate), 0, -0.02, 0.06, 0, 0, 0, 1.1, 1.1, 1.0));            // rounded knee cop
      reg(lo, at(ring(0.13, 0.025, gold), 0, -0.02, 0.04, 0.4, 0, 0));                   // knee trim
      reg(lo, at(lat([[0.12, -0.36], [0.155, -0.22], [0.16, -0.06], [0.14, 0.04]], plate), 0, 0, 0.02)); // curved shin greave
      reg(lo, at(caps(0.025, 0.26, gold), 0, -0.16, 0.14, Math.PI / 2 - 0.2, 0, 0));     // greave fuller ridge
    }

  } else if (slot === 'hands') {
    for (const arm of [armL, armR]) {
      const lo = arm.userData.lower;
      reg(lo, at(lat([[0.092, -0.06], [0.13, -0.14], [0.17, -0.22], [0.12, -0.28]], plate), 0, 0, 0)); // flared bracer cuff
      reg(lo, at(ring(0.16, 0.028, gold), 0, -0.26, 0, Math.PI / 2, 0, 0));              // cuff trim
      reg(lo, at(sph(0.105, plate), 0, -0.36, 0.03, 0, 0, 0, 1.1, 1.15, 1.3));           // rounded gauntlet fist
      for (const kx of [-0.05, 0, 0.05]) reg(lo, at(sph(0.028, gold), kx, -0.34, 0.16)); // smooth knuckle studs
    }

  } else if (slot === 'feet') {
    for (const leg of [legL, legR]) {
      const lo = leg.userData.lower;
      reg(lo, at(sph(0.16, plate), 0, -0.44, 0.06, 0, 0, 0, 1.0, 0.62, 1.65));           // smooth sabaton shell
      reg(lo, at(sph(0.07, plate), 0, -0.45, 0.24, 0, 0, 0, 1.0, 0.75, 1.6));            // rounded toe cap
      reg(lo, at(lat([[0.0, 0.1], [0.12, 0.04], [0.13, -0.06], [0.0, -0.1]], plate), 0, -0.30, 0.0)); // ankle guard
      reg(lo, at(ring(0.14, 0.025, gold), 0, -0.40, 0.05, Math.PI / 2, 0, 0));           // gold trim
    }

  } else if (slot === 'shield') {
    const lo = armL.userData.lower;                                                      // held on the left arm
    const g = new THREE.Group();
    // smooth domed kite shield: a curved lathe shell, gold rim torus, soft cross
    // ribs and a faceted gem boss.
    g.add(at(lat([[0.0, -0.4], [0.22, -0.28], [0.34, -0.05], [0.34, 0.12], [0.26, 0.3], [0.0, 0.42]], cloth(def.face ?? 0x2f5aa0), 28), 0, 0, 0, Math.PI / 2, 0, 0, 0.85, 1, 0.18));
    g.add(at(lat([[0.0, -0.42], [0.235, -0.29], [0.36, -0.05], [0.36, 0.13], [0.275, 0.32], [0.0, 0.45]], plate, 28), 0, 0, -0.04, Math.PI / 2, 0, 0, 0.85, 1, 0.18)); // steel backing
    g.add(at(ring(0.33, 0.035, gold), 0, 0, 0.02, 0, 0, 0, 0.85, 1, 1));                 // gold border
    g.add(at(caps(0.028, 0.62, gold), 0, 0, 0.06, 0, 0, 0));                             // heraldic cross (vertical)
    g.add(at(caps(0.028, 0.5, gold), 0, 0.04, 0.06, 0, 0, Math.PI / 2, 0.85, 1, 1));     // heraldic cross (horizontal)
    g.add(at(jewel(0.09, gem), 0, 0.04, 0.1));                                           // gem boss
    g.add(at(ring(0.12, 0.025, gold), 0, 0.04, 0.06));
    reg(lo, at(g, 0.05, -0.36, 0.12, 0, 0, 0.12));

  } else if (slot === 'cape') {
    const cl = cloth(def.cape ?? 0xa83232);
    reg(body, at(caps(0.05, 0.16, gold), 0, 1.64, -0.22, 0, 0, Math.PI / 2));            // rounded shoulder clasp
    // smooth flowing cape from a half-lathe shell that widens toward the hem
    const cape = lat([[0.24, 1.62], [0.3, 1.4], [0.34, 1.1], [0.4, 0.7], [0.46, 0.36]], cl, 22);
    reg(body, at(cape, 0, 0, -0.27, 0, 0, 0, 1, 1, 0.42));
    reg(body, at(ring(0.46, 0.03, gold), 0, 0.37, -0.27, Math.PI / 2, 0, 0, 1, 1, 0.42)); // hem trim
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
