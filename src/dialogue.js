// dialogue.js — a simple Old School-style dialogue box, built entirely in JS so
// the UI Builder can style it later (clear IDs/classes, minimal inline styling).
//
// A "page" is either:
//   { speaker, text }                         — one line, click/space to continue
//   { speaker, text, options: [{label, onSelect}] } — a choice menu
// Pass a single page, an array of pages, or a string (treated as one page).
// onDone() fires when the box closes after the final page.

let box = null, nameEl = null, textEl = null, hintEl = null, optionsEl = null;
let pages = [], idx = 0, onDone = null, keyHandler = null;

function ensureDom() {
  if (box) return;
  box = document.createElement('div');
  box.id = 'dialogue-box';
  box.className = 'dialogue-box';
  box.hidden = true;
  // Minimal inline styling so it's usable before the UI Builder themes it.
  box.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:120;' +
    'width:min(640px,92vw);box-sizing:border-box;padding:14px 18px;background:rgba(20,16,10,0.94);' +
    'border:2px solid #b9892f;border-radius:10px;color:#f3ead3;font:15px/1.5 Georgia,serif;' +
    'box-shadow:0 6px 24px rgba(0,0,0,0.5);';

  nameEl = document.createElement('div');
  nameEl.id = 'dialogue-name';
  nameEl.className = 'dialogue-name';
  nameEl.style.cssText = 'color:#ffd100;font-weight:700;font-size:16px;margin-bottom:6px;letter-spacing:0.4px;';

  textEl = document.createElement('div');
  textEl.id = 'dialogue-text';
  textEl.className = 'dialogue-text';
  textEl.style.cssText = 'min-height:42px;';

  optionsEl = document.createElement('div');
  optionsEl.id = 'dialogue-options';
  optionsEl.className = 'dialogue-options';
  optionsEl.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:8px;';

  hintEl = document.createElement('div');
  hintEl.id = 'dialogue-hint';
  hintEl.className = 'dialogue-hint';
  hintEl.style.cssText = 'text-align:right;color:#b9892f;font-size:12px;margin-top:6px;font-style:italic;';
  hintEl.textContent = 'Click to continue ▸';

  box.append(nameEl, textEl, optionsEl, hintEl);
  document.body.appendChild(box);

  // Clicking the box advances; clicks on an option are handled separately.
  box.addEventListener('click', (e) => { if (!e.target.closest('.dialogue-option')) advance(); });
}

function renderPage() {
  const page = pages[idx];
  if (!page) { close(); return; }
  nameEl.textContent = page.speaker || '';
  nameEl.style.display = page.speaker ? 'block' : 'none';
  textEl.innerHTML = (page.text || '').replace(/\n/g, '<br>');
  optionsEl.innerHTML = '';
  if (page.options && page.options.length) {
    hintEl.style.display = 'none';
    for (const opt of page.options) {
      const row = document.createElement('div');
      row.className = 'dialogue-option';
      row.textContent = '• ' + opt.label;
      row.style.cssText = 'cursor:pointer;padding:6px 10px;border:1px solid #6a5a2f;border-radius:6px;background:rgba(60,48,24,0.5);';
      row.addEventListener('mouseenter', () => { row.style.background = 'rgba(120,96,40,0.6)'; });
      row.addEventListener('mouseleave', () => { row.style.background = 'rgba(60,48,24,0.5)'; });
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        const fn = opt.onSelect;
        close();
        if (fn) fn();
      });
      optionsEl.appendChild(row);
    }
  } else {
    hintEl.style.display = 'block';
    hintEl.textContent = idx >= pages.length - 1 ? 'Click to close ▸' : 'Click to continue ▸';
  }
}

function advance() {
  // A choice page must be answered by clicking an option, not by advancing.
  if (pages[idx] && pages[idx].options && pages[idx].options.length) return;
  idx++;
  if (idx >= pages.length) { close(); return; }
  renderPage();
}

// Open the dialogue box. `content` is a string, a page object, or an array of pages.
export function showDialogue(content, opts = {}) {
  ensureDom();
  if (typeof content === 'string') pages = [{ speaker: opts.speaker, text: content }];
  else if (Array.isArray(content)) pages = content.map((p) => (typeof p === 'string' ? { speaker: opts.speaker, text: p } : p));
  else pages = [content];
  idx = 0;
  onDone = opts.onDone || null;
  box.hidden = false;
  renderPage();
  if (!keyHandler) {
    keyHandler = (e) => {
      if (box.hidden) return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); advance(); }
      else if (e.code === 'Escape') close();
    };
    window.addEventListener('keydown', keyHandler);
  }
}

export function close() {
  if (!box) return;
  box.hidden = true;
  const done = onDone; onDone = null; pages = []; idx = 0;
  if (done) done();
}

export function isOpen() { return !!box && !box.hidden; }
