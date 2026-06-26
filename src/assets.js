// Asset store — loads generated GLB meshes (Higgsfield image→3D) and normalizes them so
// the renderer can drop them in. Every asset is optional: if a GLB is missing or fails to
// load, the renderer falls back to its procedural primitive, so the game never breaks.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

// target heights (world units) each asset is normalized to, with base sitting at y=0
const MANIFEST = {
  being:    { file: 'being.glb',    height: 1.9 }, // dawnfolk adult male (also generic fallback)
  woman:    { file: 'woman.glb',    height: 1.8 },
  child:    { file: 'child.glb',    height: 1.1 },
  elder:    { file: 'elder.glb',    height: 1.75 },
  ember:    { file: 'ember.glb',    height: 1.9 }, // Emberfolk
  frost:    { file: 'frost.glb',    height: 1.95 }, // Frostborn
  thorn:    { file: 'thorn.glb',    height: 2.0 }, // Thornkin
  hut:      { file: 'hut.glb',      height: 2.8 },
  tree:     { file: 'tree.glb',     height: 4.0 },
  bush:     { file: 'bush.glb',     height: 1.1 },
  campfire: { file: 'campfire.glb', height: 1.1 },
  rock:     { file: 'rock.glb',     height: 1.4 },
  totem:    { file: 'totem.glb',    height: 3.2 },
};

export class AssetStore {
  constructor() { this.assets = {}; }

  async load() {
    const loader = new GLTFLoader();
    const base = (import.meta.env && import.meta.env.BASE_URL) || '/';
    await Promise.all(Object.entries(MANIFEST).map(([key, info]) => new Promise((resolve) => {
      loader.load(
        base + 'models/' + info.file,
        (gltf) => { try { this.assets[key] = this._process(gltf, info); } catch (e) { console.warn('[assets] process failed:', key, e); } resolve(); },
        undefined,
        () => resolve(), // missing/failed → fallback, stay silent
      );
    })));
    return this;
  }

  has(key) { return !!this.assets[key]; }
  isAnimated(key) { const a = this.assets[key]; return !!(a && a.clips && a.clips.length); }
  clips(key) { const a = this.assets[key]; return a ? a.clips : null; }

  // returns a fresh, placeable clone (group whose origin is base-center).
  // skinned/animated assets must be cloned with SkeletonUtils so the rig survives.
  clone(key) {
    const a = this.assets[key];
    if (!a) return null;
    return (a.clips && a.clips.length) ? skeletonClone(a.proto) : a.proto.clone(true);
  }

  // representative { geometry, material } for InstancedMesh use (trees/bushes/rocks)
  instanced(key) {
    const a = this.assets[key];
    return a ? a.inst : null;
  }

  _process(gltf, info) {
    const root = gltf.scene;
    root.updateWorldMatrix(true, true);
    const clips = gltf.animations || [];
    const animated = clips.length > 0;

    // ---- normalized clone prototype (base at y=0, centered in x/z) ----
    const box0 = new THREE.Box3().setFromObject(root);
    const size0 = box0.getSize(new THREE.Vector3());
    const scale = info.height / (size0.y || 1);

    const proto = animated ? skeletonClone(root) : root.clone(true);
    proto.scale.setScalar(scale);
    proto.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; } });
    const box1 = new THREE.Box3().setFromObject(proto);
    const c = box1.getCenter(new THREE.Vector3());
    proto.position.set(-c.x, -box1.min.y, -c.z);
    const wrap = new THREE.Group();
    wrap.add(proto);

    // ---- representative single mesh for instancing ----
    let rep = null, best = -1;
    root.traverse((o) => {
      if (o.isMesh) {
        const v = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
        const vol = v.x * v.y * v.z;
        if (vol > best) { best = vol; rep = o; }
      }
    });
    let inst = null;
    if (rep && !animated) {
      const geo = rep.geometry.clone();
      rep.updateWorldMatrix(true, false);
      geo.applyMatrix4(rep.matrixWorld);
      geo.scale(scale, scale, scale);
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
      geo.computeVertexNormals();
      inst = { geometry: geo, material: Array.isArray(rep.material) ? rep.material[0] : rep.material };
    }
    return { proto: wrap, inst, clips, height: info.height };
  }
}
