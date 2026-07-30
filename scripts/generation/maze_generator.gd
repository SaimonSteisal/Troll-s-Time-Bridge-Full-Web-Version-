class_name MazeGenerator
extends Resource

enum CellType { WALL, FLOOR, BRIDGE, PORTAL, EXIT }

@export var width: int = 31
@export var height: int = 21

var cells: Array[Array] = []
var bridge_links: Dictionary = {}

func generate(seed: int, chapter: int) -> Array[Array]:
	var rng: RandomNumberGenerator = RandomNumberGenerator.new()
	rng.seed = seed + (chapter * 7919)
	var safe_width: int = _make_odd(maxi(width, 9))
	var safe_height: int = _make_odd(maxi(height, 9))
	cells = _filled_grid(safe_width, safe_height, CellType.WALL)
	bridge_links.clear()
	_carve_depth_first(Vector2i(1, 1), rng)
	_place_special_cells(rng, chapter)
	EventBus.emit_maze_generated(safe_width, safe_height)
	return cells

func get_cell(cell: Vector2i) -> CellType:
	if cell.y < 0 or cell.y >= cells.size():
		return CellType.WALL
	var row: Array = cells[cell.y]
	if cell.x < 0 or cell.x >= row.size():
		return CellType.WALL
	return row[cell.x] as CellType

func is_walkable(cell: Vector2i) -> bool:
	var type: CellType = get_cell(cell)
	return type != CellType.WALL

func _filled_grid(grid_width: int, grid_height: int, type: CellType) -> Array[Array]:
	var grid: Array[Array] = []
	for y: int in range(grid_height):
		var row: Array[CellType] = []
		for x: int in range(grid_width):
			row.append(type)
		grid.append(row)
	return grid

func _carve_depth_first(start: Vector2i, rng: RandomNumberGenerator) -> void:
	var stack: Array[Vector2i] = [start]
	_set_cell(start, CellType.FLOOR)
	while not stack.is_empty():
		var current: Vector2i = stack.back()
		var neighbors: Array[Vector2i] = _unvisited_neighbors(current)
		if neighbors.is_empty():
			stack.pop_back()
			continue
		var next: Vector2i = neighbors[rng.randi_range(0, neighbors.size() - 1)]
		var between: Vector2i = current + ((next - current) / 2)
		_set_cell(between, CellType.FLOOR)
		_set_cell(next, CellType.FLOOR)
		stack.append(next)

func _unvisited_neighbors(cell: Vector2i) -> Array[Vector2i]:
	var offsets: Array[Vector2i] = [Vector2i(2, 0), Vector2i(-2, 0), Vector2i(0, 2), Vector2i(0, -2)]
	var result: Array[Vector2i] = []
	for offset: Vector2i in offsets:
		var candidate: Vector2i = cell + offset
		if candidate.x <= 0 or candidate.y <= 0:
			continue
		if candidate.y >= cells.size() - 1 or candidate.x >= cells[0].size() - 1:
			continue
		if get_cell(candidate) == CellType.WALL:
			result.append(candidate)
	return result

func _place_special_cells(rng: RandomNumberGenerator, chapter: int) -> void:
	var floors: Array[Vector2i] = _collect_floor_cells()
	if floors.size() < 4:
		return
	var exit_cell: Vector2i = floors.back()
	_set_cell(exit_cell, CellType.EXIT)
	var portal_count: int = mini(1 + int(chapter / 2), 4)
	for index: int in range(portal_count):
		var portal_cell: Vector2i = floors[rng.randi_range(0, floors.size() - 1)]
		_set_cell(portal_cell, CellType.PORTAL)
	var bridge_a: Vector2i = floors[rng.randi_range(0, floors.size() - 1)]
	var bridge_b: Vector2i = floors[rng.randi_range(0, floors.size() - 1)]
	_set_cell(bridge_a, CellType.BRIDGE)
	_set_cell(bridge_b, CellType.BRIDGE)
	bridge_links[bridge_a] = bridge_b
	bridge_links[bridge_b] = bridge_a

func _collect_floor_cells() -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	for y: int in range(cells.size()):
		for x: int in range(cells[y].size()):
			if get_cell(Vector2i(x, y)) == CellType.FLOOR:
				result.append(Vector2i(x, y))
	return result

func _set_cell(cell: Vector2i, type: CellType) -> void:
	cells[cell.y][cell.x] = type

func _make_odd(value: int) -> int:
	if value % 2 == 0:
		return value + 1
	return value
