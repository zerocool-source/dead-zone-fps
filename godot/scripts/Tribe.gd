# A people of one race with their own home, stockpile, and leader.
class_name Tribe
extends RefCounted

var id: int
var race_key: String
var race: Dictionary
var tribe_name: String
var home: Vector3
var hue: float
var res := {"food": 30.0, "wood": 12.0, "stone": 5.0}
var leader_id: int = -1

func _init(_id: int, _race_key: String, _race: Dictionary, _home: Vector3, rng: RNG) -> void:
	id = _id
	race_key = _race_key
	race = _race
	home = _home
	hue = float(_race.hue) + rng.gauss(0.0, 0.01)
	tribe_name = Names.tribe_name(rng)
