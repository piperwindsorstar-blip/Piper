// ============================================================================
//  CAVEMARKER — the overworld's cave-entrance icon: a rocky outcrop with a
//  dark mouth, bigger and more detailed than the old 24px ground stamp, so
//  it reads clearly next to the town and labyrinth markers instead of
//  disappearing into the grass underfoot.
// ============================================================================

import { make } from './pixel.js';

const ROCK = '#7a6d58', ROCK_D = '#4e4536', ROCK_HI = '#9c8d70';
const VOID = '#1c1620', VOID_D = '#08060c', VOID_DEEP = '#000000';
const INK = '#100c08';

export const CAVE_W = 34, CAVE_H = 26;

export function caveSprite() {
  return make('cavemarker|cave', CAVE_W, CAVE_H, (P) => {
    const cx = CAVE_W / 2;
    // craggy rock mass, wider than tall, roughly a rounded ridge
    P.tri(2, 4, CAVE_W - 4, 8, ROCK, 1);
    P.rect(2, 8, CAVE_W - 4, CAVE_H - 12, ROCK);
    P.rect(2, 8, 6, CAVE_H - 12, ROCK_HI);
    P.rect(CAVE_W - 8, 8, 6, CAVE_H - 12, ROCK_D);
    // a few jagged highlight/shadow facets
    P.rect(6, 6, 4, 3, ROCK_HI);
    P.rect(CAVE_W - 12, 5, 5, 3, ROCK_D);
    P.rect(10, CAVE_H - 8, 3, 2, ROCK_D);
    // the dark mouth itself, three nested ellipses for real depth
    P.ellipse(cx, CAVE_H - 9, 11, 8, VOID);
    P.ellipse(cx, CAVE_H - 8, 9, 6, VOID_D);
    P.ellipse(cx, CAVE_H - 7, 6, 4, VOID_DEEP);
    // scree at the base
    P.rect(0, CAVE_H - 3, CAVE_W, 3, ROCK_D);
    P.speck([[4, CAVE_H - 2], [9, CAVE_H - 1], [CAVE_W - 6, CAVE_H - 2], [CAVE_W - 11, CAVE_H - 1]], ROCK_HI);
  }, { outline: INK, ao: 0.16, rim: '#fff6dc', rimAlpha: 0.22, grain: 0.06 });
}
