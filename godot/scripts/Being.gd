# An autonomous being — needs, personality, a daily routine, and a utility brain.
# Data + logic only; Main.gd owns the visual node. Mirrors the web build's being.js
# (a focused subset for the scaffold: needs, foraging, sleep, social, life arc).
class_name Being
extends RefCounted

static var NEXT_ID := 1

var id: int
var rng: RNG
var being_name: String
var sex: String                 # "f" / "m"
var tribe: Tribe

var pos: Vector3
var target: Vector3
var heading: float = 0.0
var moving: bool = false

var age: float
var alive: bool = true

var hunger: float
var energy: float
var social: float

var traits := {}                # brave/curious/kind/devout/social in [-1,1]
var hue: float
var build: float
var job: String = "forager"
var stage_cache := "adult"

var action: String = "idle"     # for the visual / label
var act_kind: String = ""       # internal target kind
var act_ref = null
var death_age: float
var think_t: float = 0.0

func _init(_rng: RNG, x: float, z: float, opts: Dictionary = {}) -> void:
	id = NEXT_ID
	NEXT_ID += 1
	rng = _rng
	being_name = opts.get("name", Names.being_name(rng))
	sex = opts.get("sex", "f" if rng.chance(0.5) else "m")
	pos = Vector3(x, 0, z)
	target = pos
	age = opts.get("age", rng.range_f(16.0, 40.0))
	hunger = rng.range_f(10.0, 40.0)
	energy = rng.range_f(60.0, 100.0)
	social = rng.range_f(40.0, 80.0)
	hue = opts.get("hue", rng.range_f(0.0, 1.0))
	build = opts.get("build", 1.0 + rng.gauss(0.0, 0.06))
	if opts.has("traits"):
		traits = opts.traits
	else:
		for k in ["brave", "curious", "kind", "devout", "social"]:
			traits[k] = clampf(rng.gauss(0.0, 0.5), -1.0, 1.0)
	death_age = Config.MAX_AGE + rng.gauss(0.0, 14.0)

func stage() -> String:
	if age < Config.CHILD_UNTIL: return "child"
	if age >= Config.ELDER_FROM: return "elder"
	return "adult"

func fertile() -> bool:
	return stage() == "adult" and age >= Config.FERTILE_FROM and age <= Config.FERTILE_UNTIL

func speed() -> float:
	var base := 42.0 if stage() == "child" else (46.0 if stage() == "elder" else 64.0)
	return base * (0.6 + 0.4 * (energy / 100.0))

# ---- per-step update; dd = in-game days elapsed ----
func update(dd: float, sim) -> void:
	if not alive: return
	age += dd / Config.YEAR_DAYS
	var hunger_rise: float = Config.HUNGER_RISE * (0.3 if stage() == "child" else 1.0)
	hunger = min(100.0, hunger + hunger_rise * dd)
	energy = max(0.0, energy - Config.ENERGY_FALL * dd)
	social = max(0.0, social - Config.SOCIAL_FALL * dd)

	think_t -= dd
	if think_t <= 0.0 or act_kind == "":
		think_t = rng.range_f(0.25, 0.6)
		_decide(sim)
	_move(dd, sim)
	_resolve(dd, sim)
	_check_life(dd, sim)

func _decide(sim) -> void:
	var tod: float = fmod(sim.day, 1.0)
	var night: bool = tod >= Config.SLEEP or tod < Config.DAWN
	if hunger > 78.0:
		_go_eat(sim); return
	if energy < 16.0 or night:
		_go_sleep(sim); return
	if stage() == "child":
		_go_play(sim); return
	if tod < Config.DUSK:
		# work: foragers/most jobs gather food in this scaffold
		if hunger > 45.0:
			_go_eat(sim)
		else:
			_go_forage(sim)
		return
	if social < 60.0:
		_go_social(sim); return
	_go_sleep(sim)

func _go_forage(sim) -> void:
	var bush = sim.nearest_bush(pos)
	if bush == null:
		_wander(sim); return
	act_kind = "forage"; act_ref = bush; target = bush.pos; action = "foraging"

func _go_eat(sim) -> void:
	if tribe and tribe.res.food >= 7.0:
		act_kind = "eatstore"; target = tribe.home; action = "eating"
	else:
		_go_forage(sim)

func _go_sleep(sim) -> void:
	act_kind = "sleep"; action = "sleeping"
	var h := tribe.home if tribe else Vector3.ZERO
	target = h + Vector3(rng.range_f(-3, 3), 0, rng.range_f(-3, 3))

func _go_social(sim) -> void:
	var other = sim.nearest_being(self, 26.0)
	if other:
		act_kind = "social"; act_ref = other; target = other.pos; action = "talking"
	else:
		_wander(sim)

func _go_play(sim) -> void:
	act_kind = "wander"; action = "playing"
	var h := tribe.home if tribe else Vector3.ZERO
	target = h + Vector3(rng.range_f(-7, 7), 0, rng.range_f(-7, 7))

func _wander(sim) -> void:
	act_kind = "wander"; action = "wandering"
	var ang := rng.range_f(0, TAU)
	var dist := rng.range_f(8, 26)
	var nx := pos.x + cos(ang) * dist
	var nz := pos.z + sin(ang) * dist
	if not sim.world.is_land(nx, nz):
		nx = tribe.home.x if tribe else 0.0
		nz = tribe.home.z if tribe else 0.0
	target = Vector3(nx, 0, nz)

func _move(dd: float, sim) -> void:
	var d := Vector2(target.x - pos.x, target.z - pos.z)
	var dist := d.length()
	if dist > 0.4:
		var step: float = min(dist, speed() * dd)
		var nx := pos.x + d.x / dist * step
		var nz := pos.z + d.y / dist * step
		if not sim.world.is_land(nx, nz):
			target = tribe.home if tribe else Vector3.ZERO
		else:
			pos.x = nx; pos.z = nz
			moving = true
			heading = atan2(d.y, d.x)
	else:
		moving = false
	pos.y = sim.world.height_at(pos.x, pos.z)

func _resolve(dd: float, sim) -> void:
	if act_kind == "": return
	var reached := Vector2(target.x - pos.x, target.z - pos.z).length() < 1.6
	match act_kind:
		"forage":
			if reached:
				var bush = act_ref
				if bush.berries > 0:
					var eaten := 0
					while bush.berries > 0 and eaten < 2 and hunger > 12.0:
						bush.berries -= 1; eaten += 1
						hunger = max(0.0, hunger - Config.EAT_GAIN * 0.55)
					action = "eating"
				act_kind = ""; think_t = 0.0
		"eatstore":
			if reached:
				if tribe and tribe.res.food >= 7.0:
					tribe.res.food -= 7.0
					hunger = max(0.0, hunger - Config.EAT_GAIN)
				act_kind = ""; think_t = rng.range_f(0.2, 0.5)
		"sleep":
			energy = min(100.0, energy + Config.REST_GAIN * dd * 2.2)
			var tod: float = fmod(sim.day, 1.0)
			if energy > 94.0 and tod > Config.DAWN and tod < Config.SLEEP:
				act_kind = ""; think_t = 0.0
		"social":
			if reached:
				social = min(100.0, social + 45.0)
				act_kind = ""; think_t = rng.range_f(0.3, 0.7)
		"wander":
			if reached:
				act_kind = ""; think_t = 0.0

func _check_life(dd: float, sim) -> void:
	if age >= death_age and rng.chance(0.25 * dd + 0.004):
		alive = false
		sim.on_death(self, "old age")
