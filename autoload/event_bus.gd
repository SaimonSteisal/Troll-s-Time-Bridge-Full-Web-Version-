extends Node

signal run_started(seed: int, chapter: int)
signal chapter_changed(chapter: int)
signal maze_generated(width: int, height: int)
signal bridge_entered(from_cell: Vector2i, to_cell: Vector2i)
signal time_portal_used(portal_id: StringName, target_chapter: int)
signal player_health_changed(current_health: int, max_health: int)
signal inventory_changed(item_ids: Array[StringName])
signal skill_unlocked(skill_id: StringName)
signal run_ended(victory: bool)

func emit_run_started(seed: int, chapter: int) -> void:
	run_started.emit(seed, chapter)

func emit_chapter_changed(chapter: int) -> void:
	chapter_changed.emit(chapter)

func emit_maze_generated(width: int, height: int) -> void:
	maze_generated.emit(width, height)

func emit_bridge_entered(from_cell: Vector2i, to_cell: Vector2i) -> void:
	bridge_entered.emit(from_cell, to_cell)

func emit_time_portal_used(portal_id: StringName, target_chapter: int) -> void:
	time_portal_used.emit(portal_id, target_chapter)

func emit_player_health_changed(current_health: int, max_health: int) -> void:
	player_health_changed.emit(current_health, max_health)

func emit_inventory_changed(item_ids: Array[StringName]) -> void:
	inventory_changed.emit(item_ids)

func emit_skill_unlocked(skill_id: StringName) -> void:
	skill_unlocked.emit(skill_id)

func emit_run_ended(victory: bool) -> void:
	run_ended.emit(victory)
