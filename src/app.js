import "./styles.css";
import { TempestEngine } from "./gameEngine.js";
import { GameAudio } from "./sound.js";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const overlay = document.querySelector("#overlay");
const startButton = document.querySelector("#startButton");
const soundToggle = document.querySelector("#soundToggle");
const arenaToggle = document.querySelector("#arenaToggle");
const comboToggle = document.querySelector("#comboToggle");

const hud = {
  state: document.querySelector("#stateLabel"),
  score: document.querySelector("#score"),
  lives: document.querySelector("#lives"),
  wave: document.querySelector("#wave"),
  combo: document.querySelector("#combo"),
  specialFill: document.querySelector("#specialFill"),
};

const engine = new TempestEngine({
  evolvingArena: arenaToggle.checked,
  comboWeapons: comboToggle.checked,
});
const audio = new GameAudio();
audio.setEnabled(soundToggle.checked);

const input = {
  left: false,
  right: false,
  fire: false,
  special: false,
};

let lastTime = performance.now();

function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(640, Math.floor(rect.width * scale));
  canvas.height = Math.max(480, Math.floor(rect.height * scale));
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

function pointFor(snapshot, lane, depth) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const cx = width / 2;
  const cy = height / 2;
  const outer = Math.min(width, height) * 0.42;
  const inner = Math.min(width, height) * 0.08;
  const radius = inner + (outer - inner) * depth;
  const angle = engine.laneAngle(lane, depth);

  if (snapshot.arena.type === "hex") {
    const segment = Math.floor(lane / (snapshot.laneCount / 6));
    const cornerAngle = (segment / 6) * Math.PI * 2 - Math.PI / 2;
    const nextAngle = ((segment + 1) / 6) * Math.PI * 2 - Math.PI / 2;
    const local = (lane % (snapshot.laneCount / 6)) / (snapshot.laneCount / 6);
    const ax = Math.cos(cornerAngle) * radius;
    const ay = Math.sin(cornerAngle) * radius;
    const bx = Math.cos(nextAngle) * radius;
    const by = Math.sin(nextAngle) * radius;
    return { x: cx + ax + (bx - ax) * local, y: cy + ay + (by - ay) * local };
  }

  const splitOffset = snapshot.arena.type === "split" && lane > 7 ? 16 : 0;
  return {
    x: cx + Math.cos(angle) * (radius + splitOffset),
    y: cy + Math.sin(angle) * (radius + splitOffset),
  };
}

function drawArena(snapshot) {
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ctx.fillStyle = "#05080b";
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  const rings = [0.12, 0.34, 0.56, 0.78, 1];
  ctx.lineWidth = 1;
  for (const depth of rings) {
    ctx.beginPath();
    for (let lane = 0; lane <= snapshot.laneCount; lane += 1) {
      const point = pointFor(snapshot, lane % snapshot.laneCount, depth);
      if (lane === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
    ctx.strokeStyle = depth === 1 ? "rgba(140, 246, 255, 0.72)" : "rgba(140, 246, 255, 0.18)";
    ctx.stroke();
  }

  for (let lane = 0; lane < snapshot.laneCount; lane += 1) {
    const start = pointFor(snapshot, lane, 0.1);
    const end = pointFor(snapshot, lane, 1);
    const blocked = snapshot.arena.blockedLanes.includes(lane);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = blocked ? "rgba(242, 96, 88, 0.72)" : "rgba(140, 246, 255, 0.28)";
    ctx.lineWidth = blocked ? 3 : 1;
    ctx.stroke();
  }

  for (const [from] of snapshot.arena.portals) {
    const point = pointFor(snapshot, from, 0.55);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 9, 0, Math.PI * 2);
    ctx.strokeStyle = "#f2c56f";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawPlayer(snapshot) {
  const p = pointFor(snapshot, snapshot.playerLane, 1.02);
  const aim = pointFor(snapshot, snapshot.playerLane, 0.86);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(aim.x, aim.y);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
  ctx.fillStyle = "#d8fbff";
  ctx.fill();
}

function drawEnemies(snapshot) {
  for (const enemy of snapshot.enemies) {
    const point = pointFor(snapshot, enemy.lane, enemy.depth);
    ctx.beginPath();
    if (enemy.kind === "flipper") {
      ctx.rect(point.x - 7, point.y - 7, 14, 14);
      ctx.fillStyle = "#f26058";
    } else {
      ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#f2c56f";
    }
    ctx.fill();
  }
}

function drawBullets(snapshot) {
  for (const bullet of snapshot.bullets) {
    const point = pointFor(snapshot, bullet.lane, bullet.depth);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#50f0ff";
    ctx.fill();
  }
}

function drawEffects(snapshot) {
  for (const effect of snapshot.effects) {
    const point = pointFor(snapshot, effect.lane, effect.depth);
    const alpha = Math.max(0, 1 - effect.age / 0.45);
    const radius = effect.kind === "special" ? 80 * (1 - alpha + 0.35) : 26 * (1 - alpha + 0.35);
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = effect.kind === "breach"
      ? `rgba(242, 96, 88, ${alpha})`
      : `rgba(80, 240, 255, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function render(snapshot) {
  drawArena(snapshot);
  drawBullets(snapshot);
  drawEnemies(snapshot);
  drawEffects(snapshot);
  drawPlayer(snapshot);
}

function updateHud(snapshot) {
  hud.state.textContent = snapshot.state === "gameover" ? "Game Over" : snapshot.arena.type;
  hud.score.textContent = snapshot.score.toLocaleString();
  hud.lives.textContent = snapshot.lives;
  hud.wave.textContent = snapshot.wave;
  hud.combo.textContent = snapshot.combo;
  hud.specialFill.style.width = `${snapshot.special}%`;
  overlay.classList.toggle("hidden", snapshot.state === "running" || snapshot.state === "paused");
  if (snapshot.state === "gameover") {
    startButton.textContent = "Restart";
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const snapshot = engine.tick(dt, input);
  for (const event of snapshot.events) {
    audio.playEvent(event);
  }
  render(snapshot);
  updateHud(snapshot);
  input.fire = false;
  input.special = false;
  requestAnimationFrame(frame);
}

function setToggleOptions() {
  engine.setOptions({
    evolvingArena: arenaToggle.checked,
    comboWeapons: comboToggle.checked,
  });
}

startButton.addEventListener("click", () => {
  setToggleOptions();
  audio.unlock();
  engine.start();
  overlay.classList.add("hidden");
});

soundToggle.addEventListener("change", () => audio.setEnabled(soundToggle.checked));
arenaToggle.addEventListener("change", setToggleOptions);
comboToggle.addEventListener("change", setToggleOptions);
window.addEventListener("resize", resize);

window.addEventListener("keydown", (event) => {
  audio.unlock();
  if (event.code === "ArrowLeft" || event.code === "KeyA") input.left = true;
  if (event.code === "ArrowRight" || event.code === "KeyD") input.right = true;
  if (event.code === "Space") {
    input.fire = true;
    event.preventDefault();
  }
  if (event.code === "ShiftLeft" || event.code === "ShiftRight") input.special = true;
  if (event.code === "KeyP") engine.pause();
});

window.addEventListener("keyup", (event) => {
  if (event.code === "ArrowLeft" || event.code === "KeyA") input.left = false;
  if (event.code === "ArrowRight" || event.code === "KeyD") input.right = false;
});

resize();
render(engine.snapshot());
updateHud(engine.snapshot());
requestAnimationFrame(frame);
