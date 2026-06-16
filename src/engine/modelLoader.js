/**
 * modelLoader.js — Reusable GLTF model loading pipeline.
 *
 * Loads game models (CC0 GLB files), normalizes them to a unit-radius
 * template, caches at module scope, and exposes shared resources so the
 * renderer's cleanup system can distinguish them from per-instance meshes.
 *
 * Gracefully fails: if the GLB can't be loaded, template stays null and
 * callers fall back to procedural geometry.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ─── Module state ─────────────────────────────────────────────────────────────

/** @type {THREE.Group | null} Normalized asteroid template (unit-radius) */
let _asteroidTemplate = null;

/** @type {Set<THREE.Geometry>} Geometries from loaded models */
const _modelGeometries = new Set();

/** @type {Set<THREE.Material>} Materials from loaded models */
const _modelMaterials = new Set();

/** @type {boolean} True when loadGameModels() has finished */
let _ready = false;

// ─── Loading ──────────────────────────────────────────────────────────────────

/**
 * Load all game models. Normalizes each to a unit-radius template and
 * caches it. Resolves immediately on failure — game continues with fallbacks.
 */
export async function loadGameModels() {
  // Already loaded or failed
  if (_ready) return;
  if (_asteroidTemplate !== null) return;

  const loader = new GLTFLoader();
  const url = import.meta.env.BASE_URL + 'models/asteroid.glb';

  try {
    const gltf = await loader.loadAsync(url);
    _asteroidTemplate = _normalizeTemplate(gltf.scene);
    _collectResources(_asteroidTemplate);
  } catch (err) {
    console.warn('[modelLoader] Failed to load asteroid model, using wireframe fallback:', err);
    _asteroidTemplate = null;
  }

  _ready = true;
}

// ─── Normalization ────────────────────────────────────────────────────────────

/**
 * Merge a gltf.scene into a unit-radius template, recentered to origin.
 *
 * The normalization (scale + recenter) is baked into an INNER group, and an
 * outer group is returned with identity transform. This matters because the
 * renderer drives each instance's `scale.set(h.radius, …)` and
 * `position.set(h.x, h.y, 0)` on the cloned outer group every frame — if the
 * normalization lived on that same node it would be clobbered. The inner
 * wrapper keeps normalization intact while the outer node stays free for the
 * renderer to position/scale exactly like the old unit-radius icosahedron.
 *
 * @param {THREE.Object3D} gltfScene — Original scene from GLTFLoader
 * @returns {THREE.Group} Normalized template (outer group at identity)
 */
function _normalizeTemplate(gltfScene) {
  const inner = new THREE.Group();

  // Clone children so we own the geometry/materials but keep the structure
  gltfScene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const clone = child.clone();
      if (Array.isArray(clone.material)) {
        clone.material = clone.material.map((m) => m.clone());
      } else if (clone.material) {
        clone.material = clone.material.clone();
      }
      inner.add(clone);
    }
  });

  // Size from the largest axis: half-extent → matches collision radius (h.radius)
  const box = new THREE.Box3().setFromObject(inner);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);
  const radius = Math.max(size.x, size.y, size.z) / 2;

  // Bake scale-to-unit-radius and recenter into the inner group
  if (radius > 0) {
    const scale = 1 / radius;
    inner.scale.setScalar(scale);
    inner.position.copy(center).multiplyScalar(-scale);
  }

  // Outer group stays at identity so the renderer can scale/position it
  const outer = new THREE.Group();
  outer.name = 'modelTemplate';
  outer.add(inner);
  return outer;
}

// ─── Resource collection ─────────────────────────────────────────────────────

/**
 * Traverse a model group and collect all geometries and materials into
 * the module-level shared sets. Called once after normalization.
 *
 * @param {THREE.Object3D} obj — Root of the model to scan
 */
function _collectResources(obj) {
  obj.traverse((child) => {
    if (child.isMesh) {
      if (child.geometry) _modelGeometries.add(child.geometry);
      if (child.material) {
        const matArr = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of matArr) _modelMaterials.add(m);
      }
    }
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get the cached asteroid template, or null if not yet loaded.
 *
 * @returns {THREE.Group | null}
 */
export function getAsteroidTemplate() {
  return _asteroidTemplate;
}

/**
 * Check if model loading has completed.
 *
 * @returns {boolean}
 */
export function isModelsReady() {
  return _ready;
}

/**
 * Return model resources for the renderer's shared-set preservation.
 * Called once per frame in draw3DFrame via renderer3d.
 *
 * @returns {{ geometries: Set<THREE.Geometry>, materials: Set<THREE.Material> }}
 */
export function getModelSharedResources() {
  return {
    geometries: _modelGeometries,
    materials: _modelMaterials,
  };
}
