# The Simulation — owns the world, all beings, the tribes, time, reproduction, and
# death. Engine-agnostic logic (no nodes here); Main.gd renders from this state.
# A focused port of the web build's sim.js for the Godot scaffold.
class_name Sim
extends RefCounted

var rng: RNG
var world: WorldGen
var day: float = 0.0
var year: int = 0
var speed_index: int = 1
var beings: Array = []
var tribes: Array = []
var births: int = 0
var deaths: int = 0
var _job_timer: float = 0.0
var log_lines: Array = []     # recent chronicle strings

func _init(seed_str: String = "pangaea") -> void:
	rng = RNG.new(RNG.hash_seed(seed_str))
	world = WorldGen.new(rng)
	_seed_tribes()
	_log("Across a new world, %d peoples open their eyes." % tribes.size())

func _seed_tribes() -> void:
	var keys := Config.RACES.keys()
	var chosen := []
	while chosen.size() < Config.TRIBE_COUNT:
		if chosen.size() < keys.size():
			chosen.append(keys[chosen.size()])
		else:
			chosen.append(keys[rng.range_i(0, keys.size() - 1)])
	var homes := []
	var tid := 1
	for key in chosen:
		var race: Dictionary = Config.RACES[key]
		var home := world.spawn_in_biome(race.biome, homes, Config.WORLD_SIZE * 0.18)
		homes.append(home)
		var tribe := Tribe.new(tid, key, race, home, rng)
		tid += 1
		tribes.append(tribe)
		_seed_members(tribe)
		_log("The %s settle the %s." % [tribe.tribe_name, race.biome])

func _seed_members(tribe: Tribe) -> void:
	var jobs := ["forager", "hunter", "woodcutter", "builder", "forager", "miner"]
	for i in Config.START_POP:
		var ang := rng.range_f(0, TAU)
		var r := rng.range_f(2, 12)
		var x := tribe.home.x + cos(ang) * r
		var z := tribe.home.z + sin(ang) * r
		if not world.is_land(x, z):
			x = tribe.home.x; z = tribe.home.z
		var b := Being.new(rng, x, z, {
			"hue": tribe.hue + rng.gauss(0.0, 0.012),
			"build": float(tribe.race.build) + rng.gauss(0.0, 0.05),
		})
		b.tribe = tribe
		b.job = jobs[i % jobs.size()]
		beings.append(b)

func speed() -> float:
	return Config.TIME_SCALES[speed_index]

func set_speed(i: int) -> void:
	speed_index = clampi(i, 0, Config.TIME_SCALES.size() - 1)

func members_of(tribe: Tribe) -> Array:
	return beings.filter(func(b): return b.tribe == tribe)

# ---- main tick ----
func update(dt_real: float) -> void:
	var dt: float = min(dt_real, 0.05)
	var sp := speed()
	if sp == 0.0:
		return
	var total := (dt * sp) / Config.DAY_SECONDS
	var remaining := total
	var guard := 0
	while remaining > 1e-5 and guard < 16:
		var dd: float = min(0.12, remaining)
		remaining -= dd
		guard += 1
		day += dd
		var ny := int(floor(day / Config.YEAR_DAYS))
		if ny != year:
			year = ny
		for b in beings:
			b.update(dd, self)
		_food(dd)
		_reproduce(dd)
	# cull dead
	beings = beings.filter(func(b): return b.alive)

func _food(dd: float) -> void:
	var rate := dd / Config.REGROW_DAYS
	for bush in world.bushes:
		if bush.berries < bush.max:
			bush.regrow += rate
			if bush.regrow >= 1.0:
				bush.berries += 1
				bush.regrow = 0.0

func _reproduce(dd: float) -> void:
	for tribe in tribes:
		var members := members_of(tribe)
		if members.size() >= Config.SOFT_CAP:
			continue
		if not rng.chance(0.25 * dd):
			continue
		var mothers := members.filter(func(b): return b.alive and b.sex == "f" and b.fertile())
		if mothers.is_empty():
			continue
		var mother = mothers[rng.range_i(0, mothers.size() - 1)]
		# find a nearby fertile male of the same tribe
		var father = null
		for b in members:
			if b.sex == "m" and b.fertile() and b.pos.distance_to(mother.pos) < 30.0:
				father = b
				break
		var traits := {}
		for k in ["brave", "curious", "kind", "devout", "social"]:
			var fa: float = mother.traits[k]
			var fb: float = father.traits[k] if father else 0.0
			traits[k] = clampf((fa + fb) / 2.0 + rng.gauss(0.0, 0.22), -1.0, 1.0)
		var hue := (mother.hue + (father.hue if father else mother.hue)) / 2.0 + rng.gauss(0.0, 0.02)
		var build := (mother.build + (father.build if father else mother.build)) / 2.0 + rng.gauss(0.0, 0.04)
		var child := Being.new(rng, mother.pos.x + rng.range_f(-1, 1), mother.pos.z + rng.range_f(-1, 1), {
			"age": 0.0, "traits": traits, "hue": hue, "build": build,
		})
		child.tribe = tribe
		child.hunger = 30.0
		child.energy = 90.0
		beings.append(child)
		births += 1

func on_death(b, cause: String) -> void:
	deaths += 1
	if members_of(b.tribe).size() <= 30 or rng.chance(0.2):
		_log("%s dies of %s at %d." % [b.being_name, cause, int(b.age)])

# ---- queries used by beings ----
func nearest_bush(p: Vector3):
	var best = null
	var bd := INF
	for bush in world.bushes:
		if bush.berries <= 0:
			continue
		var d: float = p.distance_squared_to(bush.pos)
		if d < bd:
			bd = d; best = bush
	return best

func nearest_being(b, radius: float):
	var best = null
	var bd := radius * radius
	for o in beings:
		if o == b or not o.alive:
			continue
		var d: float = b.pos.distance_squared_to(o.pos)
		if d < bd:
			bd = d; best = o
	return best

func _log(s: String) -> void:
	log_lines.append("Y%d  %s" % [year, s])
	if log_lines.size() > 40:
		log_lines.pop_front()
