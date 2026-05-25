/**
 * WeaponModel — 3D GLB weapon viewmodel system.
 *
 * Loads animated GLB weapon models (with hands) and renders them
 * in the player's first-person view. Replaces the old 2D sprite overlay.
 *
 * Supports idle, shoot, reload, and ADS animations from the GLB.
 * Rendered in a separate scene with its own camera to prevent
 * clipping with the world geometry.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// ═══════════════════════════════════════════════════════════
// WEAPON MODEL DEFINITIONS
// ═══════════════════════════════════════════════════════════

const WEAPON_MODELS = {
  // FN 502 Tactical — default pistol, SMG, rifle
  fn502: {
    path: "/models/fps_fn502.glb",
    scale: 0.65,
    position: { x: 0.12, y: -0.35, z: -0.45 },
    rotation: { x: 0, y: Math.PI, z: 0 },
    anims: {
      idle: null,
      shoot: null,
      reload: null,
      draw: null,
    },
  },
  // Saiga shotgun
  saiga: {
    path: "/models/fps_saiga.glb",
    scale: 0.65,
    position: { x: 0.12, y: -0.35, z: -0.45 },
    rotation: { x: 0, y: Math.PI, z: 0 },
    anims: {
      idle: null,
      shoot: null,
      reload: null,
      draw: null,
    },
  },
};

// Map weapon keys to which 3D model they use
const WEAPON_TO_MODEL = {
  pistol: "fn502",
  smg: "fn502",
  ak47: "fn502",
  rifle: "fn502",
  shotgun: "saiga",
  lmg: "fn502",
  rpd: "fn502",
  rocketLauncher: "fn502",
  flamethrower: "fn502",
  minigun: "fn502",
  raygun: "fn502",
  thunder: "fn502",
};

// ═══════════════════════════════════════════════════════════
// WEAPON MODEL CLASS
// ═══════════════════════════════════════════════════════════

export class WeaponModelRenderer {
  constructor(parentCamera) {
    // Separate scene + camera for viewmodel (prevents world clipping)
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.01,
      10,
    );

    // Lighting for the weapon model
    const ambient = new THREE.AmbientLight(0xffffff, 2.0);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(0.5, 1, 0.5);
    this.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.5);
    fillLight.position.set(-0.5, 0, -0.5);
    this.scene.add(fillLight);

    // State
    this._parentCamera = parentCamera;
    this._loadedModels = {}; // modelKey → { group, mixer, clips, actions }
    this._activeModel = null; // currently displayed model key
    this._activeGroup = null; // currently displayed THREE.Group
    this._mixer = null;
    this._currentAction = null;
    this._pendingAction = null;
    this._loader = new GLTFLoader();
    this._clock = new THREE.Clock();

    // Muzzle flash
    this._muzzleFlash = this._createMuzzleFlash();
    this.scene.add(this._muzzleFlash);
    this._muzzleFlashTimer = 0;

    // Sway / bob state
    this._time = 0;
    this._bobAmount = 0;
    this._swayX = 0;
    this._swayY = 0;
    this._recoilKick = 0;
    this._adsLerp = 0;

    this.visible = true;
    this._shootQueued = false;

    // Preload both models
    this._preloadAll();

    // Handle resize
    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  // ── Muzzle flash ─────────────────────────────────────────

  _createMuzzleFlash() {
    const group = new THREE.Group();
    group.visible = false;

    // Core bright flash
    const coreGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // Outer glow
    const glowGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 0.6,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    group.add(glow);

    // Flash spikes (star pattern)
    for (let i = 0; i < 4; i++) {
      const spikeGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.12, 4);
      const spikeMat = new THREE.MeshBasicMaterial({
        color: 0xffcc44,
        transparent: true,
        opacity: 0.8,
      });
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      spike.rotation.z = (i / 4) * Math.PI;
      group.add(spike);
    }

    // Point light for illumination
    const flashLight = new THREE.PointLight(0xff8800, 3, 4, 2);
    group.add(flashLight);
    group.userData.flashLight = flashLight;

    // Position at muzzle (will be updated per-frame)
    group.position.set(0, -0.08, -0.7);

    return group;
  }

  _showMuzzleFlash() {
    this._muzzleFlash.visible = true;
    this._muzzleFlashTimer = 0.06;
    // Random rotation for variety
    this._muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
    // Random scale for variation
    const s = 0.8 + Math.random() * 0.4;
    this._muzzleFlash.scale.set(s, s, s);
  }

  // ── Preload all weapon models ─────────────────────────────

  _preloadAll() {
    for (const [key, def] of Object.entries(WEAPON_MODELS)) {
      this._loadModel(key, def);
    }
  }

  _loadModel(key, def) {
    this._loader.load(
      def.path,
      (gltf) => {
        const group = gltf.scene;
        group.scale.setScalar(def.scale);
        group.position.set(def.position.x, def.position.y, def.position.z);
        group.rotation.set(def.rotation.x, def.rotation.y, def.rotation.z);

        // Ensure all materials render properly
        group.traverse((child) => {
          if (child.isMesh) {
            child.frustumCulled = false;
            if (child.material) {
              child.material.side = THREE.FrontSide;
            }
          }
        });

        // Animation mixer
        const mixer = new THREE.AnimationMixer(group);
        const clips = gltf.animations || [];
        const actions = {};

        // Auto-map animations by name matching
        for (const clip of clips) {
          const name = clip.name.toLowerCase();
          if (name.includes("idle") || name.includes("breath")) {
            actions.idle = mixer.clipAction(clip);
            def.anims.idle = clip.name;
          } else if (
            name.includes("shoot") ||
            name.includes("fire") ||
            name.includes("shot")
          ) {
            actions.shoot = mixer.clipAction(clip);
            def.anims.shoot = clip.name;
          } else if (name.includes("reload") || name.includes("load")) {
            actions.reload = mixer.clipAction(clip);
            def.anims.reload = clip.name;
          } else if (
            name.includes("draw") ||
            name.includes("equip") ||
            name.includes("take")
          ) {
            actions.draw = mixer.clipAction(clip);
            def.anims.draw = clip.name;
          } else if (name.includes("walk") || name.includes("run")) {
            actions.walk = mixer.clipAction(clip);
          } else if (
            name.includes("aim") ||
            name.includes("ads") ||
            name.includes("iron")
          ) {
            actions.aim = mixer.clipAction(clip);
          }
        }

        // If no idle found, use the first clip or create a static pose
        if (!actions.idle && clips.length > 0) {
          actions.idle = mixer.clipAction(clips[0]);
        }

        // Configure action properties
        for (const [aName, action] of Object.entries(actions)) {
          if (!action) continue;
          if (aName === "idle" || aName === "walk") {
            action.setLoop(THREE.LoopRepeat, Infinity);
          } else {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
          }
        }

        this._loadedModels[key] = { group, mixer, clips, actions, def };

        // If this is the first model loaded and nothing is active, show it
        if (!this._activeModel) {
          this._activateModel(key);
        }

        console.log(
          `[WeaponModel] Loaded ${key}: ${clips.length} animations (${clips.map((c) => c.name).join(", ")})`,
        );
      },
      undefined,
      (err) => {
        console.warn(`[WeaponModel] Failed to load ${def.path}:`, err);
      },
    );
  }

  // ── Activate a specific model ─────────────────────────────

  _activateModel(key) {
    const model = this._loadedModels[key];
    if (!model) return;

    // Remove current model from scene
    if (this._activeGroup) {
      this.scene.remove(this._activeGroup);
    }

    // Stop current mixer
    if (this._mixer) {
      this._mixer.stopAllAction();
    }

    // Add new model
    this.scene.add(model.group);
    this._activeModel = key;
    this._activeGroup = model.group;
    this._mixer = model.mixer;

    // Play draw animation if available, then idle
    if (model.actions.draw) {
      this._playAction(model.actions.draw, 0.1);
      // After draw finishes, play idle
      model.actions.draw.reset();
      const onFinish = () => {
        this._mixer.removeEventListener("finished", onFinish);
        this._playAction(model.actions.idle, 0.3);
      };
      this._mixer.addEventListener("finished", onFinish);
    } else if (model.actions.idle) {
      this._playAction(model.actions.idle, 0.1);
    }
  }

  _playAction(action, fadeTime = 0.2) {
    if (!action) return;
    if (this._currentAction && this._currentAction !== action) {
      this._currentAction.fadeOut(fadeTime);
    }
    action.reset().fadeIn(fadeTime).play();
    this._currentAction = action;
  }

  // ── Public API ────────────────────────────────────────────

  /** Switch to a different weapon model */
  switchWeapon(weaponKey) {
    const modelKey = WEAPON_TO_MODEL[weaponKey] || "fn502";
    if (modelKey === this._activeModel) return;

    if (this._loadedModels[modelKey]) {
      this._activateModel(modelKey);
    }
    // If not loaded yet, it will activate when loading completes
  }

  /** Trigger shoot animation */
  triggerShoot() {
    const model = this._loadedModels[this._activeModel];
    if (!model) return;

    this._recoilKick = 1.0;
    this._showMuzzleFlash();

    if (model.actions.shoot) {
      this._playAction(model.actions.shoot, 0.05);
      // Return to idle after shoot finishes
      const onFinish = () => {
        this._mixer.removeEventListener("finished", onFinish);
        if (model.actions.idle) {
          this._playAction(model.actions.idle, 0.2);
        }
      };
      this._mixer.addEventListener("finished", onFinish);
    }
  }

  /** Trigger reload animation */
  triggerReload() {
    const model = this._loadedModels[this._activeModel];
    if (!model || !model.actions.reload) return;

    this._playAction(model.actions.reload, 0.2);
    const onFinish = () => {
      this._mixer.removeEventListener("finished", onFinish);
      if (model.actions.idle) {
        this._playAction(model.actions.idle, 0.3);
      }
    };
    this._mixer.addEventListener("finished", onFinish);
  }

  show() {
    this.visible = true;
  }

  hide() {
    this.visible = false;
  }

  /** True once at least one GLB has loaded and an active model is set. */
  hasModel() {
    return this._activeGroup !== null && this._activeModel !== null;
  }

  // ── Frame update ──────────────────────────────────────────

  update(dt, isMoving, isSprinting, isReloading, reloadProgress, isAiming) {
    if (!this.visible || !this._mixer) return;

    this._time += dt;
    this._mixer.update(dt);

    // Muzzle flash timer
    if (this._muzzleFlashTimer > 0) {
      this._muzzleFlashTimer -= dt;
      if (this._muzzleFlashTimer <= 0) {
        this._muzzleFlash.visible = false;
      }
    }

    // Recoil decay
    this._recoilKick *= Math.pow(0.001, dt * 8);

    // ADS lerp
    this._adsLerp +=
      ((isAiming ? 1 : 0) - this._adsLerp) * Math.min(1, dt * 12);

    // Sway (fade during ADS)
    const swayFade = 1 - this._adsLerp * 0.8;
    let swayX = Math.sin(this._time * 1.2) * 0.003 * swayFade;
    let swayY = Math.cos(this._time * 0.9) * 0.002 * swayFade;

    // Walk bob
    if (isMoving) {
      const bobSpeed = isSprinting ? 14 : 10;
      const bobMult = isSprinting ? 1.5 : 1.0;
      swayX +=
        Math.cos(this._time * bobSpeed * 0.5) * 0.008 * bobMult * swayFade;
      swayY += Math.sin(this._time * bobSpeed) * 0.012 * bobMult * swayFade;
    }

    // Apply to model position
    if (this._activeGroup) {
      const model = this._loadedModels[this._activeModel];
      if (!model) return;
      const def = model.def;

      // Base position
      const baseX = def.position.x;
      const baseY = def.position.y;
      const baseZ = def.position.z;

      // ADS: move closer to center and forward
      const adsX = baseX * (1 - this._adsLerp * 0.8);
      const adsY = baseY * (1 - this._adsLerp * 0.5);
      const adsZ = baseZ - this._adsLerp * 0.05;

      // Recoil kick-back
      const recoilZ = this._recoilKick * 0.03;
      const recoilY = this._recoilKick * 0.01;

      this._activeGroup.position.set(
        adsX + swayX,
        adsY + swayY + recoilY,
        adsZ + recoilZ,
      );
    }
  }

  /** Render the weapon viewmodel on top of the main scene */
  render(renderer) {
    if (!this.visible || !this._activeGroup) return;

    // Save renderer state
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;

    // Clear only depth buffer so weapon renders on top
    renderer.clearDepth();

    // Render weapon scene
    renderer.render(this.scene, this.camera);

    // Restore
    renderer.autoClear = autoClear;
  }
}
