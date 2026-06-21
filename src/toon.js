// toon.js — global cel-shaded / toon render pass for Eldenmoor.
//
// Two things, applied as a *rendering layer* over finished geometry (so the
// model agents keep owning the shapes):
//
//   1. BANDED TOON SHADING — swap every MeshStandardMaterial for a
//      THREE.MeshToonMaterial driven by a small stepped gradient map, so light
//      reads as a few flat bands instead of a smooth PBR falloff. Color, map,
//      emissive and transparency are preserved, so nothing changes hue.
//
//   2. INVERTED-HULL OUTLINES — for each solid mesh, add a back-faces child
//      that's pushed outward along its normals in clip space and drawn black.
//      Constant screen-space thickness, depth-tested, so it hugs silhouettes
//      with no z-fighting. (No EffectComposer/OutlinePass — those addons aren't
//      vendored; this is core-only.)
//
// Everything here is IDEMPOTENT: objects and materials get a processed tag, so
// re-running toonify(scene) after an equip is cheap and safe.

import * as THREE from '../vendor/three.module.js';

// --- tags -------------------------------------------------------------------
const TOON_MESH = '__toonDone';      // mesh has been converted + outlined
const TOON_OUTLINE = '__toonOutline'; // this object IS an outline hull (skip it)
const TOON_MAT = '__toonMat';        // material is already a toon swap

// --- stepped gradient map ---------------------------------------------------
// A 1xN luminance ramp sampled with NearestFilter gives N hard light bands.
// Four bands reads crisp-but-not-harsh (deep shadow / shadow / mid / lit).
let _gradientMap = null;
function gradientMap() {
  if (_gradientMap) return _gradientMap;
  const shades = new Uint8Array([90, 150, 205, 255]); // dark → bright bands
  const tex = new THREE.DataTexture(shades, shades.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  _gradientMap = tex;
  return tex;
}

// --- outline material -------------------------------------------------------
// Inverted hull: render back faces only, offset each vertex outward along its
// normal by a constant *screen-space* amount (scaled by clip-space w so the
// outline stays an even thickness at any distance). Black, depth-tested.
const OUTLINE_THICKNESS = 0.0042; // fraction of clip-space; tasteful, thin

function makeOutlineMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uThickness: { value: OUTLINE_THICKNESS } },
    vertexShader: /* glsl */`
      uniform float uThickness;
      void main() {
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        // normal in view space, projected to clip space direction
        vec3 n = normalize(normalMatrix * normal);
        vec4 clipN = projectionMatrix * vec4(n, 0.0);
        // push out along the normal, constant in screen space (scale by w)
        clip.xy += normalize(clipN.xy) * uThickness * clip.w;
        gl_Position = clip;
      }
    `,
    fragmentShader: /* glsl */`
      void main() { gl_FragColor = vec4(0.02, 0.02, 0.03, 1.0); }
    `,
    side: THREE.BackSide,
    // keep depth so the hull is occluded correctly by closer geometry
    depthWrite: true,
    depthTest: true,
  });
}
let _outlineMat = null;
function outlineMaterial() { return _outlineMat || (_outlineMat = makeOutlineMaterial()); }

// --- material conversion ----------------------------------------------------
// Swap a MeshStandardMaterial (or array of them) for a MeshToonMaterial,
// carrying over the look-defining properties so hue/texture/transparency hold.
function toToon(mat) {
  if (!mat) return mat;
  if (Array.isArray(mat)) return mat.map(toToon);
  if (mat.userData && mat.userData[TOON_MAT]) return mat;          // already swapped
  // only convert the lit standard/physical materials; leave Basic/Toon/etc.
  if (!mat.isMeshStandardMaterial) return mat;

  const toon = new THREE.MeshToonMaterial({
    color: mat.color ? mat.color.clone() : new THREE.Color(0xffffff),
    map: mat.map || null,
    gradientMap: gradientMap(),
    emissive: mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000),
    emissiveMap: mat.emissiveMap || null,
    emissiveIntensity: mat.emissiveIntensity != null ? mat.emissiveIntensity : 1,
    transparent: mat.transparent,
    opacity: mat.opacity,
    alphaMap: mat.alphaMap || null,
    side: mat.side,
    vertexColors: mat.vertexColors,
    fog: mat.fog,
  });
  toon.userData[TOON_MAT] = true;
  return toon;
}

// A back-face inverted-hull outline DOUBLES the draw call + vertex work of every
// mesh it's added to. The hull's silhouette contribution is only readable on
// foreground shapes of moderate complexity, so we gate it harder than before:
//   * high-vertex-count meshes (dense procedural props / smooth subdivided forms)
//     pay a large per-frame vertex cost for an outline you can barely pick out,
//     so anything above VERT_CAP is skipped. (The big downloaded GLBs — trees,
//     rocks, buildings — are pre-tagged __toonDone and never reach here anyway.)
//   * truly tiny props (small world radius) read with no visible outline.
// Hero / NPC / monster meshes are well under the cap, so the silhouettes that
// matter keep their outline; this only trims expensive, low-value hulls.
const OUTLINE_VERT_CAP = 1600;   // skip outlining meshes denser than this (was 3000)

// Should this mesh get a black outline hull? Skip transparent, tiny, non-solid,
// or very dense bits so outlines stay tasteful and cheap.
function wantsOutline(mesh) {
  const m = mesh.material;
  const one = Array.isArray(m) ? m[0] : m;
  if (!one) return false;
  if (one.transparent && one.opacity < 0.98) return false;       // glass/ghosts
  const g = mesh.geometry;
  if (!g || !g.attributes || !g.attributes.position) return false;
  const vcount = g.attributes.position.count;
  if (vcount < 8) return false;                                  // degenerate
  if (vcount > OUTLINE_VERT_CAP) return false;                   // dense mesh: outline ≈ invisible, doubles its vertex cost
  // skip very small props by bounding-sphere radius
  if (!g.boundingSphere) g.computeBoundingSphere();
  const r = g.boundingSphere ? g.boundingSphere.radius : 1;
  const s = mesh.scale;
  const worldR = r * Math.max(Math.abs(s.x), Math.abs(s.y), Math.abs(s.z));
  if (worldR < 0.16) return false;                               // small props/studs/gems — outline barely visible, not worth the doubled draw call
  return true;
}

function addOutline(mesh) {
  const hull = new THREE.Mesh(mesh.geometry, outlineMaterial());
  hull.userData[TOON_OUTLINE] = true;
  hull.castShadow = false;
  hull.receiveShadow = false;
  hull.matrixAutoUpdate = false;       // it tracks the parent (identity local)
  hull.frustumCulled = mesh.frustumCulled;
  hull.renderOrder = (mesh.renderOrder || 0) - 1;
  mesh.add(hull);                      // child → shares the parent's transform
  return hull;
}

// --- public API -------------------------------------------------------------
// Traverse `root`, converting materials and adding outline hulls. Safe to call
// repeatedly: already-processed meshes (and the outline hulls themselves) are
// skipped.
export function toonify(root) {
  if (!root) return root;
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    if (obj.userData[TOON_OUTLINE]) return;       // never re-process a hull
    if (obj.userData[TOON_MESH]) return;          // already done this mesh

    obj.material = toToon(obj.material);
    if (wantsOutline(obj)) addOutline(obj);
    obj.userData[TOON_MESH] = true;
  });
  return root;
}

// Convenience for dynamically-created subtrees (worn gear, weapons, spawned
// monsters). Identical to toonify() — named for intent at the call site.
export function applyToonTo(obj) { return toonify(obj); }
