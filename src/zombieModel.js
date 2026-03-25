/**
 * ZombieModel.js — Loads GLB zombie model with walk animation.
 * Replaces the old procedural box zombie with a real 3D model.
 *
 * The GLB is loaded once and cloned for each zombie instance.
 * Each clone gets its own AnimationMixer for independent animation.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as skeletonClone } from "three/addons/utils/SkeletonUtils.js";

// ─── Shared state: load the GLB once, clone for each zombie ────────────────
let _zombieGLTF = null;
let _zombieAltGLTF = null;
let _loading = false;
let _altLoading = false;
const _onLoadCallbacks = [];
const _altOnLoadCallbacks = [];

function ensureLoaded(callback) {
  if (_zombieGLTF) {
    callback(_zombieGLTF);
    return;
  }
  _onLoadCallbacks.push(callback);
  if (!_loading) {
    _loading = true;
    const loader = new GLTFLoader();
    loader.load(
      "/models/zombie.glb",
      (gltf) => {
        _zombieGLTF = gltf;
        console.log(
          `[ZombieModel] Loaded zombie.glb: ${gltf.animations.length} animations (${gltf.animations.map((a) => a.name).join(", ")})`,
        );
        for (const cb of _onLoadCallbacks) cb(gltf);
        _onLoadCallbacks.length = 0;
      },
      undefined,
      (err) => {
        console.warn("[ZombieModel] Failed to load zombie.glb:", err);
      },
    );
  }
}

function ensureAltLoaded(callback) {
  if (_zombieAltGLTF) {
    callback(_zombieAltGLTF);
    return;
  }
  _altOnLoadCallbacks.push(callback);
  if (!_altLoading) {
    _altLoading = true;
    const loader = new GLTFLoader();
    loader.load(
      "/models/zombie_alt.glb",
      (gltf) => {
        _zombieAltGLTF = gltf;
        console.log(
          `[ZombieModel] Loaded zombie_alt.glb: ${gltf.animations.length} animations`,
        );
        for (const cb of _altOnLoadCallbacks) cb(gltf);
        _altOnLoadCallbacks.length = 0;
      },
      undefined,
      (err) => {
        console.warn("[ZombieModel] Failed to load zombie_alt.glb:", err);
      },
    );
  }
}

// ─── Fallback box zombie (used while GLB loads) ───────────────────────────
function createFallbackZombie(scale, skinColorHex, eyeColorHex) {
  const group = new THREE.Group();
  group.scale.setScalar(scale);

  const skinColor = skinColorHex || 0x4a6b3a;
  const eyeColor = eyeColorHex || 0xff2200;

  const mat = new THREE.MeshBasicMaterial({ color: skinColor });

  // Simple body
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), mat);
  torso.position.y = 1.2;
  group.add(torso);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.3, 0.3),
    new THREE.MeshBasicMaterial({ color: skinColor }),
  );
  head.position.y = 1.85;
  group.add(head);

  // Eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor });
  const lEye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), eyeMat);
  lEye.position.set(-0.08, 1.92, 0.16);
  group.add(lEye);
  const rEye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), eyeMat);
  rEye.position.set(0.08, 1.92, 0.16);
  group.add(rEye);

  // Arms
  const armMat = new THREE.MeshBasicMaterial({ color: skinColor });
  const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), armMat);
  lArm.position.set(-0.4, 1.1, 0);
  group.add(lArm);
  const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), armMat);
  rArm.position.set(0.4, 1.1, 0);
  group.add(rArm);

  // Legs
  const legMat = new THREE.MeshBasicMaterial({ color: 0x14110d });
  const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), legMat);
  lLeg.position.set(-0.15, 0.35, 0);
  group.add(lLeg);
  const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), legMat);
  rLeg.position.set(0.15, 0.35, 0);
  group.add(rLeg);

  // Hitbox
  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 2.6, 2.2),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitbox.position.y = 1.3;
  group.add(hitbox);

  const allParts = [torso, head, lArm, rArm, lLeg, rLeg];
  group.userData.bodyParts = allParts;
  group.userData.hitbox = hitbox;

  return {
    group,
    allParts,
    update: () => {},
    playAnimation: () => {},
    currentAnim: "idle",
  };
}

// ─── Factory ───────────────────────────────────────────────────────────────
/**
 * Creates a zombie using the GLB model.
 * Returns immediately with a fallback, then swaps in the GLB when loaded.
 *
 * @param {number} scale - Overall scale
 * @param {number} skinColorHex - Tint color (applied to all meshes)
 * @param {number} eyeColorHex - Eye glow color
 * @returns {{ group, allParts, update, playAnimation, currentAnim }}
 */
export function createZombie(
  scale = 1,
  skinColorHex = null,
  eyeColorHex = null,
) {
  // Start with fallback
  const fallback = createFallbackZombie(scale, skinColorHex, eyeColorHex);
  const wrapper = {
    group: fallback.group,
    allParts: fallback.allParts,
    update: fallback.update,
    playAnimation: fallback.playAnimation,
    currentAnim: "idle",
    _mixer: null,
    _actions: {},
    _glbLoaded: false,
  };

  // Pick random variant (70% main, 30% alt for variety)
  const useAlt = Math.random() < 0.3;
  const loadFn = useAlt ? ensureAltLoaded : ensureLoaded;

  loadFn((gltf) => {
    // Use SkeletonUtils.clone for proper SkinnedMesh + skeleton cloning
    const clone = skeletonClone(gltf.scene);
    clone.scale.setScalar(scale * 1.0); // Match player height

    // Keep EXACT original materials from GLB — do NOT clone or modify.
    // KHR_materials_pbrSpecularGlossiness creates special material subclasses
    // where cloning breaks the internal texture references, causing purple/white.
    // The scene lighting is strong enough (ambient 15+) to render them correctly.
    const allParts = [];
    clone.traverse((child) => {
      if (child.isMesh || child.isSkinnedMesh) {
        child.frustumCulled = false;
        // Log material info for first zombie only (debug)
        if (!createZombie._logged) {
          console.log(
            `[ZombieModel] Mesh "${child.name}" material type: ${child.material.type}, ` +
              `hasMap: ${!!child.material.map}, color: ${child.material.color?.getHexString()}`,
          );
        }
        allParts.push(child);
      }
    });
    createZombie._logged = true;

    // Add invisible hitbox for raycasting
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 2.6, 2.2),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitbox.position.y = 1.3;
    clone.add(hitbox);

    // Set up animation mixer bound to the clone
    const mixer = new THREE.AnimationMixer(clone);
    const actions = {};

    for (const clip of gltf.animations) {
      const name = clip.name.toLowerCase();

      // clipAction auto-retargets to the clone's skeleton
      if (
        name.includes("walk") ||
        name.includes("run") ||
        name.includes("move")
      ) {
        actions.walk = mixer.clipAction(clip);
        actions.walk.setLoop(THREE.LoopRepeat, Infinity);
      } else if (
        name.includes("idle") ||
        name.includes("stand") ||
        name.includes("breath")
      ) {
        actions.idle = mixer.clipAction(clip);
        actions.idle.setLoop(THREE.LoopRepeat, Infinity);
      } else if (
        name.includes("attack") ||
        name.includes("hit") ||
        name.includes("bite") ||
        name.includes("swipe")
      ) {
        actions.attack = mixer.clipAction(clip);
        actions.attack.setLoop(THREE.LoopRepeat, Infinity);
      } else if (name.includes("die") || name.includes("death")) {
        actions.death = mixer.clipAction(clip);
        actions.death.setLoop(THREE.LoopOnce, 1);
        actions.death.clampWhenFinished = true;
      }
    }

    // If only one animation, use it for everything
    if (Object.keys(actions).length === 0 && gltf.animations.length > 0) {
      actions.walk = mixer.clipAction(gltf.animations[0]);
      actions.walk.setLoop(THREE.LoopRepeat, Infinity);
      actions.idle = actions.walk;
      actions.attack = actions.walk;
    }

    // If no idle, use walk
    if (!actions.idle && actions.walk) {
      actions.idle = actions.walk;
    }

    // Start with walk by default
    const startAction = actions.walk || actions.idle;
    if (startAction) {
      startAction.play();
    }

    // Swap fallback children for GLB clone
    // Remove all fallback children
    while (wrapper.group.children.length > 0) {
      wrapper.group.remove(wrapper.group.children[0]);
    }

    // Add all GLB children to the existing group (preserves position/rotation)
    while (clone.children.length > 0) {
      const child = clone.children[0];
      clone.remove(child);
      wrapper.group.add(child);
    }

    // Copy scale from clone
    wrapper.group.scale.copy(clone.scale);

    // Update wrapper
    wrapper.allParts = allParts;
    wrapper.group.userData.bodyParts = allParts;
    wrapper.group.userData.hitbox = hitbox;
    wrapper._mixer = mixer;
    wrapper._actions = actions;
    wrapper._glbLoaded = true;
    wrapper._currentAction = startAction;

    wrapper.update = (delta) => {
      if (mixer) mixer.update(delta);
    };

    wrapper.playAnimation = (name) => {
      // Allow re-triggering same animation if GLB just loaded
      wrapper.currentAnim = name;

      const target = actions[name];
      if (!target) return;

      if (wrapper._currentAction && wrapper._currentAction !== target) {
        wrapper._currentAction.fadeOut(0.2);
        target.reset().fadeIn(0.2).play();
      } else if (!wrapper._currentAction) {
        target.reset().play();
      }
      wrapper._currentAction = target;
    };

    // Force-apply whatever animation state the enemy already set
    // (fixes case where _setAnimation("walk") was called before GLB loaded)
    wrapper.playAnimation(wrapper.currentAnim || "walk");
  });

  return wrapper;
}
