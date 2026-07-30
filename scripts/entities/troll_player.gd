class_name TrollPlayer
extends CharacterBody2D

signal cell_changed(cell: Vector2i)

@export var movement_speed: float = 180.0
@export var grid_size: int = 32

var current_cell: Vector2i = Vector2i.ZERO
var _input_vector: Vector2 = Vector2.ZERO

func _ready() -> void:
	_update_cell_from_position()

func _physics_process(delta: float) -> void:
	_read_input()
	velocity = _input_vector * movement_speed
	move_and_slide()
	_update_cell_from_position()

func teleport_to_cell(cell: Vector2i) -> void:
	current_cell = cell
	global_position = Vector2(cell * grid_size) + Vector2(float(grid_size) * 0.5, float(grid_size) * 0.5)
	cell_changed.emit(current_cell)

func _read_input() -> void:
	_input_vector = Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")

func _update_cell_from_position() -> void:
	var next_cell: Vector2i = Vector2i(floori(global_position.x / float(grid_size)), floori(global_position.y / float(grid_size)))
	if next_cell == current_cell:
		return
	current_cell = next_cell
	cell_changed.emit(current_cell)
