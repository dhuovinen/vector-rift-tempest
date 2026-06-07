const TWO_PI = Math.PI * 2;

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ARENA_TYPES = ["classic", "hex", "spiral", "split", "portal"];

export class TempestEngine {
  constructor(options = {}) {
    this.seed = options.seed ?? Date.now();
    this.random = mulberry32(this.seed);
    this.options = {
      evolvingArena: options.evolvingArena ?? true,
      comboWeapons: options.comboWeapons ?? true,
    };
    this.reset();
  }

  reset() {
    this.laneCount = 16;
    this.playerLane = 0;
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.combo = 0;
    this.special = 0;
    this.state = "ready";
    this.time = 0;
    this.spawnTimer = 0.25;
    this.shotCooldown = 0;
    this.enemiesCleared = 0;
    this.enemies = [];
    this.bullets = [];
    this.effects = [];
    this.events = [];
    this.arena = this.createArena();
  }

  setOptions(nextOptions) {
    this.options = { ...this.options, ...nextOptions };
    this.arena = this.createArena();
  }

  start() {
    if (this.state === "ready" || this.state === "gameover") {
      this.reset();
    }
    this.state = "running";
  }

  pause() {
    if (this.state === "running") this.state = "paused";
    else if (this.state === "paused") this.state = "running";
  }

  rotate(direction) {
    if (this.state !== "running") return;
    this.playerLane = this.normalizeLane(this.playerLane + direction);
  }

  shoot() {
    if (this.state !== "running" || this.shotCooldown > 0) return false;
    this.bullets.push({
      lane: this.playerLane,
      depth: 1,
      speed: 1.95,
      age: 0,
    });
    this.shotCooldown = 0.12;
    this.emit("shot", { lane: this.playerLane });
    return true;
  }

  useSpecial() {
    if (this.state !== "running" || !this.options.comboWeapons || this.special < 100) return 0;
    const center = this.playerLane;
    const affected = new Set([
      center,
      this.normalizeLane(center - 1),
      this.normalizeLane(center + 1),
      this.normalizeLane(center - 2),
      this.normalizeLane(center + 2),
    ]);
    const before = this.enemies.length;
    this.enemies = this.enemies.filter((enemy) => !affected.has(enemy.lane));
    const removed = before - this.enemies.length;
    this.score += removed * 90;
    this.enemiesCleared += removed;
    this.combo = 0;
    this.special = 0;
    this.effects.push({ lane: center, depth: 0.6, age: 0, kind: "special" });
    this.emit("special", { lane: center, removed });
    return removed;
  }

  tick(dt, input = {}) {
    this.events = [];
    if (this.state !== "running") return this.snapshot();

    this.time += dt;
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);

    if (input.left) this.rotate(-1);
    if (input.right) this.rotate(1);
    if (input.fire) this.shoot();
    if (input.special) this.useSpecial();

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnEnemy();
      const pace = Math.max(0.32, 0.86 - this.wave * 0.055);
      this.spawnTimer += pace;
    }

    this.updateBullets(dt);
    this.updateEnemies(dt);
    this.updateEffects(dt);
    this.resolveCollisions();
    this.advanceWaveIfNeeded();

    return this.snapshot();
  }

  spawnEnemy(lane = null, depth = 0.08) {
    const chosenLane = lane ?? Math.floor(this.random() * this.laneCount);
    if (this.arena.blockedLanes.has(chosenLane)) return null;
    const enemy = {
      id: `${this.time.toFixed(3)}-${this.random().toString(16).slice(2)}`,
      lane: chosenLane,
      depth,
      speed: 0.11 + this.wave * 0.011 + this.random() * 0.035,
      kind: this.random() > 0.82 ? "flipper" : "crawler",
    };
    this.enemies.push(enemy);
    return enemy;
  }

  updateBullets(dt) {
    for (const bullet of this.bullets) {
      bullet.depth -= bullet.speed * dt;
      bullet.age += dt;
      if (this.arena.drift && bullet.age > 0.18) {
        bullet.lane = this.normalizeLane(bullet.lane + Math.sign(this.arena.drift));
        bullet.age = 0;
      }
    }
    this.bullets = this.bullets.filter((bullet) => bullet.depth > 0);
  }

  updateEnemies(dt) {
    for (const enemy of this.enemies) {
      enemy.depth += enemy.speed * dt;
      if (enemy.kind === "flipper" && this.time % 1.6 < dt) {
        enemy.lane = this.normalizeLane(enemy.lane + (this.random() > 0.5 ? 1 : -1));
      }
      if (this.arena.portals.has(enemy.lane) && enemy.depth > 0.52 && !enemy.usedPortal) {
        enemy.lane = this.arena.portals.get(enemy.lane);
        enemy.usedPortal = true;
      }
    }

    const breached = this.enemies.filter((enemy) => enemy.depth >= 0.98);
    if (breached.length) {
      this.lives = Math.max(0, this.lives - breached.length);
      this.combo = 0;
      this.enemies = this.enemies.filter((enemy) => enemy.depth < 0.98);
      this.effects.push({ lane: this.playerLane, depth: 1, age: 0, kind: "breach" });
      this.emit("breach", { count: breached.length, lives: this.lives });
      if (this.lives === 0) this.state = "gameover";
      if (this.state === "gameover") this.emit("gameover");
    }
  }

  updateEffects(dt) {
    for (const effect of this.effects) effect.age += dt;
    this.effects = this.effects.filter((effect) => effect.age < 0.45);
  }

  resolveCollisions() {
    const killed = new Set();
    const spentBullets = new Set();

    for (const bullet of this.bullets) {
      let target = null;
      for (const enemy of this.enemies) {
        if (enemy.lane === bullet.lane && Math.abs(enemy.depth - bullet.depth) < 0.065) {
          if (!target || enemy.depth > target.depth) target = enemy;
        }
      }
      if (target) {
        killed.add(target);
        spentBullets.add(bullet);
      }
    }

    if (!killed.size) return;

    this.enemies = this.enemies.filter((enemy) => !killed.has(enemy));
    this.bullets = this.bullets.filter((bullet) => !spentBullets.has(bullet));

    for (const enemy of killed) {
      this.enemiesCleared += 1;
      if (this.options.comboWeapons) {
        this.combo += 1;
        this.special = Math.min(100, this.special + 16 + Math.min(12, this.combo * 2));
        this.score += 100 + this.combo * 12;
      } else {
        this.combo = 0;
        this.special = 0;
        this.score += 100;
      }
      this.effects.push({ lane: enemy.lane, depth: enemy.depth, age: 0, kind: "kill" });
      this.emit("kill", { lane: enemy.lane, combo: this.combo, score: this.score });
    }
  }

  advanceWaveIfNeeded() {
    const quota = 9 + this.wave * 3;
    if (this.enemiesCleared < quota) return;
    this.wave += 1;
    this.enemiesCleared = 0;
    this.enemies = [];
    this.bullets = [];
    this.spawnTimer = 0.4;
    this.arena = this.createArena();
    this.effects.push({ lane: this.playerLane, depth: 0.4, age: 0, kind: "wave" });
    this.emit("wave", { wave: this.wave, arena: this.arena.type });
  }

  createArena() {
    const type = this.options.evolvingArena
      ? ARENA_TYPES[(this.wave - 1) % ARENA_TYPES.length]
      : "classic";
    const blockedLanes = new Set();
    const portals = new Map();
    let drift = 0;

    if (type === "split") {
      blockedLanes.add(4);
      blockedLanes.add(12);
    }
    if (type === "portal") {
      portals.set(2, 10);
      portals.set(10, 2);
      portals.set(6, 14);
      portals.set(14, 6);
    }
    if (type === "spiral") {
      drift = this.wave % 2 === 0 ? -1 : 1;
    }

    return { type, blockedLanes, portals, drift };
  }

  normalizeLane(lane) {
    return (lane + this.laneCount) % this.laneCount;
  }

  laneAngle(lane, depth = 1) {
    const base = (lane / this.laneCount) * TWO_PI - Math.PI / 2;
    if (this.arena.type === "spiral") return base + (1 - depth) * 0.9;
    return base;
  }

  emit(type, detail = {}) {
    this.events.push({ type, detail, time: this.time });
  }

  snapshot() {
    return {
      state: this.state,
      time: this.time,
      score: this.score,
      lives: this.lives,
      wave: this.wave,
      combo: this.combo,
      special: this.special,
      laneCount: this.laneCount,
      playerLane: this.playerLane,
      arena: {
        type: this.arena.type,
        blockedLanes: [...this.arena.blockedLanes],
        portals: [...this.arena.portals.entries()],
        drift: this.arena.drift,
      },
      enemies: this.enemies.map((enemy) => ({ ...enemy })),
      bullets: this.bullets.map((bullet) => ({ ...bullet })),
      effects: this.effects.map((effect) => ({ ...effect })),
      events: this.events.map((event) => ({ ...event, detail: { ...event.detail } })),
    };
  }
}
