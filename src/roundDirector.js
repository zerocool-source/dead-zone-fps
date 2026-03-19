import * as THREE from 'three';
import { ZOMBIE_TYPES, pickZombieType } from './zombieTypes.js';
import { ZOMBIE_BASE_HEALTH, ZOMBIE_BASE_SPEED } from './constants.js';

/**
 * Round Director — controls wave progression, zombie scaling,
 * spawn pacing, boss rounds, and between-round flow.
 */

/** Round configuration generator */
function getRoundConfig(round) {
  const isBossRound = round % 5 === 0 && round > 0;

  return {
    roundNumber: round,
    totalZombiesToSpawn: 4 + round * 3 + Math.floor(round * round * 0.2),
    maxAliveAtOnce: Math.min(8 + round * 2, 30),
    spawnInterval: Math.max(0.15, 0.6 - round * 0.025),
    healthMultiplier: 1 + (round - 1) * 0.2,
    speedMultiplier: 1 + (round - 1) * 0.06,
    rewardBonus: round * 50,
    isBossRound,
    bossHealth: isBossRound ? ZOMBIE_BASE_HEALTH * round * 2 : 0,
  };
}

export class RoundDirector {
  constructor(enemyManager, hud) {
    this.enemyManager = enemyManager;
    this.hud = hud;
    this.round = 0;
    this.state = 'waiting'; // waiting | spawning | active | boss | transition
    this.delayTimer = 3;
    this.spawnTimer = 0;
    this.spawnedThisRound = 0;
    this.totalKills = 0;
    this.config = null;
    this._spawnPoints = null;

    // Events
    this.activeEvent = null;
    this.eventTimer = 0;

    // Double points tracking
    this.doublePoints = false;

    // Callbacks
    this.onRoundStart = null;
    this.onRoundComplete = null;
    this.onBossSpawn = null;
  }

  setSpawnPoints(points) {
    this._spawnPoints = points;
  }

  _getSpawnPosition() {
    if (this._spawnPoints) {
      const all = [...(this._spawnPoints.downstairs || [])];
      if (this.round >= 3 && this._spawnPoints.upstairs) {
        all.push(...this._spawnPoints.upstairs);
      }
      if (all.length > 0) {
        const pt = all[Math.floor(Math.random() * all.length)];
        return pt.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2
        ));
      }
    }
    // Fallback
    const angle = Math.random() * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * 25, 0, Math.sin(angle) * 25);
  }

  _spawnZombie() {
    const typeKey = pickZombieType(this.round);
    const typeCfg = ZOMBIE_TYPES[typeKey];
    const rc = this.config;

    const health = Math.floor(ZOMBIE_BASE_HEALTH * typeCfg.healthMult * rc.healthMultiplier);
    const speed = ZOMBIE_BASE_SPEED * typeCfg.speedMult * rc.speedMultiplier;

    // Speed surge event
    const eventSpeed = this.activeEvent === 'speed_surge' ? 1.4 : 1;

    const pos = this._getSpawnPosition();
    this.enemyManager.spawn(pos, health, speed * eventSpeed, typeKey);
    this.spawnedThisRound++;
  }

  onZombieKilled() {
    this.totalKills++;
    return this.doublePoints ? 2 : 1; // points multiplier
  }

  /** Trigger a random event for this round */
  _tryTriggerEvent() {
    if (Math.random() > 0.35) return; // 35% chance per round
    const events = ['double_points', 'speed_surge', 'lights_out'];
    this.activeEvent = events[Math.floor(Math.random() * events.length)];
    this.eventTimer = 20; // seconds

    if (this.activeEvent === 'double_points') {
      this.doublePoints = true;
      this.hud.announce('DOUBLE POINTS!');
    } else if (this.activeEvent === 'speed_surge') {
      this.hud.announce('SPEED SURGE!');
    } else if (this.activeEvent === 'lights_out') {
      this.hud.announce('LIGHTS OUT!');
    }
  }

  update(dt) {
    // Event timer
    if (this.activeEvent) {
      this.eventTimer -= dt;
      if (this.eventTimer <= 0) {
        if (this.activeEvent === 'double_points') this.doublePoints = false;
        this.activeEvent = null;
      }
    }

    switch (this.state) {
      case 'waiting':
        this.delayTimer -= dt;
        if (this.delayTimer <= 0) {
          this.round++;
          this.config = getRoundConfig(this.round);
          this.spawnedThisRound = 0;
          this.state = 'spawning';
          this.spawnTimer = 0;
          this._tryTriggerEvent();
          if (this.onRoundStart) this.onRoundStart(this.round, this.config);
        }
        break;

      case 'spawning': {
        this.spawnTimer -= dt;
        const canSpawn = this.enemyManager.aliveCount < this.config.maxAliveAtOnce;
        if (this.spawnTimer <= 0 && canSpawn && this.spawnedThisRound < this.config.totalZombiesToSpawn) {
          this._spawnZombie();
          this.spawnTimer = this.config.spawnInterval;
        }
        if (this.spawnedThisRound >= this.config.totalZombiesToSpawn) {
          this.state = this.config.isBossRound ? 'boss' : 'active';
          if (this.config.isBossRound && this.onBossSpawn) {
            this.onBossSpawn(this.round);
          }
        }
        break;
      }

      case 'boss':
      case 'active':
        // Also keep spawning in boss if there's room
        if (this.state === 'boss' && this.enemyManager.aliveCount < 5) {
          this.spawnTimer -= dt;
          if (this.spawnTimer <= 0) {
            this._spawnZombie();
            this.spawnedThisRound++;
            this.spawnTimer = 2.0;
          }
        }

        if (this.enemyManager.aliveCount <= 0 && this.enemyManager.totalCount <= 0) {
          if (this.onRoundComplete) this.onRoundComplete(this.round, this.config);
          this.delayTimer = 5; // between-round rest
          this.state = 'waiting';
          this.activeEvent = null;
          this.doublePoints = false;
        }
        break;
    }
  }

  get wave() { return this.round; }
  get waveKills() { return this.totalKills; }
}
