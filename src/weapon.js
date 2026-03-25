import * as THREE from "three";
import {
  FIRE_RATE,
  MAGAZINE_SIZE,
  RESERVE_AMMO,
  RELOAD_TIME,
  WEAPON_DAMAGE,
  RECOIL_AMOUNT,
  WEAPON_RANGE,
  SPREAD_BASE,
  HORIZONTAL_RECOIL,
} from "./constants.js";
import { playGunshot, playReload, playEmpty } from "./audio.js";

// Return codes for tryShoot
const SHOT_RESULT = {
  BLOCKED: 0,
  MISS: 1,
  HIT: 2,
};

/**
 * Weapon system — handles shooting logic, ammo, reload, hit detection.
 * Enhanced with heavier recoil, horizontal kick, and stronger muzzle flash.
 */
export class Weapon {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;

    this.ammo = MAGAZINE_SIZE;
    this.reserve = RESERVE_AMMO;
    this.fireCooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this.aiming = false;

    // Per-weapon overridable stats
    this._magSize = MAGAZINE_SIZE;
    this._fireRate = FIRE_RATE;
    this._damage = WEAPON_DAMAGE;
    this._spread = SPREAD_BASE;
    this._recoilAmount = RECOIL_AMOUNT;
    this._horizontalRecoil = HORIZONTAL_RECOIL;

    // Muzzle flash (stronger light)
    this.muzzleFlashLight = new THREE.PointLight(0xff8800, 0, 12);
    this.camera.add(this.muzzleFlashLight);
    this.muzzleFlashLight.position.set(0, 0, -1);
    this.muzzleFlashTimer = 0;

    // Recoil state
    this.weaponKick = 0;

    // Reusable objects — avoid per-frame allocation
    this._tmpQuat = new THREE.Quaternion();
    this._tmpVec = new THREE.Vector3();
    this._tmpDir = new THREE.Vector3();

    // Input
    this.shooting = false;
    this._mouseAiming = false;
    this._setupInput();

    // Raycaster
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = WEAPON_RANGE;

    // Reference to sprite (set by main.js)
    this.sprite = null;
  }

  _setupInput() {
    document.addEventListener("mousedown", (e) => {
      if (e.button === 0) this.shooting = true;
      if (e.button === 2) {
        this._mouseAiming = true;
        this.aiming = true;
      }
    });
    document.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.shooting = false;
      if (e.button === 2) {
        this._mouseAiming = false;
        this.aiming = false;
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "r" && !this.reloading) {
        this.startReload();
      }
    });
    document.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  startReload() {
    if (this.reloading) return;
    if (this.ammo === this._magSize) return;
    if (this.reserve <= 0) return;

    this.reloading = true;
    this.reloadTimer = RELOAD_TIME;
    playReload();
  }

  /**
   * Attempt to fire.
   * Returns { result, hit } where result is SHOT_RESULT enum.
   */
  tryShoot(targets) {
    if (this.fireCooldown > 0 || this.reloading) {
      return { result: SHOT_RESULT.BLOCKED, hit: null };
    }

    if (this.ammo <= 0) {
      playEmpty();
      return { result: SHOT_RESULT.BLOCKED, hit: null };
    }

    // --- Fire! ---
    this.ammo -= 1;
    this.fireCooldown = this._fireRate;
    this.weaponKick = 1;

    // Stronger muzzle flash
    this.muzzleFlashTimer = 0.08;
    this.muzzleFlashLight.intensity = 5;

    // Trigger sprite shoot animation
    if (this.sprite) {
      this.sprite.triggerShoot();
    }

    playGunshot();

    // Ray fires straight from camera center — exactly where crosshair is
    const spread = this._spread * (this.aiming ? 0.3 : 1);
    this._tmpDir.set(
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread,
      -1,
    );
    this._tmpDir.normalize();
    this._tmpDir.applyQuaternion(this.camera.getWorldQuaternion(this._tmpQuat));

    this.raycaster.set(
      this.camera.getWorldPosition(this._tmpVec),
      this._tmpDir,
    );

    const hits = this.raycaster.intersectObjects(targets, true);
    if (hits.length > 0) {
      // Check for headshot (hit point y relative to zombie base)
      const hitPoint = hits[0].point;
      const hitObj = hits[0].object;

      // Determine if headshot based on local Y position
      let isHeadshot = false;
      const localPoint = hitObj.worldToLocal(hitPoint.clone());
      // Head is typically the top part of the zombie mesh
      if (localPoint.y > 0.3) {
        isHeadshot = true;
      }

      const damage = isHeadshot ? this._damage * 2 : this._damage;

      return {
        result: SHOT_RESULT.HIT,
        hit: {
          point: hitPoint,
          object: hitObj,
          damage,
          isHeadshot,
        },
      };
    }

    // Auto reload on empty
    if (this.ammo === 0 && this.reserve > 0) {
      setTimeout(() => this.startReload(), 300);
    }

    return { result: SHOT_RESULT.MISS, hit: null };
  }

  update(dt, isMoving, isSprinting) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    // Muzzle flash light (longer duration)
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashTimer <= 0) {
        this.muzzleFlashLight.intensity = 0;
      }
    }

    // Reload
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const needed = this._magSize - this.ammo;
        const toLoad = Math.min(needed, this.reserve);
        this.ammo += toLoad;
        this.reserve -= toLoad;
        this.reloading = false;
      }
    }

    // Slower recoil decay (heavier feel)
    this.weaponKick *= Math.pow(0.003, dt);

    // Update weapon sprite
    if (this.sprite) {
      const reloadProgress = this.reloading
        ? 1 - this.reloadTimer / RELOAD_TIME
        : 0;
      this.sprite.update(
        dt,
        isMoving,
        isSprinting,
        this.reloading,
        reloadProgress,
        this.aiming,
      );
    }

    return this._recoilAmount * (this.weaponKick > 0.1 ? 1 : 0);
  }

  /** Get horizontal recoil amount for this shot */
  getHorizontalRecoil() {
    return (Math.random() - 0.5) * this._horizontalRecoil * 2;
  }
}

export { SHOT_RESULT };
