// ============================================================================
//  TILES — 24x24 world tiles.
//
//  Each is a fixed pattern (never randomised, so a field of them is seamless)
//  built from a four-to-six tone ramp. At 24px there is room for real form:
//  grass gets clumps and blades rather than noise, stone gets courses and
//  mortar, water gets swell and crest, roofs get individual tiles.
// ============================================================================

import { make, shade } from './pixel.js';

export const TS = 24;

const T = {};

T.grass = (P) => {
  P.rect(0, 0, TS, TS, '#4c7d40');
  P.speck([[1, 2], [2, 2], [8, 1], [9, 1], [15, 3], [21, 2], [5, 7], [6, 7],
    [12, 8], [18, 6], [22, 9], [2, 12], [9, 13], [14, 12], [20, 14],
    [4, 18], [10, 19], [16, 17], [22, 20], [7, 22], [13, 21], [19, 23]], '#5b9150');
  P.speck([[4, 4], [11, 5], [17, 9], [1, 9], [7, 15], [13, 16], [23, 5],
    [3, 21], [15, 22], [20, 11], [9, 10], [0, 16]], '#3e6837');
  for (const [x, y] of [[3, 5], [12, 3], [19, 8], [7, 11], [16, 14], [2, 17], [21, 18], [10, 22]]) {
    P.px(x, y - 1, '#74a860'); P.px(x + 1, y - 1, '#74a860');
    P.px(x, y, '#5b9150'); P.px(x, y + 1, '#33552c');
  }
};

T.road = (P) => {
  P.rect(0, 0, TS, TS, '#a08a62');
  P.dither(0, 0, TS, TS, '#b39a70', 0.42);
  P.speck([[3, 4], [14, 2], [8, 10], [19, 13], [1, 17], [11, 20], [22, 7], [6, 15]], '#7a6547');
  P.speck([[5, 2], [17, 8], [2, 11], [20, 19], [12, 14], [9, 5]], '#cbb391');
  P.rect(0, 23, TS, 1, '#8a7554');
};

T.sand = (P) => {
  P.rect(0, 0, TS, TS, '#d6be88');
  P.dither(0, 0, TS, TS, '#e6d3a2', 0.4);
  P.speck([[5, 4], [15, 8], [9, 16], [3, 12], [20, 19], [12, 2], [18, 13]], '#bda36c');
  P.rect(2, 7, 5, 1, '#c9b17d'); P.rect(13, 17, 6, 1, '#c9b17d');
};

T.water = (P) => {
  P.rect(0, 0, TS, TS, '#1d3f72');
  P.speck([[2, 8], [11, 10], [19, 21], [7, 22], [15, 1], [22, 14]], '#18345f');
  for (const y of [3, 13]) {
    P.rect(0, y, TS, 4, '#2b5893');
    P.rect(0, y, TS, 1, '#3a6db0');
  }
  P.rect(2, 3, 6, 1, '#78a8de'); P.rect(13, 4, 5, 1, '#78a8de');
  P.rect(7, 13, 6, 1, '#78a8de'); P.rect(17, 14, 4, 1, '#78a8de');
  P.rect(3, 4, 3, 1, '#a8ccf0'); P.rect(9, 14, 3, 1, '#a8ccf0');
};

T.shore = (P) => {
  P.rect(0, 0, TS, 4, '#ccb384');
  P.rect(0, 0, TS, 1, '#e0c99c');
  P.rect(0, 4, TS, 1, '#b19a70');
  P.speck([[3, 2], [9, 3], [16, 2], [21, 3], [6, 1], [13, 1]], '#b19a70');
};

T.tree = (P) => {
  T.grass(P);
  P.rect(10, 17, 4, 7, '#3d2a14');
  P.rect(10, 17, 1, 7, '#5c3d1c');
  P.rect(9, 22, 6, 2, '#2c1e0f');
  P.ellipse(12, 11, 10, 10, '#153c0e');
  P.ellipse(12, 10, 9, 8, '#215420');
  P.ellipse(9, 8, 7, 6, '#2f7128');
  P.ellipse(14, 7, 5, 4, '#286326');
  P.ellipse(8, 6, 4, 3, '#3f9034');
  P.speck([[6, 4], [10, 3], [4, 8], [13, 4], [7, 2]], '#5cb44a');
  P.speck([[17, 14], [13, 17], [7, 16], [18, 10], [15, 15]], '#0f2c0a');
};

T.forest = (P) => {
  P.rect(0, 0, TS, TS, '#173f10');
  P.ellipse(6, 6, 8, 7, '#215420');
  P.ellipse(18, 8, 8, 6, '#215420');
  P.ellipse(12, 18, 9, 7, '#215420');
  P.ellipse(5, 5, 5, 4, '#2f7128');
  P.ellipse(17, 6, 4, 3, '#2f7128');
  P.ellipse(11, 16, 6, 4, '#2f7128');
  P.speck([[3, 3], [15, 4], [9, 14], [20, 17], [6, 19], [21, 3]], '#3f9034');
  P.speck([[11, 9], [1, 13], [22, 11], [14, 22], [0, 6], [17, 13]], '#0f2c0a');
};

T.mountain = (P) => {
  T.grass(P);
  for (let y = 0; y < TS; y++) {
    const half = Math.max(1, Math.round((y + 1) * 12 / TS));
    const x0 = 12 - half, x1 = 12 + half;
    P.rect(x0, y, half, 1, '#968770');
    P.rect(12, y, x1 - 12, 1, '#5e5347');
    P.px(x0, y, '#312b24');
    P.px(x1 - 1, y, '#312b24');
    if (y < 7) {
      P.rect(x0 + 1, y, Math.max(1, half - 1), 1, '#e8ecf6');
      P.rect(12, y, Math.max(1, half - 1), 1, '#bcc4d8');
    }
  }
  P.speck([[8, 14], [15, 17], [6, 20], [17, 21], [11, 18], [13, 12]], '#7d7160');
  P.speck([[14, 15], [9, 21], [16, 13]], '#4a4238');
  P.rect(0, 23, TS, 1, '#312b24');
};

T.ridge = (P) => {
  T.grass(P);
  const prof = [8, 7, 6, 5, 4, 3, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 3, 4, 5, 6, 7];
  for (let x = 0; x < TS; x++) {
    const top = prof[x];
    const lit = (x % 12) < 6;
    for (let y = top; y < TS; y++) P.px(x, y, lit ? '#968770' : '#5e5347');
    P.px(x, top, '#312b24');
    if (top <= 3) P.rect(x, top + 1, 1, 3, lit ? '#e8ecf6' : '#bcc4d8');
  }
  P.speck([[4, 14], [15, 16], [9, 20], [19, 15], [12, 21], [2, 18]], '#7d7160');
  P.rect(0, 23, TS, 1, '#312b24');
};

T.rock = (P) => {
  P.rect(0, 0, TS, TS, '#71665a');
  P.speck([[2, 3], [8, 1], [14, 4], [20, 2], [5, 9], [11, 7], [17, 10], [22, 8],
    [3, 15], [9, 13], [15, 16], [21, 14], [6, 21], [12, 19], [18, 22]], '#8c8070');
  P.speck([[5, 5], [16, 2], [10, 11], [1, 10], [19, 18], [7, 17], [13, 23], [22, 5]], '#564d43');
  P.speck([[6, 2], [6, 3], [7, 4], [16, 8], [16, 9], [3, 14], [4, 15], [12, 5],
    [20, 12], [20, 13], [9, 20]], '#443c33');
};

T.wall = (P) => {
  P.rect(0, 0, TS, TS, '#4b4557');
  P.dither(0, 0, TS, TS, '#565068', 0.35);
  for (let y = 0; y < TS; y += 8) {
    P.rect(0, y, TS, 1, '#292538');
    P.rect(0, y + 1, TS, 1, '#6a6480');
    const off = (y / 8) % 2 ? 6 : 0;
    for (let x = off; x < TS; x += 12) P.rect(x, y, 1, 8, '#292538');
  }
  P.dither(0, 0, TS, 4, '#7e7896', 0.28);
};

T.floor = (P) => {
  P.rect(0, 0, TS, TS, '#5d5770');
  P.dither(0, 0, TS, TS, '#6a6480', 0.34);
  P.rect(0, 0, TS, 1, '#7b7592');
  P.rect(0, 23, TS, 1, '#443f56');
  P.rect(11, 0, 1, TS, '#4e4962');
  P.speck([[4, 6], [16, 13], [9, 4], [20, 19], [2, 16], [14, 21]], '#514c66');
};

T.house = (P) => {
  P.rect(0, 0, TS, TS, '#cbaf86');
  P.speck([[3, 4], [13, 7], [19, 3], [7, 12], [16, 14], [4, 17], [21, 19]], '#bd9f74');
  P.speck([[9, 3], [17, 9], [2, 13], [12, 19]], '#dcc49a');
  P.rect(0, 0, TS, 3, '#7a5c3a');
  P.rect(0, 0, TS, 1, '#9a7448');
  P.rect(0, 17, TS, 7, '#8f8578');
  P.rect(0, 17, TS, 1, '#a89e90');
  P.speck([[2, 19], [8, 21], [14, 19], [20, 22], [5, 22], [17, 20]], '#a49a8c');
  for (let x = 0; x < TS; x += 8) P.rect(x, 17, 1, 7, '#6e655a');
  P.rect(0, 23, TS, 1, '#584f45');
};

T.roof = (P) => {
  P.rect(0, 0, TS, TS, '#9c4030');
  for (let y = 0; y < TS; y += 6) {
    P.rect(0, y, TS, 1, '#cc6a4e');
    P.rect(0, y + 5, TS, 1, '#6a2a1e');
    const off = (y / 6) % 2 ? 4 : 0;
    for (let x = off; x < TS; x += 8) P.rect(x, y + 1, 1, 4, '#7e3324');
  }
  P.speck([[3, 2], [12, 8], [19, 14], [7, 20], [21, 3]], '#dc8060');
};

T.door = (P) => {
  T.house(P);
  P.rect(4, 2, 16, 22, '#4a3018');
  P.rect(5, 3, 14, 21, '#6b4622');
  P.rect(5, 3, 14, 1, '#8f6534');
  P.rect(5, 3, 2, 21, '#7d5429');
  P.rect(5, 12, 14, 1, '#4a3018');
  P.speck([[8, 7], [14, 9], [10, 17], [16, 20]], '#7d5429');
  P.rect(15, 14, 3, 3, '#e8c860');
  P.px(15, 14, '#fff0b0');
};

T.town = (P) => {
  T.grass(P);
  P.rect(3, 10, 18, 12, '#cbaf86');
  P.rect(3, 10, 18, 1, '#dcc49a');
  P.rect(2, 9, 20, 1, '#6a2a1e');
  P.tri(0, 1, 24, 9, '#9c4030');
  P.tri(0, 1, 24, 6, '#cc6a4e');
  P.rect(9, 15, 6, 7, '#5a3c20');
  P.rect(9, 15, 6, 1, '#7a5430');
  P.rect(5, 13, 3, 3, '#6a90c8'); P.px(5, 13, '#a8ccf0');
  P.rect(16, 13, 3, 3, '#6a90c8'); P.px(16, 13, '#a8ccf0');
  P.rect(0, 23, TS, 1, '#3e6837');
};

T.cave = (P) => {
  P.rect(0, 0, TS, TS, '#5b5142');
  P.dither(0, 0, TS, TS, '#6b5f4c', 0.36);
  P.speck([[3, 4], [15, 2], [8, 8], [20, 6], [5, 16], [18, 18]], '#443c30');
  P.ellipse(12, 15, 10, 9, '#231d2a');
  P.ellipse(12, 17, 8, 7, '#120e18');
  P.ellipse(12, 19, 6, 5, '#04030a');
  P.rect(3, 6, 4, 1, '#7e7058');
  P.rect(16, 7, 5, 1, '#7e7058');
  P.rect(0, 23, TS, 1, '#332c22');
};

T.stairs = (P) => {
  P.rect(0, 0, TS, TS, '#4b4560');
  for (let i = 0; i < 5; i++) {
    const y = 2 + i * 4, x = 1 + i;
    P.rect(x, y, 22 - i * 2, 4, '#7b7592');
    P.rect(x, y, 22 - i * 2, 1, '#9d97b4');
    P.rect(x, y + 3, 22 - i * 2, 1, '#3d3850');
  }
  P.dither(0, 0, TS, TS, '#6a6480', 0.12);
};

T.chest = (P) => {
  T.floor(P);
  P.rect(3, 7, 18, 14, '#3a2410');
  P.rect(4, 8, 16, 5, '#8a5a28');
  P.dither(4, 8, 16, 5, '#a8703a', 0.38);
  P.rect(4, 8, 16, 1, '#c08c4a');
  P.rect(4, 14, 16, 6, '#7a4e22');
  P.dither(4, 14, 16, 6, '#8a5a28', 0.36);
  P.rect(3, 13, 18, 1, '#e8c860');
  P.rect(10, 12, 4, 6, '#e8c860');
  P.px(11, 15, '#3a2410');
  P.rect(3, 20, 18, 1, '#241608');
};

T.bridge = (P) => {
  T.water(P);
  P.rect(0, 3, TS, 18, '#7a5a34');
  P.dither(0, 3, TS, 18, '#8e6a3e', 0.4);
  P.rect(0, 3, TS, 1, '#a88a58');
  P.rect(0, 20, TS, 1, '#4e3a20');
  for (let x = 1; x < TS; x += 6) P.rect(x, 4, 1, 16, '#5e441f');
  P.rect(0, 10, TS, 1, '#684c26');
};

T.flower = (P) => {
  T.grass(P);
  for (const [x, y, c] of [[5, 6, '#f0e070'], [15, 4, '#e87890'], [9, 15, '#f0e070'],
    [18, 18, '#c890f0'], [3, 19, '#7ad0f0']]) {
    P.px(x, y + 1, '#3e6837');
    P.rect(x - 1, y, 3, 1, c);
    P.rect(x, y - 1, 1, 3, c);
    P.px(x, y, '#fff8d0');
  }
};

T.well = (P) => {
  T.grass(P);
  // stone ring
  P.ellipse(12, 16, 8, 6, '#78706a');
  P.ellipse(12, 16, 8, 6, '#8c8478');
  P.ellipse(12, 15, 7, 5, '#5a544c');
  P.ellipse(12, 14, 6, 4, '#100e0c');
  P.speck([[7, 13], [17, 12], [9, 18], [15, 17], [6, 16]], '#4a453e');
  // roof posts and crossbeam
  P.rect(4, 3, 2, 12, '#6b4622');
  P.rect(18, 3, 2, 12, '#6b4622');
  P.rect(3, 2, 18, 2, '#7d5429');
  P.rect(3, 2, 18, 1, '#966333');
  P.tri(1, -4, 22, 8, '#9c4030');
  P.tri(1, -4, 22, 5, '#cc6a4e');
  // bucket on a rope
  P.rect(11, 6, 1, 6, '#3a2f22');
  P.rect(9, 11, 5, 4, '#5a4630');
  P.rect(9, 11, 5, 1, '#7a5f40');
};

T.stall = (P) => {
  T.road(P);
  // trestle table
  P.rect(3, 15, 18, 7, '#6b4622');
  P.dither(3, 15, 18, 7, '#7d5429', 0.4);
  P.rect(3, 15, 18, 1, '#966333');
  P.rect(4, 22, 2, 2, '#3a2f22'); P.rect(18, 22, 2, 2, '#3a2f22');
  // goods laid out
  P.speck([[5, 16], [6, 17], [12, 16], [16, 17], [9, 18]], '#c85040');
  P.speck([[8, 16], [15, 16], [11, 18]], '#e8c860');
  P.speck([[6, 18], [14, 18], [19, 16]], '#5b9150');
  // striped awning
  P.tri(0, 0, 24, 11, '#a83838', 1);
  for (let x = 0; x < 24; x += 6) P.rect(x, 0, 3, 5, '#e0e0e0');
  P.rect(0, 10, 24, 1, '#6a2020');
  P.rect(1, 5, 1, 9, '#4a3018'); P.rect(22, 5, 1, 9, '#4a3018');
};

T.lamp = (P) => {
  T.road(P);
  // post
  P.rect(11, 8, 2, 15, '#2c2a30');
  P.rect(11, 8, 1, 15, '#3e3c44');
  P.rect(8, 22, 8, 2, '#221f24');
  // lamp head
  P.rect(9, 1, 6, 7, '#3e3c44');
  P.rect(10, 2, 4, 5, '#f8d878');
  P.rect(10, 2, 4, 2, '#fff4c0');
  P.rect(8, 0, 8, 1, '#221f24');
  P.rect(11, 8, 2, 1, '#221f24');
};

export const TILE_DRAW = T;
export const TILE_NAMES = Object.keys(T);

export function tileSprite(name) {
  const draw = T[name] ?? T.grass;
  return make(`tile|${name}`, TS, TS, draw);
}
