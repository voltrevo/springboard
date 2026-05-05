// Minimal painting app. Pointer to draw; toolbar for color, size, clear.

document.body.style.cssText =
  'margin:0;height:100vh;display:flex;flex-direction:column;background:#f6f6f4;font:14px ui-monospace,monospace;';

const toolbar = document.createElement('div');
toolbar.style.cssText =
  'padding:8px 12px;background:#fff;border-bottom:1px solid #d4d4d0;display:flex;gap:14px;align-items:center;';
document.body.append(toolbar);

const canvas = document.createElement('canvas');
canvas.style.cssText = 'flex:1;background:#fff;cursor:crosshair;display:block;touch-action:none;';
document.body.append(canvas);

const ctx = canvas.getContext('2d');

let color = '#222';
let size = 6;

function tool(label, type, value, attrs, onPick) {
  const el = document.createElement('input');
  el.type = type;
  el.value = value;
  Object.assign(el, attrs);
  el.style.cssText = type === 'color'
    ? 'width:32px;height:32px;border:0;background:transparent;padding:0;cursor:pointer;'
    : 'width:120px;';
  el.oninput = () => onPick(el.value);
  const wrap = document.createElement('label');
  wrap.style.cssText = 'display:flex;align-items:center;gap:6px;color:#555;';
  wrap.append(label + ' ', el);
  toolbar.append(wrap);
}

tool('color', 'color', color, {}, v => (color = v));
tool('size', 'range', size, { min: 1, max: 50 }, v => (size = +v));

const clear = document.createElement('button');
clear.textContent = 'clear';
clear.style.cssText =
  'padding:6px 14px;border:0;border-radius:4px;background:#357edd;color:#fff;cursor:pointer;font:inherit;';
clear.onclick = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
toolbar.append(clear);

function fitCanvas() {
  const dpr = devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  canvas.width = r.width * dpr;
  canvas.height = r.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

let drawing = false;

function pos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

canvas.addEventListener('pointerdown', e => {
  drawing = true;
  canvas.setPointerCapture(e.pointerId);
  const p = pos(e);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
});

canvas.addEventListener('pointermove', e => {
  if (!drawing) return;
  const p = pos(e);
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
});

canvas.addEventListener('pointerup', () => (drawing = false));
canvas.addEventListener('pointercancel', () => (drawing = false));

addEventListener('resize', fitCanvas);
requestAnimationFrame(fitCanvas);
