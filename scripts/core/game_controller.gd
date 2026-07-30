class_name GameController
extends Node2D

@export var maze_generator: MazeGenerator = MazeGenerator.new()
@export var tile_size: int = 32
@onready var player: TrollPlayer = %TrollPlayer
@onready var maze_root: Node2D = %MazeRoot

var _active_cells: Array[Array] = []

func _ready() -> void:
	player.cell_changed.connect(_on_player_cell_changed)
	EventBus.run_started.connect(_on_run_started)
	GameState.start_run()

func _on_run_started(seed: int, chapter: int) -> void:
	_active_cells = maze_generator.generate(seed, chapter)
	_render_debug_maze()
	player.teleport_to_cell(Vector2i(1, 1))

func _on_player_cell_changed(cell: Vector2i) -> void:
	var cell_type: MazeGenerator.CellType = maze_generator.get_cell(cell)
	if cell_type == MazeGenerator.CellType.BRIDGE and maze_generator.bridge_links.has(cell):
		var target_cell: Vector2i = maze_generator.bridge_links[cell]
		EventBus.emit_bridge_entered(cell, target_cell)
		player.teleport_to_cell(target_cell)
	elif cell_type == MazeGenerator.CellType.PORTAL:
		var next_chapter: int = GameState.profile.chapter + 1
		EventBus.emit_time_portal_used(&"maze_portal", next_chapter)
		GameState.change_chapter(next_chapter)
		_active_cells = maze_generator.generate(GameState.profile.seed, next_chapter)
		_render_debug_maze()
		player.teleport_to_cell(Vector2i(1, 1))
	elif cell_type == MazeGenerator.CellType.EXIT:
		EventBus.emit_run_ended(true)

func _render_debug_maze() -> void:
	for child: Node in maze_root.get_children():
		child.queue_free()
	for y: int in range(_active_cells.size()):
		var row: Array = _active_cells[y]
		for x: int in range(row.size()):
			var rect: ColorRect = ColorRect.new()
			rect.position = Vector2(float(x * tile_size), float(y * tile_size))
			rect.size = Vector2(float(tile_size), float(tile_size))
			rect.color = _color_for_cell(row[x] as MazeGenerator.CellType)
			maze_root.add_child(rect)

func _color_for_cell(type: MazeGenerator.CellType) -> Color:
	match type:
		MazeGenerator.CellType.WALL:
			return Color(0.05, 0.05, 0.07)
		MazeGenerator.CellType.BRIDGE:
			return Color(0.55, 0.28, 0.10)
		MazeGenerator.CellType.PORTAL:
			return Color(0.28, 0.11, 0.70)
		MazeGenerator.CellType.EXIT:
			return Color(0.10, 0.70, 0.22)
		_:
			return Color(0.18, 0.18, 0.22)
