# Procedural island: heightmap + radial falloff + climate (temperature x moisture)
# biomes. Mirrors the web build's world.js. Holds harvestable bushes too.
class_name WorldGen
extends RefCounted

var size: float = Config.WORLD_SIZE
var seg: int = Config.WORLD_SEG
var rng: RNG
var h: PackedFloat32Array          # heights, (seg+1)^2
var biome: PackedByteArray         # biome ids
var bushes: Array = []             # [{pos:Vector3, berries:int, max:int, regrow:float}]

func _init(_rng: RNG) -> void:
	rng = _rng
	_generate()
	_scatter_food()

func _idx(ix: int, iy: int) -> int:
	return iy * (seg + 1) + ix

func _generate() -> void:
	var n := seg
	h = PackedFloat32Array()
	biome = PackedByteArray()
	h.resize((n + 1) * (n + 1))
	biome.resize((n + 1) * (n + 1))

	var height_noise := FastNoiseLite.new()
	height_noise.seed = rng.s
	height_noise.noise_type = FastNoiseLite.TYPE_SIMPLEX
	height_noise.frequency = 0.9
	height_noise.fractal_octaves = 5
	height_noise.fractal_gain = 0.5

	var moist_noise := FastNoiseLite.new()
	moist_noise.seed = rng.s ^ 0x9e3779b9
	moist_noise.noise_type = FastNoiseLite.TYPE_SIMPLEX
	moist_noise.frequency = 1.4

	for iy in range(n + 1):
		for ix in range(n + 1):
			var nx := float(ix) / n
			var ny := float(iy) / n
			var e := (height_noise.get_noise_2d(nx, ny) + 1.0) * 0.5
			# radial island falloff
			var dx := nx - 0.5
			var dy := ny - 0.5
			var d := sqrt(dx * dx + dy * dy) * 2.0
			var fall := pow(max(0.0, 1.0 - d * 0.95), Config.ISLAND_FALLOFF)
			e = e * fall - (1.0 - fall) * 0.35
			var height := e * Config.MAX_HEIGHT
			var id := _idx(ix, iy)
			h[id] = height
			var temp := clampf(ny - maxf(0.0, height) / Config.MAX_HEIGHT * 0.6 + 0.04, 0.0, 1.0)
			var moist := (moist_noise.get_noise_2d(nx, ny) + 1.0) * 0.5
			biome[id] = _biome_for(height, temp, moist)

func _biome_for(height: float, temp: float, moist: float) -> int:
	if height <= Config.SEA_LEVEL: return Config.Biome.OCEAN
	if height < 0.5: return Config.Biome.BEACH
	if height > Config.MAX_HEIGHT * 0.62: return Config.Biome.SNOW
	if height > Config.MAX_HEIGHT * 0.42:
		return Config.Biome.SNOW if temp < 0.32 else Config.Biome.ROCK
	if temp < 0.28:
		return Config.Biome.TAIGA if moist > 0.5 else Config.Biome.TUNDRA
	if temp < 0.55:
		return Config.Biome.FOREST if moist > 0.55 else Config.Biome.GRASS
	return Config.Biome.JUNGLE if moist > 0.62 else (Config.Biome.SAVANNA if moist > 0.34 else Config.Biome.DESERT)

func height_at(x: float, z: float) -> float:
	var n := seg
	var u := (x / size + 0.5) * n
	var v := (z / size + 0.5) * n
	var ix := clampi(int(floor(u)), 0, n - 1)
	var iy := clampi(int(floor(v)), 0, n - 1)
	var fx := u - ix
	var fz := v - iy
	var a := h[_idx(ix, iy)]
	var b := h[_idx(ix + 1, iy)]
	var c := h[_idx(ix, iy + 1)]
	var dd := h[_idx(ix + 1, iy + 1)]
	return lerp(lerp(a, b, fx), lerp(c, dd, fx), fz)

func biome_at(x: float, z: float) -> int:
	var n := seg
	var ix := clampi(int(round((x / size + 0.5) * n)), 0, n)
	var iy := clampi(int(round((z / size + 0.5) * n)), 0, n)
	return biome[_idx(ix, iy)]

func is_land(x: float, z: float) -> bool:
	return height_at(x, z) > Config.SEA_LEVEL + 0.05

func _is_grassy(b: int) -> bool:
	return b == Config.Biome.GRASS or b == Config.Biome.SAVANNA \
		or b == Config.Biome.FOREST or b == Config.Biome.JUNGLE

func _scatter_food() -> void:
	var tries := 0
	while bushes.size() < Config.BUSH_COUNT and tries < Config.BUSH_COUNT * 30:
		tries += 1
		var x := rng.range_f(-size / 2.0, size / 2.0)
		var z := rng.range_f(-size / 2.0, size / 2.0)
		if _is_grassy(biome_at(x, z)):
			bushes.append({
				"pos": Vector3(x, height_at(x, z), z),
				"berries": rng.range_i(2, Config.BUSH_MAX),
				"max": Config.BUSH_MAX, "regrow": 0.0,
			})

func spawn_point() -> Vector3:
	for i in 400:
		var x := rng.range_f(-size * 0.34, size * 0.34)
		var z := rng.range_f(-size * 0.34, size * 0.34)
		var hh := height_at(x, z)
		if hh > 0.4 and hh < 4.0:
			return Vector3(x, hh, z)
	return Vector3(0, height_at(0, 0), 0)

func spawn_in_biome(biome_name: String, avoid: Array, min_dist: float) -> Vector3:
	var want := {
		"grass": Config.Biome.GRASS, "beach": Config.Biome.BEACH, "forest": Config.Biome.FOREST,
		"rock": Config.Biome.ROCK, "desert": Config.Biome.DESERT, "savanna": Config.Biome.SAVANNA,
		"jungle": Config.Biome.JUNGLE, "taiga": Config.Biome.TAIGA, "tundra": Config.Biome.TUNDRA,
	}.get(biome_name, Config.Biome.GRASS)
	var fallback: Variant = null
	for i in 1500:
		var x := rng.range_f(-size * 0.4, size * 0.4)
		var z := rng.range_f(-size * 0.4, size * 0.4)
		var hh := height_at(x, z)
		if hh <= 0.35 or hh > 7.0:
			continue
		var too_close := false
		for p in avoid:
			if Vector2(p.x - x, p.z - z).length() < min_dist:
				too_close = true
				break
		if too_close:
			continue
		if fallback == null:
			fallback = Vector3(x, hh, z)
		if biome_at(x, z) == want:
			return Vector3(x, hh, z)
	return fallback if fallback != null else spawn_point()
