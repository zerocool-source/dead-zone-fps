import * as THREE from "three";
import {
  WAVE_BASE_COUNT,
  WAVE_COUNT_INCREASE,
  WAVE_SPEED_INCREASE,
  WAVE_HEALTH_INCREASE,
  WAVE_DELAY,
  ZOMBIE_BASE_HEALTH,
  ZOMBIE_BASE_SPEED,
  ZOMBIE_SPAWN_DISTANCE,
  ROOM_WIDTH,
  ROOM_DEPTH,
  WAVE_BONUS,
  ZOMBIE_TYPE_NORMAL,
  ZOMBIE_TYPE_RUNNER,
  ZOMBIE_TYPE_TANK,
  ZOMBIE_RUNNER_HEALTH_MULT,
  ZOMBIE_RUNNER_SPEED_MULT,
  ZOMBIE_TANK_HEALTH_MULT,
  ZOMBIE_TANK_SPEED_MULT,
  SECOND_FLOOR_HEIGHT,
} from "./constants.js";

/**
 * Controls wave progression, zombie spawning, difficulty scaling,
 * and zombie archetype distribution.
 */
export class WaveManager {
  constructor(enemyManager) {
    this.enemyManager = enemyManager;
    this.wave = 0;
    this.state = "waiting";
    this.delayTimer = 2;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.spawnInterval = 0.5;
    this.totalKills = 0;
    this.waveKills = 0;
    this.onWaveStart = null;
    this.onWaveComplete = null;
  }

  get zombieCount() {
    return WAVE_BASE_COUNT + this.wave * WAVE_COUNT_INCREASE;
  }

  get zombieHealth() {
    return ZOMBIE_BASE_HEALTH + (this.wave - 1) * WAVE_HEALTH_INCREASE;
  }

  get zombieSpeed() {
    return Math.min(
      ZOMBIE_BASE_SPEED + (this.wave - 1) * WAVE_SPEED_INCREASE,
      ZOMBIE_BASE_SPEED * 2.5,
    );
  }

  /**
   * Determine zombie type distribution based on wave.
   */
  _getZombieType() {
    if (this.wave >= 5) {
      const roll = Math.random();
      if (roll < 0.25) return ZOMBIE_TYPE_TANK;
      if (roll < 0.5) return ZOMBIE_TYPE_RUNNER;
      return ZOMBIE_TYPE_NORMAL;
    }
    if (this.wave >= 3) {
      const roll = Math.random();
      if (roll < 0.3) return ZOMBIE_TYPE_RUNNER;
      return ZOMBIE_TYPE_NORMAL;
    }
    return ZOMBIE_TYPE_NORMAL;
  }

  /**
   * Get health and speed adjusted for zombie type.
   */
  _getStatsForType(type) {
    const baseHealth = this.zombieHealth;
    const baseSpeed = this.zombieSpeed;

    switch (type) {
      case ZOMBIE_TYPE_RUNNER:
        return {
          health: Math.floor(baseHealth * ZOMBIE_RUNNER_HEALTH_MULT),
          speed: baseSpeed * ZOMBIE_RUNNER_SPEED_MULT,
        };
      case ZOMBIE_TYPE_TANK:
        return {
          health: Math.floor(baseHealth * ZOMBIE_TANK_HEALTH_MULT),
          speed: baseSpeed * ZOMBIE_TANK_SPEED_MULT,
        };
      default:
        return { health: baseHealth, speed: baseSpeed };
    }
  }

  /** Set designated spawn points from level */
  setSpawnPoints(points) {
    this._spawnPoints = points;
  }

  _getSpawnPosition() {
    // Use designated spawn points if available
    if (this._spawnPoints) {
      const all = [...(this._spawnPoints.downstairs || [])];
      // Add upstairs spawns starting wave 3
      if (this.wave >= 3 && this._spawnPoints.upstairs) {
        all.push(...this._spawnPoints.upstairs);
      }
      if (all.length > 0) {
        const pt = all[Math.floor(Math.random() * all.length)];
        return pt
          .clone()
          .add(
            new THREE.Vector3(
              (Math.random() - 0.5) * 2,
              0,
              (Math.random() - 0.5) * 2,
            ),
          );
      }
    }

    // Fallback: spawn along room edges
    const hw = ROOM_WIDTH / 2 - 2;
    const hd = ROOM_DEPTH / 2 - 2;
    const side = Math.floor(Math.random() * 4);
    let x, z;
    switch (side) {
      case 0:
        x = -hw;
        z = (Math.random() - 0.5) * ROOM_DEPTH * 0.8;
        break;
      case 1:
        x = hw;
        z = (Math.random() - 0.5) * ROOM_DEPTH * 0.8;
        break;
      case 2:
        x = (Math.random() - 0.5) * ROOM_WIDTH * 0.8;
        z = -hd;
        break;
      case 3:
        x = (Math.random() - 0.5) * ROOM_WIDTH * 0.8;
        z = hd;
        break;
    }
    return new THREE.Vector3(x, 0, z);
  }

  onZombieKilled() {
    this.totalKills += 1;
    this.waveKills += 1;
  }

  _buildSpawnQueue() {
    const count = this.zombieCount;
    const queue = [];
    for (let i = 0; i < count; i++) {
      const type = this._getZombieType();
      queue.push(type);
    }
    return queue;
  }

  update(dt) {
    switch (this.state) {
      case "waiting":
        this.delayTimer -= dt;
        if (this.delayTimer <= 0) {
          this.wave += 1;
          this.waveKills = 0;
          this.spawnQueue = this._buildSpawnQueue();
          this.state = "spawning";
          this.spawnTimer = 0;
          if (this.onWaveStart) this.onWaveStart(this.wave);
        }
        break;

      case "spawning":
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.spawnQueue.length > 0) {
          const type = this.spawnQueue.shift();
          const { health, speed } = this._getStatsForType(type);
          const pos = this._getSpawnPosition();
          this.enemyManager.spawn(pos, health, speed, type);
          this.spawnTimer = Math.max(
            0.15,
            this.spawnInterval - this.wave * 0.02,
          );
        }
        if (this.spawnQueue.length <= 0) {
          this.state = "active";
        }
        break;

      case "active":
        if (
          this.enemyManager.aliveCount <= 0 &&
          this.enemyManager.totalCount <= 0
        ) {
          if (this.onWaveComplete) this.onWaveComplete(this.wave);
          this.delayTimer = WAVE_DELAY;
          this.state = "waiting";
        }
        break;
    }
  }
}
