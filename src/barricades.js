import * as THREE from "three";

/**
 * Barricade system — player can board up doorways/windows.
 * Zombies attack barricades and break through over time.
 * Press F near a broken barricade to rebuild it.
 */

const BOARD_HEALTH = 80;
const BOARD_REPAIR_TIME = 1.5; // seconds to place one board
const MAX_BOARDS = 4; // boards per barricade slot
const ZOMBIE_DAMAGE_RATE = 15; // damage per second from each zombie hitting

const BOARD_COLOR = 0x7a5a30;
const BOARD_DAMAGED_COLOR = 0x5a3a18;

class Barricade {
  constructor(scene, position, rotation, size) {
    this.scene = scene;
    this.position = position.clone();
    this.rotation = rotation;
    this.size = size; // { w, h }
    this.boards = [];
    this.maxBoards = MAX_BOARDS;
    this.health = 0;
    this.totalHealth = 0;
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.rotation.y = rotation;

    // Frame (always visible)
    const frameMat = new THREE.MeshBasicMaterial({ color: 0x4a3a28 });
    const frameW = 0.15;
    // Left post
    const left = new THREE.Mesh(
      new THREE.BoxGeometry(frameW, size.h, frameW),
      frameMat,
    );
    left.position.set(-size.w / 2, size.h / 2, 0);
    this.group.add(left);
    // Right post
    const right = new THREE.Mesh(
      new THREE.BoxGeometry(frameW, size.h, frameW),
      frameMat,
    );
    right.position.set(size.w / 2, size.h / 2, 0);
    this.group.add(right);
    // Top beam
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(size.w + frameW * 2, frameW, frameW),
      frameMat,
    );
    top.position.set(0, size.h, 0);
    this.group.add(top);

    scene.add(this.group);

    // Build all boards initially
    for (let i = 0; i < MAX_BOARDS; i++) {
      this._addBoard(i);
    }
    this.health = MAX_BOARDS * BOARD_HEALTH;
    this.totalHealth = this.health;
  }

  _addBoard(index) {
    const boardH = this.size.h / MAX_BOARDS;
    const y = boardH * index + boardH / 2;
    const mat = new THREE.MeshBasicMaterial({ color: BOARD_COLOR });
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(this.size.w - 0.1, boardH - 0.05, 0.08),
      mat,
    );
    mesh.position.set(0, y, 0);

    // Slight random rotation for natural look
    mesh.rotation.z = (Math.random() - 0.5) * 0.05;
    mesh.rotation.y = (Math.random() - 0.5) * 0.03;

    this.group.add(mesh);
    this.boards[index] = {
      mesh,
      health: BOARD_HEALTH,
      alive: true,
    };
  }

  /** Returns true if barricade is fully intact */
  get isIntact() {
    return this.boards.every((b) => b && b.alive);
  }

  /** Returns true if barricade is fully broken */
  get isBroken() {
    return this.boards.every((b) => !b || !b.alive);
  }

  /** Returns true if barricade can be repaired */
  get canRepair() {
    return this.boards.some((b) => !b || !b.alive);
  }

  /** Get blocking AABB if barricade has boards */
  getObstacle() {
    if (this.isBroken) return null;
    const hw = this.size.w / 2;
    const p = this.position;
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    // Approximate AABB based on rotation
    const dx = Math.abs(cos) * hw + Math.abs(sin) * 0.2;
    const dz = Math.abs(sin) * hw + Math.abs(cos) * 0.2;
    return {
      min: new THREE.Vector3(p.x - dx, p.y, p.z - dz),
      max: new THREE.Vector3(p.x + dx, p.y + this.size.h, p.z + dz),
    };
  }

  /** Take damage from zombies. Removes boards when health depleted. */
  takeDamage(amount) {
    if (this.isBroken) return;

    this.health -= amount;

    // Damage top board first (last in array with alive=true)
    for (let i = this.boards.length - 1; i >= 0; i--) {
      const board = this.boards[i];
      if (!board || !board.alive) continue;

      board.health -= amount;

      // Visual damage — darken color
      const damageRatio = board.health / BOARD_HEALTH;
      const r = Math.floor(0x7a * damageRatio + 0x3a * (1 - damageRatio));
      const g = Math.floor(0x5a * damageRatio + 0x20 * (1 - damageRatio));
      const b = Math.floor(0x30 * damageRatio + 0x10 * (1 - damageRatio));
      board.mesh.material.color.setRGB(r / 255, g / 255, b / 255);

      // Shake effect
      board.mesh.rotation.z = (Math.random() - 0.5) * 0.1;

      if (board.health <= 0) {
        // Board breaks
        board.alive = false;
        this.group.remove(board.mesh);
        board.mesh.geometry.dispose();
        board.mesh.material.dispose();
      }
      break;
    }

    if (this.health < 0) this.health = 0;
  }

  /** Repair one board. Returns true if a board was repaired. */
  repairOne() {
    for (let i = 0; i < this.boards.length; i++) {
      const board = this.boards[i];
      if (!board || !board.alive) {
        this._addBoard(i);
        this.health += BOARD_HEALTH;
        return true;
      }
    }
    return false;
  }

  dispose() {
    this.scene.remove(this.group);
  }
}

/**
 * Manages all barricades in the level.
 */
export class BarricadeManager {
  constructor(scene) {
    this.scene = scene;
    this.barricades = [];
    this._repairTimer = 0;
    this._repairing = false;
  }

  /**
   * Add a barricade at position with rotation.
   * @param {THREE.Vector3} position
   * @param {number} rotationY — radians
   * @param {{ w: number, h: number }} size
   */
  addBarricade(position, rotationY, size = { w: 2.5, h: 2.5 }) {
    const b = new Barricade(this.scene, position, rotationY, size);
    this.barricades.push(b);
    return b;
  }

  /**
   * Get barricade obstacles for collision.
   * @returns {Array} AABB obstacles for intact barricades
   */
  getObstacles() {
    const result = [];
    for (const b of this.barricades) {
      const obs = b.getObstacle();
      if (obs) result.push(obs);
    }
    return result;
  }

  /**
   * Get nearest repairable barricade to player.
   */
  getNearbyRepairable(playerPos, maxDist = 3) {
    let nearest = null;
    let nearestDist = maxDist;
    for (const b of this.barricades) {
      if (!b.canRepair) continue;
      const dist = playerPos.distanceTo(b.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = b;
      }
    }
    return nearest;
  }

  /**
   * Apply zombie damage to nearest barricade.
   * Called by zombies when they're near a barricade.
   */
  damageNearest(zombiePos, amount) {
    let nearest = null;
    let nearestDist = 3;
    for (const b of this.barricades) {
      if (b.isBroken) continue;
      const dist = zombiePos.distanceTo(b.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = b;
      }
    }
    if (nearest) {
      nearest.takeDamage(amount);
      return true;
    }
    return false;
  }

  /**
   * Check if a zombie is blocked by a barricade.
   */
  isBlocked(zombiePos) {
    for (const b of this.barricades) {
      if (b.isBroken) continue;
      const dist = zombiePos.distanceTo(b.position);
      if (dist < 2) return true;
    }
    return false;
  }

  clear() {
    for (const b of this.barricades) {
      b.dispose();
    }
    this.barricades = [];
  }
}
