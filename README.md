# 🌉 Troll's Time Bridge

**Troll's Time Bridge** — это динамичный 2D Roguelike на базе HTML5 и Phaser 3. Игрок управляет троллем, который должен пересечь бесконечный мост, меняющийся во времени.

## 🚀 Текущее состояние: MVP (Functional Prototype)
Проект переведен с монолитной структуры на модульную архитектуру (ES6 Modules), что решило проблему зависания при переходах между сценами и заложило фундамент для масштабирования.

## 🛠 Технологический стек
* **Engine:** [Phaser 3.60+](https://phaser.io/)
* **Language:** JavaScript (ES6+)
* **Architecture:** Component-based / State Machine
* **Platform:** Web (Mobile friendly)

## 📂 Структура проекта
```text
trolls_time_bridge/
├── index.html          # Точка входа
├── assets/             # Графические и аудио ресурсы
└── js/                 # Игровая логика (Modules)
    ├── main.js         # Конфигурация и инициализация Phaser
    ├── MenuScene.js    # Главное меню (Лобби)
    ├── GameScene.js    # Основной игровой процесс
    └── Troll.js        # Класс игрока (Entity)
-
