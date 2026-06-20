// audio.js — Eldenmoor's whole soundscape, synthesized live with the Web Audio
// API. NO downloaded files: every pad, gust of wind, birdsong and clink is
// generated from oscillators and filtered noise in code.
//
// Self-contained and self-initializing: it polls for window.eldenmoor (set up by
// main.js once you start the game), then exposes:
//
//   window.eldenmoor.audio.play(name)   // one-shot SFX or music control
//   window.eldenmoor.audio.toggleMute() // mute / unmute everything
//
// SFX names: 'chop', 'click', 'pickup', 'levelup', 'hit'.
// It also draws its own little mute button (top-right) and binds the M key.
//
// Browsers forbid starting audio without a user gesture, so the AudioContext is
// created/resumed on the first click anywhere (which includes "Play Solo").

// ============================================================================
//  Core: a single AudioContext, a master gain, and gesture-gated startup.
// ============================================================================
const AudioCtx = window.AudioContext || window.webkitAudioContext;

let ctx = null;          // the AudioContext (created on first gesture)
let master = null;       // master gain -> destination
let musicGain = null;    // music bed bus
let ambientGain = null;  // wind / birds bus
let sfxGain = null;      // event sound bus
let muted = false;
let volume = 0.9;        // master volume 0..1 (persisted in localStorage)
try {
  const sv = localStorage.getItem('eldenmoor.volume'); if (sv != null) volume = Math.max(0, Math.min(1, parseFloat(sv) || 0));
  if (localStorage.getItem('eldenmoor.muted') === '1') muted = true;
} catch (e) { /* localStorage may be blocked */ }
let started = false;     // have we begun the music/ambient beds?
let musicTimer = null;   // setTimeout handle for the next bar
let ambientTimer = null; // setTimeout handle for the next bird chirp

const now = () => ctx.currentTime;

// Build the audio graph the first time we're allowed to make noise.
function ensureContext() {
  if (ctx) return ctx;
  ctx = new AudioCtx();

  master = ctx.createGain();
  master.gain.value = muted ? 0 : volume;
  master.connect(ctx.destination);

  musicGain = ctx.createGain();
  musicGain.gain.value = 0.34;             // gentle bed, sits under everything
  musicGain.connect(master);

  ambientGain = ctx.createGain();
  ambientGain.gain.value = 0.5;
  ambientGain.connect(master);

  sfxGain = ctx.createGain();
  sfxGain.gain.value = 0.85;
  sfxGain.connect(master);

  return ctx;
}

// Resume + kick off the beds. Safe to call repeatedly.
function startAudio() {
  ensureContext();
  if (ctx.state === 'suspended') ctx.resume();
  if (started) return;
  started = true;
  // wind/water-rush bed removed by request — keep music + birdsong only
  scheduleMusic();
  scheduleBird();
}

// ============================================================================
//  A reusable noise buffer (for wind, birds, percussive transients).
// ============================================================================
let _noiseBuf = null;
function noiseBuffer() {
  if (_noiseBuf) return _noiseBuf;
  const len = ctx.sampleRate * 2;          // 2s of white noise, looped
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  _noiseBuf = buf;
  return buf;
}

// ============================================================================
//  MUSIC BED — a slow, loopable medieval-fantasy progression.
//  Two warm detuned saw "pads" hold the chord while a soft triangle arpeggio
//  drifts over the top. Everything is rescheduled bar-by-bar so it loops forever
//  without clicks or buffer seams.
// ============================================================================

// Note frequencies (equal temperament), keyed by name. A minor-ish modal feel.
const NOTE = (() => {
  const names = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];
  const map = {};
  for (let oct = 2; oct <= 6; oct++) {
    for (let i = 0; i < 12; i++) {
      const midi = (oct + 1) * 12 + i;     // MIDI number
      map[names[i] + oct] = 440 * Math.pow(2, (midi - 69) / 12);
    }
  }
  return map;
})();

// A gentle four-chord loop (Am – F – C – G feel) voiced low for a pad, plus the
// arpeggio tones drawn from each chord. Quiet, spacious, fantasy-tavern calm.
const PROGRESSION = [
  { pad: ['A2', 'E3', 'A3'], arp: ['A3', 'C4', 'E4', 'A4'] },
  { pad: ['F2', 'C3', 'A3'], arp: ['F3', 'A3', 'C4', 'F4'] },
  { pad: ['C3', 'G3', 'E4'], arp: ['C4', 'E4', 'G4', 'C5'] },
  { pad: ['G2', 'D3', 'B3'], arp: ['G3', 'B3', 'D4', 'G4'] },
];
let barIndex = 0;
const BAR_SECONDS = 4.0;                    // slow, ~bar every 4s

// One sustained pad voice: two detuned saws through a lowpass, slow swell.
function playPad(freq, t0, dur) {
  const o1 = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  o1.type = 'sawtooth'; o2.type = 'sawtooth';
  o1.frequency.value = freq;
  o2.frequency.value = freq;
  o2.detune.value = 7;                      // shimmer

  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 700;
  filt.Q.value = 0.6;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.16, t0 + dur * 0.4);   // slow swell in
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);       // and out

  o1.connect(filt); o2.connect(filt);
  filt.connect(g); g.connect(musicGain);
  o1.start(t0); o2.start(t0);
  o1.stop(t0 + dur + 0.05); o2.stop(t0 + dur + 0.05);
}

// One soft arpeggio pluck (triangle, short bell-ish envelope).
function playArp(freq, t0, dur) {
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(musicGain);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

// Schedule one bar, then set a timer to schedule the next — loops forever.
function scheduleMusic() {
  if (!ctx) return;
  const bar = PROGRESSION[barIndex % PROGRESSION.length];
  const t0 = now() + 0.05;

  for (const n of bar.pad) if (NOTE[n]) playPad(NOTE[n], t0, BAR_SECONDS);

  // four arpeggio notes spread across the bar
  const step = BAR_SECONDS / bar.arp.length;
  bar.arp.forEach((n, i) => {
    if (NOTE[n]) playArp(NOTE[n], t0 + i * step, step * 0.9);
  });

  barIndex++;
  musicTimer = setTimeout(scheduleMusic, BAR_SECONDS * 1000);
}

// ============================================================================
//  AMBIENT — a soft wind bed (filtered, slowly-modulated noise) and the
//  occasional far-off birdsong (a couple of quick whistled tones).
// ============================================================================
let windNodes = null;
function startWind() {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  src.loop = true;

  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = 500;
  filt.Q.value = 0.7;

  const g = ctx.createGain();
  g.gain.value = 0.05;          // wind / water-rush bed — kept low so the music carries

  // a slow LFO breathing the wind's volume up and down (gusts)
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.035;
  lfo.connect(lfoGain); lfoGain.connect(g.gain);

  // a second, slower LFO sweeping the filter for movement
  const lfo2 = ctx.createOscillator();
  lfo2.frequency.value = 0.05;
  const lfo2Gain = ctx.createGain();
  lfo2Gain.gain.value = 220;
  lfo2.connect(lfo2Gain); lfo2Gain.connect(filt.frequency);

  src.connect(filt); filt.connect(g); g.connect(ambientGain);
  src.start(); lfo.start(); lfo2.start();
  windNodes = { src, lfo, lfo2 };
}

// One short whistled bird "tweet": a couple of quick gliding sine blips.
function playBird(t0) {
  const blips = 2 + Math.floor(Math.random() * 3);
  let t = t0;
  for (let i = 0; i < blips; i++) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    const base = 1800 + Math.random() * 1400;
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.5), t + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g); g.connect(ambientGain);
    o.start(t); o.stop(t + 0.12);
    t += 0.09 + Math.random() * 0.06;
  }
}

// Chirp every so often (random gaps), forever.
function scheduleBird() {
  if (!ctx) return;
  playBird(now() + 0.05);
  const gap = 6000 + Math.random() * 12000;   // 6–18s between calls
  ambientTimer = setTimeout(scheduleBird, gap);
}

// ============================================================================
//  SFX — short synthesized one-shots for game events.
// ============================================================================

// Tree chop: a low filtered-noise "thock" with a quick woody pitch knock.
function sfxChop() {
  const t = now();
  // noise burst
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 900;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  src.connect(filt); filt.connect(g); g.connect(sfxGain);
  src.start(t); src.stop(t + 0.18);
  // woody knock
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.12);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.35, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  o.connect(og); og.connect(sfxGain);
  o.start(t); o.stop(t + 0.16);
}

// UI click: a tiny clean blip.
function sfxClick() {
  const t = now();
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(660, t);
  o.frequency.exponentialRampToValueAtTime(880, t + 0.04);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.18, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  o.connect(g); g.connect(sfxGain);
  o.start(t); o.stop(t + 0.08);
}

// Item pickup: two bright ascending sine notes (a little "ting-ting").
function sfxPickup() {
  const t = now();
  [880, 1320].forEach((f, i) => {
    const tt = t + i * 0.08;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, tt);
    g.gain.exponentialRampToValueAtTime(0.2, tt + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.18);
    o.connect(g); g.connect(sfxGain);
    o.start(tt); o.stop(tt + 0.2);
  });
}

// Level-up: a triumphant little rising fanfare arpeggio.
function sfxLevelup() {
  const t = now();
  const notes = [NOTE['C4'], NOTE['E4'], NOTE['G4'], NOTE['C5']];
  notes.forEach((f, i) => {
    const tt = t + i * 0.11;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const o2 = ctx.createOscillator();   // a fifth-ish sparkle on top
    o2.type = 'sine';
    o2.frequency.value = f * 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, tt);
    g.gain.exponentialRampToValueAtTime(0.22, tt + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.35);
    o.connect(g); o2.connect(g); g.connect(sfxGain);
    o.start(tt); o.stop(tt + 0.37);
    o2.start(tt); o2.stop(tt + 0.37);
  });
}

// Generic hit: a short punchy filtered-noise thud with a downward pitch.
function sfxHit() {
  const t = now();
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.setValueAtTime(1200, t);
  filt.frequency.exponentialRampToValueAtTime(300, t + 0.1);
  filt.Q.value = 1.0;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.4, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  src.connect(filt); filt.connect(g); g.connect(sfxGain);
  src.start(t); src.stop(t + 0.14);
  // low thump body
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(50, t + 0.1);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.3, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(og); og.connect(sfxGain);
  o.start(t); o.stop(t + 0.14);
}

const SFX = {
  chop: sfxChop,
  click: sfxClick,
  pickup: sfxPickup,
  levelup: sfxLevelup,
  hit: sfxHit,
};

// ============================================================================
//  Public API
// ============================================================================

// play(name): start the audio engine if needed, then fire a named SFX.
// Also accepts 'music'/'start' as a no-op-ish way to ensure the beds are going.
function play(name) {
  startAudio();                 // first call doubles as the gesture-driven start
  if (!ctx) return;
  if (name === 'music' || name === 'start') return;   // beds already running
  const fn = SFX[name];
  if (fn) {
    try { fn(); } catch (err) { /* ignore transient audio errors */ }
  }
}

function setMuted(m) {
  muted = m;
  if (master) {
    const t = ctx ? now() : 0;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(muted ? 0 : volume, t + 0.08);
  }
  try { localStorage.setItem('eldenmoor.muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
  updateAudioUI();
}

function toggleMute() {
  setMuted(!muted);
  return muted;
}

// Master volume 0..1. Dragging the slider above zero also unmutes.
function setVolume(v) {
  volume = Math.max(0, Math.min(1, isFinite(v) ? v : 0));
  if (volume > 0 && muted) muted = false;
  if (master) {
    const t = ctx ? now() : 0;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(muted ? 0 : volume, t + 0.05);
  }
  try { localStorage.setItem('eldenmoor.volume', String(volume)); localStorage.setItem('eldenmoor.muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
  updateAudioUI();
}
function getVolume() { return volume; }

// ============================================================================
//  Mute button (drawn from JS, no edits to index.html) + the M key.
// ============================================================================
let audioPanel = null, muteBtn = null, volSlider = null;
function makeAudioControls() {
  if (audioPanel) return;
  audioPanel = document.createElement('div');
  audioPanel.id = 'audio-controls';
  audioPanel.style.cssText = [
    'position:fixed', 'top:276px', 'right:14px', 'z-index:60',  // bottom of the top-right stack (under minimap/logout/saved)
    'display:flex', 'align-items:center', 'gap:6px',
    'background:rgba(20,16,10,0.82)', 'border:1px solid #b9892f', 'border-radius:8px',
    'padding:3px 9px 3px 3px', 'user-select:none',
  ].join(';');

  muteBtn = document.createElement('button');
  muteBtn.id = 'audio-mute';
  muteBtn.title = 'Mute / unmute (M)';
  muteBtn.style.cssText = [
    'width:32px', 'height:32px', 'cursor:pointer', 'background:transparent',
    'color:#ffd100', 'border:none', 'font:18px Georgia,serif', 'line-height:1',
    'display:flex', 'align-items:center', 'justify-content:center',
  ].join(';');
  muteBtn.addEventListener('click', (e) => { e.stopPropagation(); startAudio(); toggleMute(); });

  volSlider = document.createElement('input');
  volSlider.type = 'range'; volSlider.min = '0'; volSlider.max = '100'; volSlider.step = '1';
  volSlider.id = 'audio-vol'; volSlider.title = 'Volume';
  volSlider.value = String(Math.round(volume * 100));
  volSlider.style.cssText = ['width:96px', 'cursor:pointer', 'accent-color:#ffd100'].join(';');
  // a slider drag is a valid gesture to start audio; keep it from rotating the camera
  volSlider.addEventListener('input', (e) => { e.stopPropagation(); startAudio(); setVolume(parseInt(volSlider.value, 10) / 100); });
  volSlider.addEventListener('pointerdown', (e) => { e.stopPropagation(); });

  audioPanel.appendChild(muteBtn);
  audioPanel.appendChild(volSlider);
  document.body.appendChild(audioPanel);
  updateAudioUI();
}

function updateAudioUI() {
  if (muteBtn) {
    muteBtn.textContent = muted ? '🔇' : (volume < 0.34 ? '🔈' : (volume < 0.67 ? '🔉' : '🔊'));
    muteBtn.style.color = muted ? '#9a8a7a' : '#ffd100';
  }
  if (volSlider && document.activeElement !== volSlider) volSlider.value = String(Math.round(volume * 100));
}

// ============================================================================
//  Start-up wiring: a first-gesture handler + self-initialization.
// ============================================================================
function installGestureStart() {
  const kick = () => {
    startAudio();
    if (ctx && ctx.state === 'running') {
      window.removeEventListener('pointerdown', kick, true);
      window.removeEventListener('keydown', kick, true);
    }
  };
  // capture phase so we run before anything stops propagation
  window.addEventListener('pointerdown', kick, true);
  window.addEventListener('keydown', kick, true);
}

function installKeybind() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') {
      // don't steal the key while typing in a field
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      startAudio();
      toggleMute();
    }
  });
}

// Poll for window.eldenmoor (created by main.js when the game starts), then wire
// in. If the page sits on the login screen we still want a working mute button
// and the gesture handler ready, so we self-init even before the game object
// exists — and attach .audio onto it as soon as it appears.
(function boot() {
  if (!AudioCtx) { console.warn('[audio] Web Audio API unavailable'); return; }

  // Set up DOM + gesture handlers right away (login screen is fine).
  makeAudioControls();
  installGestureStart();
  installKeybind();

  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const em = window.eldenmoor;
    if (em) {
      clearInterval(iv);
      try {
        em.audio = { play, toggleMute, isMuted: () => muted, setVolume, getVolume, ctx: () => ctx };
      } catch (err) {
        console.error('[audio] failed to attach', err);
      }
    } else if (tries > 1200) {   // ~120s — give up quietly
      clearInterval(iv);
    }
  }, 100);
})();
