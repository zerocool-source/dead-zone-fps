import * as THREE from "three";
import {
  ZOMBIE_BASE_HEALTH,
  ZOMBIE_DAMAGE,
  ZOMBIE_ATTACK_COOLDOWN,
  ZOMBIE_BASE_SPEED,
  ZOMBIE_ATTACK_RANGE,
  SECOND_FLOOR_HEIGHT,
  PLAYER_HEIGHT,
} from "./constants.js";
import { ZOMBIE_TYPES } from "./zombieTypes.js";
import { playZombieHit, playZombieDeath } from "./audio.js";
import { createZombie } from "./zombieModel.js";

/**
 * Single zombie entity — now uses procedural 3D rigged model
 * with idle/walk/attack animations instead of flat billboard sprites.
 */
class Zombie {
  constructor(position, health, speed, type = "walker") {
    this.type = type;
    this.health = health;
    this.maxHealth = health;
    this.speed = speed;
    this.alive = true;
    this.attackCooldown = 0;
    this.hitFlash = 0;
    this.deathTimer = 0;
    this.dying = false;

    // Floor tracking
    this.currentFloor = 0;
    this.targetFloor = 0;

    // Stair navigation state
    this.navigatingStairs = false;
    this.stairWaypointIndex = 0;
    this.currentStaircase = null;
    this.goingUp = false;

    // Reusable vectors
    this._tmpVec = new THREE.Vector3();
    this._tmpDir = new THREE.Vector3();
    this._animTime = 0;
    this._staggerTime = 0;
    this._staggerDir = 0;
    this._deathDir = null;

    // 3D zombie asset
    this._zombieAsset = null;
    this._currentAnimState = "idle";

    this.mesh = this._createMesh(type);
    this.mesh.position.copy(position);
    this.mesh.position.y = 0;
  }

  _createMesh(type) {
    const cfg = ZOMBIE_TYPES[type] || ZOMBIE_TYPES.walker;
    const scale = cfg.scale;

    // Use procedural 3D zombie model
    const skinColor = cfg.bodyColor || 0x4a6b3a;
    const eyeColor = cfg.eyeColor || 0xff2200;
    const asset = createZombie(scale, skinColor, eyeColor);
    this._zombieAsset = asset;

    const group = asset.group;

    // Store refs for game integration (hit flash, death fade, etc.)
    group.userData.bodyParts = asset.allParts;
    group.userData.sprite = null; // no sprite — 3D model
    group.userData.is3D = true;

    return group;
  }

  /**
   * Set animation state based on zombie behavior.
   */
  _setAnimation(name) {
    if (this._currentAnimState === name && this._zombieAsset._glbLoaded) return;
    this._currentAnimState = name;
    if (this._zombieAsset) {
      this._zombieAsset.currentAnim = name;
      this._zombieAsset.playAnimation(name);
    }
  }

  takeDamage(amount) {
    if (!this.alive || this.dying) return;

    this.health -= amount;
    this.hitFlash = 0.15;
    playZombieHit();

    // Flash red on hit
    const parts = this.mesh.userData.bodyParts || [];
    for (const part of parts) {
      if (part.material && part.material.color) {
        part.material.color.setHex(0xff4444);
      }
    }

    // Stagger
    this._staggerTime = 0.2;
    this._staggerDir = (Math.random() - 0.5) * 2;

    if (this.health <= 0) {
      this.die();
    }
  }

  die() {
    this.alive = false;
    this.dying = true;
    this.deathTimer = 1.5;
    playZombieDeath();
  }

  _updateFloor() {
    const feetY = this.mesh.position.y;
    this.currentFloor = feetY > SECOND_FLOOR_HEIGHT - 0.5 ? 1 : 0;
  }

  _getPlayerFloor(playerPosition) {
    return playerPosition.y - PLAYER_HEIGHT > SECOND_FLOOR_HEIGHT - 0.5 ? 1 : 0;
  }

  _findNearestStaircase(stairWaypoints) {
    let nearest = null;
    let nearestDist = Infinity;
    const myPos = this.mesh.position;

    for (const stair of stairWaypoints) {
      const entryPoint = this.currentFloor === 0 ? stair.bottom : stair.top;
      const dist = myPos.distanceTo(entryPoint);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = stair;
      }
    }
    return nearest;
  }

  /**
   * Update zombie AI, movement, attack.
   * Returns damage dealt to player this frame, or 0.
   */
  update(dt, playerPosition, obstacles, stairWaypoints) {
    let damageDealt = 0;

    // Hit flash recovery — restore original colors
    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      if (this.hitFlash <= 0) {
        const parts = this.mesh.userData.bodyParts || [];
        for (const part of parts) {
          if (part.material && part.material.color) {
            // Reset to a neutral tint
            part.material.color.setHex(0xcccccc);
          }
        }
      }
    }

    // Death animation — tip over, sink, fade
    if (this.dying) {
      this.deathTimer -= dt;
      const t = 1 - Math.max(0, this.deathTimer / 1.5);

      if (!this._deathDir) {
        this._deathDir = (Math.random() - 0.5) * 2;
      }

      // Tip the 3D model sideways
      this.mesh.rotation.z = this._deathDir * t * 1.2;
      this.mesh.rotation.x = t * 0.4;

      // Sink into ground
      const floorY = this.currentFloor === 1 ? SECOND_FLOOR_HEIGHT : 0;
      this.mesh.position.y = floorY - t * 0.8;

      // Fade out all parts
      const opacity = Math.max(0, 1 - t * 1.2);
      const parts = this.mesh.userData.bodyParts || [];
      for (const part of parts) {
        if (part.material) {
          part.material.transparent = true;
          part.material.opacity = opacity;
        }
      }
      return 0;
    }

    if (!this.alive) return 0;

    // Update 3D animation
    if (this._zombieAsset) {
      this._zombieAsset.update(dt);
    }

    this._updateFloor();
    this.targetFloor = this._getPlayerFloor(playerPosition);

    // Stair navigation logic
    const needsFloorChange = this.currentFloor !== this.targetFloor;

    if (
      needsFloorChange &&
      !this.navigatingStairs &&
      stairWaypoints &&
      stairWaypoints.length > 0
    ) {
      this.currentStaircase = this._findNearestStaircase(stairWaypoints);
      if (this.currentStaircase) {
        this.navigatingStairs = true;
        this.goingUp = this.currentFloor === 0;
        this.stairWaypointIndex = this.goingUp
          ? 0
          : this.currentStaircase.waypoints.length - 1;
      }
    }

    if (!needsFloorChange && this.navigatingStairs) {
      this.navigatingStairs = false;
      this.currentStaircase = null;
    }

    let moveTarget;

    if (this.navigatingStairs && this.currentStaircase) {
      const waypoints = this.currentStaircase.waypoints;
      const targetWP = waypoints[this.stairWaypointIndex];

      if (targetWP) {
        moveTarget = targetWP;
        const dwpX = this.mesh.position.x - targetWP.x;
        const dwpZ = this.mesh.position.z - targetWP.z;
        const distToWP = Math.sqrt(dwpX * dwpX + dwpZ * dwpZ);

        if (distToWP < 1.0) {
          this.mesh.position.y = targetWP.y;
          if (this.goingUp) {
            this.stairWaypointIndex++;
            if (this.stairWaypointIndex >= waypoints.length) {
              this.navigatingStairs = false;
              this.currentStaircase = null;
            }
          } else {
            this.stairWaypointIndex--;
            if (this.stairWaypointIndex < 0) {
              this.navigatingStairs = false;
              this.currentStaircase = null;
              this.mesh.position.y = 0;
            }
          }
        }
      } else {
        this.navigatingStairs = false;
        this.currentStaircase = null;
        moveTarget = playerPosition;
      }
    } else if (needsFloorChange && this.currentStaircase) {
      moveTarget =
        this.currentFloor === 0
          ? this.currentStaircase.bottom
          : this.currentStaircase.top;
    } else {
      moveTarget = playerPosition;
    }

    // Move toward target
    const dir = this._tmpDir;
    dir.subVectors(moveTarget, this.mesh.position);

    if (!this.navigatingStairs) {
      dir.y = 0;
    }

    const dist = dir.length();
    dir.normalize();

    // Face movement direction (3D model rotates via Y axis)
    if (dir.x !== 0 || dir.z !== 0) {
      const angle = Math.atan2(dir.x, dir.z);
      // Smooth rotation
      const currentY = this.mesh.rotation.y;
      let targetY = angle;
      // Normalize angle difference
      let diff = targetY - currentY;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.mesh.rotation.y += diff * Math.min(1, dt * 8);
    }

    // Ground position when not on stairs
    if (!this.navigatingStairs) {
      const baseY = this.currentFloor === 1 ? SECOND_FLOOR_HEIGHT + 0.05 : 0;
      this.mesh.position.y = baseY;
    }

    // Stagger from hits
    if (this._staggerTime > 0) {
      this._staggerTime -= dt;
      const staggerT = this._staggerTime / 0.2;
      this.mesh.rotation.z = this._staggerDir * staggerT * 0.15;
    } else if (!this.dying) {
      // Reset rotation z when not staggering/dying
      this.mesh.rotation.z *= 0.9;
    }

    // Distance to player for attack/animation state
    const distToPlayer = this.mesh.position.distanceTo(playerPosition);
    const typeCfg = ZOMBIE_TYPES[this.type] || ZOMBIE_TYPES.walker;
    const effectiveAttackRange = typeCfg.attackRange;

    // Set animation based on distance
    if (distToPlayer < effectiveAttackRange * 1.5) {
      this._setAnimation("attack");
    } else if (dist < 25) {
      this._setAnimation("walk");
    } else {
      this._setAnimation("idle");
    }

    // Movement
    if (dist > 0.5) {
      const moveAmount = this.speed * dt;

      if (this.navigatingStairs) {
        this.mesh.position.x += dir.x * moveAmount;
        this.mesh.position.z += dir.z * moveAmount;
        if (this.currentStaircase) {
          const targetWP =
            this.currentStaircase.waypoints[this.stairWaypointIndex];
          if (targetWP) {
            this.mesh.position.y +=
              (targetWP.y - this.mesh.position.y) * dt * 4;
          }
        }
      } else {
        const newX = this.mesh.position.x + dir.x * moveAmount;
        const newZ = this.mesh.position.z + dir.z * moveAmount;

        let blocked = false;
        for (const obs of obstacles) {
          if (obs.max.y - obs.min.y < 0.5 && obs.min.y > 1) continue;

          const closestX = Math.max(obs.min.x, Math.min(newX, obs.max.x));
          const closestZ = Math.max(obs.min.z, Math.min(newZ, obs.max.z));
          const dx = newX - closestX;
          const dz = newZ - closestZ;
          if (dx * dx + dz * dz < 0.5 * 0.5) {
            blocked = true;
            let slideX = -dir.z;
            let slideZ = dir.x;
            const dot = slideX * dir.x + slideZ * dir.z;
            if (dot < 0) {
              slideX = -slideX;
              slideZ = -slideZ;
            }
            this.mesh.position.x += slideX * moveAmount * 0.5;
            this.mesh.position.z += slideZ * moveAmount * 0.5;
            break;
          }
        }

        if (!blocked) {
          this.mesh.position.x = newX;
          this.mesh.position.z = newZ;
        }
      }
    }

    // Attack
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (
      distToPlayer < effectiveAttackRange &&
      this.attackCooldown <= 0 &&
      this.currentFloor === this.targetFloor
    ) {
      this.attackCooldown = typeCfg.attackCooldown;
      damageDealt = typeCfg.damage;

      // Lunge
      this._tmpVec.subVectors(playerPosition, this.mesh.position);
      this._tmpVec.y = 0;
      this._tmpVec.normalize();
      this.mesh.position.x += this._tmpVec.x * 0.2;
      this.mesh.position.z += this._tmpVec.z * 0.2;
    }

    return damageDealt;
  }

  get shouldRemove() {
    return this.dying && this.deathTimer <= 0;
  }
}

/**
 * Manages all zombie instances in the scene.
 */
export class EnemyManager {
  constructor(scene) {
    this.scene = scene;
    this.zombies = [];
    this.stairWaypoints = [];
    this._cachedMeshes = [];
  }

  setStairWaypoints(waypoints) {
    this.stairWaypoints = waypoints;
  }

  spawn(position, health, speed, type = "walker") {
    const zombie = new Zombie(position, health, speed, type);
    this.scene.add(zombie.mesh);
    this.zombies.push(zombie);
    return zombie;
  }

  /** Get all zombie meshes for raycasting — rebuilds every call for accuracy */
  getMeshes() {
    this._cachedMeshes = [];
    for (const z of this.zombies) {
      if (z.alive && !z.dying) {
        z.mesh.updateMatrixWorld(true);
        this._cachedMeshes.push(z.mesh);
      }
    }
    return this._cachedMeshes;
  }

  /** Find zombie by mesh (or child mesh) */
  findByMesh(mesh) {
    return this.zombies.find((z) => {
      if (z.mesh === mesh) return true;
      let parent = mesh.parent;
      while (parent) {
        if (parent === z.mesh) return true;
        parent = parent.parent;
      }
      return false;
    });
  }

  /** Update all zombies, returns total damage dealt to player */
  update(dt, playerPosition, obstacles) {
    let totalDamage = 0;

    for (const zombie of this.zombies) {
      totalDamage += zombie.update(
        dt,
        playerPosition,
        obstacles,
        this.stairWaypoints,
      );
    }

    const toRemove = this.zombies.filter((z) => z.shouldRemove);
    for (const z of toRemove) {
      this.scene.remove(z.mesh);
    }
    this.zombies = this.zombies.filter((z) => !z.shouldRemove);

    return totalDamage;
  }

  get aliveCount() {
    return this.zombies.filter((z) => z.alive && !z.dying).length;
  }

  get totalCount() {
    return this.zombies.length;
  }

  clear() {
    for (const z of this.zombies) {
      this.scene.remove(z.mesh);
    }
    this.zombies = [];
  }
}
