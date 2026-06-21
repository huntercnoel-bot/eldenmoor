// castleModel.js — swaps the home castle's exterior for a huge realistic glTF
// keep (The Long Roam castle). Like the stores: while you're OUT in the town you
// see the giant glTF castle; once you cross the gate the glTF hides and the
// procedural castle (throne room, King, the stairs up/down) takes over — so all
// the interior gameplay is untouched. The procedural walls keep colliding either
// way, so the gateway stays the only way in.
//
// Self-contained: polls for window.eldenmoor and boots itself; main.js only
// needs `import './castleModel.js';`.

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';

const URL = './assets/models/castle/castle.glb';
const CX = 0, CZ = 46;          // procedural castle centre
const TARGET_W = 62;            // grander than the procedural footprint (HW*2 = 46) so it towers behind the gate
const GATE_ROT = Math.PI;       // the glTF gate/drawbridge faces -z (the town)
const loader = new GLTFLoader();

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

// "Inside the castle" = past the gate, within the curtain walls.
function isInside(p) {
  return p.position.x > -22 && p.position.x < 22 && p.position.z > 26 && p.position.z < 66;
}

async function swapCastle(em) {
  const keep = em.scene.userData.keep;
  if (!keep || !keep.ground) return;

  const g = await new Promise((ok, err) => loader.load(URL, (x) => ok(x.scene), undefined, err));
  const s0 = new THREE.Vector3(); new THREE.Box3().setFromObject(g).getSize(s0);
  g.scale.setScalar(TARGET_W / (Math.max(s0.x, s0.z) || 1));
  g.rotation.y = GATE_ROT;
  g.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true; m.receiveShadow = true; m.userData.__toonDone = true;
      // warm the stone a touch and kill stray metalness so it reads as a sunlit keep
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (!mat || !mat.isMeshStandardMaterial) continue;
        if (mat.metalness !== undefined) mat.metalness = Math.min(mat.metalness, 0.05);
        if (mat.roughness !== undefined) mat.roughness = Math.max(mat.roughness, 0.7);
        if (mat.color) mat.color.lerp(new THREE.Color(0xfff0d8), 0.12);   // gentle warm wash
      }
    }
  });
  g.position.set(CX, 0, CZ); g.updateMatrixWorld(true);
  const minY = new THREE.Box3().setFromObject(g).min.y;
  g.position.set(CX, -minY, CZ);
  g.name = 'castle-model';
  em.scene.add(g);
  (em.scene.userData.outdoor = em.scene.userData.outdoor || []).push(g);

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

  let inside = null;
  function tick() {
    requestAnimationFrame(tick);
    // subtle brazier flicker
    const t = performance.now() * 0.006;
    for (let i = 0; i < braziers.length; i++) {
      const br = braziers[i];
      const f = 0.82 + Math.sin(t + i * 1.7) * 0.12 + Math.sin(t * 2.3 + i) * 0.06;
      br.light.intensity = br.base * f;
      if (br.fire) br.fire.scale.y = 0.92 + (f - 0.82) * 1.4;
    }
    const p = em.player; if (!p) return;
    const onGround = !em.getFloor || em.getFloor() === 0;
    if (!onGround) return;                 // upstairs/cellar: the floor system hides outdoor
    const ins = isInside(p);
    if (ins !== inside) {
      inside = ins;
      g.visible = !ins;                    // glТF keep outside, procedural inside
      dress.visible = !ins;                // gate dressing belongs to the exterior
      keep.ground.visible = ins;
    }
  }
  tick();
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
