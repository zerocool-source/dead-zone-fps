# Global tuning constants — the Godot mirror of the web build's config.js.
# Registered as an autoload singleton, so access anywhere as `Config.WORLD_SIZE`, etc.
extends Node

# ---- world ----
const WORLD_SIZE := 640.0          # world units across (massive continent)
const WORLD_SEG := 200             # terrain grid resolution (Godot handles this fine)
const SEA_LEVEL := 0.0
const MAX_HEIGHT := 30.0
const ISLAND_FALLOFF := 1.25

# ---- time ----
const DAY_SECONDS := 55.0          # one in-game day at 1x
const YEAR_DAYS := 30.0
const TIME_SCALES := [0.0, 1.0, 4.0, 16.0, 70.0]
const TIME_LABELS := ["Paused", "Lived", "Days", "Seasons", "Ages"]
const DAWN := 0.22
const DUSK := 0.74
const SLEEP := 0.86

# ---- needs (per in-game day) ----
const HUNGER_RISE := 22.0
const ENERGY_FALL := 18.0
const SOCIAL_FALL := 12.0
const EAT_GAIN := 60.0
const REST_GAIN := 55.0

# ---- life (years / days) ----
const CHILD_UNTIL := 14.0
const ELDER_FROM := 52.0
const MAX_AGE := 72.0
const FERTILE_FROM := 16.0
const FERTILE_UNTIL := 45.0
const GESTATION_DAYS := 6.0
const MATE_COOLDOWN_DAYS := 8.0

# ---- population / tribes ----
const TRIBE_COUNT := 6
const START_POP := 9
const SOFT_CAP := 70

# ---- food ----
const BUSH_COUNT := 420
const BUSH_MAX := 5
const REGROW_DAYS := 2.5

# Playable races. `mesh` is the GLB stem under assets/models; `biome` is the
# preferred homeland; `hue` tints the lineage; `build` scales size.
const RACES := {
	"dawnfolk":  {"name": "Dawnfolk",  "mesh": "being", "hue": 0.07, "build": 1.00, "biome": "grass"},
	"emberfolk": {"name": "Emberfolk", "mesh": "ember", "hue": 0.03, "build": 0.94, "biome": "desert"},
	"frostborn": {"name": "Frostborn", "mesh": "frost", "hue": 0.60, "build": 1.14, "biome": "taiga"},
	"thornkin":  {"name": "Thornkin",  "mesh": "thorn", "hue": 0.32, "build": 1.05, "biome": "jungle"},
}

# biome ids
enum Biome { OCEAN, BEACH, DESERT, SAVANNA, GRASS, FOREST, JUNGLE, TAIGA, TUNDRA, SNOW, ROCK }

const BIOME_COLOR := {
	Biome.OCEAN:   Color(0.05, 0.18, 0.32),
	Biome.BEACH:   Color(0.80, 0.73, 0.50),
	Biome.DESERT:  Color(0.82, 0.69, 0.40),
	Biome.SAVANNA: Color(0.58, 0.55, 0.27),
	Biome.GRASS:   Color(0.34, 0.50, 0.23),
	Biome.FOREST:  Color(0.18, 0.36, 0.17),
	Biome.JUNGLE:  Color(0.12, 0.32, 0.14),
	Biome.TAIGA:   Color(0.24, 0.36, 0.30),
	Biome.TUNDRA:  Color(0.55, 0.58, 0.55),
	Biome.SNOW:    Color(0.92, 0.94, 0.97),
	Biome.ROCK:    Color(0.42, 0.40, 0.38),
}
