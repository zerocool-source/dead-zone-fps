// AEON — global tuning constants. One place to balance the whole sim.

export const WORLD = {
  SIZE: 200,          // world units across (square island)
  SEG: 160,           // terrain grid resolution
  SEA_LEVEL: 0.0,     // height at/below this is ocean
  MAX_HEIGHT: 16,     // peak mountain height in world units
  ISLAND_FALLOFF: 1.5,// how hard the coast drops to sea
};

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

export const JOBS = ['forager', 'hunter', 'woodcutter', 'miner', 'builder', 'farmer', 'leader'];

// fauna for hunting
export const FAUNA = {
  DEER_COUNT: 16,
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
  SOFT_CAP: 60,        // food/space pressure scales above this
};

export const FOOD = {
  BUSH_COUNT: 70,
  BUSH_MAX: 5,         // berries per bush
  REGROW_DAYS: 2.5,    // days to regrow one berry
};

// Knowledge thresholds — culture-wide discoveries (emergent-ish, gated by conditions).
export const TECH = [
  { id: 'fire',     name: 'Fire',        needPop: 0,  needInsight: 30,   desc: 'Warmth, safety, cooked food.' },
  { id: 'tools',    name: 'Stone Tools', needPop: 0,  needInsight: 130,  desc: 'Sharper foraging and building.' },
  { id: 'shelter',  name: 'Shelter',     needPop: 6,  needInsight: 340,  desc: 'Permanent homes; a village forms.' },
  { id: 'language', name: 'Language',    needPop: 8,  needInsight: 680,  desc: 'Stories, names, shared memory.' },
  { id: 'ritual',   name: 'Ritual',      needPop: 10, needInsight: 1150, desc: 'They begin to wonder about you.' },
  { id: 'farming',  name: 'Farming',     needPop: 12, needInsight: 1900, desc: 'Food they grow themselves.' },
];

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
