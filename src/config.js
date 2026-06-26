// AEON — global tuning constants. One place to balance the whole sim.

export const WORLD = {
  SIZE: 200,          // world units across (square island)
  SEG: 160,           // terrain grid resolution
  SEA_LEVEL: 0.0,     // height at/below this is ocean
  MAX_HEIGHT: 16,     // peak mountain height in world units
  ISLAND_FALLOFF: 1.5,// how hard the coast drops to sea
};

// One in-game DAY = this many real seconds at 1x speed.
export const DAY_SECONDS = 12;
export const YEAR_DAYS = 24;          // compressed year so lineages turn over in minutes

export const TIME_SCALES = [0, 1, 6, 30, 120]; // pause, lived, fast, faster, deep-time
export const TIME_LABELS = ['❚❚ Paused', '▶ Lived', '▶▶ Days', '▶▶▶ Seasons', '▶▶▶▶ Ages'];

export const NEEDS = {
  // per in-game-day drain/gain rates (0..100 scale)
  HUNGER_RISE: 26,
  ENERGY_FALL: 20,
  SOCIAL_FALL: 14,
  EAT_GAIN: 60,        // hunger removed per meal tick
  REST_GAIN: 55,
  SOCIAL_GAIN: 45,
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
