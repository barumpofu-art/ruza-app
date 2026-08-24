// Builds kalahari-manager.html: the whole game as one file that runs from a
// phone's Downloads folder with no server and no network.
//
//   node build/build-offline.mjs
//
// esbuild flattens the ES modules into a single classic script, because
// browsers refuse to load module imports over file://.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = join(root, 'build', '.bundle.js');

execFileSync('npx', ['--yes', 'esbuild', join(root, 'js/main.js'),
  '--bundle', '--format=iife', '--target=es2020', `--outfile=${tmp}`], { stdio: 'inherit' });

const script = readFileSync(tmp, 'utf8');
const css = readFileSync(join(root, 'styles.css'), 'utf8');
let html = readFileSync(join(root, 'index.html'), 'utf8');
rmSync(tmp);

html = html
  // A lone file has no sibling assets to point at.
  .replace('<link rel="manifest" href="manifest.webmanifest">\n', '')
  .replace('<link rel="apple-touch-icon" href="icon-192.png">\n', '')
  .replace('<link rel="stylesheet" href="styles.css">', `<style>\n${css}\n</style>`)
  .replace('<script type="module" src="js/main.js"></script>', `<script>\n${script}\n</script>`)
  .replace('<title>Kalahari Manager</title>', '<title>Kalahari Manager</title>\n<!-- Single-file offline build. Open it in any browser; progress is saved in the browser. -->');

if (html.includes('src="js/main.js"') || html.includes('href="styles.css"')) {
  throw new Error('inlining failed — index.html tags did not match');
}

const out = join(root, 'kalahari-manager.html');
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)}kb)`);
