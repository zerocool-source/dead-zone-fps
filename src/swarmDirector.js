import * as THREE from "three";
import { ZOMBIE_TYPES, pickZombieType } from "./zombieTypes.js";
import { ZOMBIE_BASE_HEALTH, ZOMBIE_BASE_SPEED } from "./constants.js";

/**
 * Swarm Director — a brutal mode where 30 zombies rush you all at once.
 * Each wave dumps 30 zombies simultaneously.
 * Waves get harder with more health/speed.
 * Between waves: repair barricades, buy weapons.
 */

const SWARM_SIZE = 30;
const MAX_WAVES = 15;

function getSwarmConfig(wave) {
  const healthMult = 1 + (wave - 1) * 0.4;
  const speedMult = 1 + (wave - 1) * 0.08;
  const isBossWave = wave % 3 === 0;

  return {
    waveNumber: wave,
    swarmSize: SWARM_SIZE + Math.floor(wave * 2),
    healthMultiplier: healthMult,
    speedMultiplier: speedMult,
    rewardBonus: wave * 100,
    isBossWave,
    bossCount: isBossWave ? Math.min(Math.ceil(wave / 3), 4) : 0,
    bossHealth: isBossWave ? ZOMBIE_BASE_HEALTH * wave * 3 : 0,
  };
}

export class SwarmDirector {
  constructor(enemyManager, hud) {
    this.enemyManager = enemyManager;
    this.hud = hud;
    this.wave = 0;
    this.state = "waiting"; // waiting | swarm | active | transition
    this.delayTimer = 5;
    this.config = null;
    this._spawnPoints = null;
    this.totalKills = 0;
    this.doublePoints = false;
    this.activeEvent = null;
    this.eventTimer = 0;

    // Countdown UI
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
        "0 0 30px rgba(255,0,0,0.8), 0 0 60px rgba(255,0,0,0.4)",
      pointerEvents: "none",
      zIndex: "52",
      opacity: "0",
      transition: "opacity 0.3s, transform 0.15s",
      letterSpacing: "6px",
    });
    document.body.appendChild(this._countdownEl);
    this._lastCountdownInt = -1;

    // Swarm warning
    this._swarmWarning = document.createElement("div");
    Object.assign(this._swarmWarning.style, {
      position: "fixed",
      top: "15%",
      left: "50%",
      transform: "translateX(-50%)",
      fontFamily: "'Courier New', monospace",
      fontSize: "36px",
      fontWeight: "bold",
      color: "#ff4444",
      textShadow: "0 0 20px rgba(255,0,0,0.6)",
      pointerEvents: "none",
      zIndex: "52",
      opacity: "0",
      transition: "opacity 0.5s",
      letterSpacing: "4px",
    });
    document.body.appendChild(this._swarmWarning);

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
      const all = [
        ...(this._spawnPoints.downstairs || []),
        ...(this._spawnPoints.upstairs || []),
      ];
      if (all.length > 0) {
        const pt = all[Math.floor(Math.random() * all.length)];
        return pt.clone().add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 4,
            0,
            (Math.random() - 0.5) * 4,
          ),
        );
      }
    }
    const angle = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 15;
    return new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
  }

  /** Spawn ALL zombies at once — the swarm */
  _spawnSwarm() {
    const rc = this.config;

    for (let i = 0; i < rc.swarmSize; i++) {
      const typeKey = pickZombieType(this.wave);
      const typeCfg = ZOMBIE_TYPES[typeKey];
      const health = Math.floor(
        ZOMBIE_BASE_HEALTH * typeCfg.healthMult * rc.healthMultiplier,
      );
      const speed = ZOMBIE_BASE_SPEED * typeCfg.speedMult * rc.speedMultiplier;
      const pos = this._getSpawnPosition();
      this.enemyManager.spawn(pos, health, speed, typeKey);
    }

    // Spawn bosses
    if (rc.isBossWave) {
      for (let b = 0; b < rc.bossCount; b++) {
        const pos = this._getSpawnPosition();
        this.enemyManager.spawn(
          pos,
          rc.bossHealth,
          ZOMBIE_BASE_SPEED * 0.5,
          "warden",
        );
      }
    }
  }

  onZombieKilled() {
    this.totalKills++;
    return this.doublePoints ? 2 : 1;
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

      if (remaining !== this._lastCountdownInt) {
        this._lastCountdownInt = remaining;
        this._countdownEl.style.transform = "translateX(-50%) scale(1.3)";
        setTimeout(() => {
          this._countdownEl.style.transform = "translateX(-50%) scale(1)";
        }, 100);

        if (remaining > 6) {
          this._countdownEl.style.color = "#44dd44";
        } else if (remaining > 3) {
          this._countdownEl.style.color = "#ffcc00";
        } else {
          this._countdownEl.style.color = "#ff2222";
        }
      }

      // Show swarm warning in last 3 seconds
      if (remaining <= 3) {
        this._swarmWarning.style.opacity = "1";
        this._swarmWarning.textContent = "⚠ SWARM INCOMING ⚠";
      }
    } else {
      this._countdownEl.style.opacity = "0";
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

    this._updateCountdown();

    switch (this.state) {
      case "waiting":
        this.delayTimer -= dt;
        if (this.delayTimer <= 0) {
          this.wave++;
          this.config = getSwarmConfig(this.wave);
          this.state = "swarm";
          this._swarmWarning.style.opacity = "0";
          if (this.onRoundStart) this.onRoundStart(this.wave, this.config);
        }
        break;

      case "swarm":
        // Dump all zombies at once!
        this._spawnSwarm();
        this.hud.announce(
          `SWARM WAVE ${this.wave} — ${this.config.swarmSize} ZOMBIES!`,
        );
        this.state = "active";
        break;

      case "active":
        if (this.enemyManager.aliveCount <= 0) {
          this._completeWave();
        }
        break;
    }
  }

  _completeWave() {
    if (this.onRoundComplete) this.onRoundComplete(this.wave, this.config);

    if (this.wave >= MAX_WAVES) {
      this.hud.announce("SWARM MODE COMPLETE — YOU SURVIVED!");
      this.state = "victory";
      return;
    }

    // 50% chance of double points event
    if (Math.random() < 0.5) {
      this.activeEvent = "double_points";
      this.doublePoints = true;
      this.eventTimer = 15;
      this.hud.announce("DOUBLE POINTS!");
    }

    this.delayTimer = 12; // 12 seconds to prep between swarms
    this.state = "waiting";
  }

  get round() {
    return this.wave;
  }
  get waveKills() {
    return this.totalKills;
  }
}
