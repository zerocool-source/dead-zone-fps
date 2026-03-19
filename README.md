# Dead Zone — FPS Zombie Survival Prototype

A first-person zombie survival shooter built with Three.js. Survive waves of undead in a dark industrial bunker arena.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000 — click to start.

## Controls

### Keyboard + Mouse

| Key | Action |
|-----|--------|
| WASD | Move |
| SHIFT | Sprint |
| SPACE | Jump |
| Mouse | Aim |
| Left Click | Shoot (hold for auto-fire) |
| Right Click | Aim Down Sights |
| R | Reload |
| ESC | Pause / unlock mouse |

### Xbox Series X Controller (Bluetooth)

| Input | Action |
|-------|--------|
| Left Stick | Move |
| Right Stick | Aim |
| A | Jump |
| X / LB | Reload |
| RT (Right Trigger) | Shoot |
| LT (Left Trigger) | Aim Down Sights |
| L3 (Left Stick Press) | Sprint |
| Start | Pause |

Both input methods work simultaneously.

## Project Structure

```
src/
├── main.js          Entry point, game loop, wiring
├── constants.js     All tunable gameplay values
├── player.js        FPS controller, movement, collision
├── weapon.js        Gun model, shooting, recoil, ammo, ADS
├── enemies.js       Zombie class + EnemyManager
├── waveManager.js   Wave progression, spawning, difficulty
├── effects.js       Screen shake, particles, hitmarkers
├── hud.js           All UI updates
├── audio.js         Procedural Web Audio sounds
├── room.js          Enhanced arena with industrial bunker theme
├── textures.js      Procedural texture generator (concrete, wood, metal, blood)
├── gamepad.js       Xbox controller support via Gamepad API
```

## Arena Features

- Industrial bunker with concrete walls, cracks, and stains
- 4 boarded windows (partially broken) as zombie entry points
- Damaged main door (slightly ajar)
- Stairs leading to a second-floor balcony/platform
- Weapon wall with glowing gun outlines
- Crates, barrels, and pillars for cover
- Blood stains and scratch marks
- Flickering overhead lights (warm orange center, cold blue corners)
- Atmospheric fog

## Tuning Guide

All gameplay values are in `src/constants.js`:

### Movement
- `MOVE_SPEED` — base walk speed (default: 6)
- `SPRINT_MULTIPLIER` — sprint speed multiplier (default: 1.6)
- `JUMP_FORCE` — jump height (default: 8)
- `MOUSE_SENSITIVITY` — aim sensitivity (default: 0.002)

### Weapon
- `FIRE_RATE` — seconds between shots (default: 0.12)
- `WEAPON_DAMAGE` — damage per bullet (default: 25)
- `RECOIL_AMOUNT` — camera kick per shot (default: 0.03)
- `MAGAZINE_SIZE` — rounds per magazine (default: 30)
- `RESERVE_AMMO` — total backup ammo (default: 150)
- `RELOAD_TIME` — reload duration in seconds (default: 1.8)
- `SPREAD_BASE` — bullet spread in radians (default: 0.01)

### Zombies
- `ZOMBIE_BASE_HEALTH` — starting zombie HP (default: 75)
- `ZOMBIE_BASE_SPEED` — starting zombie speed (default: 2.5)
- `ZOMBIE_DAMAGE` — damage per zombie hit (default: 15)
- `ZOMBIE_ATTACK_COOLDOWN` — seconds between zombie attacks (default: 1.0)

### Waves
- `WAVE_BASE_COUNT` — zombies in wave 1 (default: 5)
- `WAVE_COUNT_INCREASE` — extra zombies per wave (default: 3)
- `WAVE_SPEED_INCREASE` — speed increase per wave (default: 0.15)
- `WAVE_HEALTH_INCREASE` — HP increase per wave (default: 15)
- `WAVE_DELAY` — seconds between waves (default: 4.0)

### Gamepad
- `GAMEPAD_SENSITIVITY` — right stick look speed (default: 3.5)
- `GAMEPAD_DEADZONE` — stick dead zone threshold (default: 0.15)

### Scoring
- `KILL_SCORE` — points per kill (default: 100)
- `WAVE_BONUS` — bonus for completing a wave (default: 500)
