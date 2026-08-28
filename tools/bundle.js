#!/usr/bin/env node
// Builds docs/play.html: the whole game as ONE self-contained file that runs
// from a double-click, with no server and no install. Regenerate with:
//
//   npm run bundle
//
// esbuild is fetched on demand by npx rather than being a dependency — the
// game itself still has none.
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const OUT = resolve(ROOT, 'docs/play.html');
const TMP = resolve(tmpdir(), `qot-bundle-${process.pid}.js`);

execFileSync('npx', ['--yes', 'esbuild', resolve(ROOT, 'src/main.js'),
  '--bundle', '--format=iife', '--minify', `--outfile=${TMP}`], { stdio: 'inherit' });

const [head, tail, js] = await Promise.all([
  readFile(resolve(ROOT, 'tools/play-head.html'), 'utf8'),
  readFile(resolve(ROOT, 'tools/play-tail.html'), 'utf8'),
  readFile(TMP, 'utf8'),
]);

await writeFile(OUT, head + js.replace(/<\/script/gi, '<\\/script') + '\n' + tail);
console.log(`wrote docs/play.html (${Math.round((await readFile(OUT)).length / 1024)} KB)`);
