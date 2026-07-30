# 🌉 Troll's Time Bridge

**Troll's Time Bridge** — 2D roguelike про тролля-похитителя коз, который проходит главами процедурный мост-лабиринт, прыгает между мостами и использует временные порталы.

## 🚀 Текущее состояние: Godot 4.6 Full-Version Scaffold

Репозиторий переведен с описания старого HTML5/Phaser MVP на Godot 4.6-ориентированную структуру полной версии. Добавлен запускаемый каркас архитектуры: глобальный Event Bus, состояние забега, генератор лабиринта, контроллер сцены, игрок и HUD.

## 🛠 Технологический стек

* **Engine:** Godot 4.6
* **Language:** GDScript со статической типизацией
* **Architecture:** Event Bus + Resource-backed game state + Scene Controller + MVVM-style UI views
* **Platform:** Web/Desktop-first с масштабируемой 2D-сценой

## 📂 Структура проекта

```text
Troll-s-Time-Bridge-Full-Web-Version-/
├── project.godot
├── autoload/
│   └── event_bus.gd
├── scripts/
│   ├── core/
│   │   ├── game_controller.gd
│   │   ├── game_state.gd
│   │   └── run_profile.gd
│   ├── entities/
│   │   └── troll_player.gd
│   ├── generation/
│   │   └── maze_generator.gd
│   └── ui/
│       └── hud_view.gd
└── scenes/
    ├── entities/TrollPlayer.tscn
    ├── game/GameRoot.tscn
    └── ui/Hud.tscn
```

## 🧱 Архитектура полной версии

### 1. Architecture & Approach

* **Event Bus Autoload** (`EventBus`) декуплирует генерацию, игрока, UI, инвентарь, скиллы и прогресс глав.
* **Resource-backed Run State** (`RunProfile`) хранит seed, главу, здоровье, инвентарь и разблокированные навыки без привязки к сценам.
* **Scene Controller** (`GameController`) оркестрирует текущий забег и остается тонким фасадом между моделью, генератором и сценой.
* **MVVM-style HUD View** (`HudView`) подписывается на события и отвечает только за визуализацию и Tween-анимации.
* **Procedural DFS Maze Generator** (`MazeGenerator`) изолирован в Resource, чтобы его можно было тестировать и заменять без переписывания сцены.

### 2. Scene Tree Hierarchy

```text
GameRoot (Node2D)
├── MazeRoot (Node2D)
├── TrollPlayer (CharacterBody2D)
│   ├── Body (ColorRect)
│   └── CollisionShape2D (CollisionShape2D)
└── Hud (CanvasLayer)
    └── Root (Control)
        ├── ChapterLabel (Label)
        ├── HealthLabel (Label)
        └── ToastLabel (Label)
```

### 3. Implementation Notes

1. Откройте `project.godot` в Godot 4.6.
2. Запустите главную сцену `res://scenes/game/GameRoot.tscn`.
3. Управляйте троллем стрелками или стандартными `ui_*` действиями.
4. Коричневые клетки — мостовые телепорты, фиолетовые — временные порталы, зеленая — выход.

### 4. Game Design Check

Каркас поддерживает roguelike feel через seed-based генерацию, мгновенную обратную связь HUD, безопасные точки расширения для инвентаря/скиллов и chapter escalation через порталы времени. Следующий слой должен добавить пул врагов, таблицы наград, комнаты-события и data-driven skill tree.
