// AEON — global tuning constants. One place to balance the whole sim.

export const WORLD = {
  SIZE: 1536,         // world units across (a truly huge continent)
  SEG: 320,           // terrain grid resolution
  SEA_LEVEL: 0.0,     // height at/below this is ocean
  MAX_HEIGHT: 36,     // peak mountain height in world units
  ISLAND_FALLOFF: 1.15,// how hard the coast drops to sea
};

// Playable peoples. `mesh` maps to an asset key (falls back to 'being'); hue tints them,
// build scales their size. Each tribe is seeded as one of these races.
export const RACES = {
  dawnfolk:  { name: 'Dawnfolk',  mesh: 'being', hue: 0.07, build: 1.00, biome: 'grass',  trait: { kind: 0.3 } },
  emberfolk: { name: 'Emberfolk', mesh: 'ember', hue: 0.03, build: 0.94, biome: 'desert', trait: { brave: 0.4 } },
  frostborn: { name: 'Frostborn', mesh: 'frost', hue: 0.60, build: 1.14, biome: 'taiga',  trait: { brave: 0.25, social: -0.1 } },
  thornkin:  { name: 'Thornkin',  mesh: 'thorn', hue: 0.32, build: 1.05, biome: 'jungle', trait: { curious: 0.4 } },
  ashkin:    { name: 'Ashkin',    mesh: 'ash',   hue: 0.98, build: 1.10, biome: 'rock',    trait: { brave: 0.35, devout: 0.2 } },
  sunkin:    { name: 'Sunkin',    mesh: 'sun',   hue: 0.11, build: 0.97, biome: 'savanna', trait: { social: 0.3, curious: 0.25 } },
  tidefolk:  { name: 'Tidefolk',  mesh: 'tide',  hue: 0.55, build: 1.0,  biome: 'beach',   trait: { curious: 0.3, kind: 0.2 } },
  mirekin:   { name: 'Mirekin',   mesh: 'mire',  hue: 0.40, build: 0.95, biome: 'tundra',  trait: { devout: 0.3, social: -0.15 } },
  duskborn:  { name: 'Duskborn',  mesh: 'dusk',  hue: 0.75, build: 1.02, biome: 'forest',  trait: { curious: 0.3, social: -0.1 } },
  stormkin:  { name: 'Stormkin',  mesh: 'storm', hue: 0.58, build: 1.08, biome: 'rock',    trait: { brave: 0.45 } },
  oreborn:   { name: 'Oreborn',   mesh: 'ore',   hue: 0.08, build: 1.12, biome: 'rock',    trait: { devout: 0.2, brave: 0.2 } },
  giltfolk:  { name: 'Giltfolk',  mesh: 'gilt',  hue: 0.13, build: 1.0,  biome: 'savanna', trait: { curious: 0.4, social: 0.2 }, elite: true },
};

export const TRIBES = { COUNT: 12, START_POP: 9 };

// One in-game DAY = this many real seconds at 1x speed (slowed for day-to-day life).
export const DAY_SECONDS = 55;
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

// fauna — prey and predators
export const FAUNA = {
  FLEE_RADIUS: 14,
  RESPAWN_DAYS: 4,
  TYPES: {
    // prey
    deer: { count: 70, food: 14, speed: 9, health: 16, predator: false, biomes: ['grass', 'savanna', 'forest', 'tundra'] },
    boar: { count: 22, food: 24, speed: 8, health: 42, predator: false, gore: 18, biomes: ['forest', 'jungle', 'savanna'] },
    mammoth: { count: 9, food: 70, speed: 6, health: 120, predator: false, gore: 30, biomes: ['tundra', 'taiga', 'savanna'] },
    // predator — hunts lone beings
    wolf: { count: 16, food: 7, speed: 13, health: 34, predator: true, attack: 16, sight: 30, biomes: ['forest', 'taiga', 'tundra', 'rock'] },
  },
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
  BUSH_COUNT: 420,
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
  { id: 'sailing',  name: 'Sailing',     needPop: 12, needInsight: 2300, era: 'Stone',      desc: 'Boats to fish the deep water and cross the sea.' },
  { id: 'pottery',  name: 'Pottery',     needPop: 14, needInsight: 2700, era: 'Stone',      desc: 'Storage, surplus, trade goods.' },
  { id: 'bronze',   name: 'Bronze Working', needPop: 16, needInsight: 3800, era: 'Bronze', desc: 'Metal tools and the first blades. The Bronze Age dawns.' },
  { id: 'writing',  name: 'Writing',     needPop: 18, needInsight: 5200, era: 'Bronze',     desc: 'Law, record, and memory beyond a lifetime.' },
  { id: 'wheel',    name: 'The Wheel',   needPop: 18, needInsight: 6800, era: 'Bronze',     desc: 'Carts, trade roads, faster everything.' },
  { id: 'iron',     name: 'Iron Working', needPop: 22, needInsight: 9000, era: 'Iron',      desc: 'Hard tools, hard weapons. The Iron Age begins.' },
  { id: 'masonry',  name: 'Masonry',     needPop: 24, needInsight: 12000, era: 'Iron',      desc: 'Walls, temples, the first true cities.' },
  { id: 'currency', name: 'Currency',    needPop: 26, needInsight: 16000, era: 'Classical', desc: 'Coin and credit. Markets hum with trade.' },
  { id: 'mathematics', name: 'Mathematics', needPop: 28, needInsight: 21000, era: 'Classical', desc: 'Number, measure, and the geometry of great works.' },
  { id: 'engineering', name: 'Engineering', needPop: 30, needInsight: 27000, era: 'Machina', desc: 'Gears, cranes, aqueducts. The age of machines stirs.' },
  { id: 'steamworks', name: 'Steamworks', needPop: 34, needInsight: 36000, era: 'Machina',  desc: 'Pressure and pistons. Chimneys rise over the workshops.' },
];

// the age a tribe is in, by the most advanced tech it holds
export const ERAS = ['Stone', 'Bronze', 'Iron', 'Classical', 'Machina'];
export function eraOf(techIds) {
  let era = 'Stone';
  for (const t of TECH) if (techIds.includes(t.id)) era = t.era;
  return era;
}

// Player-placeable buildings. You place a site (spending the focused tribe's
// resources); the tribe's builders construct it; once built it provides its effect.
export const BUILDINGS = {
  hut:        { name: 'Hut',          icon: '🛖', cost: { wood: 10, stone: 3 },  work: 6,  mesh: 'hut',
    desc: 'A home. Houses a family who sleep here at night.', effect: 'Shelter for ~5 souls' },
  storehouse: { name: 'Storehouse',   icon: '🏪', cost: { wood: 20, stone: 8 },  work: 10, mesh: null, cap: 200,
    desc: 'A central store for the tribe’s goods.', effect: '+200 resource storage' },
  granary:    { name: 'Granary',      icon: '🌾', cost: { wood: 16, stone: 4 },  work: 8,  mesh: null, produces: { food: 4 },
    desc: 'Stores and grows grain.', effect: '+4 food / day' },
  farm:       { name: 'Farm Plot',    icon: '🌱', cost: { wood: 8 },             work: 5,  mesh: null, produces: { food: 5 },
    desc: 'Tilled land worked for crops.', effect: '+5 food / day' },
  lodge:      { name: 'Logging Lodge', icon: '🪵', cost: { wood: 14, stone: 4 }, work: 8,  mesh: null, produces: { wood: 5 },
    desc: 'Organizes the woodcutters.', effect: '+5 wood / day' },
  mine:       { name: 'Mine',         icon: '⛏️', cost: { wood: 10, stone: 10 }, work: 10, mesh: null, produces: { stone: 4 },
    desc: 'Digs ore and stone from the earth.', effect: '+4 stone / day' },
  totem:      { name: 'Totem',        icon: '🗿', cost: { wood: 8, stone: 6 },   work: 6,  mesh: 'totem', faith: 0.12,
    desc: 'A sacred marker of your watching presence.', effect: 'Spreads devotion' },
  monument:   { name: 'Monument',     icon: '🏛️', cost: { stone: 30 },           work: 18, mesh: null, faith: 0.35,
    desc: 'A great work raised in your name.', effect: 'Strong devotion + prestige' },
  palisade:   { name: 'Palisade',     icon: '🧱', cost: { wood: 12 },            work: 5,  mesh: null, defense: 1,
    desc: 'A wall of sharpened logs.', effect: '+1 defense vs raids & beasts' },
  watchtower: { name: 'Watchtower',   icon: '🗼', cost: { wood: 18, stone: 6 },  work: 10, mesh: null, defense: 3,
    desc: 'A lookout that guards the village.', effect: '+3 defense, spots danger' },
  well:       { name: 'Well',         icon: '⛲', cost: { wood: 6, stone: 8 },   work: 6,  mesh: 'well', produces: { food: 2 }, heal: 8,
    desc: 'Clean water at the heart of the village.', effect: '+2 food / day · heals the nearby' },
  circle:     { name: 'Elder Circle', icon: '🔮', cost: { stone: 12, wood: 4 },  work: 8,  mesh: null, insight: 6, tech: 'language',
    desc: 'Where the wise gather to think and teach.', effect: '+6 insight / day (faster tech)' },
  dock:       { name: 'Dock',         icon: '⚓', cost: { wood: 16 },            work: 8,  mesh: null, produces: { food: 6 }, water: 'shore', tech: 'tools',
    desc: 'A pier for fishers. Must touch the water.', effect: '+6 food / day · enables ships' },
  ship:       { name: 'Fishing Ship', icon: '⛵', cost: { wood: 22 },            work: 10, mesh: 'ship', produces: { food: 9 }, water: 'water', needs: 'dock', tech: 'sailing',
    desc: 'A sailed canoe. Build on water near your dock.', effect: '+9 food / day from the deep' },
  house:      { name: 'Longhouse',    icon: '🏠', cost: { wood: 26, stone: 10 }, work: 14, mesh: 'house', shelter: 10, tech: 'pottery',
    desc: 'A great home for many families.', effect: 'Shelter for ~10 souls' },
  market:     { name: 'Market',       icon: '🛒', cost: { wood: 24, stone: 10 }, work: 12, mesh: 'market', produces: { food: 3, wood: 2, stone: 2 }, tech: 'pottery',
    desc: 'Traders barter surplus into plenty.', effect: '+3 food +2 wood +2 stone / day' },
  forge:      { name: 'Forge',        icon: '🔥', cost: { wood: 14, stone: 18 }, work: 12, mesh: 'forge', power: 1.3, tech: 'bronze',
    desc: 'Bronze and iron beaten into blades and tools.', effect: 'Warriors +30% strength' },
  wall:       { name: 'Stone Wall',   icon: '🏯', cost: { stone: 22 },           work: 10, mesh: 'wall', defense: 4, tech: 'masonry',
    desc: 'True masonry. Cities grow behind walls.', effect: '+4 defense' },
  workshop:   { name: 'Machina Workshop', icon: '⚙️', cost: { wood: 20, stone: 26 }, work: 16, mesh: 'workshop', insight: 10, produces: { wood: 3, stone: 3 }, tech: 'engineering',
    desc: 'Gears and steam — the future being invented.', effect: '+10 insight · +3 wood +3 stone / day' },
};
export const BUILD_ORDER = ['hut', 'house', 'well', 'storehouse', 'granary', 'farm', 'lodge', 'mine', 'market', 'forge', 'circle', 'dock', 'ship', 'totem', 'monument', 'palisade', 'wall', 'watchtower', 'workshop'];

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
