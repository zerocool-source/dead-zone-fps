// ============================================
// TWEAK THESE VALUES TO TUNE GAMEPLAY
// ============================================

// --- Player ---
export const PLAYER_HEIGHT = 1.7;
export const PLAYER_RADIUS = 0.4;
export const MOVE_SPEED = 6;
export const SPRINT_MULTIPLIER = 1.6;
export const JUMP_FORCE = 8;
export const GRAVITY = 20;
export const MOUSE_SENSITIVITY = 0.002;
export const PLAYER_MAX_HEALTH = 100;

// --- Weapon ---
export const FIRE_RATE = 0.12; // seconds between shots
export const MAGAZINE_SIZE = 30;
export const RESERVE_AMMO = 150;
export const RELOAD_TIME = 1.8; // seconds
export const WEAPON_DAMAGE = 25;
export const RECOIL_AMOUNT = 0.04; // radians upward kick (increased)
export const RECOIL_RECOVERY = 0.08; // radians per second (slower recovery = heavier feel)
export const WEAPON_RANGE = 100;
export const SPREAD_BASE = 0.01; // radians
export const HORIZONTAL_RECOIL = 0.015; // radians left/right kick

// --- Zombie ---
export const ZOMBIE_BASE_HEALTH = 75;
export const ZOMBIE_DAMAGE = 15;
export const ZOMBIE_ATTACK_COOLDOWN = 1.0; // seconds
export const ZOMBIE_BASE_SPEED = 2.5;
export const ZOMBIE_ATTACK_RANGE = 1.8;
export const ZOMBIE_SPAWN_DISTANCE = 18; // from center

// --- Zombie Archetypes ---
export const ZOMBIE_TYPE_NORMAL = "normal";
export const ZOMBIE_TYPE_RUNNER = "runner";
export const ZOMBIE_TYPE_TANK = "tank";

export const ZOMBIE_RUNNER_HEALTH_MULT = 0.6;
export const ZOMBIE_RUNNER_SPEED_MULT = 1.8;
export const ZOMBIE_RUNNER_SCALE = 0.85;

export const ZOMBIE_TANK_HEALTH_MULT = 3.0;
export const ZOMBIE_TANK_SPEED_MULT = 0.6;
export const ZOMBIE_TANK_SCALE = 1.3;

// --- Waves ---
export const WAVE_BASE_COUNT = 5;
export const WAVE_COUNT_INCREASE = 3;
export const WAVE_SPEED_INCREASE = 0.15;
export const WAVE_HEALTH_INCREASE = 15;
export const WAVE_DELAY = 4.0; // seconds between waves

// --- Room ---
export const ROOM_WIDTH = 60;
export const ROOM_DEPTH = 60;
export const ROOM_HEIGHT = 8;
export const SECOND_FLOOR_HEIGHT = 4.0;
export const FLOOR_THICKNESS = 0.25;

// --- Stairs ---
export const STAIR_STEP_COUNT = 14;
export const STAIR_STEP_HEIGHT = SECOND_FLOOR_HEIGHT / 14;
export const STAIR_STEP_DEPTH = 0.8;
export const STAIR_WIDTH = 3.5;

// --- Staircase positions (bottom-center of each staircase) ---
export const STAIRCASE_A = { x: -26.5, z: -21, dirX: 0, dirZ: 1 }; // left wall, goes toward front
export const STAIRCASE_B = { x: 26.5, z: -21, dirX: 0, dirZ: 1 }; // right wall, goes toward front

// --- Doors ---
export const DOOR_CONFIGS = [
  { id: "door_left_wing", cost: 750 },
  { id: "door_right_wing", cost: 750 },
  { id: "door_back_room", cost: 1250 },
  { id: "door_balcony_room", cost: 1500 },
];

// --- Gamepad (Xbox Series X) ---
export const GAMEPAD_SENSITIVITY = 3.5; // right stick look speed
export const GAMEPAD_DEADZONE = 0.15; // stick dead zone threshold

// --- Scoring ---
export const KILL_SCORE = 100;
export const HEADSHOT_BONUS = 50;
export const WAVE_BONUS = 500;
