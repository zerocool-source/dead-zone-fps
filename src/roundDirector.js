import * as THREE from "three";
import { ZOMBIE_TYPES, pickZombieType } from "./zombieTypes.js";
import { ZOMBIE_BASE_HEALTH, ZOMBIE_BASE_SPEED } from "./constants.js";

/**
 * Round Director — controls wave progression, zombie scaling,
 * spawn pacing, boss rounds, and between-round flow.
 * Supports 25 rounds with aggressive difficulty scaling.
 */

const MAX_ROUNDS = 25;

/** Round configuration generator — exponential difficulty curve */
function getRoundConfig(round) {
  const isBossRound = round % 5 === 0 && round > 0;

  // Zombie count: ramps hard — round 1: 7, round 5: 24, round 10: 54, round 15: 99, round 20: 160, round 25: 237
  const totalZombiesToSpawn = Math.floor(
    4 + round * 3 + round * round * 0.3 + (round > 10 ? (round - 10) * 4 : 0),
  );

  // Max alive at once: ramps from 10 to 40
  const maxAliveAtOnce = Math.min(10 + round * 2, 40);

  // Spawn interval: gets faster — starts 0.6s, down to 0.08s
  const spawnInterval = Math.max(0.08, 0.6 - round * 0.025);

  // Health: exponential scaling — round 1: 1x, round 10: 3.5x, round 20: 7x, round 25: 10x
  const healthMultiplier =
    1 + (round - 1) * 0.25 + (round > 10 ? (round - 10) * 0.15 : 0);

  // Speed: gradual increase — round 1: 1x, round 10: 1.5x, round 20: 2.1x, round 25: 2.5x
  const speedMultiplier =
    1 + (round - 1) * 0.06 + (round > 12 ? (round - 12) * 0.03 : 0);

  return {
    roundNumber: round,
    totalZombiesToSpawn,
    maxAliveAtOnce,
    spawnInterval,
    healthMultiplier,
    speedMultiplier,
    rewardBonus: round * 50 + (round > 10 ? round * 25 : 0),
    isBossRound,
    bossCount: isBossRound ? Math.min(Math.floor(round / 5), 3) : 0, // more bosses at higher rounds
    bossHealth: isBossRound ? ZOMBIE_BASE_HEALTH * round * 2.5 : 0,
  };
}

export class RoundDirector {
  constructor(enemyManager, hud) {
    this.enemyManager = enemyManager;
    this.hud = hud;
    this.round = 0;
    this.state = "waiting"; // waiting | spawning | active | boss | transition
    this.delayTimer = 3;
    this.spawnTimer = 0;
    this.spawnedThisRound = 0;
    this.bossesSpawnedThisRound = 0;
    this.totalKills = 0;
    this.config = null;
    this._spawnPoints = null;

    // Events
    this.activeEvent = null;
    this.eventTimer = 0;

    // Double points tracking
    this.doublePoints = false;

    // Countdown timer UI
    this._countdownEl = null;
    this._lastCountdownInt = -1;
    this._createCountdownUI();

    // Callbacks
    this.onRoundStart = null;
    this.onRoundComplete = null;
    this.onBossSpawn = null;
  }

  _createCountdownUI() {
    this._countdownEl = document.createElement("div");
    Object.assign(this._countdownEl.style, {
      position: "fixed",
      top: "22%",
      left: "50%",
      transform: "translateX(-50%)",
      fontFamily: "'Courier New', monospace",
      fontSize: "72px",
      fontWeight: "bold",
      color: "#ff2222",
      textShadow:
        "0 0 30px rgba(255,0,0,0.8), 0 0 60px rgba(255,0,0,0.4), 0 4px 8px rgba(0,0,0,0.6)",
      pointerEvents: "none",
      zIndex: "52",
      opacity: "0",
      transition: "opacity 0.3s, transform 0.15s",
      letterSpacing: "6px",
    });
    document.body.appendChild(this._countdownEl);
  }

  _updateCountdown() {
    if (this.state !== "waiting" || this.delayTimer > 10) {
      this._countdownEl.style.opacity = "0";
      this._lastCountdownInt = -1;
      return;
    }

    const remaining = Math.ceil(this.delayTimer);
    if (remaining <= 10 && remaining > 0) {
      this._countdownEl.style.opacity = "1";
      this._countdownEl.textContent = String(remaining);

      // Pulse effect on each new second
      if (remaining !== this._lastCountdownInt) {
        this._lastCountdownInt = remaining;
        // Scale pop on change
        this._countdownEl.style.transform = "translateX(-50%) scale(1.3)";
        setTimeout(() => {
          if (this._countdownEl) {
            this._countdownEl.style.transform = "translateX(-50%) scale(1)";
          }
        }, 100);

        // Color shifts: green->yellow->red
        if (remaining > 6) {
          this._countdownEl.style.color = "#44dd44";
          this._countdownEl.style.textShadow =
            "0 0 30px rgba(0,255,0,0.6), 0 0 60px rgba(0,255,0,0.3)";
        } else if (remaining > 3) {
          this._countdownEl.style.color = "#ffcc00";
          this._countdownEl.style.textShadow =
            "0 0 30px rgba(255,200,0,0.7), 0 0 60px rgba(255,100,0,0.4)";
        } else {
          this._countdownEl.style.color = "#ff2222";
          this._countdownEl.style.textShadow =
            "0 0 30px rgba(255,0,0,0.8), 0 0 60px rgba(255,0,0,0.5)";
        }
      }
    } else {
      this._countdownEl.style.opacity = "0";
    }
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
    // Fallback — spawn from edges
    const angle = Math.random() * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * 25, 0, Math.sin(angle) * 25);
  }

  _spawnZombie() {
    const typeKey = pickZombieType(this.round);
    const typeCfg = ZOMBIE_TYPES[typeKey];
    const rc = this.config;

    const health = Math.floor(
      ZOMBIE_BASE_HEALTH * typeCfg.healthMult * rc.healthMultiplier,
    );
    const speed = ZOMBIE_BASE_SPEED * typeCfg.speedMult * rc.speedMultiplier;

    // Speed surge event
    const eventSpeed = this.activeEvent === "speed_surge" ? 1.4 : 1;

    const pos = this._getSpawnPosition();
    this.enemyManager.spawn(pos, health, speed * eventSpeed, typeKey);
    this.spawnedThisRound++;
  }

  _spawnBoss() {
    const rc = this.config;
    const pos = this._getSpawnPosition();
    this.enemyManager.spawn(
      pos,
      rc.bossHealth,
      ZOMBIE_BASE_SPEED * 0.5,
      "warden",
    );
    this.bossesSpawnedThisRound++;
  }

  onZombieKilled() {
    this.totalKills++;
    return this.doublePoints ? 2 : 1; // points multiplier
  }

  /** Trigger a random event for this round */
  _tryTriggerEvent() {
    if (Math.random() > 0.35) return;
    const events = ["double_points", "speed_surge", "lights_out"];
    this.activeEvent = events[Math.floor(Math.random() * events.length)];
    this.eventTimer = 20;

    if (this.activeEvent === "double_points") {
      this.doublePoints = true;
      this.hud.announce("DOUBLE POINTS!");
    } else if (this.activeEvent === "speed_surge") {
      this.hud.announce("SPEED SURGE!");
    } else if (this.activeEvent === "lights_out") {
      this.hud.announce("LIGHTS OUT!");
    }
  }

  update(dt) {
    // Event timer
    if (this.activeEvent) {
      this.eventTimer -= dt;
      if (this.eventTimer <= 0) {
        if (this.activeEvent === "double_points") this.doublePoints = false;
        this.activeEvent = null;
      }
    }

    // Countdown display
    this._updateCountdown();

    switch (this.state) {
      case "waiting":
        this.delayTimer -= dt;
        if (this.delayTimer <= 0) {
          this.round++;
          this.config = getRoundConfig(this.round);
          this.spawnedThisRound = 0;
          this.bossesSpawnedThisRound = 0;
          this.state = "spawning";
          this.spawnTimer = 0;
          this._tryTriggerEvent();
          if (this.onRoundStart) this.onRoundStart(this.round, this.config);
        }
        break;

      case "spawning": {
        this.spawnTimer -= dt;
        const canSpawn =
          this.enemyManager.aliveCount < this.config.maxAliveAtOnce;
        if (
          this.spawnTimer <= 0 &&
          canSpawn &&
          this.spawnedThisRound < this.config.totalZombiesToSpawn
        ) {
          this._spawnZombie();
          this.spawnTimer = this.config.spawnInterval;
        }

        // Spawn bosses on boss rounds
        if (
          this.config.isBossRound &&
          this.bossesSpawnedThisRound < this.config.bossCount
        ) {
          if (
            this.spawnedThisRound >=
            Math.floor(this.config.totalZombiesToSpawn * 0.3)
          ) {
            this._spawnBoss();
            if (this.onBossSpawn) this.onBossSpawn(this.round);
          }
        }

        if (this.spawnedThisRound >= this.config.totalZombiesToSpawn) {
          this.state = "active";
        }
        break;
      }

      case "active":
        // All spawned — wait for all zombies to be killed (dying ones don't count)
        if (this.enemyManager.aliveCount <= 0) {
          this._completeRound();
        }
        break;
    }
  }

  _completeRound() {
    if (this.onRoundComplete) this.onRoundComplete(this.round, this.config);

    if (this.round >= MAX_ROUNDS) {
      // Victory! Player survived all 25 rounds
      this.hud.announce("YOU SURVIVED ALL 25 ROUNDS!");
      this.state = "victory";
      return;
    }

    this.delayTimer = 10; // 10 seconds between rounds
    this.state = "waiting";
    this.activeEvent = null;
    this.doublePoints = false;
  }

  get wave() {
    return this.round;
  }
  get waveKills() {
    return this.totalKills;
  }
}
