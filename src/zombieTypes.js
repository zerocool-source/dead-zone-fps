/**
 * Modular zombie archetype definitions.
 * Data-driven config for all zombie types.
 */

export const ZOMBIE_TYPES = {
  walker: {
    id: "walker",
    type: "walker",
    healthMult: 1.0,
    speedMult: 1.0,
    damage: 15,
    attackRange: 1.8,
    attackCooldown: 1.0,
    pointsOnKill: 100,
    spawnWeight: 10,
    bodyColor: 0x3a5a3a,
    darkColor: 0x2a3a2a,
    eyeColor: 0xff0000,
    scale: 1.0,
    texture: "/textures/zombie.png", // male walker
    aspectRatio: 0.7, // width/height
    specialAbility: null,
    minRound: 1,
  },
  sprinter: {
    id: "sprinter",
    type: "sprinter",
    healthMult: 0.6,
    speedMult: 1.8,
    damage: 12,
    attackRange: 1.8,
    attackCooldown: 0.8,
    pointsOnKill: 120,
    spawnWeight: 6,
    bodyColor: 0x5a2a2a,
    darkColor: 0x3a1a1a,
    eyeColor: 0xff4400,
    scale: 0.85,
    texture: "/textures/zombie.png",
    aspectRatio: 0.65,
    specialAbility: null,
    minRound: 3,
  },
  tank: {
    id: "tank",
    type: "tank",
    healthMult: 3.0,
    speedMult: 0.55,
    damage: 30,
    attackRange: 2.2,
    attackCooldown: 1.5,
    pointsOnKill: 250,
    spawnWeight: 3,
    bodyColor: 0x2a2a4a,
    darkColor: 0x1a1a3a,
    eyeColor: 0x8800ff,
    scale: 1.35,
    texture: "/textures/zombie.png",
    aspectRatio: 0.8,
    specialAbility: "headshot_weak",
    minRound: 5,
  },
  toxic: {
    id: "toxic",
    type: "toxic",
    healthMult: 0.8,
    speedMult: 1.1,
    damage: 10,
    attackRange: 1.8,
    attackCooldown: 1.0,
    pointsOnKill: 150,
    spawnWeight: 4,
    bodyColor: 0x2a5a2a,
    darkColor: 0x1a3a1a,
    eyeColor: 0x44ff00,
    scale: 1.0,
    texture: "/textures/zombie.png",
    aspectRatio: 0.7,
    specialAbility: "explode_on_death",
    minRound: 4,
  },
  crawler: {
    id: "crawler",
    type: "crawler",
    healthMult: 0.5,
    speedMult: 1.3,
    damage: 10,
    attackRange: 1.5,
    attackCooldown: 0.7,
    pointsOnKill: 80,
    spawnWeight: 5,
    bodyColor: 0x4a3a2a,
    darkColor: 0x3a2a1a,
    eyeColor: 0xffaa00,
    scale: 0.6,
    texture: "/textures/zombie.png",
    aspectRatio: 0.7,
    specialAbility: "low_profile",
    minRound: 3,
  },
  screamer: {
    id: "screamer",
    type: "screamer",
    healthMult: 0.4,
    speedMult: 0.9,
    damage: 5,
    attackRange: 1.5,
    attackCooldown: 1.0,
    pointsOnKill: 200,
    spawnWeight: 2,
    bodyColor: 0x5a5a5a,
    darkColor: 0x3a3a3a,
    eyeColor: 0xff00ff,
    scale: 0.95,
    texture: "/textures/zombie.png",
    aspectRatio: 0.7,
    specialAbility: "scream",
    minRound: 6,
  },
  soldier: {
    id: "soldier",
    type: "soldier",
    healthMult: 1.5,
    speedMult: 1.2,
    damage: 20,
    attackRange: 2.0,
    attackCooldown: 0.9,
    pointsOnKill: 180,
    spawnWeight: 5,
    bodyColor: 0x3a3a2a,
    darkColor: 0x2a2a1a,
    eyeColor: 0xffaa00,
    scale: 1.05,
    texture: "/textures/zombie.png",
    aspectRatio: 0.7,
    specialAbility: null,
    minRound: 2,
  },
  officer: {
    id: "officer",
    type: "officer",
    healthMult: 1.8,
    speedMult: 1.0,
    damage: 22,
    attackRange: 2.0,
    attackCooldown: 1.0,
    pointsOnKill: 220,
    spawnWeight: 3,
    bodyColor: 0x2a2a2a,
    darkColor: 0x1a1a1a,
    eyeColor: 0xffcc00,
    scale: 1.0,
    texture: "/textures/zombie.png",
    aspectRatio: 0.7,
    specialAbility: null,
    minRound: 4,
  },
  warden: {
    id: "warden",
    type: "warden",
    healthMult: 8.0,
    speedMult: 0.4,
    damage: 50,
    attackRange: 3.0,
    attackCooldown: 2.0,
    pointsOnKill: 1000,
    spawnWeight: 0, // boss-only — never spawns as regular zombie
    bodyColor: 0x1a1a1a,
    darkColor: 0x0a0a0a,
    eyeColor: 0xff0000,
    scale: 1.8,
    texture: "/textures/zombie.png",
    aspectRatio: 0.7,
    specialAbility: "boss",
    minRound: 99, // boss-only — spawned explicitly by RoundDirector
  },
};

/**
 * Get weighted spawn table for a given round.
 * Returns array of type keys with proper weights.
 */
export function getSpawnWeightsForRound(round) {
  const weights = {};
  for (const [key, cfg] of Object.entries(ZOMBIE_TYPES)) {
    if (round >= cfg.minRound && cfg.spawnWeight > 0) {
      weights[key] = cfg.spawnWeight;
    }
  }
  return weights;
}

/**
 * Pick a random zombie type based on weighted table.
 */
export function pickZombieType(round) {
  const weights = getSpawnWeightsForRound(round);
  const entries = Object.entries(weights);
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * totalWeight;

  for (const [type, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return type;
  }
  return "walker";
}
