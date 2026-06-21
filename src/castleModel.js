// castleModel.js — decorates the approach to the home castle with gate braziers
// and heraldic banners, and makes sure the (now much-improved) PROCEDURAL castle
// is what you see both outside and in.
//
// HISTORY: this used to swap in a 39 MB glTF keep when you stood outside. That
// single model parsed for ~30 s on the main thread — it starved every other GLB
// load (the King's model never got a turn, so he stayed a boxy placeholder) and
// tanked the framerate. We dropped it: the procedural castle (buildings.js
// makeCastle — vaulted great hall, towers, throne room, stairs) now serves as
// both the exterior and the interior, which is far cheaper and loads instantly.
//
// Self-contained: polls for window.eldenmoor and boots itself; main.js only
// needs `import './castleModel.js';`.

import * as THREE from '../vendor/three.module.js';

const CX = 0, CZ = 46;          // procedural castle centre

// ---- procedural gate dressing: braziers + banners (cel-shade exempt) --------
// A stone bowl on a column with a glowing ember core + warm point light.
function makeBrazier() {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.95 });
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.78, 2.8, 14), stone);
  col.position.y = 1.4; col.castShadow = true;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.5, 0.9, 16), stone);
  bowl.position.y = 3.05; bowl.castShadow = true;
  const ember = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xffb24a, emissive: 0xff6a16, emissiveIntensity: 2.0, roughness: 0.5 })
  );
  ember.position.y = 3.25; ember.scale.y = 0.6;
  const fire = new THREE.Mesh(
    new THREE.ConeGeometry(0.7, 1.7, 10),
    new THREE.MeshBasicMaterial({ color: 0xffd66a })
  );
  fire.position.y = 4.15;
  g.add(col, bowl, ember, fire);
  const light = new THREE.PointLight(0xffa53a, 8, 24, 2);
  light.position.y = 4.2; g.add(light);
  g.traverse((m) => { if (m.isMesh) m.userData.__toonDone = true; });
  g.userData.__brazier = { light, fire, base: 8 };
  return g;
}

// A tall hanging heraldic banner on a pole (plain-canvas crest).
let _bannerTex = null;
function bannerTexture() {
  const c = document.createElement('canvas'); c.width = 96; c.height = 192;
  const x = c.getContext('2d');
  x.fillStyle = '#26406e'; x.fillRect(0, 0, 96, 192);
  x.fillStyle = '#1c3055'; for (let i = 0; i < 192; i += 12) x.fillRect(0, i, 96, 2);
  x.strokeStyle = '#d8b24a'; x.lineWidth = 6; x.strokeRect(6, 6, 84, 180);
  x.fillStyle = '#d8b24a';
  x.beginPath(); x.moveTo(48, 50); x.lineTo(72, 96); x.lineTo(48, 142); x.lineTo(24, 96); x.closePath(); x.fill();
  x.fillStyle = '#26406e'; x.font = 'bold 30px serif'; x.textAlign = 'center';
  x.fillText('E', 48, 108);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makeBanner() {
  if (!_bannerTex) _bannerTex = bannerTexture();
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.9 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 10, 10), wood);
  pole.position.y = 5.0; pole.castShadow = true;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.4, 8), wood);
  arm.rotation.z = Math.PI / 2; arm.position.set(1.0, 9.4, 0);
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 5.4),
    new THREE.MeshStandardMaterial({ map: _bannerTex, side: THREE.DoubleSide, roughness: 0.85 })
  );
  cloth.position.set(1.0, 6.4, 0); cloth.castShadow = true;
  g.add(pole, arm, cloth);
  g.traverse((m) => { if (m.isMesh) m.userData.__toonDone = true; });
  return g;
}

async function swapCastle(em) {
  const keep = em.scene.userData.keep;
  if (!keep || !keep.ground) return;

  // ---- gate dressing: braziers + banners flanking the approach (town side) --
  // These live in world space just OUTSIDE the gate (z<24, well clear of the
  // interior's isInside box) and decorate the causeway. Grouped so they show /
  // hide with the glTF keep. Tagged deco/noCollide so they never block the path.
  const dress = new THREE.Group(); dress.name = 'castle-gate-dressing';
  const braziers = [];
  // braziers stagger down the causeway toward the town
  for (const sx of [-1, 1]) for (const z of [22, 15, 8]) {
    const b = makeBrazier();
    b.position.set(sx * 6.5, 0, z);
    b.traverse((m) => { m.userData.noCollide = true; });
    dress.add(b); braziers.push(b.userData.__brazier);
  }
  // tall banners closest to the gate mouth
  for (const sx of [-1, 1]) {
    const bn = makeBanner();
    bn.position.set(sx * 9.5, 0, 23);
    bn.rotation.y = sx < 0 ? -Math.PI / 2 : Math.PI / 2;   // arms face inward over the path
    bn.traverse((m) => { m.userData.noCollide = true; });
    dress.add(bn);
  }
  dress.traverse((m) => { m.userData.__toonDone = true; });
  em.scene.add(dress);
  (em.scene.userData.outdoor = em.scene.userData.outdoor || []).push(dress);

  // ---- EXTERIOR LOD PROXY -----------------------------------------------------
  // The full procedural castle (curtain walls, vaulted hall, throne room and the
  // six furnished side rooms) is ~thousands of meshes. From town it's all in the
  // frustum even though the walls occlude the inside — that was the big "facing
  // the castle = laggy" cost. So: show this CHEAP silhouette (a few dozen meshes)
  // while you're out in town, and swap to the full walkable castle only once you
  // approach/enter. The real castle's wall colliders are baked at startup, so the
  // gateway still works regardless of which one is visible.
  const proxy = buildProxy();
  proxy.position.set(CX, 0, CZ);
  em.scene.add(proxy);
  (em.scene.userData.outdoor = em.scene.userData.outdoor || []).push(proxy);

  const NEAR2 = 34 * 34;          // within this distance of the castle → full detail
  let lastMode = null;
  function updateLOD() {
    const p = em.player; if (!p) return;
    const onGround = (em.getFloor ? em.getFloor() : 0) === 0;
    if (!onGround) {                 // upstairs/cellar: you're inside; never show the proxy
      if (lastMode !== 'inside') { lastMode = 'inside'; proxy.visible = false; }
      return;
    }
    const dx = p.position.x - CX, dz = p.position.z - CZ;
    const near = (dx * dx + dz * dz) < NEAR2;
    const mode = near ? 'full' : 'far';
    if (mode !== lastMode) {
      lastMode = mode;
      keep.ground.visible = near;    // full detailed castle only when near/inside
      proxy.visible = !near;         // cheap silhouette while out in town
    }
  }

  function tick() {
    requestAnimationFrame(tick);
    const t = performance.now() * 0.006;
    for (let i = 0; i < braziers.length; i++) {
      const br = braziers[i];
      const f = 0.82 + Math.sin(t + i * 1.7) * 0.12 + Math.sin(t * 2.3 + i) * 0.06;
      br.light.intensity = br.base * f;
      if (br.fire) br.fire.scale.y = 0.92 + (f - 0.82) * 1.4;
    }
    updateLOD();
  }
  tick();
}

// A cheap, good-looking castle SILHOUETTE matching the procedural castle's
// footprint (centre (0,46), curtain walls at x=±23 / z=24..68). ~30 meshes,
// all cel-shade-exempt + non-colliding. Local space (added at the castle centre).
function buildProxy() {
  const g = new THREE.Group(); g.name = 'castle-proxy';
  const stone = new THREE.MeshStandardMaterial({ color: 0xc9c2af, roughness: 0.92, metalness: 0 });
  const slate = new THREE.MeshStandardMaterial({ color: 0x5d5168, roughness: 0.9, metalness: 0 });
  const gilt = new THREE.MeshStandardMaterial({ color: 0xd8b24a, roughness: 0.5, metalness: 0.3 });
  const HWX = 23, ZF = -22, ZB = 22, WH = 7.5, TH = 1.2;   // local: front -z, back +z
  const box = (w, h, d, m, x, y, z) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; return me; };
  const merlons = (x0, z0, x1, z1, y) => {        // a row of battlement teeth along a wall run
    const horiz = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(len / 1.8));
    for (let i = 0; i <= n; i++) {
      const f = i / n, x = x0 + (x1 - x0) * f, z = z0 + (z1 - z0) * f;
      g.add(box(horiz ? 0.9 : TH + 0.1, 0.9, horiz ? TH + 0.1 : 0.9, stone, x, y + 0.45, z));
    }
  };
  // curtain walls (front has a gate gap around x∈[-3.5,3.5])
  g.add(box(HWX * 2 + TH, WH, TH, stone, 0, WH / 2, ZB));                         // back
  g.add(box(TH, WH, (ZB - ZF), stone, -HWX, WH / 2, (ZF + ZB) / 2));              // left
  g.add(box(TH, WH, (ZB - ZF), stone, HWX, WH / 2, (ZF + ZB) / 2));              // right
  g.add(box(HWX - 3.5, WH, TH, stone, -(HWX + 3.5) / 2, WH / 2, ZF));            // front-left of gate
  g.add(box(HWX - 3.5, WH, TH, stone, (HWX + 3.5) / 2, WH / 2, ZF));             // front-right of gate
  merlons(-HWX, ZB, HWX, ZB, WH); merlons(-HWX, ZF, -HWX, ZB, WH); merlons(HWX, ZF, HWX, ZB, WH);
  merlons(-HWX, ZF, -3.6, ZF, WH); merlons(3.6, ZF, HWX, ZF, WH);
  // gatehouse: two squat towers flanking the gate + a lintel + arch
  for (const sx of [-1, 1]) {
    g.add(box(4, WH + 3, 4, stone, sx * 4.6, (WH + 3) / 2, ZF));
    const cap = new THREE.Mesh(new THREE.ConeGeometry(3.0, 3.0, 4), slate); cap.position.set(sx * 4.6, WH + 4.5, ZF); cap.rotation.y = Math.PI / 4; g.add(cap);
  }
  g.add(box(8.5, 1.4, TH + 0.3, stone, 0, WH - 0.4, ZF));                         // gate lintel band
  // four round corner towers with conical slate roofs
  for (const sx of [-1, 1]) for (const sz of [ZF, ZB]) {
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.7, WH + 8, 12), stone);
    tw.position.set(sx * HWX, (WH + 8) / 2, sz); tw.castShadow = true; g.add(tw);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.0, 5.0, 12), slate); roof.position.set(sx * HWX, WH + 8 + 2.5, sz); g.add(roof);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), gilt).translateX(sx * HWX).translateY(WH + 8 + 5.3).translateZ(sz));
  }
  // central great hall block with a tall hipped roof (the keep silhouette)
  g.add(box(20, 11, 26, stone, 0, 5.5, 4));
  const hall = new THREE.Mesh(new THREE.ConeGeometry(15, 7, 4), slate); hall.position.set(0, 14.5, 4); hall.rotation.y = Math.PI / 4; hall.scale.set(1, 1, 1.25); g.add(hall);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 0.4), gilt).translateY(18.5).translateZ(4));   // finial
  g.traverse((m) => { if (m.isMesh) { m.userData.__toonDone = true; m.userData.noCollide = true; m.receiveShadow = true; } });
  return g;
}

// ----- self-initialize --------------------------------------------------------
(function boot() {
  let tries = 0;
  const iv = setInterval(async () => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.scene && em.player && em.scene.userData.keep) {
      clearInterval(iv);
      try { await swapCastle(em); }
      catch (err) { console.error('[castleModel] swap failed', err); }
    } else if (tries > 800) { clearInterval(iv); }
  }, 100);
})();
