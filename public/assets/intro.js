const entryPath = '/design-agent';
const introSeen = 'haipai.design-agent.intro';
const motionQuery = '(prefers-reduced-motion: reduce)';

function linework(canvas) {
  if (typeof Path2D === 'undefined') return;
  const context = canvas.getContext('2d');
  if (!context) return;
  const density = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = 420 * density;
  canvas.height = 320 * density;
  context.scale(density, density);
  context.lineCap = 'round';
  context.lineJoin = 'round';

  const trace = (outline, color, weight = 1, dash = []) => {
    context.strokeStyle = color;
    context.lineWidth = weight;
    context.setLineDash(dash);
    context.stroke(new Path2D(outline));
  };
  const palette = getComputedStyle(document.documentElement);
  const color = token => palette.getPropertyValue(token).trim();
  const guide = color('--teal-7');
  const fabric = color('--sand-1');
  const stitching = color('--white-a7');

  trace(
    'M176 71 L122 92 Q106 99 102 118 L72 244 L108 254 L132 171 '
    + 'L134 270 Q205 279 277 270 L280 171 L304 254 L340 244 L311 118 '
    + 'Q306 99 291 92 L236 71 Q207 54 176 71 Z',
    fabric, 1.45
  );
  trace(
    'M176 71 Q179 92 206 121 L232 151 L232 273 M236 71 Q227 98 206 121 '
    + 'M186 67 Q196 86 218 109 M225 67 Q219 86 196 108',
    fabric, 1.05
  );
  trace(
    'M121 93 Q125 122 132 171 M292 93 Q289 128 280 171 '
    + 'M76 232 L113 241 M298 241 L336 232 M135 257 Q206 266 276 257 '
    + 'M238 154 L238 264',
    stitching, .85, [2.5, 3.5]
  );
  trace(
    'M95 43 H318 M103 37 V49 M311 37 V49 M103 44 V103 M311 44 V104 '
    + 'M362 68 V273 M356 71 H368 M356 270 H368 M283 270 H362 M242 71 H362 '
    + 'M205 38 V66 M205 278 V289',
    guide, .8
  );
  trace('M156 44 V48 M206 44 V48 M257 44 V48 M362 119 H367 M362 170 H367 M362 220 H367', guide, .8);
  trace('M208 149 L231 149 M208 144 V154 M231 144 V154', color('--amber-8'), 1);
}

function startIntro() {
  const path = window.location.pathname.replace(/\/$/, '');
  if (path !== entryPath || !document.getElementById('main') || document.visibilityState === 'hidden') return;
  const motion = window.matchMedia(motionQuery);
  if (motion.matches || getComputedStyle(document.documentElement).getPropertyValue('--atelier-intro-enabled').trim() !== '1') return;

  try {
    if (sessionStorage.getItem(introSeen)) return;
    sessionStorage.setItem(introSeen, '1');
  } catch {
    return;
  }

  const cover = document.createElement('div');
  cover.className = 'atelier-intro';
  cover.setAttribute('aria-hidden', 'true');
  cover.innerHTML = `
    <div class="atelier-intro-stage">
      <div class="atelier-intro-wordmark">
        <div class="atelier-intro-group">
          <span>模拟定制工作台</span>
        </div>
        <span class="atelier-intro-title">海派定制顾问</span>
      </div>
      <canvas class="atelier-intro-pattern" width="420" height="320"></canvas>
    </div>`;

  linework(cover.querySelector('canvas'));

  const listeners = new AbortController();
  const { signal } = listeners;
  const timer = window.setTimeout(finish, 700);
  function finish() {
    window.clearTimeout(timer);
    listeners.abort();
    cover.remove();
  }
  document.addEventListener('pointerdown', finish, { capture: true, once: true, signal });
  document.addEventListener('focusin', finish, { once: true, signal });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') finish();
  }, { signal });
  window.addEventListener('pagehide', finish, { once: true, signal });
  cover.addEventListener('animationend', (event) => {
    if (event.target === cover && event.animationName === 'atelier-intro-exit') finish();
  }, { signal });
  document.body.prepend(cover);
}

startIntro();
