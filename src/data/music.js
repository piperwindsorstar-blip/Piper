// ============================================================================
//  MUSIC TRACKS — declarative {tempo, loop, channels} data for the tracker in
//  src/engine/audio.js. Every track is two voices (a square-wave melody over
//  a triangle-wave bass), the same instrumentation the sound effects already
//  use, so the whole soundtrack stays inside one small synthesised palette.
// ============================================================================

export const TITLE_THEME = {
  tempo: 96,
  loop: true,
  channels: [
    { wave: 'square', gain: 0.11, notes: [
      ['A4', 4], ['C5', 4], ['E5', 4], ['D5', 4],
      ['C5', 4], ['B4', 4], ['A4', 8],
    ] },
    { wave: 'triangle', gain: 0.09, notes: [
      ['A3', 8], ['F3', 8], ['G3', 8], ['E3', 8],
    ] },
  ],
};

export const FIELD_THEME = {
  tempo: 128,
  loop: true,
  channels: [
    { wave: 'square', gain: 0.10, notes: [
      ['C5', 4], ['E5', 4], ['G5', 4], ['E5', 4],
      ['F5', 4], ['A5', 4], ['G5', 8],
    ] },
    { wave: 'triangle', gain: 0.08, notes: [
      ['C3', 8], ['G3', 8], ['A3', 8], ['F3', 8],
    ] },
  ],
};

export const TOWN_THEME = {
  tempo: 100,
  loop: true,
  channels: [
    { wave: 'square', gain: 0.09, notes: [
      ['F4', 4], ['A4', 4], ['C5', 4], ['A4', 4],
      ['Bb4', 4], ['D5', 4], ['C5', 8],
    ] },
    { wave: 'triangle', gain: 0.08, notes: [
      ['F3', 8], ['C3', 8], ['D3', 8], ['Bb2', 8],
    ] },
  ],
};

export const BATTLE_THEME = {
  tempo: 150,
  loop: true,
  channels: [
    { wave: 'square', gain: 0.11, notes: [
      ['D5', 2], ['D5', 2], ['F5', 2], ['D5', 2], ['A5', 4], ['G5', 2], ['F5', 2], ['E5', 2],
      ['D5', 4], ['C5', 2], ['D5', 2], ['E5', 4],
    ] },
    { wave: 'triangle', gain: 0.10, notes: [
      ['D3', 2], ['D3', 2], ['A2', 2], ['A2', 2], ['Bb2', 2], ['Bb2', 2], ['C3', 2], ['C3', 2],
    ] },
  ],
};

export const BOSS_THEME = {
  tempo: 160,
  loop: true,
  channels: [
    { wave: 'square', gain: 0.12, notes: [
      ['E5', 2], ['F5', 2], ['E5', 2], ['D5', 2], ['E5', 2], ['G5', 2], ['F5', 2], ['E5', 2],
      ['E5', 4], ['D5', 2], ['C5', 2], ['B4', 4], ['B4', 4],
    ] },
    { wave: 'triangle', gain: 0.11, notes: [
      ['E2', 2], ['E2', 2], ['F2', 2], ['F2', 2], ['G2', 2], ['G2', 2], ['D2', 2], ['D2', 2],
    ] },
  ],
};

export const VICTORY_THEME = {
  tempo: 140,
  loop: true,
  channels: [
    { wave: 'square', gain: 0.13, notes: [
      ['C5', 2], ['C5', 2], ['C5', 2], ['G4', 2], ['A4', 2], ['C5', 2], ['G4', 4],
      ['-', 2], ['C5', 2], ['E5', 2], ['G5', 4],
    ] },
    { wave: 'triangle', gain: 0.09, notes: [
      ['C3', 13], ['G2', 13],
    ] },
  ],
};

export const GAMEOVER_THEME = {
  tempo: 70,
  loop: true,
  channels: [
    { wave: 'square', gain: 0.09, notes: [
      ['D4', 4], ['C4', 4], ['Bb3', 4], ['A3', 4],
    ] },
    { wave: 'triangle', gain: 0.08, notes: [
      ['D2', 8], ['A2', 8],
    ] },
  ],
};
