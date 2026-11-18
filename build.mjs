#!/usr/bin/env node
// Builds one self-contained HTML: Three.js + CSS + game, zero network requests.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(HERE, p), 'utf8');

const THREE_MIT = `MIT License

Copyright © 2010-2024 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const BANNER = `<!--
  MODU NIGHT WALK — 技术研究演示 / technical research demo
  NOT FOR RELEASE / 不发行. This is NOT a commercial game product and
  provides no official release, distribution or online service.
  Public source code does not grant permission to release or operate it.
  See DISCLAIMER.md in the source repository.

  Original code, text and generated assets:
    PolyForm Noncommercial License 1.0.0 — non-commercial use only.
    See LICENSE. Source-available, not OSI open source.

  Map data: © OpenStreetMap contributors, ODbL 1.0.
    https://www.openstreetmap.org/copyright
    ODbL text: https://opendatacommons.org/licenses/odbl/1-0/
    See DATA-LICENSE.md and LICENSES/ODbL-1.0.txt.
    The non-commercial license above does NOT apply to the map data.

  Three.js r169 — ${THREE_MIT.replace(/\n/g, '\n  ')}

  Third-party notices: THIRD-PARTY-NOTICES.md
-->`;

let three = read('vendor/three.module.js');
const exp = three.match(/export \{([\s\S]*?)\};?\s*$/);
if (!exp) throw new Error('three.module.js: export block not found');
const names = exp[1].split(',').map((s) => s.trim()).filter(Boolean);
const mappings = names.map((n) => {
  const m = n.match(/^(\S+)\s+as\s+(\S+)$/);
  return m ? `${m[2]}:${m[1]}` : n;
});
const headerEnd = three.indexOf('const REVISION');
if (headerEnd < 0) throw new Error('three.module.js: revision header not found');
const threeHeader = three.slice(0, headerEnd).trim();
const body = three.slice(headerEnd, exp.index);
three = `${threeHeader}\n\n/* Inlined so the page is fully offline and self-contained. */\nwindow.THREE=(function(){\n${body}\nreturn {${mappings.join(',')}};\n})();`;

let template = read('src/index.template.html');
const style = read('src/style.css');
const game = readdirSync(join(HERE, 'src/js')).filter((f) => f.endsWith('.js')).sort()
  .map((f) => `\n/* ================= ${f} ================= */\n` + read('src/js/' + f)).join('\n');
for (const [tag, value] of [['/*__STYLE__*/', style], ['/*__THREE__*/', three], ['/*__GAME__*/', game]]) {
  if (!template.includes(tag)) throw new Error('template tag missing: ' + tag);
  template = template.split(tag).join(value);
}
if (!template.includes('<head>')) throw new Error('template <head> not found');
template = template.replace('<head>', '<head>\n' + BANNER);
if (/\b(fetch\(|XMLHttpRequest|import\s*\(|@import\s+url|https?:\/\/[^\s"']+\.(js|css|png|jpg|woff2?))/i.test(game + style)) {
  console.warn('WARNING: possible network reference in source');
}
mkdirSync(join(HERE, 'dist'), { recursive: true });
const out = join(HERE, 'dist', 'modu-nightrun.html');
writeFileSync(out, template);
copyFileSync(out, join(HERE, 'modu-nightrun.html'));
console.log(`built ${out}  ${(template.length / 1024).toFixed(0)} KB`);
