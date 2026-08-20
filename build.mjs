/**
 * あそびずかん — 静的サイト生成
 *   node build.mjs        → dist/ に出力
 *
 * 1あそび＝1URL。カードは実リンクなので、クロールも共有もできる。
 * 絞り込みは トップページ内のUIのみ（URLは作らない）。
 * 遊びが50件を超えたら 絞り込みページの追加を検討する。
 */
import { readFile, writeFile, mkdir, cp, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const ORIGIN = 'https://asobizukan.com';

const GAMES = eval(await readFile(path.join(ROOT,'src/games.js'),'utf8') + '; GAMES');
const CSS   = await readFile(path.join(ROOT,'src/style.css'),'utf8');
const FONTS = await readFile(path.join(ROOT,'fonts/fonts.css'),'utf8');

const SLUGS = ['nandemo-basket','shingenchi','jintori','keshigomu-otoshi','e-shiritori',
  'dare-ga-kawatta','koori-oni','keidoro','hachinoji-tobi','kami-zumou','yubi-suma',
  'ayatori','kami-hikouki','ng-word','senaka-moji-ate','ousama-dodge'];

const plain = s => s.replace(/\{([^|}]+)\|[^}]+\}/g,'$1');
const ruby  = s => s.replace(/\{([^|}]+)\|([^}]+)\}/g,'<ruby>$1<rt>$2</rt></ruby>');
const esc   = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const no    = i => String(i+1).padStart(2,'0');
const TINT  = {'{教室|きょうしつ}':'t-room','{校|こう}てい':'t-out','どこでも':'t-any'};
const BADGE = {'{教室|きょうしつ}':'b-room','{校|こう}てい':'b-out','どこでも':'b-any'};
const PILL  = {'{教室|きょうしつ}':'p-room','{校|こう}てい':'p-out','どこでも':'p-any'};

const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E"
  + "%3Ctext y='.9em' font-size='90'%3E%F0%9F%93%96%3C/text%3E%3C/svg%3E";

function shell({ title, desc, canonical, ogImage, jsonld, body, script='' }) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<link rel="icon" href="${FAVICON}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="あそびずかん">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" as="font" type="font/woff2" href="/fonts/ZenMaruGothic-500.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="/fonts/DelaGothicOne-400.woff2" crossorigin>
<style>${FONTS}${CSS}</style>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body>
<div class="top"><div class="wrap">
  <a class="logo" href="/" style="text-decoration:none;color:inherit"><span class="dot"></span>あそびずかん</a>
  <div class="spacer"></div>
  <button class="furi-btn" id="furi" aria-pressed="true"><span class="box"></span>ふりがな</button>
</div></div>
${body}
<footer><div class="wrap">
  <p class="fnote">あそびずかん — ${ruby('{休|やす}み{時間|じかん}')}に できる ${ruby('{遊|あそ}び')}の ずかん</p>
  <p class="fcopy">© 2026 <a href="https://stendear.com" target="_blank" rel="noopener noreferrer">Stendear</a></p>
</div></footer>
<script>
document.getElementById('furi').onclick=()=>{
  const on=document.documentElement.classList.toggle('furigana');
  document.getElementById('furi').setAttribute('aria-pressed',String(on));
  try{ localStorage.setItem('furigana', on?'1':'0'); }catch(e){}
};
(function(){ let on=true; try{ on=localStorage.getItem('furigana')!=='0'; }catch(e){}
  document.documentElement.classList.toggle('furigana',on);
  document.getElementById('furi').setAttribute('aria-pressed',String(on)); })();
</script>
${script}
</body>
</html>
`;
}

const card = (g,i,cls='card') => `
    <a class="${cls}" href="/asobi/${SLUGS[i]}/" data-i="${i}" style="--i:${i}">
      <span class="thumbwrap">
        <span class="thumb ${TINT[g.place]}"><img src="/img/${no(i)}.webp" alt="${esc(plain(g.n))}" width="800" height="600" loading="lazy"></span>
        <span class="badge ${BADGE[g.place]}">${no(i)}</span>
      </span>
      <span class="cardbody">
        <span class="place ${PILL[g.place]}">${ruby(g.place)}</span>
        <h3>${ruby(g.n)}</h3>
        <p class="tag">${ruby(g.tag)}</p>
        <span class="meta">
          <span class="metatxt"><span class="num">${g.min}</span>ふん・${ruby(g.size)}</span>
          <span class="lvl" aria-label="もりあがり ${g.fun}／5">${
            Array.from({length:5},(_,k)=>`<i class="${k<g.fun?'on':''}"></i>`).join('')}</span></span>
      </span>
    </a>`;

// ── トップページ ──
const TIME=[{v:'5ふんだけ',max:5},{v:'15ふんある',max:15},{v:'30ぷんある',max:999}];
const uniq=k=>[...new Set(GAMES.map(g=>g[k]))];
const FILTERS={ place:uniq('place'), size:uniq('size'), gear:uniq('gear'), noise:uniq('noise') };
const chips=(k,vals)=>vals.map(v=>`<button class="chip" data-k="${k}" data-v="${esc(v)}" aria-pressed="false">${ruby(v)}</button>`).join('');

const topBody = `
<div class="wrap">
  <div class="hero">
    <h1>きょうの${ruby('{休|やす}み{時間|じかん}')}、<br>なにして<span class="hl">${ruby('{遊|あそ}ぶ')}</span>？</h1>
    <p>${ruby('{5分|ごふん}しかない{休|やす}み{時間|じかん}でも、{中|なか}{休|やす}みでも、{昼|ひる}{休|やす}みでも。ある{時間|じかん}と{人数|にんずう}をえらぶと、いますぐできる{遊|あそ}びが{見|み}つかります。')}</p>
  </div>
  <div class="roulette">
    <button class="roulette-btn" id="spin">きょう なにする？</button>
    <div class="roulette-out" id="pick"><span class="label">ボタンをおすと 1つ えらびます</span></div>
  </div>
  <div class="filters">
    <div class="frow"><span class="flabel label">じかん</span><span class="opts" id="f-time">${
      TIME.map(t=>`<button class="chip" data-k="time" data-v="${t.v}" aria-pressed="false">${t.v}</button>`).join('')}</span></div>
    ${Object.entries(FILTERS).map(([k,v])=>
      `<div class="frow"><span class="flabel label">${{place:'ばしょ',size:'にんずう',gear:'どうぐ',noise:'しずかさ'}[k]}</span><span class="opts" id="f-${k}">${chips(k,v)}</span></div>`).join('\n    ')}
    <div class="count"><b id="n">${GAMES.length}</b><span>この あそびが みつかりました</span>
      <button class="reset" id="reset">ぜんぶ もどす</button></div>
  </div>
  <div class="grid" id="grid">${GAMES.map((g,i)=>card(g,i)).join('')}</div>
</div>`;

const topScript = `<script>
const DATA=${JSON.stringify(GAMES.map((g,i)=>({i,min:g.min,place:g.place,size:g.size,gear:g.gear,noise:g.noise,n:plain(g.n),slug:SLUGS[i]})))};
const TIME=${JSON.stringify(TIME)};
const active={time:null,place:null,size:null,gear:null,noise:null};
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const cards=[...document.querySelectorAll('#grid .card')];
const matches=()=>{const cap=active.time?TIME.find(t=>t.v===active.time).max:999;
  return DATA.filter(d=>d.min<=cap&&(!active.place||d.place===active.place)&&(!active.size||d.size===active.size)
    &&(!active.gear||d.gear===active.gear)&&(!active.noise||d.noise===active.noise));};
let countFrom=DATA.length;
function countTo(t){const el=document.getElementById('n');
  if(reduced||countFrom===t||document.hidden){el.textContent=t;countFrom=t;return;}
  const f=countFrom,t0=performance.now();
  const tick=x=>{const p=Math.min(1,(x-t0)/340),e=1-Math.pow(1-p,3);
    el.textContent=Math.round(f+(t-f)*e); if(p<1)requestAnimationFrame(tick);};
  requestAnimationFrame(tick); countFrom=t;}
function render(){const keep=new Set(matches().map(d=>d.i));
  let k=0; cards.forEach(c=>{const on=keep.has(+c.dataset.i);
    c.style.display=on?'':'none'; if(on){c.style.setProperty('--i',k++);}});
  countTo(keep.size);
  document.getElementById('empty').style.display=keep.size?'none':'';}
document.addEventListener('click',e=>{const c=e.target.closest('.chip'); if(!c)return;
  const{k,v}=c.dataset; active[k]=active[k]===v?null:v;
  document.querySelectorAll('.chip[data-k="'+k+'"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===active[k])));
  render();});
document.getElementById('reset').onclick=()=>{for(const k in active)active[k]=null;
  document.querySelectorAll('.chip').forEach(b=>b.setAttribute('aria-pressed','false'));render();};
const out=document.getElementById('pick');
document.getElementById('spin').onclick=()=>{const list=matches();
  if(!list.length){out.innerHTML='<span class="label">じょうけんに あう あそびが ありません</span>';return;}
  const go=d=>{out.innerHTML='<span class="label">きょうは これ</span><span class="win">'+d.n+'</span>';
    location.href='/asobi/'+d.slug+'/';};
  if(reduced){go(list[Math.floor(Math.random()*list.length)]);return;}
  let i=0,delay=55; out.classList.add('spin');
  const step=()=>{out.innerHTML='<span class="label">えらんでいます…</span>'+list[i++%list.length].n;
    delay*=1.16; if(delay<190)setTimeout(step,delay);
    else{out.classList.remove('spin');go(list[Math.floor(Math.random()*list.length)]);}};
  step();};
</script>`;

// ── 出力 ──
await rm(DIST,{recursive:true,force:true});
await mkdir(DIST,{recursive:true});

await writeFile(path.join(DIST,'index.html'), shell({
  title:'あそびずかん｜休み時間にできる遊びを 時間・場所・人数からさがす',
  desc:'休み時間にできる遊びを、ある時間・場所・人数・道具から探せます。5分の休み時間でも、中休みでも、昼休みでも。ふりがな付きで'+GAMES.length+'種類の遊び方を紹介。',
  canonical:ORIGIN+'/', ogImage:ORIGIN+'/ogp.png',
  jsonld:{'@context':'https://schema.org','@type':'CollectionPage',name:'あそびずかん',url:ORIGIN+'/',
    inLanguage:'ja',hasPart:GAMES.map((g,i)=>({'@type':'Article',name:plain(g.n),url:`${ORIGIN}/asobi/${SLUGS[i]}/`}))},
  body: topBody.replace('</div>\n</div>','</div>\n</div>')
        .replace('<div class="grid" id="grid">','<p class="empty" id="empty" style="display:none">その くみあわせの あそびは まだ ありません。じょうけんを 1つ へらしてみて ください。</p>\n  <div class="grid" id="grid">'),
  script: topScript,
}));

for (let i=0;i<GAMES.length;i++){
  const g=GAMES[i], slug=SLUGS[i], url=`${ORIGIN}/asobi/${slug}/`;
  const rel = GAMES.map((x,j)=>({x,j})).filter(o=>o.j!==i && o.x.place===g.place).slice(0,3);
  const more = rel.length<3 ? GAMES.map((x,j)=>({x,j})).filter(o=>o.j!==i&&!rel.some(r=>r.j===o.j)).slice(0,3-rel.length) : [];
  const related=[...rel,...more];
  const body=`
<div class="wrap">
  <nav class="crumb"><a href="/">あそびずかん</a><span>›</span>${ruby(g.n)}</nav>
  <div class="detail">
    <div class="fig">
      <span class="thumbwrap">
        <span class="thumb ${TINT[g.place]}"><img src="/img/${no(i)}.webp" alt="${esc(plain(g.n))}のあそび方" width="800" height="600"></span>
        <span class="badge ${BADGE[g.place]}">${no(i)}</span>
      </span>
    </div>
    <div>
      <span class="place ${PILL[g.place]}">${ruby(g.place)}</span>
      <h1>${ruby(g.n)}</h1>
      <p class="lede">${ruby(g.tag)}</p>
      <div class="facts">
        <span class="fact">にんずう<b>${ruby(g.size)}</b></span>
        <span class="fact">じかん<b><span class="num">${g.min}</span>ふんくらい</b></span>
        <span class="fact">どうぐ<b>${ruby(g.gear)}</b></span>
        <span class="fact">こえ<b>${g.noise}</b></span>
      </div>
    </div>
  </div>
  <div class="sec"><h2>あそび${ruby('{方|かた}')}</h2>
    <ol class="rules">${g.rules.map(r=>`<li><span>${ruby(r)}</span></li>`).join('')}</ol></div>
  <div class="sec"><div class="tips"><b>じょうずに やる コツ</b>${ruby(g.tip)}</div></div>
  <div class="nav-actions">
    <a class="primary" href="/">ぜんぶの あそびを ${ruby('{見|み}る')}</a>
    <a href="/asobi/${SLUGS[(i+1)%GAMES.length]}/">つぎの あそび ›</a>
  </div>
  <div class="sec"><h2>にた あそび</h2>
    <div class="related">${related.map(o=>card(o.x,o.j)).join('')}</div></div>
</div>`;
  await mkdir(path.join(DIST,'asobi',slug),{recursive:true});
  await writeFile(path.join(DIST,'asobi',slug,'index.html'), shell({
    title:`${plain(g.n)}のあそび方｜${plain(g.place)}でできる遊び ｜ あそびずかん`,
    desc:`${plain(g.tag)} ${plain(g.size)}・${g.min}分くらい・どうぐは${plain(g.gear)}。ルールとコツをふりがな付きで紹介します。`,
    canonical:url, ogImage:`${ORIGIN}/img/${no(i)}.webp`,
    jsonld:{'@context':'https://schema.org','@graph':[
      {'@type':'BreadcrumbList',itemListElement:[
        {'@type':'ListItem',position:1,name:'あそびずかん',item:ORIGIN+'/'},
        {'@type':'ListItem',position:2,name:plain(g.n),item:url}]},
      {'@type':'Article',headline:plain(g.n)+'のあそび方',description:plain(g.tag),
       inLanguage:'ja',image:`${ORIGIN}/img/${no(i)}.webp`,mainEntityOfPage:url}]},
    body,
  }));
}

for (const d of ['img','fonts']) await cp(path.join(ROOT,d), path.join(DIST,d), {recursive:true});
await rm(path.join(DIST,'fonts','.src'),{recursive:true,force:true});
await rm(path.join(DIST,'fonts','fonts.css'),{force:true});
await cp(path.join(ROOT,'ogp.png'), path.join(DIST,'ogp.png'));
await writeFile(path.join(DIST,'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
const today=new Date().toISOString().slice(0,10);
await writeFile(path.join(DIST,'sitemap.xml'),
`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
+ `  <url><loc>${ORIGIN}/</loc><lastmod>${today}</lastmod><priority>1.0</priority></url>\n`
+ SLUGS.map(s=>`  <url><loc>${ORIGIN}/asobi/${s}/</loc><lastmod>${today}</lastmod><priority>0.8</priority></url>`).join('\n')
+ `\n</urlset>\n`);

const files=async d=>{let n=0;for(const e of await readdir(d,{withFileTypes:true}))n+= e.isDirectory()?await files(path.join(d,e.name)):1;return n;};
console.log(`生成 ${1+GAMES.length} ページ / ファイル ${await files(DIST)} 個`);
