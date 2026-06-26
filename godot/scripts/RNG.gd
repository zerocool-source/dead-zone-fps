# Deterministic, seedable PRNG (mulberry32) — parity with the web build's rng.js,
# so a seed grows the same world in both engines.
class_name RNG
extends RefCounted

var s: int = 1

func _init(seed: int = 1) -> void:
	s = seed & 0xFFFFFFFF

func next() -> float:
	s = (s + 0x6D2B79F5) & 0xFFFFFFFF
	var t := s
	t = (t ^ (t >> 15)) * (t | 1) & 0xFFFFFFFF
	t = (t + ((t ^ (t >> 7)) * (t | 61) & 0xFFFFFFFF)) & 0xFFFFFFFF
	t = t ^ (t >> 14)
	return float(t & 0xFFFFFFFF) / 4294967296.0

func range_f(a: float, b: float) -> float:
	return a + (b - a) * next()

func range_i(a: int, b: int) -> int:
	return int(floor(range_f(a, b + 1)))

func pick(arr: Array):
	return arr[int(floor(next() * arr.size()))]

func chance(p: float) -> bool:
	return next() < p

func gauss(mean: float = 0.0, sd: float = 1.0) -> float:
	var sum := 0.0
	for i in 4:
		sum += next()
	return mean + (sum - 2.0) / 0.816 * sd

static func hash_seed(str: String) -> int:
	var h := 2166136261
	for i in str.length():
		h = (h ^ str.unicode_at(i)) & 0xFFFFFFFF
		h = (h * 16777619) & 0xFFFFFFFF
	return h
