import { PLAYER_MAX_HEALTH } from "./constants.js";

/**
 * HUD manager — updates all on-screen UI elements.
 * Enhanced with weapon name, kill counter, score popups, and announcements.
 */
export class HUD {
  constructor() {
    this.healthFill = document.getElementById("health-fill");
    this.healthValue = document.getElementById("health-value");
    this.ammoCurrent = document.getElementById("ammo-current");
    this.ammoReserve = document.getElementById("ammo-reserve");
    this.waveNumber = document.getElementById("wave-number");
    this.zombiesRemaining = document.getElementById("zombies-remaining");
    this.scoreDisplay = document.getElementById("score-display");
    this.waveAnnounce = document.getElementById("wave-announce");
    this.reloadHint = document.getElementById("reload-hint");
    this.hudElement = document.getElementById("hud");
    this.weaponName = document.getElementById("weapon-name");
    this.killCounter = document.getElementById("kill-counter");
    this.scorePopup = document.getElementById("score-popup");

    this.announceTimer = 0;
    this.score = 0;
    this.kills = 0;
    this.weaponNameTimer = 0;
    this.scorePopupTimer = 0;
  }

  show() {
    this.hudElement.style.display = "block";
  }

  hide() {
    this.hudElement.style.display = "none";
  }

  addScore(points) {
    this.score += points;

    // Show score popup for positive gains
    if (points > 0 && this.scorePopup) {
      this.scorePopup.textContent = `+${points}`;
      this.scorePopup.style.opacity = "1";
      this.scorePopupTimer = 1.0;
    }
  }

  addKill() {
    this.kills += 1;
  }

  announceWave(waveNum) {
    this.waveAnnounce.textContent = `WAVE ${waveNum}`;
    this.waveAnnounce.style.opacity = "1";
    this.announceTimer = 2.5;
  }

  /** Generic announcement (door opened, etc.) */
  announce(text) {
    this.waveAnnounce.textContent = text;
    this.waveAnnounce.style.opacity = "1";
    this.announceTimer = 2.0;
  }

  update(dt, player, weapon, waveManager, enemyManager) {
    // Health
    const healthPct = (player.health / PLAYER_MAX_HEALTH) * 100;
    this.healthFill.style.width = `${healthPct}%`;
    this.healthValue.textContent = Math.ceil(player.health);

    if (healthPct <= 25) {
      this.healthFill.style.background = "#ff0000";
    } else if (healthPct <= 50) {
      this.healthFill.style.background = "#ff6600";
    } else {
      this.healthFill.style.background = "#cc3333";
    }

    // Ammo
    this.ammoCurrent.textContent = weapon.ammo;
    this.ammoReserve.textContent = `/ ${weapon.reserve}`;

    if (weapon.ammo <= 5 && weapon.ammo > 0) {
      this.ammoCurrent.style.color = "#ff6600";
    } else if (weapon.ammo === 0) {
      this.ammoCurrent.style.color = "#ff0000";
    } else {
      this.ammoCurrent.style.color = "#ffffff";
    }

    // Reload hint
    if (weapon.ammo === 0 && weapon.reserve > 0 && !weapon.reloading) {
      this.reloadHint.style.opacity = "1";
    } else {
      this.reloadHint.style.opacity = "0";
    }

    // Wave info
    this.waveNumber.textContent = `WAVE ${waveManager.wave || 1}`;
    this.zombiesRemaining.textContent = `Zombies: ${enemyManager.aliveCount}`;

    // Score
    this.scoreDisplay.textContent = `SCORE: ${this.score}`;

    // Kill counter
    if (this.killCounter) {
      this.killCounter.textContent = `KILLS: ${this.kills}`;
    }

    // Wave announce fade
    if (this.announceTimer > 0) {
      this.announceTimer -= dt;
      if (this.announceTimer <= 0.5) {
        this.waveAnnounce.style.opacity = String(
          Math.max(0, this.announceTimer / 0.5)
        );
      }
      if (this.announceTimer <= 0) {
        this.waveAnnounce.style.opacity = "0";
      }
    }

    // Score popup fade
    if (this.scorePopupTimer > 0) {
      this.scorePopupTimer -= dt;
      if (this.scorePopupTimer <= 0.3 && this.scorePopup) {
        this.scorePopup.style.opacity = String(
          Math.max(0, this.scorePopupTimer / 0.3)
        );
      }
      if (this.scorePopupTimer <= 0 && this.scorePopup) {
        this.scorePopup.style.opacity = "0";
      }
    }
  }

  showWeaponName(name) {
    if (this.weaponName) {
      this.weaponName.textContent = name.toUpperCase();
      this.weaponName.style.opacity = "1";
      this.weaponNameTimer = 2.0;
    }
    this.announce(name.toUpperCase());
  }

  showGameOver(wave, score, kills) {
    document.getElementById("final-wave").textContent = `Wave: ${wave}`;
    document.getElementById("final-score").textContent = `Score: ${score}`;
    document.getElementById("final-kills").textContent = `Kills: ${kills}`;
    document.getElementById("game-over").style.display = "flex";
  }
}
