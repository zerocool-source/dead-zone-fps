import * as THREE from "three";

/**
 * Trap system — point-activated area denial.
 */

export const TRAP_DEFS = {
  electric_stairs: {
    id: "electric_stairs",
    name: "Electric Trap",
    cost: 1000,
    damage: 50,
    duration: 5, // seconds active
    cooldown: 30, // seconds before reuse
    radius: 4,
    color: 0x4488ff,
  },
  fire_hallway: {
    id: "fire_hallway",
    name: "Fire Trap",
    cost: 1500,
    damage: 80,
    duration: 4,
    cooldown: 45,
    radius: 5,
    color: 0xff4400,
  },
};

class Trap {
  constructor(def, position) {
    this.def = def;
    this.position = position.clone();
    this.active = false;
    this.activeTimer = 0;
    this.cooldownTimer = 0;
    this.ready = true;
  }

  activate() {
    if (!this.ready) return false;
    this.active = true;
    this.activeTimer = this.def.duration;
    this.ready = false;
    return true;
  }

  update(dt, enemyManager) {
    let totalDamage = 0;

    if (this.active) {
      this.activeTimer -= dt;

      // Damage zombies in range
      for (const zombie of enemyManager.zombies) {
        if (!zombie.alive || zombie.dying) continue;
        const dist = zombie.mesh.position.distanceTo(this.position);
        if (dist < this.def.radius) {
          zombie.takeDamage(this.def.damage * dt); // DPS
        }
      }

      if (this.activeTimer <= 0) {
        this.active = false;
        this.cooldownTimer = this.def.cooldown;
      }
    } else if (!this.ready) {
      this.cooldownTimer -= dt;
      if (this.cooldownTimer <= 0) {
        this.ready = true;
      }
    }

    return totalDamage;
  }

  get statusText() {
    if (this.active) return `ACTIVE ${Math.ceil(this.activeTimer)}s`;
    if (!this.ready) return `COOLDOWN ${Math.ceil(this.cooldownTimer)}s`;
    return "READY";
  }
}

export class TrapManager {
  constructor(scene) {
    this.scene = scene;
    this.traps = [];
  }

  clear() {
    for (const trap of this.traps) {
      if (trap._indicator) this.scene.remove(trap._indicator);
      if (trap._light) this.scene.remove(trap._light);
    }
    this.traps = [];
  }

  addTrap(defId, position) {
    const def = TRAP_DEFS[defId];
    if (!def) return;
    const trap = new Trap(def, position);

    // Visual indicator
    const indicator = new THREE.Mesh(
      new THREE.CylinderGeometry(def.radius, def.radius, 0.05, 16),
      new THREE.MeshBasicMaterial({
        color: def.color,
        transparent: true,
        opacity: 0.15,
      }),
    );
    indicator.position.copy(position);
    indicator.position.y = 0.03;
    this.scene.add(indicator);
    trap._indicator = indicator;

    // No PointLight — emissive indicator handles glow
    trap._light = null;

    this.traps.push(trap);
    return trap;
  }

  getNearbyTrap(playerPos, maxDist = 4) {
    for (const trap of this.traps) {
      if (playerPos.distanceTo(trap.position) < maxDist) {
        return trap;
      }
    }
    return null;
  }

  update(dt, enemyManager) {
    for (const trap of this.traps) {
      trap.update(dt, enemyManager);

      // Update visual
      if (trap._light) {
        trap._light.intensity = trap.active ? 2.0 : trap.ready ? 0.3 : 0.1;
      }
      if (trap._indicator) {
        trap._indicator.material.opacity = trap.active
          ? 0.4
          : trap.ready
            ? 0.15
            : 0.05;
      }
    }
  }
}
