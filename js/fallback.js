// Fallback for pre-2017 TV browsers: no ES modules, no arrow functions, no
// fetch/promises -- plain ES5 + XMLHttpRequest. Loaded via <script nomodule>
// so modern browsers never execute it.
//
// Features: one random quote per load, "another quote" button, auto-advance
// rotation (30s/1m/5m/15m/off, default 1m, persisted when storage works).
// No flip animation or sound -- old engines only.
(function () {
  var ROTATE_KEY = 'fallback-rotate-seconds';
  var DEFAULT_ROTATE = 60;
  var rotateTimer = null;

  function getQuote(cb) {
    try {
      var x = new XMLHttpRequest();
      x.open('GET', '/random?n=1', true);
      x.onreadystatechange = function () {
        if (x.readyState === 4) {
          var d = null;
          if (x.status === 200) {
            try { d = JSON.parse(x.responseText)[0]; } catch (e) {}
          }
          cb(d && d.text ? d : null);
        }
      };
      x.send(null);
    } catch (e) {
      cb(null);
    }
  }

  function render(d) {
    var quote = document.getElementById('fallback-quote');
    var author = document.getElementById('fallback-author');
    if (!quote) { return; }
    quote.innerHTML = '';
    author.innerHTML = '';
    if (!d) {
      quote.innerHTML = 'COULD NOT LOAD QUOTES';
      return;
    }
    quote.appendChild(document.createTextNode(d.text));
    if (d.author && d.author !== 'Unknown') {
      author.appendChild(document.createTextNode('- ' + d.author));
    }
  }

  function storeGet() {
    try {
      var v = localStorage.getItem(ROTATE_KEY);
      return v === null ? DEFAULT_ROTATE : (parseInt(v, 10) || 0);
    } catch (e) {
      return DEFAULT_ROTATE;
    }
  }

  function storeSet(sec) {
    try { localStorage.setItem(ROTATE_KEY, String(sec)); } catch (e) {}
  }

  function markPicker(sec) {
    var row = document.getElementById('fallback-picker');
    if (!row) { return; }
    var buttons = row.getElementsByTagName('button');
    for (var i = 0; i < buttons.length; i++) {
      var on = buttons[i].getAttribute('data-sec') === String(sec);
      buttons[i].style.background = on ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)';
    }
  }

  function applyRotation(sec) {
    if (rotateTimer) { clearInterval(rotateTimer); rotateTimer = null; }
    if (sec > 0) {
      rotateTimer = setInterval(function () { getQuote(render); }, sec * 1000);
    }
    markPicker(sec);
  }

  function buildPicker(container) {
    var opts = [[30, '30s'], [60, '1m'], [300, '5m'], [900, '15m'], [0, 'off']];
    var row = document.createElement('div');
    row.id = 'fallback-picker';
    row.style.cssText = 'margin-top:20px';
    for (var i = 0; i < opts.length; i++) {
      (function (pair) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('data-sec', String(pair[0]));
        b.innerHTML = pair[1];
        b.style.cssText = 'margin:4px;padding:8px 14px;font:inherit;font-size:13px;'
          + 'color:#fff;border:1px solid rgba(255,255,255,0.3);cursor:pointer';
        b.onclick = function () {
          storeSet(pair[0]);
          applyRotation(pair[0]);
        };
        row.appendChild(b);
      })(opts[i]);
    }
    container.appendChild(row);
  }

  function init() {
    if (!document.getElementById || !window.XMLHttpRequest) { return; }
    if (document.getElementById('fallback-quote')) { return; }

    var box = document.createElement('div');
    box.id = 'fallback';
    box.style.cssText = 'text-align:center;padding:40px 24px;'
      + 'font-family:Consolas,monospace;color:#fff';

    var quote = document.createElement('div');
    quote.id = 'fallback-quote';
    quote.style.cssText = 'font-size:32px;text-transform:uppercase;'
      + 'letter-spacing:2px;line-height:1.5;margin:0 auto;max-width:90%;'
      + 'word-wrap:break-word';

    var author = document.createElement('div');
    author.id = 'fallback-author';
    author.style.cssText = 'margin-top:24px;font-size:16px;'
      + 'color:rgba(255,255,255,0.55);letter-spacing:3px;'
      + 'text-transform:uppercase';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = 'ANOTHER QUOTE';
    btn.style.cssText = 'margin-top:40px;padding:14px 28px;font:inherit;'
      + 'font-size:16px;background:rgba(255,255,255,0.1);color:#fff;'
      + 'border:1px solid rgba(255,255,255,0.3);cursor:pointer';
    btn.onclick = function () { getQuote(render); };

    box.appendChild(quote);
    box.appendChild(author);
    box.appendChild(btn);
    buildPicker(box);
    document.body.appendChild(box);

    getQuote(render);
    applyRotation(storeGet());
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 0);
  } else if (window.addEventListener) {
    window.addEventListener('DOMContentLoaded', init);
  }
}());
