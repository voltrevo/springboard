// Classic snake. Arrow keys or WASD to steer; space to restart.

const W = 20;
const H = 20;
const CELL = 24;

document.body.style.cssText =
  'margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;' +
  'justify-content:center;background:#111;color:#eee;font:14px ui-monospace,monospace;';

const scoreEl = document.createElement('div');
scoreEl.style.cssText = 'margin-bottom:8px;color:#888;';
document.body.append(scoreEl);

const canvas = document.createElement('canvas');
canvas.width = W * CELL;
canvas.height = H * CELL;
canvas.style.cssText = 'background:#000;border:1px solid #333;';
document.body.append(canvas);
const ctx = canvas.getContext('2d');

const hint = document.createElement('div');
hint.style.cssText = 'margin-top:8px;color:#666;font-size:12px;';
hint.textContent = 'Arrow keys / WASD. Space to restart.';
document.body.append(hint);

let snake;
let dir;
let food;
let dead;
let points;

function spawnFood() {
  while (true) {
    const f = { x: Math.floor(Math.random() * W), y: Math.floor(Math.random() * H) };
    if (!snake.some(s => s.x === f.x && s.y === f.y)) return f;
  }
}

function reset() {
  snake = [{ x: 10, y: 10 }];
  dir = { x: 1, y: 0 };
  food = spawnFood();
  dead = false;
  points = 0;
  draw();
}

function step() {
  if (dead) return;
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
  if (head.x < 0 || head.x >= W || head.y < 0 || head.y >= H ||
      snake.some(s => s.x === head.x && s.y === head.y)) {
    dead = true;
    draw();
    return;
  }
  snake.unshift(head);
  if (head.x === food.x && head.y === food.y) {
    points++;
    food = spawnFood();
  } else {
    snake.pop();
  }
  draw();
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#e44';
  ctx.fillRect(food.x * CELL, food.y * CELL, CELL, CELL);
  ctx.fillStyle = '#4d8';
  for (const s of snake) ctx.fillRect(s.x * CELL, s.y * CELL, CELL - 1, CELL - 1);
  scoreEl.textContent = dead ? `game over — score ${points}` : `score ${points}`;
}

addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === ' ' && dead) reset();
  else if ((k === 'arrowup' || k === 'w') && dir.y !== 1) dir = { x: 0, y: -1 };
  else if ((k === 'arrowdown' || k === 's') && dir.y !== -1) dir = { x: 0, y: 1 };
  else if ((k === 'arrowleft' || k === 'a') && dir.x !== 1) dir = { x: -1, y: 0 };
  else if ((k === 'arrowright' || k === 'd') && dir.x !== -1) dir = { x: 1, y: 0 };
});

reset();
setInterval(step, 100);
