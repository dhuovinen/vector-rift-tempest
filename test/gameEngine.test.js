import assert from "node:assert/strict";
import test from "node:test";
import { TempestEngine } from "../src/gameEngine.js";

test("base game shoots enemies on the selected lane", () => {
  const engine = new TempestEngine({ seed: 7, evolvingArena: false, comboWeapons: false });
  engine.start();
  engine.spawnTimer = 999;
  engine.spawnEnemy(0, 0.5);
  engine.shoot();

  let killEvent = null;
  for (let i = 0; i < 20; i += 1) {
    const frame = engine.tick(0.02);
    killEvent ??= frame.events.find((event) => event.type === "kill");
  }

  const snapshot = engine.snapshot();
  assert.equal(snapshot.enemies.length, 0);
  assert.equal(snapshot.score, 100);
  assert.equal(snapshot.combo, 0);
  assert.equal(snapshot.special, 0);
  assert.equal(killEvent.type, "kill");
});

test("arena enhancement can be disabled independently", () => {
  const engine = new TempestEngine({ seed: 7, evolvingArena: false, comboWeapons: true });
  engine.start();
  engine.wave = 4;
  engine.arena = engine.createArena();

  assert.equal(engine.snapshot().arena.type, "classic");
});

test("arena enhancement changes arena rules by wave when enabled", () => {
  const engine = new TempestEngine({ seed: 7, evolvingArena: true, comboWeapons: false });
  engine.start();
  engine.wave = 4;
  engine.arena = engine.createArena();

  const snapshot = engine.snapshot();
  assert.equal(snapshot.arena.type, "split");
  assert.deepEqual(snapshot.arena.blockedLanes, [4, 12]);
});

test("combo weapons can be disabled independently", () => {
  const engine = new TempestEngine({ seed: 7, evolvingArena: true, comboWeapons: false });
  engine.start();
  engine.spawnTimer = 999;
  engine.spawnEnemy(0, 0.5);
  engine.shoot();

  for (let i = 0; i < 20; i += 1) {
    engine.tick(0.02);
  }

  const snapshot = engine.snapshot();
  assert.equal(snapshot.score, 100);
  assert.equal(snapshot.combo, 0);
  assert.equal(snapshot.special, 0);
});

test("combo weapons build charge and special clears nearby lanes", () => {
  const engine = new TempestEngine({ seed: 11, evolvingArena: false, comboWeapons: true });
  engine.start();
  engine.spawnTimer = 999;

  for (let kill = 0; kill < 5; kill += 1) {
    engine.spawnEnemy(0, 0.5);
    engine.shoot();
    for (let i = 0; i < 20; i += 1) {
      engine.tick(0.02);
    }
  }

  let snapshot = engine.snapshot();
  assert.equal(snapshot.combo, 5);
  assert.equal(snapshot.special, 100);

  engine.spawnEnemy(0, 0.4);
  engine.spawnEnemy(1, 0.4);
  engine.spawnEnemy(3, 0.4);
  const removed = engine.useSpecial();
  snapshot = engine.snapshot();

  assert.equal(removed, 2);
  assert.equal(snapshot.combo, 0);
  assert.equal(snapshot.special, 0);
  assert.equal(snapshot.enemies.length, 1);
  assert.equal(snapshot.events.at(-1).type, "special");
});

test("breach and wave events are emitted for audio cues", () => {
  const engine = new TempestEngine({ seed: 17, evolvingArena: true, comboWeapons: true });
  engine.start();
  engine.spawnTimer = 999;
  engine.spawnEnemy(0, 0.97);

  let snapshot = engine.tick(0.2);
  assert.equal(snapshot.events.at(-1).type, "breach");

  engine.enemies = [];
  engine.enemiesCleared = 12;
  snapshot = engine.tick(0.02);
  assert.equal(snapshot.events.at(-1).type, "wave");
});
