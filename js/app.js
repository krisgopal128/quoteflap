import { Board } from './Board.js?v=6';
import { SoundEngine } from './SoundEngine.js';
import { MessageRotator } from './MessageRotator.js?v=6';
import { KeyboardController } from './KeyboardController.js?v=7';
import { TOTAL_TRANSITION } from './constants.js';

// Board charset: A-Z 0-9 . , - ! ? ' / :  (GRID 22x5). Sanitize, wrap to 22
// chars per line, max 5 lines. Author never renders on the board itself.
function wrap(text) {
  const clean = (s) => (s || '').toUpperCase()
    .replace(/[^A-Z0-9.,!?'\//: -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const lines = [];
  let cur = '';
  for (const w of clean(text).split(' ')) {
    if (!w) continue;
    if (w.length > 22) return null;
    const next = cur ? cur + ' ' + w : w;
    if (next.length > 22) { lines.push(cur); cur = w; } else { cur = next; }
  }
  if (cur) lines.push(cur);
  if (!lines.length || lines.length > 5) return null;
  while (lines.length < 5) {
    lines.unshift('');
    if (lines.length < 5) lines.push('');
  }
  return lines;
}

// Quote pool: server hands out batches of 10 random {text, author} quotes;
// each page load (or random-button click) consumes one; when <= 7 remain,
// pull another 10. (v2 dropped the whole-dataset IndexedDB cache.)
const APP_VERSION = 'v18';
try { if (window.indexedDB) indexedDB.deleteDatabase('flipoff-quotes-v1'); } catch (e) {}
const POOL_KEY = 'flipoff-quote-pool';
const BATCH = 10;
const REFILL_AT = 7;

// TV/kiosk browsers can throw on storage access or lack it entirely
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
};

async function fetchBatch() {
  const r = await fetch('/random?n=' + BATCH);
  if (!r.ok) throw new Error('/random ' + r.status);
  return r.json();
}

function loadPool() {
  try {
    const p = JSON.parse(store.get(POOL_KEY));
    if (Array.isArray(p)) return p.filter((q) => q && typeof q === 'object' && q.text);
  } catch (e) { /* corrupt pool, refill */ }
  return [];
}

async function nextQuote() {
  let pool = loadPool();
  if (!pool.length) pool = await fetchBatch();
  for (let i = 0; i < 5; i++) {
    if (!pool.length) pool = await fetchBatch();
    const item = pool.shift();
    const lines = wrap(item && item.text);
    if (lines) {
      if (pool.length <= REFILL_AT) pool.push(...await fetchBatch());
      store.set(POOL_KEY, JSON.stringify(pool));
      return { lines, author: (item && item.author) || '' };
    }
  }
  throw new Error('no fitting quote in pool');
}

// Fullscreen — same API as the standard example; visual twin of F11.
// Rejections surface as a toast so Chrome issues are visible, not silent.
const toast = (msg) => {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);'
      + 'background:rgba(0,0,0,0.8);color:#fff;padding:8px 20px;border-radius:8px;'
      + 'font-size:14px;font-weight:600;z-index:9999;transition:opacity 0.3s;pointer-events:none;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._hide);
  el._hide = setTimeout(() => { el.style.opacity = '0'; }, 2200);
};

function openFullscreen() {
  const el = document.documentElement;
  const fn = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!fn) { toast('Fullscreen not supported in this browser'); return; }
  const p = fn.call(el);
  if (p && p.catch) p.catch((e) => toast('Fullscreen blocked: ' + (e && e.message ? e.message : e)));
}

function closeFullscreen() {
  const fn = document.exitFullscreen || document.webkitExitFullscreen;
  if (!fn) return;
  const p = fn.call(document);
  if (p && p.catch) p.catch(() => {});
}

// Always keep the screen awake (mobile/tablet/TV displays). Re-acquired when
// the tab becomes visible again; silently ignored on browsers without it.
let wakeSentinel = null;
const keepAwake = async () => {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible'
        && !wakeSentinel) {
      wakeSentinel = await navigator.wakeLock.request('screen');
      wakeSentinel.addEventListener('release', () => { wakeSentinel = null; });
    }
  } catch (e) {
    wakeSentinel = null;
  }
};
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    keepAwake();
  } else {
    try { if (wakeSentinel) wakeSentinel.release(); } catch (e) {}
    wakeSentinel = null;
  }
});
keepAwake();

document.addEventListener('DOMContentLoaded', () => {
  const soundEngine = new SoundEngine();
  const board = new Board(document.body, soundEngine);

  // Visible version chip (diagnostics, bottom-left)
  const chip = document.createElement('div');
  chip.className = 'version-chip';
  chip.textContent = APP_VERSION;
  document.body.appendChild(chip);

  // Author caption below the board (never on the flipboard itself)
  const caption = document.createElement('div');
  caption.className = 'author-caption'
    + (store.get('show-author') === '1' ? ' visible' : '');
  document.body.appendChild(caption);
  const setCaption = (author) => {
    caption.textContent = author && author !== 'Unknown' ? author : '';
  };

  // Initialize audio on first user interaction (browser autoplay policy)
  let audioInitialized = false;
  const initAudio = async () => {
    if (audioInitialized) return;
    audioInitialized = true;
    await soundEngine.init();
    soundEngine.resume();
    document.removeEventListener('click', initAudio);
    document.removeEventListener('keydown', initAudio);
  };
  document.addEventListener('click', initAudio);
  document.addEventListener('keydown', initAudio);

  let rotator = null;
  let captionTimer = null;

  const show = (q) => {
    // Author appears only after the flip animation settles
    clearTimeout(captionTimer);
    caption.textContent = '';
    captionTimer = setTimeout(() => setCaption(q.author), TOTAL_TRANSITION + 200);
    if (!rotator) {
      rotator = new MessageRotator(board, [q.lines]);
      const nextRandom = () => {
        // Mid-flip: board would ignore the change, so don't burn a pooled quote
        if (board.isTransitioning) return;
        nextQuote().then(show)
          .catch((e) => console.error('random quote failed:', e));
      };
      new KeyboardController(rotator, soundEngine, nextRandom);
      rotator.start();
      addButtons(nextRandom);
    } else {
      rotator.messages = [q.lines];
      rotator.next();
    }
  };

  const addButtons = (nextRandom) => {
    // Random button (bottom-right of board): next quote from the pool
    const randomBtn = document.createElement('button');
    randomBtn.className = 'random-btn';
    randomBtn.type = 'button';
    randomBtn.title = 'Random quote';
    randomBtn.setAttribute('aria-label', 'Random quote');
    randomBtn.textContent = '\u27F3';
    randomBtn.addEventListener('click', () => nextRandom());
    board.boardEl.appendChild(randomBtn);

    // Author toggle (beside the random button): show/hide author caption
    const authorBtn = document.createElement('button');
    authorBtn.className = 'random-btn author-btn';
    authorBtn.type = 'button';
    authorBtn.title = 'Show author';
    authorBtn.setAttribute('aria-pressed', caption.classList.contains('visible'));
    authorBtn.textContent = 'A';
    authorBtn.addEventListener('click', () => {
      const on = caption.classList.toggle('visible');
      store.set('show-author', on ? '1' : '0');
      authorBtn.setAttribute('aria-pressed', on);
    });
    board.boardEl.appendChild(authorBtn);

    // Rotation-interval picker (beside the A button): 1/2/4/12/24h
    const rotateBtn = document.createElement('button');
    rotateBtn.className = 'random-btn rotate-btn';
    rotateBtn.type = 'button';
    rotateBtn.title = 'Rotation interval';
    rotateBtn.setAttribute('aria-label', 'Rotation interval');
    rotateBtn.textContent = 'H';

    const menu = document.createElement('div');
    menu.className = 'rotate-menu';
    menu.innerHTML = [1, 2, 4, 12, 24]
      .map((h) => '<button type="button" data-h="' + h + '">' + h + 'h</button>')
      .join('');
    const markActive = () => {
      fetch('/rotate-interval')
        .then((r) => r.json())
        .then(({ hours }) => {
          menu.querySelectorAll('button').forEach((b) => {
            b.classList.toggle('active', Number(b.dataset.h) === hours);
          });
        })
        .catch(() => {});
    };
    menu.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-h]');
      if (!btn) return;
      fetch('/rotate-interval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours: Number(btn.dataset.h) }),
      })
        .then((r) => r.json())
        .then(({ hours }) => {
          markActive();
          menu.classList.remove('visible');
          toast('Quotes rotate every ' + hours + 'h');
        })
        .catch(() => toast('Could not set interval'));
    });
    rotateBtn.addEventListener('click', () => {
      menu.classList.toggle('visible');
      if (menu.classList.contains('visible')) markActive();
    });
    board.boardEl.appendChild(rotateBtn);
    board.boardEl.appendChild(menu);
    markActive();

    // Fullscreen toggle (top-right corner): open/close like the standard example
    const fsBtn = document.createElement('button');
    fsBtn.className = 'random-btn fs-btn';
    fsBtn.type = 'button';
    fsBtn.title = 'Fullscreen';
    fsBtn.setAttribute('aria-label', 'Fullscreen');
    fsBtn.textContent = '\u26F6';
    fsBtn.addEventListener('click', () => {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        closeFullscreen();
      } else {
        openFullscreen();
      }
    });
    board.boardEl.appendChild(fsBtn);
  };

  // One random quote per page load, from the pooled batches
  nextQuote()
    .then(show)
    .catch((err) => {
      console.error('quotes load failed:', err);
      board.displayMessage(['', 'COULD NOT LOAD', 'QUOTES', '', '']);
    });
});
