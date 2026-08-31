// ============================================================================
//  AUDIO — every sound and every note of music in this game is synthesised
//  live from oscillators and filtered noise; there is not one audio file
//  anywhere. Two buses (sfx, music) run through a master gain so either can
//  be muted independently, and the whole thing stays silent and inert until
//  a real user gesture unlocks it, since no browser will start an
//  AudioContext on its own.
// ============================================================================

const KEY = 'qot13.audio';

function readSettings() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; }
}
function writeSettings(patch) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...readSettings(), ...patch })); } catch { /* ignore */ }
}

let ctx = null;
let master = null, sfxBus = null, musicBus = null;
let noiseBuffer = null;
let muted = readSettings().muted ?? false;
let sfxVol = readSettings().sfxVol ?? 0.8;
let musicVol = readSettings().musicVol ?? 0.55;

/** True once an AudioContext exists and can actually make sound. */
export function audioReady() { return !!ctx; }

/**
 * Build the graph on the first real gesture. Safe to call many times —
 * only the first call does anything. Call sites: a global pointerdown/
 * keydown listener installed once at boot, so the very first tap or key
 * anywhere unlocks sound without any scene needing to know about it.
 */
export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  ctx = new Ctx();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = sfxVol;
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = musicVol;
  musicBus.connect(master);

  // one shared 2-second noise buffer, reused (sliced) by every percussive
  // sound instead of allocating fresh random samples each time
  const len = Math.floor(ctx.sampleRate * 2);
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}

export function isMuted() { return muted; }
export function setMuted(v) {
  muted = v;
  writeSettings({ muted });
  if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02);
}
export function toggleMuted() { setMuted(!muted); return muted; }

export function getSfxVolume() { return sfxVol; }
export function setSfxVolume(v) {
  sfxVol = Math.max(0, Math.min(1, v));
  writeSettings({ sfxVol });
  if (sfxBus) sfxBus.gain.setTargetAtTime(sfxVol, ctx.currentTime, 0.02);
}
export function getMusicVolume() { return musicVol; }
export function setMusicVolume(v) {
  musicVol = Math.max(0, Math.min(1, v));
  writeSettings({ musicVol });
  if (musicBus) musicBus.gain.setTargetAtTime(musicVol, ctx.currentTime, 0.02);
}

// ---------------------------------------------------------------------------
//  LOW-LEVEL VOICES
// ---------------------------------------------------------------------------

/**
 * A single oscillator voice with a short percussive/AD envelope — the
 * building block for almost every sound effect. `sweep` glides the pitch
 * from `freq` to `freq*sweep` across the note, which is what turns a flat
 * tone into a "blip" or a "whoop".
 */
function tone(t, freq, dur, {
  type = 'square', gain = 0.2, attack = 0.005, release = 0.08,
  sweep = 1, detune = 0, dest = sfxBus,
} = {}) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (sweep !== 1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq * sweep), t + dur);
  osc.detune.value = detune;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur + release);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + attack + dur + release + 0.02);
  return { osc, gain: g };
}

/** A short burst of the shared noise buffer through a bandpass/lowpass
 *  filter — every drum, hit, whoosh and footstep is this with different
 *  filter settings. */
function noise(t, dur, {
  gain = 0.2, filter = 'lowpass', freq = 1200, Q = 1, attack = 0.002, release = 0.06, dest = sfxBus,
} = {}) {
  if (!ctx || !noiseBuffer) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = false;
  const off = Math.random() * (noiseBuffer.duration - dur - 0.1);
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = Q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur + release);
  src.connect(f).connect(g).connect(dest);
  src.start(t, Math.max(0, off));
  src.stop(t + attack + dur + release + 0.02);
}

const now = () => (ctx ? ctx.currentTime : 0);

// ---------------------------------------------------------------------------
//  NOTES — equal temperament, A4 = 440Hz, for the music sequencer and any
//  sfx that wants a real pitch rather than a raw frequency.
// ---------------------------------------------------------------------------
const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function noteFreq(name) {
  if (!name || name === '-') return 0;
  const m = /^([A-G])(#|b)?(-?\d+)$/.exec(name);
  if (!m) return 0;
  let n = NOTE_INDEX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const octave = parseInt(m[3], 10);
  const semis = (n - NOTE_INDEX.A) + (octave - 4) * 12;
  return 440 * Math.pow(2, semis / 12);
}

// ---------------------------------------------------------------------------
//  SOUND EFFECTS
// ---------------------------------------------------------------------------

export const sfx = {
  move() { const t = now(); tone(t, 520, 0.03, { type: 'square', gain: 0.09, release: 0.03 }); },
  confirm() {
    const t = now();
    tone(t, 660, 0.045, { type: 'square', gain: 0.12, release: 0.04 });
    tone(t + 0.045, 880, 0.06, { type: 'square', gain: 0.12, release: 0.05 });
  },
  cancel() { const t = now(); tone(t, 320, 0.07, { type: 'square', gain: 0.1, sweep: 0.6, release: 0.05 }); },
  error() {
    const t = now();
    tone(t, 160, 0.09, { type: 'sawtooth', gain: 0.12, sweep: 0.85, release: 0.05 });
    tone(t + 0.09, 120, 0.12, { type: 'sawtooth', gain: 0.1, sweep: 0.8, release: 0.08 });
  },
  cursorEdge() { const t = now(); tone(t, 200, 0.04, { type: 'square', gain: 0.08, release: 0.02 }); },

  hit(crit = false) {
    const t = now();
    noise(t, crit ? 0.09 : 0.05, { gain: crit ? 0.34 : 0.24, filter: 'lowpass', freq: crit ? 2200 : 1400, release: 0.09 });
    tone(t, crit ? 180 : 140, 0.06, { type: 'triangle', gain: crit ? 0.3 : 0.2, sweep: 0.5, release: 0.1 });
    if (crit) {
      tone(t + 0.02, 1200, 0.08, { type: 'square', gain: 0.14, sweep: 1.6, release: 0.12 });
      tone(t + 0.05, 1700, 0.07, { type: 'square', gain: 0.1, sweep: 1.4, release: 0.1 });
    }
  },
  miss() {
    const t = now();
    noise(t, 0.12, { gain: 0.14, filter: 'bandpass', freq: 900, Q: 0.6, release: 0.1 });
    tone(t, 500, 0.12, { type: 'sine', gain: 0.08, sweep: 1.8, release: 0.08 });
  },
  guard() {
    const t = now();
    noise(t, 0.05, { gain: 0.2, filter: 'highpass', freq: 1800, release: 0.06 });
    tone(t, 900, 0.05, { type: 'square', gain: 0.12, sweep: 0.8, release: 0.05 });
  },
  heal() {
    const t = now();
    ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => {
      tone(t + i * 0.055, noteFreq(n), 0.14, { type: 'sine', gain: 0.14, release: 0.14 });
    });
  },
  buff() {
    const t = now();
    tone(t, noteFreq('C5'), 0.1, { type: 'triangle', gain: 0.12, sweep: 1.5, release: 0.1 });
    tone(t + 0.05, noteFreq('G5'), 0.12, { type: 'triangle', gain: 0.1, sweep: 1.3, release: 0.12 });
  },
  debuff() {
    const t = now();
    tone(t, noteFreq('G4'), 0.12, { type: 'triangle', gain: 0.11, sweep: 0.55, release: 0.12 });
    tone(t + 0.06, noteFreq('D4'), 0.14, { type: 'triangle', gain: 0.1, sweep: 0.6, release: 0.14 });
  },
  statusBad() { const t = now(); tone(t, 220, 0.16, { type: 'sawtooth', gain: 0.1, sweep: 0.5, release: 0.1 }); },

  castArcane() {
    const t = now();
    for (let i = 0; i < 5; i++) tone(t + i * 0.028, 700 + i * 160, 0.05, { type: 'sine', gain: 0.08, release: 0.06 });
    noise(t, 0.2, { gain: 0.06, filter: 'highpass', freq: 3000, release: 0.15 });
  },
  castFire() {
    const t = now();
    noise(t, 0.22, { gain: 0.2, filter: 'bandpass', freq: 500, Q: 0.7, release: 0.15 });
    tone(t, 140, 0.2, { type: 'sawtooth', gain: 0.14, sweep: 1.8, release: 0.15 });
  },
  castIce() {
    const t = now();
    ['E6', 'C6', 'G6'].forEach((n, i) => tone(t + i * 0.04, noteFreq(n), 0.14, { type: 'sine', gain: 0.11, release: 0.16 }));
  },
  castLightning() {
    const t = now();
    noise(t, 0.05, { gain: 0.24, filter: 'highpass', freq: 4000, release: 0.05 });
    tone(t, 1400, 0.03, { type: 'square', gain: 0.16, sweep: 0.3, release: 0.03 });
    tone(t + 0.04, 900, 0.04, { type: 'square', gain: 0.12, sweep: 0.4, release: 0.04 });
  },

  levelUp() {
    const t = now();
    ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((n, i) => {
      tone(t + i * 0.07, noteFreq(n), 0.16, { type: 'square', gain: 0.14, release: 0.12 });
    });
  },
  promote() {
    const t = now();
    ['C4', 'E4', 'G4', 'C5', 'G4', 'C5', 'E5'].forEach((n, i) => {
      tone(t + i * 0.09, noteFreq(n), 0.16, { type: 'triangle', gain: 0.15, release: 0.14 });
    });
    noise(t + 0.55, 0.2, { gain: 0.1, filter: 'highpass', freq: 3500, release: 0.2 });
  },
  victory() {
    const t = now();
    const mel = ['C5', 'C5', 'C5', 'G4', 'A4', 'C5', 'G4', '-', 'C5', 'E5', 'G5'];
    let at = 0;
    for (const n of mel) {
      if (n !== '-') tone(t + at, noteFreq(n), 0.14, { type: 'square', gain: 0.14, release: 0.1 });
      at += 0.11;
    }
  },
  defeat() {
    const t = now();
    ['C4', 'B3', 'Bb3', 'A3'].forEach((n, i) => {
      tone(t + i * 0.22, noteFreq(n), 0.3, { type: 'sawtooth', gain: 0.14, sweep: 0.9, release: 0.2 });
    });
  },
  flee() { const t = now(); tone(t, 500, 0.18, { type: 'triangle', gain: 0.12, sweep: 1.7, release: 0.12 }); },

  coin() {
    const t = now();
    tone(t, noteFreq('B5'), 0.05, { type: 'square', gain: 0.13, release: 0.03 });
    tone(t + 0.05, noteFreq('E6'), 0.14, { type: 'square', gain: 0.13, release: 0.12 });
  },
  purchase() {
    const t = now();
    tone(t, noteFreq('C5'), 0.05, { type: 'square', gain: 0.1, release: 0.04 });
    tone(t + 0.05, noteFreq('G5'), 0.1, { type: 'square', gain: 0.1, release: 0.08 });
  },
  equip() {
    const t = now();
    noise(t, 0.04, { gain: 0.16, filter: 'bandpass', freq: 2500, Q: 2, release: 0.05 });
    tone(t, 700, 0.04, { type: 'square', gain: 0.08, sweep: 0.7, release: 0.05 });
  },
  save() {
    const t = now();
    ['G4', 'C5'].forEach((n, i) => tone(t + i * 0.08, noteFreq(n), 0.13, { type: 'sine', gain: 0.12, release: 0.12 }));
  },
  chest() {
    const t = now();
    noise(t, 0.06, { gain: 0.18, filter: 'lowpass', freq: 900, release: 0.06 });
    ['C5', 'E5', 'G5'].forEach((n, i) => tone(t + 0.05 + i * 0.05, noteFreq(n), 0.12, { type: 'triangle', gain: 0.12, release: 0.1 }));
  },
  door() {
    const t = now();
    noise(t, 0.1, { gain: 0.12, filter: 'lowpass', freq: 500, release: 0.12 });
  },
  step() { const t = now(); noise(t, 0.02, { gain: 0.035, filter: 'lowpass', freq: 350, release: 0.02 }); },
  encounter() {
    const t = now();
    tone(t, 220, 0.05, { type: 'square', gain: 0.14, release: 0.03 });
    tone(t + 0.06, 220, 0.05, { type: 'square', gain: 0.14, release: 0.03 });
    noise(t, 0.3, { gain: 0.08, filter: 'highpass', freq: 2000, release: 0.25 });
  },
  menuOpen() { const t = now(); tone(t, 440, 0.05, { type: 'triangle', gain: 0.1, sweep: 1.4, release: 0.05 }); },
  menuClose() { const t = now(); tone(t, 440, 0.05, { type: 'triangle', gain: 0.1, sweep: 0.7, release: 0.05 }); },
};

// ---------------------------------------------------------------------------
//  MUSIC — a tiny tracker. A track is {tempo, loop, channels:[{wave,gain,
//  notes:[[note,len,vel?],...]}]}. `len` is in 16th notes. `note` of '-' or
//  null is a rest. The scheduler runs a standard look-ahead loop (poll every
//  25ms, schedule anything due in the next 100ms against ctx.currentTime)
//  so tempo never drifts the way setTimeout-per-note would.
// ---------------------------------------------------------------------------

class MusicPlayer {
  constructor() {
    this.track = null;
    this.name = null;
    this.timer = null;
    this.nextTime = 0;
    this.step = 0;
    this.stepsPerChannel = [];
    this.fade = null;
  }

  play(name, track, { fadeIn = 0.6 } = {}) {
    if (this.name === name) return;
    this.stop(0.25);
    if (!ctx || !track) { this.name = name; this.track = null; return; }
    this.name = name;
    this.track = track;
    this.step = 0;
    this.stepsPerChannel = track.channels.map(() => 0);
    this.nextTime = ctx.currentTime + 0.06;
    this.gate = ctx.createGain();
    this.gate.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.gate.gain.exponentialRampToValueAtTime(1, ctx.currentTime + fadeIn);
    this.gate.connect(musicBus);
    this.timer = setInterval(() => this.tick(), 25);
  }

  stop(fade = 0.4) {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.gate && ctx) {
      const g = this.gate;
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fade);
      setTimeout(() => { try { g.disconnect(); } catch { /* already gone */ } }, (fade + 0.1) * 1000);
    }
    this.gate = null;
    this.name = null;
    this.track = null;
  }

  tick() {
    if (!ctx || !this.track) return;
    const secPerStep = 60 / this.track.tempo / 4;               // a step is a 16th note
    while (this.nextTime < ctx.currentTime + 0.1) {
      this.track.channels.forEach((ch, ci) => {
        const pattern = ch.notes;
        const total = pattern.length;
        if (total === 0) return;
        // find the note that starts at this global 16th-step (patterns can
        // have different total lengths, so each channel tracks its own
        // position independently and wraps on its own loop length)
        const patLen = pattern.reduce((s, n) => s + n[1], 0);
        const pos = this.stepsPerChannel[ci] % patLen;
        let acc = 0, idx = 0;
        for (; idx < total; idx++) { if (pos < acc + pattern[idx][1]) break; acc += pattern[idx][1]; }
        if (pos === acc) this.playNote(ch, pattern[idx], this.nextTime, secPerStep);
      });
      this.step++;
      for (let ci = 0; ci < this.stepsPerChannel.length; ci++) this.stepsPerChannel[ci]++;
      this.nextTime += secPerStep;
    }
  }

  playNote(ch, entry, t, secPerStep) {
    const [note, len, vel] = entry;
    if (!note || note === '-') return;
    const dur = Math.max(0.03, len * secPerStep * 0.86);
    const freq = noteFreq(note);
    if (!freq) return;
    const osc = ctx.createOscillator();
    osc.type = ch.wave ?? 'square';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    const peak = (ch.gain ?? 0.12) * (vel ?? 1);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.gate);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}

const music = new MusicPlayer();
export function playMusic(name, track, opts) { music.play(name, track, opts); }
export function stopMusic(fade) { music.stop(fade); }
export function currentMusic() { return music.name; }

// ---------------------------------------------------------------------------
//  BOOT — the first pointerdown/keydown/touchstart anywhere unlocks audio.
//  Scenes never need to think about this; it just becomes available.
// ---------------------------------------------------------------------------
let installed = false;
export function installAudioUnlock() {
  if (installed) return;
  installed = true;
  const unlock = () => unlockAudio();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true, passive: true });
}
