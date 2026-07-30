class_name RunProfile
extends Resource

@export var seed: int = 0
@export var chapter: int = 1
@export var max_health: int = 100
@export var current_health: int = 100
@export var stolen_goats: int = 0
@export var unlocked_skills: Array[StringName] = []
@export var inventory: Array[StringName] = []

func reset(new_seed: int, starting_chapter: int) -> void:
	seed = new_seed
	chapter = starting_chapter
	current_health = max_health
	stolen_goats = 0
	unlocked_skills.clear()
	inventory.clear()
