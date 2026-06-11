import * as THREE from "three";
import { createRoom, updateFlickerLights } from "./room.js";
import {
  createOutdoorLevel,
  updateOutdoorFlickerLights,
} from "./outdoorLevel.js";
import { createCityLevel } from "./cityLevel.js";
import { createZombieFloor } from "./zombieFloor.js";
import { Player } from "./player.js";
import { Weapon, SHOT_RESULT } from "./weapon.js";
import { WeaponSprite } from "./weaponSprite.js";
import { WeaponModelRenderer } from "./weaponModel.js";
import { EnemyManager } from "./enemies.js";
import { RoundDirector } from "./roundDirector.js";
import { BarricadeManager } from "./barricades.js";
import { Effects } from "./effects.js";
import { HUD } from "./hud.js";
import { GamepadController } from "./gamepad.js";
import { WeaponUpgradeManager } from "./weaponUpgrades.js";
import { DoorManager } from "./doors.js";
import { TrapManager } from "./traps.js";
import { PerkManager } from "./perks.js";
import { ZOMBIE_TYPES } from "./zombieTypes.js";
import {
  resumeAudio,
  playHurt,
  playFootstep,
  setMasterVolume,
  setMusicVolume,
  getCurrentTrackName,
  nextTrack,
} from "./audio.js";
import {
  KILL_SCORE,
  HEADSHOT_BONUS,
  WAVE_BONUS,
  RELOAD_TIME,
  PLAYER_MAX_HEALTH,
  SECOND_FLOOR_HEIGHT,
  ROOM_WIDTH,
  ROOM_DEPTH,
} from "./constants.js";

// ═══════════════════════════════════════════════════════════
// STORY CHAPTERS — each chapter is a level + round range
// ═══════════════════════════════════════════════════════════
const CHAPTERS = [
  {
    id: 1,
    name: "THE GRAND HALL",
    subtitle: "Clear the building. Survive the night.",
    level: "indoor",
    startRound: 1,
    endRound: 8,
    color: "#c33",
  },
  {
    id: 2,
    name: "DEAD CITY STREETS",
    subtitle: "They're everywhere. Find shelter. Board up. Hold the line.",
    level: "outdoor",
    startRound: 9,
    endRound: 16,
    color: "#4a4",
  },
  {
    id: 3,
    name: "THE SWARM",
    subtitle: "No more hiding. They come in waves of thirty.",
    level: "outdoor",
    startRound: 17,
    endRound: 20,
    swarm: true,
    color: "#f44",
  },
  {
    id: 4,
    name: "END OF DAYS",
    subtitle: "Final stand. The Wardens are coming.",
    level: "indoor",
    startRound: 21,
    endRound: 25,
    color: "#a4f",
  },
];

function getChapterForRound(round) {
  for (const ch of CHAPTERS) {
    if (round >= ch.startRound && round <= ch.endRound) return ch;
  }
  return CHAPTERS[CHAPTERS.length - 1];
}

// ═══════════════════════════════════════════════════════════
// CHAPTER TRANSITION UI
// ═══════════════════════════════════════════════════════════
let _chapterOverlay = null;

function createChapterOverlay() {
  _chapterOverlay = document.createElement("div");
  Object.assign(_chapterOverlay.style, {
    position: "fixed",
    inset: "0",
    background: "rgba(0,0,0,0.95)",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "180",
    fontFamily: "'Courier New', monospace",
    textAlign: "center",
    flexDirection: "column",
  });
  _chapterOverlay.innerHTML = `
    <div id="chapter-number" style="color:#888;font-size:16px;letter-spacing:6px;margin-bottom:12px;"></div>
    <div id="chapter-title" style="color:#c33;font-size:52px;font-weight:bold;letter-spacing:4px;
      text-shadow:0 0 30px rgba(200,0,0,0.6);margin-bottom:20px;"></div>
    <div id="chapter-subtitle" style="color:#888;font-size:18px;max-width:500px;line-height:1.6;"></div>
  `;
  document.body.appendChild(_chapterOverlay);
}
createChapterOverlay();

function showChapterTransition(chapter, callback) {
  const numEl = _chapterOverlay.querySelector("#chapter-number");
  const titleEl = _chapterOverlay.querySelector("#chapter-title");
  const subEl = _chapterOverlay.querySelector("#chapter-subtitle");

  numEl.textContent = `CHAPTER ${chapter.id}`;
  titleEl.textContent = chapter.name;
  titleEl.style.color = chapter.color;
  titleEl.style.textShadow = `0 0 30px ${chapter.color}80, 0 0 60px ${chapter.color}40`;
  subEl.textContent = chapter.subtitle;

  _chapterOverlay.style.display = "flex";
  _chapterOverlay.style.opacity = "0";
  _chapterOverlay.style.transition = "opacity 0.5s";

  requestAnimationFrame(() => {
    _chapterOverlay.style.opacity = "1";
  });

  setTimeout(() => {
    _chapterOverlay.style.opacity = "0";
    setTimeout(() => {
      _chapterOverlay.style.display = "none";
      if (callback) callback();
    }, 500);
  }, 3500);
}

// ═══════════════════════════════════════════════════════════
// HEALTH DROPS
// ═══════════════════════════════════════════════════════════
const healthDrops = [];
const _healthTexLoader = new THREE.TextureLoader();
let _healthTex = null;
_healthTexLoader.load("/health_pack.png", (tex) => {
  _healthTex = tex;
});

function _makeFallbackHealthTex() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#2a3a2a";
  ctx.fillRect(16, 24, 96, 80);
  ctx.strokeStyle = "#5a5a5a";
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 24, 96, 80);
  ctx.fillStyle = "#00dd44";
  ctx.shadowColor = "#00ff44";
  ctx.shadowBlur = 8;
  ctx.fillRect(52, 40, 24, 48);
  ctx.fillRect(40, 52, 48, 24);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#444";
  ctx.fillRect(44, 18, 40, 10);
  return new THREE.CanvasTexture(c);
}

function spawnHealthDrop(pos) {
  const tex = _healthTex || _makeFallbackHealthTex();
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity: 0.95,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.2, 1.2, 1);
  sprite.position.copy(pos);
  sprite.position.y = 0.6;
  scene.add(sprite);
  healthDrops.push({ mesh: sprite, life: 15 });
}

function updateHealthDrops(dt, player) {
  for (let i = healthDrops.length - 1; i >= 0; i--) {
    const drop = healthDrops[i];
    drop.life -= dt;
    drop.mesh.position.y = 0.6 + Math.sin(drop.life * 4) * 0.15;
    drop.mesh.material.opacity = 0.7 + Math.sin(drop.life * 6) * 0.25;
    const t = drop.life * 2;
    drop.mesh.scale.x = Math.max(0.15, 1.2 * Math.abs(Math.cos(t)));
    if (drop.life < 3) {
      drop.mesh.visible = Math.sin(drop.life * 12) > 0;
    }
    const dist = player.position.distanceTo(drop.mesh.position);
    if (dist < 2) {
      player.health = Math.min(PLAYER_MAX_HEALTH, player.health + 25);
      hud.announce("+25 HEALTH");
      scene.remove(drop.mesh);
      drop.mesh.material.dispose();
      healthDrops.splice(i, 1);
      continue;
    }
    if (drop.life <= 0) {
      scene.remove(drop.mesh);
      drop.mesh.material.dispose();
      healthDrops.splice(i, 1);
    }
  }
}

// ═══════════════════════════════════════════════════════════
// GRENADES
// ═══════════════════════════════════════════════════════════
const grenades = [];
let grenadeCount = 3;
const _grenadeGeo = new THREE.SphereGeometry(0.15, 8, 6);
const _grenadeMat = new THREE.MeshBasicMaterial({ color: 0x556644 });

function throwGrenade(cam, playerPos) {
  if (grenadeCount <= 0) return;
  grenadeCount--;
  const mesh = new THREE.Mesh(_grenadeGeo, _grenadeMat);
  mesh.position.copy(playerPos);
  mesh.position.y -= 0.5;
  const dir = new THREE.Vector3(0, 0, -1);
  dir.applyQuaternion(cam.getWorldQuaternion(new THREE.Quaternion()));
  dir.y += 0.3;
  dir.normalize();
  scene.add(mesh);
  grenades.push({ mesh, velocity: dir.multiplyScalar(15), timer: 2.5 });
}

function updateGrenades(dt, enemyMgr, fx, plr) {
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    g.timer -= dt;
    g.velocity.y -= 15 * dt;
    g.mesh.position.addScaledVector(g.velocity, dt);
    g.mesh.rotation.x += dt * 8;
    g.mesh.rotation.z += dt * 5;
    if (g.mesh.position.y < 0.15) {
      g.mesh.position.y = 0.15;
      g.velocity.y *= -0.3;
      g.velocity.x *= 0.7;
      g.velocity.z *= 0.7;
    }
    if (g.timer <= 0) {
      const pos = g.mesh.position;
      for (const z of enemyMgr.zombies) {
        if (!z.alive || z.dying) continue;
        const d = z.mesh.position.distanceTo(pos);
        if (d < 6) {
          const dmg = Math.floor(200 * (1 - d / 6));
          z.takeDamage(dmg);
          if (!z.alive) {
            hud.addKill();
            hud.addScore(100);
          }
        }
      }
      fx.spawnHitParticles(scene, pos, 0xff6600);
      fx.spawnHitParticles(scene, pos, 0xffaa00);
      fx.shake(0.06);
      const pDist = plr.position.distanceTo(pos);
      if (pDist < 3) plr.takeDamage(Math.floor(30 * (1 - pDist / 3)));
      scene.remove(g.mesh);
      grenades.splice(i, 1);
    }
  }
}

// ═══════════════════════════════════════════════════════════
// RENDERER + SCENE
// ═══════════════════════════════════════════════════════════
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = false;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setClearColor(0x020204, 1);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  120,
);

// ═══════════════════════════════════════════════════════════
// LEVEL BUILDING
// ═══════════════════════════════════════════════════════════
let isOutdoor = false;
let currentChapter = CHAPTERS[0];
let obstacles = [];
let flickerLights = [];
let stairWaypoints = [];
let spawnPoints = null;

function buildLevel(levelType) {
  // Clear scene (preserve camera)
  while (scene.children.length > 0) {
    scene.remove(scene.children[0]);
  }
  scene.fog = null;

  // Clear health drops
  healthDrops.length = 0;

  isOutdoor = levelType === "outdoor";
  let levelData;

  if (isOutdoor) {
    levelData = createCityLevel(scene);
  } else {
    // Default level: The Grand Hall (indoor room)
    levelData = createRoom(scene);
  }

  obstacles = levelData.obstacles;
  flickerLights = levelData.flickerLights;
  stairWaypoints = levelData.stairWaypoints;
  spawnPoints = levelData.spawnPoints;

  return levelData;
}

// Build initial level (Chapter 1: Indoor)
buildLevel("indoor");

// ═══════════════════════════════════════════════════════════
// GAME SYSTEMS
// ═══════════════════════════════════════════════════════════
const doorManager = new DoorManager(scene, obstacles);
const player = new Player(camera);
scene.add(player.yawObject);

const weapon = new Weapon(camera, scene);
const weaponSprite = new WeaponSprite();
weapon.sprite = weaponSprite;

// 3D weapon viewmodel (GLB models with animated hands)
const weaponModel = new WeaponModelRenderer(camera);

const enemyManager = new EnemyManager(scene);
enemyManager.setStairWaypoints(stairWaypoints);

const effects = new Effects(camera);
const hud = new HUD();
const gamepad = new GamepadController();
const upgrades = new WeaponUpgradeManager(
  weapon,
  hud,
  weaponSprite,
  weaponModel,
);
upgrades.createWallDisplays(scene);
const perkManager = new PerkManager();

const barricadeManager = new BarricadeManager(scene);

function setupBarricades() {
  barricadeManager.clear();
  if (isOutdoor) {
    barricadeManager.addBarricade(new THREE.Vector3(-18, 0, -25), 0, {
      w: 3.5,
      h: 3,
    });
    barricadeManager.addBarricade(new THREE.Vector3(17, 0, 20), 0, {
      w: 3.5,
      h: 3,
    });
    barricadeManager.addBarricade(new THREE.Vector3(30, 0, -28), Math.PI / 2, {
      w: 2,
      h: 2.5,
    });
  }
}
setupBarricades();

// Round Director (always use standard — swarm is handled by chapter config)
const roundDirector = new RoundDirector(enemyManager, hud);
roundDirector.setSpawnPoints(spawnPoints);

// Dev/test hook — only set in dev to allow Playwright probes to introspect
// the running game (camera direction, zombies, etc). Safe to leave: it's a
// reference, not a global mutation surface.
if (import.meta.env.DEV) {
  window.__game = {
    camera, player, weapon, enemyManager, roundDirector, scene,
  };
}

// Traps
const trapManager = new TrapManager(scene);
function setupTraps() {
  trapManager.clear();
  if (isOutdoor) {
    trapManager.addTrap("electric_stairs", new THREE.Vector3(0, 0, -5));
    trapManager.addTrap("fire_hallway", new THREE.Vector3(0, 0, 15));
  } else {
    trapManager.addTrap("electric_stairs", new THREE.Vector3(-21, 0, 2));
    trapManager.addTrap("fire_hallway", new THREE.Vector3(21, 0, 2));
  }
}
setupTraps();

// ═══════════════════════════════════════════════════════════
// CHAPTER TRANSITION — rebuilds level mid-game
// ═══════════════════════════════════════════════════════════
let transitioning = false;

function transitionToChapter(chapter) {
  if (transitioning) return;
  transitioning = true;
  currentChapter = chapter;

  // Show chapter title card
  showChapterTransition(chapter, () => {
    // Clear enemies
    enemyManager.clear();

    // Rebuild the level
    buildLevel(chapter.level);

    // Re-add player to scene
    scene.add(player.yawObject);

    // Start high — gravity drops player onto street once city loads
    player.yawObject.position.set(0, 20, 0);
    player.velocity.set(0, 0, 0);

    // Store player refs so async level loaders can teleport player when ready
    scene.userData.playerRef = player.yawObject;
    scene.userData.playerVelocity = player.velocity;
    scene.userData.playerObject = player; // for setting groundLevel

    // Re-setup systems for new level
    enemyManager.setStairWaypoints(stairWaypoints);
    roundDirector.setSpawnPoints(spawnPoints);
    setupBarricades();
    setupTraps();

    // Re-request pointer lock
    renderer.domElement.requestPointerLock();
    transitioning = false;
  });
}

// ═══════════════════════════════════════════════════════════
// VOLUME & PAUSE
// ═══════════════════════════════════════════════════════════
const volumeSlider = document.getElementById("volume-slider");
const volumeValue = document.getElementById("volume-value");
const volumeControl = document.getElementById("volume-control");
let volumeVisible = false;

if (volumeSlider) {
  volumeSlider.addEventListener("input", () => {
    const vol = parseInt(volumeSlider.value, 10);
    setMasterVolume(vol / 100);
    if (volumeValue) volumeValue.textContent = `${vol}%`;
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "v" && volumeControl) {
    volumeVisible = !volumeVisible;
    volumeControl.style.opacity = volumeVisible ? "1" : "0";
    volumeControl.style.pointerEvents = volumeVisible ? "all" : "none";
  }
  if (e.key.toLowerCase() === "g" && !e.ctrlKey && isLocked && !gameOver) {
    throwGrenade(camera, player.position);
  }
});

// ═══════════════════════════════════════════════════════════
// POINTER LOCK + PAUSE
// ═══════════════════════════════════════════════════════════
const blocker = document.getElementById("blocker");
const introVideo = document.getElementById("intro-video");
const menuMusic = document.getElementById("menu-music");
if (menuMusic) menuMusic.volume = 0.3;
let isLocked = false;

blocker.addEventListener("click", () => {
  renderer.domElement.requestPointerLock();
  resumeAudio();
});

const pauseMenu = document.getElementById("pause-menu");
const pauseMasterVol = document.getElementById("pause-master-vol");
const pauseMusicVol = document.getElementById("pause-music-vol");
const pauseTrackName = document.getElementById("pause-track-name");
const pauseNextTrack = document.getElementById("pause-next-track");
const pauseSensitivity = document.getElementById("pause-sensitivity");
let isPaused = false;

function showPauseMenu() {
  isPaused = true;
  pauseMenu.style.display = "flex";
  pauseTrackName.textContent = getCurrentTrackName();
}

function hidePauseMenu() {
  isPaused = false;
  pauseMenu.style.display = "none";
}

if (pauseMasterVol) {
  pauseMasterVol.addEventListener("input", (e) => {
    setMasterVolume(e.target.value / 100);
  });
}
if (pauseMusicVol) {
  pauseMusicVol.addEventListener("input", (e) => {
    setMusicVolume(e.target.value / 100);
  });
}
if (pauseNextTrack) {
  pauseNextTrack.addEventListener("click", () => {
    const name = nextTrack();
    if (pauseTrackName) pauseTrackName.textContent = name;
  });
}
if (pauseSensitivity) {
  pauseSensitivity.addEventListener("input", (e) => {
    player.sensitivityMult = e.target.value / 4;
  });
}
if (pauseMenu) {
  pauseMenu.addEventListener("click", (e) => {
    if (
      e.target === pauseMenu ||
      e.target.tagName === "H1" ||
      e.target.textContent.includes("resume")
    ) {
      hidePauseMenu();
      renderer.domElement.requestPointerLock();
    }
  });
}

document.addEventListener("pointerlockchange", () => {
  isLocked = document.pointerLockElement === renderer.domElement;
  if (isLocked) {
    blocker.style.display = "none";
    hidePauseMenu();
    hud.show();
    // Use 2D sprite as fallback when the 3D weapon model isn't loaded
    // (e.g. GLB assets unavailable). It'll get hidden in the render loop
    // once the 3D model becomes active.
    if (weaponModel.hasModel()) {
      weaponSprite.hide();
    } else {
      weaponSprite.show();
    }
    if (introVideo) introVideo.pause();
    if (menuMusic) menuMusic.pause();
    // Show chapter 1 title on first play
    if (elapsedTime < 0.5 && !_shownFirstChapter) {
      _shownFirstChapter = true;
      showChapterTransition(CHAPTERS[0], () => {
        renderer.domElement.requestPointerLock();
      });
    }
  } else {
    if (gameOver) {
      blocker.style.display = "none";
      hidePauseMenu();
    } else if (transitioning) {
      // Chapter transition in progress — don't show anything
    } else if (elapsedTime > 1) {
      showPauseMenu();
      blocker.style.display = "none";
    } else {
      blocker.style.display = "flex";
      if (introVideo) introVideo.play().catch(() => {});
    }
    hud.hide();
    weaponSprite.hide();
  }
});

// ═══════════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════════
let gameOver = false;
let prevTime = performance.now();
let elapsedTime = 0;
let mouseDown = false;
let lastFootstepBob = 0;
let _shownFirstChapter = false;

// Zombie popup
let zombiePopupShown = false;
let gameplayTime = 0;
function showZombiePopup() {
  if (zombiePopupShown) return;
  zombiePopupShown = true;
  const vid = document.createElement("video");
  vid.src = "/zombie_popup.mp4";
  vid.playsInline = true;
  vid.muted = true;
  Object.assign(vid.style, {
    position: "fixed",
    bottom: "-900px",
    left: "20px",
    width: "840px",
    height: "auto",
    zIndex: "60",
    pointerEvents: "none",
    borderRadius: "12px",
    transition: "bottom 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
    mixBlendMode: "screen",
    backgroundColor: "black",
  });
  document.body.appendChild(vid);
  vid
    .play()
    .then(() => {
      vid.muted = false;
    })
    .catch(() => {});
  setTimeout(() => {
    vid.style.bottom = "10px";
  }, 100);
  vid.addEventListener("ended", () => {
    vid.style.bottom = "-900px";
    setTimeout(() => vid.remove(), 600);
  });
  setTimeout(() => {
    if (vid.parentNode) {
      vid.style.bottom = "-900px";
      setTimeout(() => vid.remove(), 600);
    }
  }, 15000);
}

document.addEventListener("mousedown", (e) => {
  if (e.button === 0) mouseDown = true;
});
document.addEventListener("mouseup", (e) => {
  if (e.button === 0) mouseDown = false;
});

// ═══════════════════════════════════════════════════════════
// ROUND CALLBACKS — includes chapter transitions
// ═══════════════════════════════════════════════════════════
roundDirector.onRoundStart = (round, config) => {
  hud.announceWave(round);

  // Chapter announcement at start of new chapter
  const ch = getChapterForRound(round);
  if (ch.id !== currentChapter.id) {
    // Defer level transition to after the round announcement
    setTimeout(() => transitionToChapter(ch), 1500);
  }

  if (config.isBossRound) {
    setTimeout(() => hud.announce("THE WARDEN APPROACHES"), 2000);
  }

  // Swarm chapter: override max alive for massive waves
  if (ch.swarm && config) {
    config.maxAliveAtOnce = 30;
    config.spawnInterval = 0.05;
  }
};

roundDirector.onRoundComplete = (round, config) => {
  hud.addScore(WAVE_BONUS + config.rewardBonus);
  if (player.alive) {
    player.health = Math.min(
      PLAYER_MAX_HEALTH + perkManager.getEffect("healthBonus", 0),
      player.health + 25,
    );
    grenadeCount = Math.min(5, grenadeCount + 1);
  }

  const ch = getChapterForRound(round);
  hud.announce(`ROUND ${round} COMPLETE — ${ch.name} — 10 SECONDS TO PREPARE`);
};

// ═══════════════════════════════════════════════════════════
// GAME LOOP
// ═══════════════════════════════════════════════════════════
function gameLoop() {
  requestAnimationFrame(gameLoop);

  const now = performance.now();
  const dt = Math.min((now - prevTime) / 1000, 0.1);
  prevTime = now;
  elapsedTime += dt;

  if (isOutdoor) {
    updateOutdoorFlickerLights(flickerLights, elapsedTime);
  } else {
    updateFlickerLights(flickerLights, elapsedTime);
  }
  gamepad.poll(dt);

  // Controller start
  if (!isLocked && !gameOver && gamepad.connected && gamepad.activated) {
    if (gamepad.jump || gamepad.shooting || gamepad.pause || gamepad.interact) {
      renderer.domElement.requestPointerLock();
      resumeAudio();
    }
  }
  if (isLocked && gamepad.connected && gamepad.pause) {
    document.exitPointerLock();
  }

  if (!isLocked || gameOver || transitioning) {
    if (!isPaused) {
      renderer.render(scene, camera);
    }
    return;
  }

  // Gamepad input
  player.gamepadMove.x = gamepad.moveX;
  player.gamepadMove.z = gamepad.moveZ;
  player.gamepadLook.x = gamepad.lookX;
  player.gamepadLook.y = gamepad.lookY;
  if (gamepad.sprint) player.keys.shift = true;
  if (gamepad.jump) player.keys.space = true;

  player.update(dt, obstacles);

  if (gamepad.jump) player.keys.space = false;
  if (!gamepad.sprint) player.keys.shift = player._keyboardShift || false;

  const isMoving =
    player.keys.w ||
    player.keys.a ||
    player.keys.s ||
    player.keys.d ||
    Math.abs(gamepad.moveX) > 0 ||
    Math.abs(gamepad.moveZ) > 0;
  const isSprinting = player.keys.shift || gamepad.sprint;

  // Footsteps
  if (isMoving && player.onGround) {
    const currentBob = Math.sin(player.bobTime);
    if (lastFootstepBob > 0 && currentBob <= 0) playFootstep(isSprinting);
    lastFootstepBob = currentBob;
  }

  // Weapon
  weapon.update(dt, isMoving, isSprinting);
  if (gamepad.connected && gamepad.activated) {
    weapon.aiming = gamepad.aiming || weapon._mouseAiming;
  }
  if (gamepad.reload) weapon.startReload();
  if (gamepad.grenade) throwGrenade(camera, player.position);

  // Trigger 3D model reload when weapon starts reloading
  if (weapon.reloading && !weapon._wasReloading) {
    weaponModel.triggerReload();
  }
  weapon._wasReloading = weapon.reloading;

  // Once the 3D weapon model finishes loading, swap from sprite fallback to it
  if (weaponSprite.visible && weaponModel.hasModel()) {
    weaponSprite.hide();
  }

  // Weapon sprite
  if (weaponSprite.visible) {
    const reloadProgress = weapon.reloading
      ? 1 - weapon.reloadTimer / RELOAD_TIME
      : 0;
    weaponSprite.update(
      dt,
      isMoving,
      isSprinting,
      weapon.reloading,
      reloadProgress,
      weapon.aiming,
    );
  }

  // Upgrades + doors
  upgrades.update(
    player.position,
    gamepad.interact || gamepad.reload,
    doorManager,
  );

  // Barricade repair prompt
  const nearBarricade = barricadeManager.getNearbyRepairable(player.position);
  if (nearBarricade) {
    const prompt = document.getElementById("interact-prompt");
    if (prompt && !upgrades._interactHeld) {
      prompt.style.display = "block";
      prompt.textContent = "[F] Repair Barricade";
    }
  }

  // Fire weapon
  const isFiring = mouseDown || gamepad.shooting;
  if (isFiring && player.alive) {
    const targets = enemyManager.getMeshes();
    const origSpread = weapon._spread;
    weapon._spread *= perkManager.getEffect("spreadMult", 1);
    const { result, hit } = weapon.tryShoot(targets);
    weapon._spread = origSpread;

    if (result === SHOT_RESULT.HIT || result === SHOT_RESULT.MISS) {
      weaponSprite.triggerShoot();
      weaponModel.triggerShoot();
      player.applyRecoil(weapon._recoilAmount);
      player.yawObject.rotation.y += weapon.getHorizontalRecoil();
      effects.shake(0.025);

      const ch = document.getElementById("crosshair");
      if (ch) {
        ch.style.transition = "none";
        ch.style.transform = `translate(-50%, -50%) translateY(-${8 + Math.random() * 6}px) translateX(${(Math.random() - 0.5) * 6}px)`;
        requestAnimationFrame(() => {
          ch.style.transition = "transform 0.15s ease-out";
          ch.style.transform = "translate(-50%, -50%)";
        });
      }

      if (result === SHOT_RESULT.HIT && hit) {
        const zombie = enemyManager.findByMesh(hit.object);
        if (zombie) {
          let dmg = hit.damage;
          if (hit.isHeadshot && zombie.type === "tank") dmg *= 3;
          zombie.takeDamage(dmg);
          effects.spawnHitParticles(scene, hit.point, 0xcc0000);
          effects.spawnBloodDecal(scene, hit.point);
          effects.showHitmarker(hit.isHeadshot);

          if (!zombie.alive) {
            effects.spawnDeathExplosion(scene, zombie.mesh.position);
            const pointsMult = roundDirector.onZombieKilled();
            const typeCfg = ZOMBIE_TYPES[zombie.type] || ZOMBIE_TYPES.walker;
            const killPts =
              (typeCfg.pointsOnKill + (hit.isHeadshot ? HEADSHOT_BONUS : 0)) *
              pointsMult;
            hud.addKill();
            hud.addScore(killPts);

            if (typeCfg.specialAbility === "explode_on_death") {
              effects.spawnHitParticles(scene, zombie.mesh.position, 0x44ff00);
              effects.shake(0.04);
              const distToPlayer = zombie.mesh.position.distanceTo(
                player.position,
              );
              if (distToPlayer < 4) {
                player.takeDamage(20 * (1 - distToPlayer / 4));
                effects.damageFlash();
              }
            }

            if (Math.random() < 0.25) {
              spawnHealthDrop(zombie.mesh.position.clone());
            }
          }
        }
      }
    }
  }

  // Health drops
  updateHealthDrops(dt, player);

  // Barricade + obstacle merge
  const allObstacles = [...obstacles, ...barricadeManager.getObstacles()];

  // Zombies attack barricades
  for (const z of enemyManager.zombies) {
    if (!z.alive || z.dying) continue;
    if (barricadeManager.isBlocked(z.mesh.position)) {
      barricadeManager.damageNearest(z.mesh.position, 15 * dt);
    }
  }

  // Enemy damage
  const damage = enemyManager.update(dt, player.position, allObstacles);
  if (damage > 0 && player.alive) {
    player.takeDamage(damage);
    effects.damageFlash();
    effects.shake(0.03);
    playHurt();

    if (!player.alive) {
      gameOver = true;
      document.exitPointerLock();
      hud.showGameOver(roundDirector.round, hud.score, hud.kills);
    }
  }

  // Grenades
  updateGrenades(dt, enemyManager, effects, player);
  const grenadeEl = document.getElementById("grenade-count");
  if (grenadeEl) grenadeEl.textContent = `\uD83E\uDDE8 ${grenadeCount}`;

  // Round director
  roundDirector.update(dt);

  // Traps
  trapManager.update(dt, enemyManager);

  // Effects
  effects.update(dt, scene);
  effects.updateBloodVignette(player.health);

  // HUD
  hud.update(dt, player, weapon, roundDirector, enemyManager);

  // Chapter display in HUD
  const ch2 = getChapterForRound(roundDirector.round || 1);
  const waveEl = document.getElementById("wave-number");
  if (waveEl && ch2) {
    waveEl.textContent = `${ch2.name} — WAVE ${roundDirector.round}`;
  }

  renderer.render(scene, camera);

  // Render 3D weapon viewmodel on top of scene
  weaponModel.update(
    dt,
    isMoving,
    isSprinting,
    weapon.reloading,
    weapon.reloading ? 1 - weapon.reloadTimer / 1.8 : 0,
    weapon.aiming,
  );
  weaponModel.render(renderer);
}

// ═══════════════════════════════════════════════════════════
// RESIZE + TRAP KEY + DEBUG
// ═══════════════════════════════════════════════════════════
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "t") {
    const trap = trapManager.getNearbyTrap(player.position);
    if (trap && trap.ready && hud.score >= trap.def.cost) {
      hud.addScore(-trap.def.cost);
      trap.activate();
      hud.announce(`${trap.def.name.toUpperCase()} ACTIVATED!`);
    }
  }
});

window.__scene = scene;
window.__camera = camera;
window.__renderer = renderer;

gameLoop();
