/**
 * フォントのサブセット生成
 *
 *   npm run fonts
 *
 * Google Fonts 経由だと和文は 641KB / 44リクエストになるため、
 * サイトで実際に使う文字だけを含む woff2 を生成して自前配信する。
 *
 * ⚠ 本文に新しい漢字を追加したら必ず再実行すること。
 *   未収録の文字はシステムフォントで表示され、そこだけ書体が変わる。
 *
 * 文字の収集元は build.mjs と src/ の全ファイル。
 * （以前 src/games.js だけを見ていたため、build.mjs 側にしかない
 *   「遊」「違」が抜けて表示が崩れた。同じ事故を防ぐため全部を走査する）
 */
import subsetFont from 'subset-font';
import { readFile, writeFile, mkdir, stat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT  = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT   = path.join(ROOT, 'fonts');
const CACHE = path.join(OUT, '.src');

const FONTS = [
  { out:'DelaGothicOne-400', family:'Dela Gothic One', weight:400, file:'DelaGothicOne-Regular.ttf',
    url:'https://github.com/google/fonts/raw/main/ofl/delagothicone/DelaGothicOne-Regular.ttf' },
  { out:'ZenMaruGothic-500', family:'Zen Maru Gothic', weight:500, file:'ZenMaruGothic-Medium.ttf',
    url:'https://github.com/google/fonts/raw/main/ofl/zenmarugothic/ZenMaruGothic-Medium.ttf' },
  { out:'ZenMaruGothic-700', family:'Zen Maru Gothic', weight:700, file:'ZenMaruGothic-Bold.ttf',
    url:'https://github.com/google/fonts/raw/main/ofl/zenmarugothic/ZenMaruGothic-Bold.ttf' },
  { out:'ZenMaruGothic-900', family:'Zen Maru Gothic', weight:900, file:'ZenMaruGothic-Black.ttf',
    url:'https://github.com/google/fonts/raw/main/ofl/zenmarugothic/ZenMaruGothic-Black.ttf' },
  { out:'Archivo-600', family:'Archivo', weight:600, file:'Archivo.ttf', axes:{wght:600,wdth:100}, latin:true,
    url:'https://github.com/google/fonts/raw/main/ofl/archivo/Archivo%5Bwdth,wght%5D.ttf' },
  { out:'Archivo-700', family:'Archivo', weight:700, file:'Archivo.ttf', axes:{wght:700,wdth:100}, latin:true,
    url:'https://github.com/google/fonts/raw/main/ofl/archivo/Archivo%5Bwdth,wght%5D.ttf' },
];

const range = (a,b) => { let s=''; for (let c=a;c<=b;c++) s+=String.fromCodePoint(c); return s; };
// かな全域と記号は将来の追記に備えて常に入れる
const BASE = range(0x20,0x7e) + range(0x3041,0x309f) + range(0x30a0,0x30ff)
  + '　、。・「」『』（）！？〜ー－—…／：；＋×÷＝％①②③④⑤★☆●○◯■□▶►©℃㎝㎞〇々›»';
const LATIN = range(0x20,0x7e) + '　©›»';

async function collect() {
  let text = await readFile(path.join(ROOT,'build.mjs'),'utf8');
  for (const f of await readdir(path.join(ROOT,'src')))
    text += await readFile(path.join(ROOT,'src',f),'utf8');
  return text;
}

await mkdir(CACHE,{recursive:true});
const chars = [...new Set(await collect() + BASE)].filter(c=>c.codePointAt(0)>0x1f).join('');
console.log('収録文字数:', [...new Set(chars)].length);

let total = 0;
const css = [];
for (const f of FONTS) {
  const p = path.join(CACHE, f.file);
  try { await stat(p); } catch {
    process.stdout.write(`  取得 ${f.file} ... `);
    const r = await fetch(f.url);
    if (!r.ok) throw new Error(`${f.file}: ${r.status}`);
    await writeFile(p, Buffer.from(await r.arrayBuffer()));
    console.log('ok');
  }
  const sub = await subsetFont(await readFile(p), f.latin ? LATIN : chars,
    { targetFormat:'woff2', ...(f.axes ? { variationAxes:f.axes } : {}) });
  await writeFile(path.join(OUT, f.out+'.woff2'), sub);
  total += sub.length;
  css.push(`@font-face{font-family:"${f.family}";font-style:normal;font-weight:${f.weight};font-display:swap;src:url(/fonts/${f.out}.woff2) format("woff2")}`);
  console.log(`  ${f.out.padEnd(20)} ${(sub.length/1024).toFixed(1)}KB`);
}
await writeFile(path.join(OUT,'fonts.css'), css.join('\n')+'\n');
console.log(`合計 ${(total/1024).toFixed(1)}KB`);
