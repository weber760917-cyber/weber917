/**
 * generate-images.js
 * 讀取 brief.json 和 stories.json，生成 IG 圖卡 (1080x1080 PNG)
 * 輸出到 data/images/ 資料夾
 */

import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');
const IMG_DIR = join(DATA_DIR, 'images');

if (!existsSync(IMG_DIR)) mkdirSync(IMG_DIR, { recursive: true });

// ── 色票（Weber 品牌色）──
const C = {
  navy:    '#1B2A4A',
  navyDk:  '#111E35',
  gold:    '#D4A843',
  orange:  '#E8520A',
  teal:    '#1E6B4F',
  white:   '#FFFFFF',
  off:     '#F7F8FA',
  grey:    '#8A95A3',
  light:   '#EEF1F6',
  red:     '#C0392B',
};

// ── W Logo HTML snippet ──
const wLogo = (size=72, goldBg=true) => `
<div style="
  width:${size}px; height:${size}px; border-radius:50%;
  background:${goldBg ? C.gold : C.navy};
  display:flex; align-items:center; justify-content:center; flex-shrink:0;">
  <span style="font-size:${Math.round(size*0.5)}px; font-weight:900;
    color:${goldBg ? C.navyDk : C.gold}; line-height:1; font-family:'Noto Sans TC',sans-serif;">W</span>
</div>`;

// ── 共用 CSS ──
const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1080px; height:1080px; overflow:hidden;
    font-family:'Noto Sans TC','PingFang TC',sans-serif; }
`;

// ── HTML 模板：Story 封面卡 ──
function storyTitleCard(story) {
  const title = (story.title || '').replace(/，/g, '，\n').slice(0, 30);
  const hook  = (story.quote || story.hook || '').split('\n')[0].slice(0, 50);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>${BASE_CSS}
  body {
    background: linear-gradient(150deg, ${C.navyDk} 0%, ${C.navy} 65%, #243759 100%);
    color:${C.white}; position:relative;
  }
  /* 裝飾 */
  .ring {
    position:absolute; border-radius:50%; border:1px solid rgba(212,168,67,0.15);
  }
  /* 頂部 TAG */
  .tag {
    position:absolute; top:68px; left:72px;
    background:${C.gold}; color:${C.navyDk};
    font-size:26px; font-weight:900; letter-spacing:3px;
    padding:8px 24px; border-radius:6px;
  }
  /* 主標題 — 佔滿中央，最重要 */
  .title {
    position:absolute; top:190px; left:72px; right:72px;
    font-size:72px; font-weight:900; line-height:1.2;
    color:${C.gold};
    text-shadow: 0 4px 32px rgba(0,0,0,0.5);
    white-space:pre-wrap;
  }
  /* 金條 */
  .bar {
    position:absolute; top:580px; left:72px;
    width:60px; height:5px; background:${C.gold}; border-radius:3px;
  }
  /* Hook — 只有一行 */
  .hook {
    position:absolute; top:612px; left:72px; right:72px;
    font-size:32px; font-weight:400; line-height:1.5;
    color:rgba(255,255,255,0.80);
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  /* 底部品牌 */
  .brand {
    position:absolute; bottom:64px; left:72px; right:72px;
    display:flex; align-items:center; justify-content:space-between;
  }
  .brand-name { font-size:26px; font-weight:700; color:${C.gold}; }
  .brand-sub  { font-size:18px; color:rgba(255,255,255,0.4); margin-top:3px; }
</style></head><body>
  <!-- 裝飾圈 -->
  <div class="ring" style="width:520px;height:520px;top:-140px;right:-140px;"></div>
  <div class="ring" style="width:300px;height:300px;bottom:-60px;left:-60px;"></div>
  <div class="tag">案例故事</div>
  <div class="title">${title}</div>
  <div class="bar"></div>
  <div class="hook">${hook}</div>
  <div class="brand">
    <div>
      <div class="brand-name">樂爸 Weber</div>
      <div class="brand-sub">LINE / IG : weber917</div>
    </div>
    ${wLogo(68, true)}
  </div>
</body></html>`;
}

// ── HTML 模板：Story 解法卡 ──
function storySolutionCard(story) {
  const sol    = story.solution || {};
  const points = (sol.points || []).slice(0, 4);
  const boxColors = [C.navy, C.teal, C.orange, '#5B3FA0'];
  const boxHTML = points.map((p, i) => {
    const short = p.slice(0, 22);
    return `<div style="
      background:${boxColors[i]||C.navy}; border-radius:20px;
      padding:36px 30px; display:flex; flex-direction:column; justify-content:space-between;">
      <div style="font-size:52px;font-weight:900;color:${C.white};opacity:0.2;line-height:1;">${String(i+1).padStart(2,'0')}</div>
      <div style="font-size:28px;font-weight:700;color:${C.white};line-height:1.4;margin-top:12px;">${short}</div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>${BASE_CSS}
  body { background:${C.off}; }
  .header {
    background:linear-gradient(90deg,${C.navyDk} 0%,${C.navy} 100%);
    padding:52px 72px 44px;
  }
  .header-label { font-size:22px;color:${C.gold};font-weight:700;letter-spacing:2px;margin-bottom:10px; }
  .header-title { font-size:44px;font-weight:900;color:${C.white};line-height:1.25; }
  .grid { padding:40px 72px 0; display:grid; grid-template-columns:1fr 1fr; gap:24px; }
  .footer {
    position:absolute; bottom:44px; left:72px; right:72px;
    display:flex; justify-content:space-between; align-items:center;
  }
  .footer-name { font-size:24px;font-weight:700;color:${C.navy}; }
  .footer-sub  { font-size:16px;color:${C.grey};margin-top:2px; }
</style></head><body>
  <div class="header">
    <div class="header-label">Weber 的建議</div>
    <div class="header-title">${(sol.title||'行動方案').slice(0,20)}</div>
  </div>
  <div class="grid">${boxHTML}</div>
  <div class="footer">
    <div>
      <div class="footer-name">樂爸 Weber</div>
      <div class="footer-sub">LINE / IG : weber917</div>
    </div>
    ${wLogo(62, false)}
  </div>
</body></html>`;
}

// ── HTML 模板：市場早盤/收盤觀點卡 ──
function briefCard(brief) {
  const marketData = (brief.marketData || []).slice(0, 3);
  const punchline  = (brief.punchline || brief.summary || '').slice(0, 32);
  const keywords   = (brief.keywords || []).slice(0, 4);
  const modeLabel  = brief.mode === 'afternoon' ? '收盤觀點' : brief.mode === 'weekend' ? '週末分享' : '早盤觀點';

  const statsHTML = marketData.map(m => `
    <div style="flex:1;text-align:center;">
      <div style="font-size:20px;font-weight:700;color:rgba(255,255,255,0.45);letter-spacing:1px;margin-bottom:10px;">${m.label}</div>
      <div style="font-size:52px;font-weight:900;color:${C.white};letter-spacing:-1px;line-height:1;">${m.value}</div>
      <div style="font-size:26px;font-weight:700;margin-top:8px;color:${m.up ? '#52C97A' : '#F06868'};">${m.change}</div>
    </div>
  `).join(`<div style="width:1px;background:rgba(255,255,255,0.1);margin:0 8px;"></div>`);

  // 若無 marketData（週末），改顯示大標題
  const centerBlock = marketData.length > 0 ? `
    <div style="
      position:absolute; top:220px; left:72px; right:72px;
      display:flex; align-items:flex-start; justify-content:space-around;
      gap:16px; padding:44px 32px;
      background:rgba(255,255,255,0.05); border-radius:20px;
      border:1px solid rgba(212,168,67,0.2);">
      ${statsHTML}
    </div>
  ` : `
    <div style="position:absolute;top:220px;left:72px;right:72px;text-align:center;">
      <div style="font-size:52px;font-weight:900;color:${C.gold};line-height:1.3;">
        ${(brief.summary||'').slice(0,28)}
      </div>
    </div>
  `;

  const kwHTML = keywords.map(k =>
    `<span style="background:rgba(255,255,255,0.08);border:1px solid rgba(212,168,67,0.35);
      color:${C.gold};font-size:22px;font-weight:700;
      padding:7px 18px;border-radius:8px;letter-spacing:0.5px;">${k}</span>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>${BASE_CSS}
  body {
    background:linear-gradient(150deg,${C.navyDk} 0%,${C.navy} 60%,#1e3560 100%);
    color:${C.white}; position:relative;
  }
  .bg-glow {
    position:absolute;top:0;right:0;width:420px;height:420px;
    background:radial-gradient(circle at top right,rgba(212,168,67,0.12) 0%,transparent 60%);
  }
</style></head><body>
  <div class="bg-glow"></div>

  <!-- 頂部：日期 + mode tag -->
  <div style="position:absolute;top:68px;left:72px;right:72px;
    display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:22px;color:rgba(255,255,255,0.45);letter-spacing:1px;">${brief.dateLabel||''}</div>
    <div style="background:${C.gold};color:${C.navyDk};
      font-size:22px;font-weight:900;padding:7px 20px;border-radius:6px;">${modeLabel}</div>
  </div>

  <!-- 主標：今日市場 -->
  <div style="position:absolute;top:140px;left:72px;
    font-size:46px;font-weight:900;color:${C.white};">
    今日<span style="color:${C.gold};">市場</span>快報
  </div>

  <!-- 數字區塊 -->
  ${centerBlock}

  <!-- 金條 + Punchline -->
  <div style="position:absolute;top:570px;left:72px;
    width:55px;height:4px;background:${C.gold};border-radius:2px;"></div>
  <div style="position:absolute;top:606px;left:72px;right:72px;
    font-size:36px;font-weight:700;line-height:1.45;
    color:rgba(255,255,255,0.9);">${punchline}</div>

  <!-- 關鍵字 -->
  <div style="position:absolute;bottom:150px;left:72px;right:72px;
    display:flex;flex-wrap:wrap;gap:12px;">${kwHTML}</div>

  <!-- 品牌底部 -->
  <div style="position:absolute;bottom:56px;left:72px;right:72px;
    display:flex;justify-content:space-between;align-items:center;
    border-top:1px solid rgba(255,255,255,0.1);padding-top:28px;">
    <div>
      <div style="font-size:26px;font-weight:700;color:${C.gold};">樂爸 Weber</div>
      <div style="font-size:17px;color:rgba(255,255,255,0.35);margin-top:3px;">LINE / IG : weber917</div>
    </div>
    ${wLogo(68, true)}
  </div>
</body></html>`;
}

// ── 截圖主程式 ──
async function generateImage(html, outputPath) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.screenshot({ path: outputPath, type: 'png', fullPage: false });
    console.log(`✅ 圖卡輸出：${outputPath}`);
  } finally {
    await browser.close();
  }
}

async function main() {
  const briefPath   = join(DATA_DIR, 'brief.json');
  const storiesPath = join(DATA_DIR, 'stories.json');

  const brief   = JSON.parse(readFileSync(briefPath, 'utf-8'));
  const stories = JSON.parse(readFileSync(storiesPath, 'utf-8'));
  const story   = stories[stories.length - 1];

  const date = brief.date || new Date().toISOString().slice(0,10);

  await generateImage(storyTitleCard(story),    join(IMG_DIR, `story_title_${date}.png`));
  await generateImage(storySolutionCard(story), join(IMG_DIR, `story_solution_${date}.png`));

  await generateImage(briefCard(brief),         join(IMG_DIR, `brief_${date}.png`));

  await generateImage(storyTitleCard(story),    join(IMG_DIR, 'story_title_latest.png'));
  await generateImage(storySolutionCard(story), join(IMG_DIR, 'story_solution_latest.png'));
  await generateImage(briefCard(brief),         join(IMG_DIR, 'brief_latest.png'));

  console.log(`✅ 所有圖卡生成完成（${date}）`);
}

main().catch(e => { console.error(e); process.exit(1); });
