class_name HudView
extends CanvasLayer

@onready var chapter_label: Label = %ChapterLabel
@onready var health_label: Label = %HealthLabel
@onready var toast_label: Label = %ToastLabel

var _toast_tween: Tween

func _ready() -> void:
	EventBus.chapter_changed.connect(_on_chapter_changed)
	EventBus.player_health_changed.connect(_on_player_health_changed)
	EventBus.bridge_entered.connect(_on_bridge_entered)
	EventBus.time_portal_used.connect(_on_time_portal_used)
	EventBus.run_ended.connect(_on_run_ended)
	toast_label.modulate.a = 0.0

func _on_chapter_changed(chapter: int) -> void:
	chapter_label.text = "Chapter %d" % chapter
	_play_pulse(chapter_label)

func _on_player_health_changed(current_health: int, max_health: int) -> void:
	health_label.text = "HP %d/%d" % [current_health, max_health]
	_play_pulse(health_label)

func _on_bridge_entered(from_cell: Vector2i, to_cell: Vector2i) -> void:
	_show_toast("Bridge jump: %s → %s" % [from_cell, to_cell])

func _on_time_portal_used(portal_id: StringName, target_chapter: int) -> void:
	_show_toast("%s opened Chapter %d" % [String(portal_id), target_chapter])

func _on_run_ended(victory: bool) -> void:
	if victory:
		_show_toast("The troll escapes with the goats!")
	else:
		_show_toast("The bridge claims the troll...")

func _play_pulse(control: Control) -> void:
	var tween: Tween = create_tween()
	control.scale = Vector2.ONE
	tween.tween_property(control, "scale", Vector2(1.08, 1.08), 0.08)
	tween.tween_property(control, "scale", Vector2.ONE, 0.12)

func _show_toast(message: String) -> void:
	if is_instance_valid(_toast_tween):
		_toast_tween.kill()
	toast_label.text = message
	toast_label.modulate.a = 0.0
	_toast_tween = create_tween()
	_toast_tween.tween_property(toast_label, "modulate:a", 1.0, 0.15)
	_toast_tween.tween_interval(1.4)
	_toast_tween.tween_property(toast_label, "modulate:a", 0.0, 0.25)
