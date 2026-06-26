# Procedural naming — parity with the web build's names.js.
class_name Names
extends RefCounted

const ONSET := ["", "k", "t", "m", "n", "s", "r", "l", "v", "th", "sh", "br", "dr", "g", "p", "h", "w", "y"]
const VOWEL := ["a", "e", "i", "o", "u", "a", "e", "i", "ae", "oo", "ou"]
const CODA := ["", "", "n", "r", "l", "s", "k", "m", "th"]
const TRIBE_A := ["Sun", "River", "Stone", "Ash", "Dawn", "Cinder", "Salt", "Reed", "Elder", "Hollow"]
const TRIBE_B := ["folk", "kin", "born", "walkers", "children", "people", "tribe", "wardens"]

static func being_name(rng: RNG) -> String:
	var syl := rng.range_i(2, 3)
	var out := ""
	for i in syl:
		out += rng.pick(ONSET) + rng.pick(VOWEL)
		if i == syl - 1:
			out += rng.pick(CODA)
	return out.substr(0, 1).to_upper() + out.substr(1)

static func tribe_name(rng: RNG) -> String:
	return str(rng.pick(TRIBE_A)) + str(rng.pick(TRIBE_B))
