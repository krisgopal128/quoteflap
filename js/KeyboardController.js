export class KeyboardController {
  constructor(rotator, soundEngine, onNext) {
    this.rotator = rotator;
    this.soundEngine = soundEngine;
    this.onNext = onNext; // when set, navigation keys fetch a new quote

    document.addEventListener('keydown', (e) => this._handleKey(e));
  }

  _handleKey(e) {
    // Don't capture when typing in fields, or when a button has focus —
    // Enter/Space must activate the focused button (fullscreen, A, H, ↻),
    // not trigger the global shortcut.
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        this._next();
        break;

      case 'ArrowRight':
        e.preventDefault();
        this._next();
        break;

      case 'ArrowLeft':
        e.preventDefault();
        this._prev();
        break;

      case 'm':
      case 'M':
        e.preventDefault();
        if (this.soundEngine) {
          const muted = this.soundEngine.toggleMute();
          this._showToast(muted ? 'Sound off' : 'Sound on');
        }
        break;

      case 'Escape':
        // Hide shortcuts overlay
        const overlay = document.querySelector('.shortcuts-overlay');
        if (overlay) overlay.classList.remove('visible');
        break;
    }
  }

  _next() {
    if (this.onNext) this.onNext();
    else this.rotator.next();
  }

  _prev() {
    if (this.onNext) this.onNext();
    else this.rotator.prev();
  }

  _showToast(msg) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.style.cssText = `
        position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%);
        background: rgba(0,0,0,0.8); color: #fff; padding: 8px 20px;
        border-radius: 8px; font-size: 14px; font-weight: 600;
        z-index: 9999; transition: opacity 0.3s; pointer-events: none;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
      toast.style.opacity = '0';
    }, 1200);
  }
}
