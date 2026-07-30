extends Node

var profile: RunProfile = RunProfile.new()
var _rng: RandomNumberGenerator = RandomNumberGenerator.new()

func start_run(seed: int = 0, starting_chapter: int = 1) -> void:
	var resolved_seed: int = seed
	if resolved_seed == 0:
		resolved_seed = int(Time.get_unix_time_from_system())
	_rng.seed = resolved_seed
	profile.reset(resolved_seed, starting_chapter)
	EventBus.emit_run_started(profile.seed, profile.chapter)
	EventBus.emit_player_health_changed(profile.current_health, profile.max_health)

func change_chapter(next_chapter: int) -> void:
	profile.chapter = max(next_chapter, 1)
	EventBus.emit_chapter_changed(profile.chapter)

func apply_damage(amount: int) -> void:
	if amount <= 0:
		return
	profile.current_health = maxi(profile.current_health - amount, 0)
	EventBus.emit_player_health_changed(profile.current_health, profile.max_health)
	if profile.current_health == 0:
		EventBus.emit_run_ended(false)

func heal(amount: int) -> void:
	if amount <= 0:
		return
	profile.current_health = mini(profile.current_health + amount, profile.max_health)
	EventBus.emit_player_health_changed(profile.current_health, profile.max_health)

func add_item(item_id: StringName) -> void:
	profile.inventory.append(item_id)
	EventBus.emit_inventory_changed(profile.inventory.duplicate())

func unlock_skill(skill_id: StringName) -> void:
	if profile.unlocked_skills.has(skill_id):
		return
	profile.unlocked_skills.append(skill_id)
	EventBus.emit_skill_unlocked(skill_id)

func roll_int(min_value: int, max_value: int) -> int:
	return _rng.randi_range(min_value, max_value)
