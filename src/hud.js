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

    // Kill streak system
    this._streakCount = 0;
    this._streakTimer = 0; // resets if no kill within 3 seconds
    this._streakThresholds = [5, 10, 15, 25, 50];
    this._streakNames = [
      "KILLING SPREE",
      "RAMPAGE",
      "UNSTOPPABLE",
      "GODLIKE",
      "LEGENDARY",
    ];
    this._streakBonuses = [200, 500, 1000, 2500, 5000];

    // Create kill streak overlay
    this._streakEl = document.createElement("div");
    Object.assign(this._streakEl.style, {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      height: "0",
      background: "linear-gradient(to bottom, rgba(0,200,50,0.6), transparent)",
      pointerEvents: "none",
      zIndex: "48",
      transition: "height 0.3s, opacity 0.5s",
      opacity: "0",
    });
    document.body.appendChild(this._streakEl);

    // Kill streak image — try loading PNG, fallback to text
    this._streakText = document.createElement("div");
    Object.assign(this._streakText.style, {
      position: "fixed",
      top: "15%",
      left: "50%",
      transform: "translateX(-50%)",
      pointerEvents: "none",
      zIndex: "49",
      opacity: "0",
      transition: "opacity 0.3s",
      textAlign: "center",
    });

    // Try to load kill streak PNG
    const streakImg = document.createElement("img");
    streakImg.src = "/textures/killstreak.png";
    streakImg.style.width = "400px";
    streakImg.style.height = "auto";
    streakImg.style.display = "none";
    streakImg.onload = () => {
      this._hasStreakImg = true;
      streakImg.style.display = "block";
    };
    this._streakImg = streakImg;
    this._hasStreakImg = false;

    // Fallback text
    this._streakLabel = document.createElement("div");
    Object.assign(this._streakLabel.style, {
      color: "#ff4422",
      fontSize: "42px",
      fontWeight: "bold",
      fontFamily: "'Courier New', monospace",
      textShadow: "0 0 20px rgba(255,50,0,0.8), 0 0 40px rgba(255,100,0,0.4)",
      letterSpacing: "4px",
    });

    this._streakText.appendChild(streakImg);
    this._streakText.appendChild(this._streakLabel);
    document.body.appendChild(this._streakText);

    // Streak counter display
    this._streakCounter = document.createElement("div");
    Object.assign(this._streakCounter.style, {
      position: "fixed",
      top: "26%",
      left: "50%",
      transform: "translateX(-50%)",
      color: "#88ffaa",
      fontSize: "18px",
      fontFamily: "'Courier New', monospace",
      textAlign: "center",
      textShadow: "0 0 10px rgba(0,255,50,0.5)",
      pointerEvents: "none",
      zIndex: "49",
      opacity: "0",
      transition: "opacity 0.3s",
    });
    document.body.appendChild(this._streakCounter);

    // Kill streak VIDEO overlay — plays on 10+ kills
    this._streakVideo = document.createElement("video");
    this._streakVideo.src = "/killstreak.mp4";
    this._streakVideo.preload = "auto";
    this._streakVideo.muted = false;
    this._streakVideo.playsInline = true;
    Object.assign(this._streakVideo.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "60vw",
      height: "auto",
      maxWidth: "800px",
      pointerEvents: "none",
      zIndex: "55",
      opacity: "0",
      transition: "opacity 0.2s",
      mixBlendMode: "screen",
      backgroundColor: "black",
      borderRadius: "8px",
    });
    this._streakVideo.addEventListener("ended", () => {
      this._streakVideo.style.opacity = "0";
    });
    document.body.appendChild(this._streakVideo);
    this._hasStreakVideo = true;
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

    // Kill streak tracking
    this._streakCount += 1;
    this._streakTimer = 3.0; // 3 seconds to get next kill or streak resets

    // Check thresholds
    for (let i = this._streakThresholds.length - 1; i >= 0; i--) {
      if (this._streakCount === this._streakThresholds[i]) {
        this._triggerStreak(i);
        break;
      }
    }
  }

  _triggerStreak(tier) {
    const name = this._streakNames[tier];
    const bonus = this._streakBonuses[tier];

    // Award bonus points
    this.addScore(bonus);

    // Show green ooze drip effect from top
    this._streakEl.style.opacity = "1";
    this._streakEl.style.height = `${15 + tier * 8}%`;

    // Show streak — image or text
    if (this._hasStreakImg) {
      this._streakImg.style.display = "block";
      this._streakImg.style.width = `${300 + tier * 40}px`;
      this._streakLabel.textContent = name;
    } else {
      this._streakImg.style.display = "none";
      this._streakLabel.textContent = name;
      this._streakLabel.style.fontSize = `${36 + tier * 6}px`;
    }
    this._streakText.style.opacity = "1";

    // Show counter
    this._streakCounter.textContent = `${this._streakCount} KILLS — +${bonus} BONUS`;
    this._streakCounter.style.opacity = "1";

    // Play kill streak video for tier 1+ (10+ kills)
    if (tier >= 1 && this._hasStreakVideo && this._streakVideo) {
      this._streakVideo.currentTime = 0;
      this._streakVideo.style.opacity = "1";
      this._streakVideo.play().catch(() => {});
    }

    // Fade out after 2.5 seconds (text/ooze; video fades on its own end event)
    clearTimeout(this._streakFadeTimer);
    this._streakFadeTimer = setTimeout(() => {
      this._streakEl.style.opacity = "0";
      this._streakEl.style.height = "0";
      this._streakText.style.opacity = "0";
      this._streakCounter.style.opacity = "0";
    }, 2500);
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
    if (waveManager.state === "waiting" && waveManager.wave > 0) {
      const timeLeft = Math.ceil(waveManager.delayTimer);
      this.zombiesRemaining.textContent = `Next wave in ${timeLeft}s`;
      this.zombiesRemaining.style.color = timeLeft <= 5 ? "#ff4444" : "#888";
    } else {
      this.zombiesRemaining.textContent = `Zombies: ${enemyManager.aliveCount}`;
      this.zombiesRemaining.style.color = "#888";
    }

    // Score
    this.scoreDisplay.textContent = `SCORE: ${this.score}`;

    // Kill counter
    if (this.killCounter) {
      this.killCounter.textContent = `KILLS: ${this.kills}`;
    }

    // Kill streak timer — resets if no kill within 3 seconds
    if (this._streakTimer > 0) {
      this._streakTimer -= dt;
      if (this._streakTimer <= 0) {
        this._streakCount = 0; // streak broken
      }
    }

    // Wave announce fade
    if (this.announceTimer > 0) {
      this.announceTimer -= dt;
      if (this.announceTimer <= 0.5) {
        this.waveAnnounce.style.opacity = String(
          Math.max(0, this.announceTimer / 0.5),
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
          Math.max(0, this.scorePopupTimer / 0.3),
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
    // Create and play death video overlay FIRST
    const deathVideo = document.createElement("video");
    deathVideo.src = "/death.mp4";
    deathVideo.playsInline = true;
    deathVideo.muted = true; // muted first to guarantee autoplay
    Object.assign(deathVideo.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      objectFit: "cover",
      zIndex: "200",
      pointerEvents: "none",
      backgroundColor: "#000",
    });
    document.body.appendChild(deathVideo);

    // Play death video — start muted, unmute after play begins
    deathVideo
      .play()
      .then(() => {
        deathVideo.muted = false;
      })
      .catch(() => {
        // If play fails entirely, show game over immediately
        deathVideo.remove();
        document.getElementById("final-wave").textContent = `Wave: ${wave}`;
        document.getElementById("final-score").textContent = `Score: ${score}`;
        document.getElementById("final-kills").textContent = `Kills: ${kills}`;
        document.getElementById("game-over").style.display = "flex";
      });

    deathVideo.addEventListener("ended", () => {
      deathVideo.remove();
      // Now show the standard game over overlay
      document.getElementById("final-wave").textContent = `Wave: ${wave}`;
      document.getElementById("final-score").textContent = `Score: ${score}`;
      document.getElementById("final-kills").textContent = `Kills: ${kills}`;
      document.getElementById("game-over").style.display = "flex";
    });

    // Fallback: if video fails to play, show game over after 3 seconds
    deathVideo.addEventListener("error", () => {
      deathVideo.remove();
      document.getElementById("final-wave").textContent = `Wave: ${wave}`;
      document.getElementById("final-score").textContent = `Score: ${score}`;
      document.getElementById("final-kills").textContent = `Kills: ${kills}`;
      document.getElementById("game-over").style.display = "flex";
    });

    // Safety timeout — if video is longer than 10s, force game over screen
    setTimeout(() => {
      if (deathVideo.parentNode) {
        deathVideo.remove();
        document.getElementById("final-wave").textContent = `Wave: ${wave}`;
        document.getElementById("final-score").textContent = `Score: ${score}`;
        document.getElementById("final-kills").textContent = `Kills: ${kills}`;
        document.getElementById("game-over").style.display = "flex";
      }
    }, 10000);
  }
}
