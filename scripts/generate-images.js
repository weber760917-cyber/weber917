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
const COLORS = {
  navy:    '#1B2A4A',
  navyDark:'#111E35',
  gold:    '#D4A843',
  orange:  '#E8520A',
  teal:    '#1E6B4F',
  white:   '#FFFFFF',
  offWhite:'#F7F8FA',
  grey:    '#8A95A3',
  lightBg: '#EEF1F6',
};

// ── HTML 模板：Story 封面卡 ──
function storyTitleCard(story) {
  const title = story.title || '';
  const hook = (story.quote || '').split('\n')[0].slice(0, 60);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width: 1080px; height: 1080px; overflow: hidden;
    font-family: 'Noto Sans TC', 'PingFang TC', sans-serif;
    background: linear-gradient(150deg, ${COLORS.navyDark} 0%, ${COLORS.navy} 60%, #243759 100%);
    color: ${COLORS.white};
    position: relative;
  }
  /* 背景裝飾圓 */
  .bg-circle1 {
    position:absolute; width:500px; height:500px; border-radius:50%;
    background: radial-gradient(circle, rgba(212,168,67,0.08) 0%, transparent 70%);
    top:-100px; right:-100px;
  }
  .bg-circle2 {
    position:absolute; width:400px; height:400px; border-radius:50%;
    background: radial-gradient(circle, rgba(30,107,79,0.12) 0%, transparent 70%);
    bottom:-80px; left:-80px;
  }
  /* 頂部 tag */
  .tag {
    position:absolute; top:72px; left:72px;
    background:${COLORS.gold}; color:${COLORS.navyDark};
    font-size:30px; font-weight:900; letter-spacing:2px;
    padding:10px 28px; border-radius:6px;
  }
  /* 主標題 */
  .title {
    position:absolute; top:200px; left:72px; right:72px;
    font-size:62px; font-weight:900; line-height:1.25;
    color:${COLORS.gold};
    text-shadow: 0 2px 20px rgba(0,0,0,0.4);
  }
  /* 分隔線 */
  .divider {
    position:absolute; top:560px; left:72px;
    width:80px; height:5px; background:${COLORS.gold}; border-radius:3px;
  }
  /* 副標 */
  .hook {
    position:absolute; top:590px; left:72px; right:72px;
    font-size:34px; font-weight:400; line-height:1.6;
    color:rgba(255,255,255,0.85);
  }
  /* 底部品牌 */
  .brand {
    position:absolute; bottom:72px; left:72px; right:72px;
    display:flex; align-items:center; justify-content:space-between;
  }
  .brand-name {
    font-size:28px; font-weight:700; color:${COLORS.gold}; letter-spacing:1px;
  }
  .brand-sub {
    font-size:20px; color:rgba(255,255,255,0.5);
    margin-top:4px;
  }
  .sparkle {
    font-size:42px; color:${COLORS.gold}; opacity:0.6;
  }
</style>
</head>
<body>
  <div class="bg-circle1"></div>
  <div class="bg-circle2"></div>
  <div class="tag">【 Story 】</div>
  <div class="title">${title}</div>
  <div class="divider"></div>
  <div class="hook">${hook}</div>
  <div class="brand">
    <div>
      <div class="brand-name">樂爸 Weber</div>
      <div class="brand-sub">LINE / IG : weber917</div>
    </div>
    <div class="sparkle">✦</div>
  </div>
</body>
</html>`;
}

// ── HTML 模板：Story 解法卡 ──
function storySolutionCard(story) {
  const sol = story.solution || {};
  const points = (sol.points || []).slice(0, 4);
  const boxColors = [COLORS.navy, COLORS.teal, COLORS.orange, '#6B3FA0'];
  const pointsHTML = points.map((p, i) => `
    <div class="point" style="background:${boxColors[i] || COLORS.navy}">
      <div class="point-num">${String(i+1).padStart(2,'0')}</div>
      <div class="point-text">${p}</div>
    </div>
  `).join('');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:1080px; height:1080px; overflow:hidden;
    font-family:'Noto Sans TC','PingFang TC',sans-serif;
    background:${COLORS.offWhite};
    position:relative;
  }
  /* 頂部色帶 */
  .header {
    background: linear-gradient(90deg, ${COLORS.navyDark} 0%, ${COLORS.navy} 100%);
    padding: 52px 72px 44px;
  }
  .header-label {
    font-size:24px; color:${COLORS.gold}; font-weight:700;
    letter-spacing:2px; margin-bottom:12px;
  }
  .header-title {
    font-size:42px; font-weight:900; color:${COLORS.white}; line-height:1.3;
  }
  /* 解法區 */
  .points {
    padding: 44px 72px 0;
    display:grid; grid-template-columns:1fr 1fr; gap:24px;
  }
  .point {
    border-radius:16px; padding:32px 28px;
    color:${COLORS.white}; min-height:180px;
    display:flex; flex-direction:column; justify-content:space-between;
  }
  .point-num {
    font-size:48px; font-weight:900; opacity:0.25; line-height:1;
    margin-bottom:8px;
  }
  .point-text {
    font-size:26px; font-weight:700; line-height:1.5;
  }
  /* 底部 */
  .footer {
    position:absolute; bottom:48px; left:72px; right:72px;
    display:flex; justify-content:space-between; align-items:center;
  }
  .footer-name { font-size:26px; font-weight:700; color:${COLORS.navy}; }
  .footer-sub  { font-size:18px; color:${COLORS.grey}; margin-top:2px; }
  .sparkle { font-size:38px; color:${COLORS.gold}; opacity:0.7; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-label">Weber 的建議</div>
    <div class="header-title">${sol.title || '行動方案'}</div>
  </div>
  <div class="points">${pointsHTML}</div>
  <div class="footer">
    <div>
      <div class="footer-name">樂爸 Weber</div>
      <div class="footer-sub">LINE / IG : weber917</div>
    </div>
    <div class="sparkle">✦</div>
  </div>
</body>
</html>`;
}

// ── HTML 模板：市場早盤觀點卡 ──
function briefCard(brief) {
  const keywords = (brief.keywords || []).slice(0, 5);
  const summary = (brief.summary || '').slice(0, 120);
  const keywordsHTML = keywords.map(k =>
    `<span class="kw">${k}</span>`
  ).join('');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:1080px; height:1080px; overflow:hidden;
    font-family:'Noto Sans TC','PingFang TC',sans-serif;
    background: linear-gradient(150deg, ${COLORS.navyDark} 0%, ${COLORS.navy} 60%, #1e3560 100%);
    color:${COLORS.white};
    position:relative;
  }
  .bg-accent {
    position:absolute; top:0; right:0;
    width:400px; height:400px;
    background: radial-gradient(circle at top right, rgba(212,168,67,0.15) 0%, transparent 60%);
  }
  /* 頂部日期 tag */
  .date-tag {
    position:absolute; top:72px; left:72px;
    font-size:24px; color:rgba(255,255,255,0.5); letter-spacing:1px;
  }
  .mode-tag {
    position:absolute; top:64px; right:72px;
    background:${COLORS.gold}; color:${COLORS.navyDark};
    font-size:22px; font-weight:900; padding:8px 22px; border-radius:6px;
  }
  /* 主標題 */
  .main-title {
    position:absolute; top:148px; left:72px; right:72px;
    font-size:56px; font-weight:900; line-height:1.25; color:${COLORS.white};
  }
  .gold { color:${COLORS.gold}; }
  /* 分隔線 */
  .divider {
    position:absolute; top:380px; left:72px;
    width:60px; height:4px; background:${COLORS.gold}; border-radius:2px;
  }
  /* 摘要 */
  .summary {
    position:absolute; top:418px; left:72px; right:72px;
    font-size:30px; line-height:1.7; color:rgba(255,255,255,0.85);
  }
  /* 關鍵字 */
  .keywords {
    position:absolute; bottom:160px; left:72px; right:72px;
    display:flex; flex-wrap:wrap; gap:14px;
  }
  .kw {
    background:rgba(255,255,255,0.1); border:1px solid rgba(212,168,67,0.4);
    color:${COLORS.gold}; font-size:22px; font-weight:700;
    padding:8px 20px; border-radius:8px; letter-spacing:0.5px;
  }
  /* 底部品牌 */
  .brand {
    position:absolute; bottom:64px; left:72px; right:72px;
    display:flex; justify-content:space-between; align-items:center;
    border-top:1px solid rgba(255,255,255,0.1); padding-top:32px;
  }
  .brand-name { font-size:28px; font-weight:700; color:${COLORS.gold}; }
  .brand-sub  { font-size:18px; color:rgba(255,255,255,0.4); margin-top:4px; }
  .sparkle    { font-size:40px; color:${COLORS.gold}; opacity:0.6; }
</style>
</head>
<body>
  <div class="bg-accent"></div>
  <div class="date-tag">${brief.dateLabel || ''}</div>
  <div class="mode-tag">早盤觀點</div>
  <div class="main-title">今日<span class="gold">市場</span><br>重點速覽</div>
  <div class="divider"></div>
  <div class="summary">${summary}</div>
  <div class="keywords">${keywordsHTML}</div>
  <div class="brand">
    <div>
      <div class="brand-name">樂爸 Weber</div>
      <div class="brand-sub">LINE / IG : weber917</div>
    </div>
    <div class="sparkle">✦</div>
  </div>
</body>
</html>`;
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
  // 讀取資料
  const briefPath  = join(DATA_DIR, 'brief.json');
  const storiesPath = join(DATA_DIR, 'stories.json');

  const brief   = JSON.parse(readFileSync(briefPath, 'utf-8'));
  const stories = JSON.parse(readFileSync(storiesPath, 'utf-8'));
  const story   = stories[stories.length - 1]; // 最新一篇

  const date = brief.date || new Date().toISOString().slice(0,10);

  // 生成三張圖
  await generateImage(storyTitleCard(story),    join(IMG_DIR, `story_title_${date}.png`));
  await generateImage(storySolutionCard(story), join(IMG_DIR, `story_solution_${date}.png`));
  await generateImage(briefCard(brief),         join(IMG_DIR, `brief_${date}.png`));

  // 同時更新 latest 捷徑（方便網站直接讀）
  await generateImage(storyTitleCard(story),    join(IMG_DIR, 'story_title_latest.png'));
  await generateImage(storySolutionCard(story), join(IMG_DIR, 'story_solution_latest.png'));
  await generateImage(briefCard(brief),         join(IMG_DIR, 'brief_latest.png'));

  console.log(`✅ 所有圖卡生成完成（${date}）`);
}

main().catch(e => { console.error(e); process.exit(1); });
