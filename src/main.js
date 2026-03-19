import * as THREE from "three";
import { createRoom, updateFlickerLights } from "./room.js";
import { Player } from "./player.js";
import { Weapon, SHOT_RESULT } from "./weapon.js";
import { WeaponSprite } from "./weaponSprite.js";
import { EnemyManager } from "./enemies.js";
import { RoundDirector } from "./roundDirector.js";
import { Effects } from "./effects.js";
import { HUD } from "./hud.js";
import { GamepadController } from "./gamepad.js";
import { WeaponUpgradeManager } from "./weaponUpgrades.js";
import { DoorManager } from "./doors.js";
import { TrapManager } from "./traps.js";
import { PerkManager, PERK_DEFS } from "./perks.js";
import { ZOMBIE_TYPES } from "./zombieTypes.js";
import {
  resumeAudio,
  playHurt,
  playFootstep,
  setMasterVolume,
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

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap; // faster than PCFSoft
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 2.8;
renderer.setClearColor(0x020204, 1); // Force dark clear color — no white bleed
document.body.appendChild(renderer.domElement);

// --- Scene & Camera ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  120,
);

// --- Build level ---
const { obstacles, flickerLights, stairWaypoints, spawnPoints } =
  createRoom(scene);

// --- Systems ---
const doorManager = new DoorManager(scene, obstacles);
const player = new Player(camera);
scene.add(player.yawObject);

const weapon = new Weapon(camera, scene);
const weaponSprite = new WeaponSprite();
weapon.sprite = weaponSprite;

const enemyManager = new EnemyManager(scene);
enemyManager.setStairWaypoints(stairWaypoints);

const effects = new Effects(camera);
const hud = new HUD();
const gamepad = new GamepadController();
const upgrades = new WeaponUpgradeManager(weapon, hud, weaponSprite);
upgrades.createWallDisplays(scene);
const perkManager = new PerkManager();

// --- Round Director (replaces WaveManager) ---
const roundDirector = new RoundDirector(enemyManager, hud);
roundDirector.setSpawnPoints(spawnPoints);

// --- Traps ---
const trapManager = new TrapManager(scene);
// Place traps near staircases
const HW = ROOM_WIDTH / 2,
  HD = ROOM_DEPTH / 2;
trapManager.addTrap("electric_stairs", new THREE.Vector3(-HW + 9, 0, 2));
trapManager.addTrap("fire_hallway", new THREE.Vector3(HW - 9, 0, 2));

// --- Volume Control ---
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
});

// --- Pointer Lock ---
const blocker = document.getElementById("blocker");
const introVideo = document.getElementById("intro-video");
let isLocked = false;

blocker.addEventListener("click", () => {
  renderer.domElement.requestPointerLock();
  resumeAudio();
});

document.addEventListener("pointerlockchange", () => {
  isLocked = document.pointerLockElement === renderer.domElement;
  blocker.style.display = isLocked ? "none" : "flex";
  if (isLocked) {
    hud.show();
    weaponSprite.show();
    // Pause intro video when playing
    if (introVideo) introVideo.pause();
  } else {
    hud.hide();
    weaponSprite.hide();
    // Resume intro video on menu
    if (introVideo) introVideo.play().catch(() => {});
  }
});

// --- Game State ---
let gameOver = false;
let prevTime = performance.now();
let elapsedTime = 0;
let mouseDown = false;
let lastFootstepBob = 0;

document.addEventListener("mousedown", (e) => {
  if (e.button === 0) mouseDown = true;
});
document.addEventListener("mouseup", (e) => {
  if (e.button === 0) mouseDown = false;
});

// --- Round callbacks ---
roundDirector.onRoundStart = (round, config) => {
  hud.announceWave(round);
  if (config.isBossRound) {
    setTimeout(() => hud.announce("THE WARDEN APPROACHES"), 2000);
  }
};

roundDirector.onRoundComplete = (round, config) => {
  hud.addScore(WAVE_BONUS + config.rewardBonus);
  // Small health recovery between rounds
  if (player.alive) {
    player.health = Math.min(
      PLAYER_MAX_HEALTH + perkManager.getEffect("healthBonus", 0),
      player.health + 20,
    );
  }
};

// --- Game Loop ---
function gameLoop() {
  requestAnimationFrame(gameLoop);

  const now = performance.now();
  const dt = Math.min((now - prevTime) / 1000, 0.1);
  prevTime = now;
  elapsedTime += dt;

  updateFlickerLights(flickerLights, elapsedTime);
  gamepad.poll(dt);

  // Controller can start the game — press A, Start, or RT from menu
  if (!isLocked && !gameOver && gamepad.connected && gamepad.activated) {
    // Any of these buttons starts the game
    if (gamepad.jump || gamepad.shooting || gamepad.pause || gamepad.interact) {
      renderer.domElement.requestPointerLock();
      resumeAudio();
    }
  }
  // Pause with controller while playing
  if (isLocked && gamepad.connected && gamepad.pause) {
    document.exitPointerLock();
  }

  if (!isLocked || gameOver) {
    renderer.render(scene, camera);
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

  // Weapon update (apply perk effects)
  weapon.update(dt, isMoving, isSprinting);
  if (gamepad.connected && gamepad.activated) {
    weapon.aiming = gamepad.aiming || weapon._mouseAiming;
  }
  if (gamepad.reload) weapon.startReload();

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

  // Upgrades + doors + traps interaction
  upgrades.update(
    player.position,
    gamepad.interact || gamepad.reload,
    doorManager,
  );

  // Trap activation (T key)
  const nearTrap = trapManager.getNearbyTrap(player.position);

  // Fire weapon
  const isFiring = mouseDown || gamepad.shooting;
  if (isFiring && player.alive) {
    const targets = enemyManager.getMeshes();

    // Apply deadeye perk to spread
    const origSpread = weapon._spread;
    weapon._spread *= perkManager.getEffect("spreadMult", 1);

    const { result, hit } = weapon.tryShoot(targets);
    weapon._spread = origSpread; // restore

    if (result === SHOT_RESULT.HIT || result === SHOT_RESULT.MISS) {
      weaponSprite.triggerShoot();
      player.applyRecoil(weapon._recoilAmount);
      player.yawObject.rotation.y += weapon.getHorizontalRecoil();
      effects.shake(0.025);

      if (result === SHOT_RESULT.HIT && hit) {
        const zombie = enemyManager.findByMesh(hit.object);
        if (zombie) {
          // Tank headshot weak spot
          let dmg = hit.damage;
          if (hit.isHeadshot && zombie.type === "tank") dmg *= 3;

          zombie.takeDamage(dmg);
          effects.spawnHitParticles(scene, hit.point, 0xcc0000);
          effects.showHitmarker(hit.isHeadshot);

          if (!zombie.alive) {
            const pointsMult = roundDirector.onZombieKilled();
            const typeCfg = ZOMBIE_TYPES[zombie.type] || ZOMBIE_TYPES.walker;
            const killPts =
              (typeCfg.pointsOnKill + (hit.isHeadshot ? HEADSHOT_BONUS : 0)) *
              pointsMult;
            hud.addKill();
            hud.addScore(killPts);

            // Toxic zombie explode on death
            if (typeCfg.specialAbility === "explode_on_death") {
              effects.spawnHitParticles(scene, zombie.mesh.position, 0x44ff00);
              effects.shake(0.04);
              // Damage player if nearby
              const distToPlayer = zombie.mesh.position.distanceTo(
                player.position,
              );
              if (distToPlayer < 4) {
                player.takeDamage(20 * (1 - distToPlayer / 4));
                effects.damageFlash();
              }
            }
          }
        }
      }
    }
  }

  // Enemy damage
  const damage = enemyManager.update(dt, player.position, obstacles);
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

  // Update round director
  roundDirector.update(dt);

  // Update traps
  trapManager.update(dt, enemyManager);

  // Update effects
  effects.update(dt, scene);
  effects.updateBloodVignette(player.health);

  // Update HUD (pass roundDirector as waveManager-compatible)
  hud.update(dt, player, weapon, roundDirector, enemyManager);

  renderer.render(scene, camera);
}

// --- Resize ---
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Trap activation key (T) ---
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

// Debug
window.__scene = scene;
window.__camera = camera;

gameLoop();
