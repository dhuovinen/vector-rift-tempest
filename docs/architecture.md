# Vector Rift Implementation Plan

## Architecture

- `index.html`: Browser entry point, game canvas, toggles, and HUD.
- `src/gameEngine.js`: Deterministic game state and rules. This module owns player movement, enemies, bullets, collision, scoring, arena evolution, and combo weapons.
- `src/app.js`: Browser adapter. It handles input, timing, canvas rendering, resizing, and DOM HUD updates.
- `src/styles.css`: Responsive visual shell.
- `test/gameEngine.test.js`: Node tests for core gameplay behavior and enhancement toggles.

## Base Game

The base game keeps the classic Tempest loop:

- Player sits on the outer rim of a radial lane arena.
- Enemies spawn near the center and advance outward along lanes.
- Player rotates left and right around the rim.
- Player shoots inward along the selected lane.
- Enemy reaching the rim costs a life.
- Clearing enough enemies advances the wave.

## Enhancement 1: Evolving Arenas

This can be toggled independently with `evolvingArena`.

- The arena shape changes by wave: circle, hex, spiral, split ring, and portal layouts.
- Rule modifiers can include blocked lanes, lane portals, and lane drift.
- The engine exposes lane geometry hints to the renderer, while gameplay stays lane-based and testable.

## Enhancement 2: Combo Weapons

This can be toggled independently with `comboWeapons`.

- Consecutive kills increase combo.
- Combo fills a special meter.
- A charged special clears nearby lanes and awards score.
- Using the special spends the meter, creating a score-versus-safety decision.

## Test Strategy

- Engine tests are deterministic by seeding the random number generator.
- Tests verify base shooting, arena toggle behavior, combo toggle behavior, and special weapon effects.
- Canvas rendering is validated by running the app locally after tests.
