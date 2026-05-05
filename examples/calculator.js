// Four-function calculator with keyboard support.

document.body.style.cssText =
  'margin:0;height:100vh;display:flex;align-items:center;justify-content:center;' +
  'background:#f6f6f4;font:14px ui-monospace,monospace;';

const wrap = document.createElement('div');
wrap.style.cssText =
  'width:280px;background:#fff;border:1px solid #d4d4d0;border-radius:8px;padding:12px;' +
  'display:flex;flex-direction:column;gap:8px;box-shadow:0 4px 12px rgba(0,0,0,.04);';
document.body.append(wrap);

const display = document.createElement('div');
display.style.cssText =
  'background:#222;color:#fff;border-radius:6px;padding:14px;text-align:right;' +
  'font-size:24px;min-height:36px;overflow-x:auto;white-space:nowrap;';
display.textContent = '0';
wrap.append(display);

const grid = document.createElement('div');
grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:6px;';
wrap.append(grid);

let current = '';
let stored = null;
let op = null;
let justEvaluated = false;

function format(n) {
  if (!isFinite(n)) return 'Error';
  return String(+n.toPrecision(12));
}

function refresh() {
  display.textContent = current || (stored !== null ? format(stored) : '0');
}

function inputDigit(d) {
  if (justEvaluated) {
    current = '';
    justEvaluated = false;
  }
  if (d === '.' && current.includes('.')) return;
  current += d;
  refresh();
}

function compute(a, op, b) {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '*') return a * b;
  if (op === '/') return a / b;
}

function applyOp(next) {
  const n = current === '' ? stored : parseFloat(current);
  if (n === null || isNaN(n)) return;
  if (stored === null || op === null) {
    stored = n;
  } else if (current !== '') {
    stored = compute(stored, op, n);
  }
  op = next;
  current = '';
  justEvaluated = false;
  refresh();
}

function evaluate() {
  if (op === null || stored === null || current === '') return;
  stored = compute(stored, op, parseFloat(current));
  current = format(stored);
  stored = null;
  op = null;
  justEvaluated = true;
  refresh();
}

function clearAll() {
  current = '';
  stored = null;
  op = null;
  justEvaluated = false;
  refresh();
}

function negate() {
  current = current.startsWith('-') ? current.slice(1) : '-' + (current || '0');
  refresh();
}

function percent() {
  if (!current) return;
  current = format(parseFloat(current) / 100);
  refresh();
}

const handlers = {
  C: clearAll,
  '±': negate,
  '%': percent,
  '/': () => applyOp('/'),
  '*': () => applyOp('*'),
  '-': () => applyOp('-'),
  '+': () => applyOp('+'),
  '=': evaluate,
  '.': () => inputDigit('.'),
};
for (let d = 0; d <= 9; d++) handlers[String(d)] = () => inputDigit(String(d));

const layout = [
  ['C', '±', '%', '/'],
  ['7', '8', '9', '*'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['0', '.', '='],
];

for (const row of layout) {
  for (const k of row) {
    const b = document.createElement('button');
    b.textContent = k;
    const isOp = '+-*/=±%C'.includes(k);
    b.style.cssText =
      'padding:14px;border:0;border-radius:6px;font:600 16px ui-monospace,monospace;cursor:pointer;' +
      `background:${isOp ? '#357edd' : '#eee'};color:${isOp ? '#fff' : '#222'};`;
    if (k === '0') b.style.gridColumn = 'span 2';
    b.onclick = handlers[k];
    grid.append(b);
  }
}

addEventListener('keydown', e => {
  if (handlers[e.key]) {
    e.preventDefault();
    handlers[e.key]();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    evaluate();
  } else if (e.key === 'Backspace') {
    current = current.slice(0, -1);
    refresh();
  } else if (e.key === 'Escape') {
    clearAll();
  }
});
