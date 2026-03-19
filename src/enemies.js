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

/**
 * Single zombie entity with health, AI movement,
 * attack behavior, visual representation, stair navigation, and archetypes.
 */
class Zombie {
  static _zombieTexture = null;

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
    this.currentFloor = 0; // 0 = ground, 1 = upper
    this.targetFloor = 0;

    // Stair navigation state
    this.navigatingStairs = false;
    this.stairWaypointIndex = 0;
    this.currentStaircase = null;
    this.goingUp = false;

    this.mesh = this._createMesh(type);
    this.mesh.position.copy(position);
    this.mesh.position.y = 0;
  }

  _createMesh(type) {
    const group = new THREE.Group();
    const cfg = ZOMBIE_TYPES[type] || ZOMBIE_TYPES.walker;
    const scale = cfg.scale;

    // Load zombie PNG as billboard sprite
    const tex = Zombie._zombieTexture;
    if (!tex) {
      return this._createFallbackMesh(cfg);
    }

    // Billboard plane — always faces camera
    const zombieHeight = 2.2 * scale;
    const zombieWidth = zombieHeight * 0.85; // wider for better visibility
    // MeshBasicMaterial — NOT affected by lighting, always fully visible
    const spriteMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide,
      color: 0xffffff, // full brightness — show texture as-is
    });

    const sprite = new THREE.Mesh(
      new THREE.PlaneGeometry(zombieWidth, zombieHeight),
      spriteMat,
    );
    sprite.position.y = zombieHeight / 2;
    group.add(sprite);

    // LARGE hitbox for reliable raycasting — covers full zombie body
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(1.2 * scale, 2.2 * scale, 1.2 * scale),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitbox.position.y = 1.1 * scale;
    group.add(hitbox);

    // Eye glow for tanks
    if (type === "tank") {
      const eyeGlow = new THREE.PointLight(cfg.eyeColor, 0.6, 4, 2);
      eyeGlow.position.set(0, 1.8 * scale, 0.3);
      group.add(eyeGlow);
    }

    // Store refs — bodyParts must use materials with emissive
    group.userData.bodyParts = [sprite];
    group.userData.sprite = sprite;

    return group;
  }

  /** Fallback box mesh if texture hasn't loaded */
  _createFallbackMesh(cfg) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: cfg.bodyColor,
      roughness: 0.8,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0,
    });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.35), mat);
    torso.position.y = 1.2;
    group.add(torso);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.35, 0.35),
      mat.clone(),
    );
    head.position.y = 1.85;
    group.add(head);

    // LARGE hitbox for reliable raycasting
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2.2, 1.2),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitbox.position.y = 1.1;
    group.add(hitbox);

    group.scale.setScalar(cfg.scale);
    group.userData.bodyParts = [torso, head];
    return group;
  }

  takeDamage(amount) {
    if (!this.alive || this.dying) return;

    this.health -= amount;
    this.hitFlash = 0.15;
    playZombieHit();

    // Flash red on hit — tint the material color
    const parts = this.mesh.userData.bodyParts || [];
    for (const part of parts) {
      if (!part.material) continue;
      if (part.material.color) {
        part.material.color.setHex(0xff4444);
      }
    }

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

  /**
   * Determine which floor this zombie is currently on based on Y position.
   */
  _updateFloor() {
    const feetY = this.mesh.position.y;
    this.currentFloor = feetY > SECOND_FLOOR_HEIGHT - 0.5 ? 1 : 0;
  }

  /**
   * Determine which floor the player is on.
   */
  _getPlayerFloor(playerPosition) {
    return playerPosition.y - PLAYER_HEIGHT > SECOND_FLOOR_HEIGHT - 0.5 ? 1 : 0;
  }

  /**
   * Find the nearest staircase to navigate between floors.
   */
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

    // Hit flash recovery
    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      if (this.hitFlash <= 0) {
        // Restore to white (full brightness texture)
        const parts = this.mesh.userData.bodyParts || [];
        for (const part of parts) {
          if (!part.material) continue;
          if (part.material.color) {
            part.material.color.setHex(0xffffff);
          }
        }
      }
    }

    // Death animation — use cached body parts instead of traverse
    if (this.dying) {
      this.deathTimer -= dt;
      this.mesh.rotation.x = Math.min(
        Math.PI / 2,
        this.mesh.rotation.x + dt * 3,
      );
      this.mesh.position.y = Math.max(
        this.mesh.position.y - dt * 0.5,
        this.currentFloor === 1 ? SECOND_FLOOR_HEIGHT - 0.5 : -0.5,
      );
      const opacity = Math.max(0, this.deathTimer / 1.5);
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

    this._updateFloor();
    this.targetFloor = this._getPlayerFloor(playerPosition);

    // Determine if we need stair navigation
    const needsFloorChange = this.currentFloor !== this.targetFloor;

    if (
      needsFloorChange &&
      !this.navigatingStairs &&
      stairWaypoints &&
      stairWaypoints.length > 0
    ) {
      // Start navigating to stairs
      this.currentStaircase = this._findNearestStaircase(stairWaypoints);
      if (this.currentStaircase) {
        this.navigatingStairs = true;
        this.goingUp = this.currentFloor === 0;
        this.stairWaypointIndex = this.goingUp
          ? 0
          : this.currentStaircase.waypoints.length - 1;
      }
    }

    // If on same floor as player and not on stairs, cancel stair nav
    if (!needsFloorChange && this.navigatingStairs) {
      this.navigatingStairs = false;
      this.currentStaircase = null;
    }

    let moveTarget;

    if (this.navigatingStairs && this.currentStaircase) {
      // Navigate stairs via waypoints
      const waypoints = this.currentStaircase.waypoints;
      const targetWP = waypoints[this.stairWaypointIndex];

      if (targetWP) {
        moveTarget = targetWP;
        const distToWP = new THREE.Vector2(
          this.mesh.position.x - targetWP.x,
          this.mesh.position.z - targetWP.z,
        ).length();

        if (distToWP < 1.0) {
          // Snap Y to stair height
          this.mesh.position.y = targetWP.y;

          // Advance to next waypoint
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
        // Invalid waypoint, cancel
        this.navigatingStairs = false;
        this.currentStaircase = null;
        moveTarget = playerPosition;
      }
    } else if (needsFloorChange && this.currentStaircase) {
      // Move toward staircase entry point
      moveTarget =
        this.currentFloor === 0
          ? this.currentStaircase.bottom
          : this.currentStaircase.top;
    } else {
      // Direct chase
      moveTarget = playerPosition;
    }

    // Move toward target
    const dir = new THREE.Vector3();
    dir.subVectors(moveTarget, this.mesh.position);

    // Only zero Y when not on stairs (so horizontal-only chase on flat ground)
    if (!this.navigatingStairs) {
      dir.y = 0;
    }

    const dist = dir.length();
    dir.normalize();

    // Billboard: sprite always faces player
    if (this.mesh.userData.sprite) {
      this.mesh.userData.sprite.lookAt(
        playerPosition.x,
        this.mesh.userData.sprite.getWorldPosition(new THREE.Vector3()).y,
        playerPosition.z,
      );
    } else {
      // Fallback box: face movement direction
      if (dir.x !== 0 || dir.z !== 0) {
        const lookTarget = new THREE.Vector3(
          this.mesh.position.x + dir.x,
          this.mesh.position.y,
          this.mesh.position.z + dir.z,
        );
        this.mesh.lookAt(lookTarget);
      }
    }

    // Shambling animation
    const walkCycle = Math.sin(Date.now() * 0.005 * this.speed) * 0.1;
    if (!this.navigatingStairs) {
      const baseY = this.currentFloor === 1 ? SECOND_FLOOR_HEIGHT + 0.13 : 0;
      this.mesh.position.y = baseY + Math.abs(walkCycle) * 0.05;
    }

    // Move if not in attack range of player
    const distToPlayer = this.mesh.position.distanceTo(playerPosition);
    const typeCfg = ZOMBIE_TYPES[this.type] || ZOMBIE_TYPES.walker;
    const effectiveAttackRange = typeCfg.attackRange;

    if (dist > 0.5) {
      const moveAmount = this.speed * dt;

      if (this.navigatingStairs) {
        // On stairs: move freely toward waypoint (including Y)
        this.mesh.position.x += dir.x * moveAmount;
        this.mesh.position.z += dir.z * moveAmount;
        // Lerp Y toward target waypoint Y
        if (this.currentStaircase) {
          const targetWP =
            this.currentStaircase.waypoints[this.stairWaypointIndex];
          if (targetWP) {
            this.mesh.position.y +=
              (targetWP.y - this.mesh.position.y) * dt * 4;
          }
        }
      } else {
        // Normal ground movement with obstacle avoidance
        const newX = this.mesh.position.x + dir.x * moveAmount;
        const newZ = this.mesh.position.z + dir.z * moveAmount;

        let blocked = false;
        for (const obs of obstacles) {
          // Skip floor obstacles (balcony) when checking zombie ground movement
          if (obs.max.y - obs.min.y < 0.5 && obs.min.y > 1) continue;

          const closestX = Math.max(obs.min.x, Math.min(newX, obs.max.x));
          const closestZ = Math.max(obs.min.z, Math.min(newZ, obs.max.z));
          const dx = newX - closestX;
          const dz = newZ - closestZ;
          if (dx * dx + dz * dz < 0.5 * 0.5) {
            blocked = true;
            const slideDir = new THREE.Vector3(-dir.z, 0, dir.x);
            const dot = slideDir.dot(dir);
            if (dot < 0) slideDir.negate();
            this.mesh.position.x += slideDir.x * moveAmount * 0.5;
            this.mesh.position.z += slideDir.z * moveAmount * 0.5;
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
      const lungeDir = new THREE.Vector3();
      lungeDir.subVectors(playerPosition, this.mesh.position);
      lungeDir.y = 0;
      lungeDir.normalize();
      this.mesh.position.x += lungeDir.x * 0.2;
      this.mesh.position.z += lungeDir.z * 0.2;
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

    // Preload zombie texture — process to remove dark background
    this._loadZombieTexture();
  }

  /** Load zombie PNG — already has RGBA transparency */
  _loadZombieTexture() {
    const loader = new THREE.TextureLoader();
    const tex = loader.load("/textures/zombie.png");
    tex.colorSpace = THREE.SRGBColorSpace;
    Zombie._zombieTexture = tex;
  }

  /** Set staircase waypoints from room creation */
  setStairWaypoints(waypoints) {
    this.stairWaypoints = waypoints;
  }

  /** Spawn a zombie at a position with given stats and type */
  spawn(position, health, speed, type = "walker") {
    const zombie = new Zombie(position, health, speed, type);
    this.scene.add(zombie.mesh);
    this.zombies.push(zombie);
    return zombie;
  }

  /** Get all zombie meshes for raycasting */
  getMeshes() {
    return this.zombies.filter((z) => z.alive && !z.dying).map((z) => z.mesh);
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

    // Remove dead zombies that finished death animation
    const toRemove = this.zombies.filter((z) => z.shouldRemove);
    for (const z of toRemove) {
      this.scene.remove(z.mesh);
    }
    this.zombies = this.zombies.filter((z) => !z.shouldRemove);

    return totalDamage;
  }

  /** Count of alive (not dying) zombies */
  get aliveCount() {
    return this.zombies.filter((z) => z.alive && !z.dying).length;
  }

  /** Total count including dying */
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
