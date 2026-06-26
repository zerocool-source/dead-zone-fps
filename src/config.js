// AEON — global tuning constants. One place to balance the whole sim.

export const WORLD = {
  SIZE: 320,          // world units across (a bigger continent)
  SEG: 200,           // terrain grid resolution
  SEA_LEVEL: 0.0,     // height at/below this is ocean
  MAX_HEIGHT: 20,     // peak mountain height in world units
  ISLAND_FALLOFF: 1.35,// how hard the coast drops to sea
};

// Playable peoples. `mesh` maps to an asset key (falls back to 'being'); hue tints them,
// build scales their size. Each tribe is seeded as one of these races.
export const RACES = {
  dawnfolk:  { name: 'Dawnfolk',  mesh: 'being', hue: 0.07, build: 1.00, biome: 'grass',  trait: { kind: 0.3 } },
  emberfolk: { name: 'Emberfolk', mesh: 'ember', hue: 0.03, build: 0.94, biome: 'beach',  trait: { brave: 0.4 } },
  frostborn: { name: 'Frostborn', mesh: 'frost', hue: 0.60, build: 1.14, biome: 'rock',   trait: { brave: 0.25, social: -0.1 } },
  thornkin:  { name: 'Thornkin',  mesh: 'thorn', hue: 0.32, build: 1.05, biome: 'forest', trait: { curious: 0.4 } },
};

export const TRIBES = { COUNT: 3, START_POP: 9 };

// One in-game DAY = this many real seconds at 1x speed (slowed for day-to-day life).
export const DAY_SECONDS = 34;
export const YEAR_DAYS = 30;          // days per year

export const TIME_SCALES = [0, 1, 4, 16, 70]; // pause, lived, days, seasons, ages
export const TIME_LABELS = ['❚❚ Paused', '▶ Lived', '▶▶ Days', '▶▶▶ Seasons', '▶▶▶▶ Ages'];

// fraction-of-day boundaries for the daily routine
export const DAYTIME = { DAWN: 0.22, WORK_END: 0.62, DUSK: 0.74, SLEEP: 0.86 };

export const NEEDS = {
  // per in-game-day drain/gain rates (0..100 scale)
  HUNGER_RISE: 22,
  ENERGY_FALL: 18,
  SOCIAL_FALL: 12,
  EAT_GAIN: 60,        // hunger removed per meal
  REST_GAIN: 55,
  SOCIAL_GAIN: 45,
};

// Tribe resource economy + the jobs that feed it.
export const RES = {
  START: { food: 30, wood: 12, stone: 5 },
  CARRY: 7,             // how much a worker hauls per trip
  FOOD_PER_BERRY: 2,
  EAT_FROM_STORE: 7,    // food units a meal pulls from the storehouse
  HUT_COST: { wood: 10, stone: 3 },
  STORE_COST: { wood: 20, stone: 8 },
};

export const JOBS = ['forager', 'hunter', 'woodcutter', 'miner', 'builder', 'farmer', 'warrior', 'leader'];

// conflict between tribes
export const COMBAT = {
  WAR_THRESHOLD: -45,   // standing at/below this means war
  PEACE_THRESHOLD: -10, // standing above this ends a war
  RANGE: 2.2,           // strike distance
  SIGHT: 34,            // how far a warrior spots an enemy
  DAMAGE: 26,           // base hit (scaled by skill/build)
  HEAL_PER_DAY: 22,     // out-of-combat recovery
};

// fauna for hunting
export const FAUNA = {
  DEER_COUNT: 34,
  DEER_FOOD: 14,        // food yield when caught
  DEER_HIDE: 1,
  FLEE_RADIUS: 14,
  RESPAWN_DAYS: 4,
};

export const LIFE = {
  CHILD_UNTIL: 14,     // years
  ELDER_FROM: 52,
  MAX_AGE: 72,
  DEATH_AGE_VARIANCE: 14,
  GESTATION_DAYS: 6,
  FERTILE_FROM: 16,
  FERTILE_UNTIL: 45,
  MATE_COOLDOWN_DAYS: 8,
  STARVE_DEATH_DAYS: 3, // days at max hunger before death risk
};

export const POP = {
  START: 14,
  SOFT_CAP: 70,        // per-tribe soft cap; food/space pressure scales above this
};

export const FOOD = {
  BUSH_COUNT: 150,
  BUSH_MAX: 5,         // berries per bush
  REGROW_DAYS: 2.5,    // days to regrow one berry
};

// Knowledge thresholds — culture-wide discoveries. `era` marks the age each one opens.
export const TECH = [
  { id: 'fire',     name: 'Fire',        needPop: 0,  needInsight: 30,   era: 'Stone',      desc: 'Warmth, safety, cooked food.' },
  { id: 'tools',    name: 'Stone Tools', needPop: 0,  needInsight: 130,  era: 'Stone',      desc: 'Sharper foraging and building.' },
  { id: 'shelter',  name: 'Shelter',     needPop: 6,  needInsight: 340,  era: 'Stone',      desc: 'Permanent homes; a village forms.' },
  { id: 'language', name: 'Language',    needPop: 8,  needInsight: 680,  era: 'Stone',      desc: 'Stories, names, shared memory.' },
  { id: 'ritual',   name: 'Ritual',      needPop: 10, needInsight: 1150, era: 'Stone',      desc: 'They begin to wonder about you.' },
  { id: 'farming',  name: 'Farming',     needPop: 12, needInsight: 1900, era: 'Stone',      desc: 'Food they grow themselves.' },
  { id: 'pottery',  name: 'Pottery',     needPop: 14, needInsight: 2700, era: 'Stone',      desc: 'Storage, surplus, trade goods.' },
  { id: 'bronze',   name: 'Bronze Working', needPop: 16, needInsight: 3800, era: 'Bronze', desc: 'Metal tools and the first blades. The Bronze Age dawns.' },
  { id: 'writing',  name: 'Writing',     needPop: 18, needInsight: 5200, era: 'Bronze',     desc: 'Law, record, and memory beyond a lifetime.' },
  { id: 'wheel',    name: 'The Wheel',   needPop: 18, needInsight: 6800, era: 'Bronze',     desc: 'Carts, trade roads, faster everything.' },
  { id: 'iron',     name: 'Iron Working', needPop: 22, needInsight: 9000, era: 'Iron',      desc: 'Hard tools, hard weapons. The Iron Age begins.' },
  { id: 'masonry',  name: 'Masonry',     needPop: 24, needInsight: 12000, era: 'Iron',      desc: 'Walls, temples, the first true cities.' },
];

// the age a tribe is in, by the most advanced tech it holds
export const ERAS = ['Stone', 'Bronze', 'Iron', 'Classical'];
export function eraOf(techIds) {
  let era = 'Stone';
  for (const t of TECH) if (techIds.includes(t.id)) era = t.era;
  return era;
}

export const GOD = {
  FAITH_START: 20,
  FAITH_MAX: 200,
  FAITH_PER_BELIEVER_DAY: 0.6,
  COST_INSPIRE: 6,
  COST_BLESS: 14,
  COST_REVEAL: 4,
  COST_SMITE: 24,
  COST_SHAPE: 10,
  BLESS_RADIUS: 26,
  SMITE_RADIUS: 16,
  SHAPE_RADIUS: 14,
};
