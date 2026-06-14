/**
 * generate-brief.js — morning / afternoon / weekend 三種模式
 * morning 模式額外整合「金十數據全球財經早餐」，生成 300 字 Weber 版市場分析
 */
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, '../data/brief.json');

function getTaiwanDate() {
  const now = new Date();
  const tw = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  const weekdays = ['週日','週一','週二','週三','週四','週五','週六'];
  return {
    date: `${tw.getFullYear()}-${String(tw.getMonth()+1).padStart(2,'0')}-${String(tw.getDate()).padStart(2,'0')}`,
    dateLabel: `${tw.getFullYear()}年${tw.getMonth()+1}月${tw.getDate()}日（${weekdays[tw.getDay()]}）`,
    dayOfWeek: tw.getDay(), hour: tw.getHours(),
  };
}

function detectMode(d) {
  const m = process.env.BRIEF_MODE || process.argv[2] || 'auto';
  if (m !== 'auto') return m;
  if (d.dayOfWeek === 0 || d.dayOfWeek === 6) return 'weekend';
  return d.hour < 12 ? 'morning' : 'afternoon';
}

async function fetchHtml(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

// ── 抓取金十數據全球財經早餐 ──
async function fetchJin10Breakfast() {
  try {
    console.log('📰 抓取金十數據全球財經早餐...');
    // 從列表頁找連結（嘗試第一頁，找不到試第二頁）
    let articleUrl = null;
    for (let page = 1; page <= 3 && !articleUrl; page++) {
      const listUrl = `https://www.capitalfutures.com.tw/zh-tw/Financial/Global/all${page > 1 ? `?PageID=${page}` : ''}`;
      const html = await fetchHtml(listUrl);
      // 尋找含「金十數據全球財經早餐」的連結
      const re = /href="([^"]*GlobalArticle[^"]*)"[^>]*>\s*金十數據全球財經早餐/gi;
      const m = re.exec(html);
      if (m) {
        articleUrl = m[1].startsWith('http') ? m[1] : `https://www.capitalfutures.com.tw${m[1]}`;
        console.log(`✅ 找到文章：${articleUrl}`);
      }
    }
    if (!articleUrl) { console.log('⚠️ 未找到金十數據早餐文章（可能今日尚未發布）'); return null; }

    // 抓文章內容
    const html = await fetchHtml(articleUrl);
    // 去除 HTML 標籤，取純文字
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 提取關鍵段落
    const getSection = (start, end) => {
      const s = text.indexOf(start);
      const e = end ? text.indexOf(end, s) : s + 600;
      if (s < 0) return '';
      return text.slice(s + start.length, e > 0 ? e : s + 600).trim();
    };

    const highlights = getSection('今日優選', '市場盤點').slice(0, 200);
    const marketReview = getSection('市場盤點', '國際要聞').slice(0, 900);
    const intlNews = getSection('國際要聞', '國內要聞').slice(0, 500);

    const result = `【今日優選】${highlights}\n\n【市場盤點】${marketReview}\n\n【國際要聞重點】${intlNews}`;
    console.log(`✅ 金十數據內容擷取完成（${result.length} 字）`);
    return result;
  } catch(e) {
    console.warn('⚠️ 金十數據抓取失敗:', e.message);
    return null;
  }
}

async function fetchQuote(sym) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=2d`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } });
    if (!r.ok) return null;
    const data = await r.json();
    const meta = data.chart.result[0].meta;
    const price = meta.regularMarketPrice;
    const prev  = meta.chartPreviousClose || meta.previousClose;
    const chg   = meta.regularMarketChangePercent ?? ((price - prev) / prev * 100);
    const chgAbs = meta.regularMarketChange ?? (price - prev);
    return { price, chg, chgAbs };
  } catch { return null; }
}

function fmt(v, d=2) { return v == null ? '—' : v.toLocaleString('en',{minimumFractionDigits:d,maximumFractionDigits:d}); }
function chgStr(c, a, isIdx=false) {
  if (c == null) return '持平';
  const sign = c >= 0 ? '+' : '';
  const arrow = c >= 0 ? '▲' : '▼';
  const absS = isIdx ? Math.round(Math.abs(a)).toLocaleString('en') : fmt(Math.abs(a));
  return `${arrow} ${absS} (${sign}${fmt(c)}%)`;
}

async function buildMorning(d) {
  const [[sp, nq, dj, twii], jin10] = await Promise.all([
    Promise.all([fetchQuote('%5EGSPC'), fetchQuote('%5EIXIC'), fetchQuote('%5EDJI'), fetchQuote('%5ETWII')]),
    fetchJin10Breakfast(),
  ]);
  const spChg = sp?.chg ?? 0;
  const mood = spChg > 1 ? '大漲' : spChg > 0.3 ? '小漲' : spChg < -1 ? '重挫' : spChg < -0.3 ? '走弱' : '持平';
  const moodEmoji = spChg > 0.3 ? '🟢' : spChg < -0.3 ? '🔴' : '🟡';
  const vibeUS = spChg > 0.5
    ? '華爾街昨晚心情不錯，香檳還沒喝完。'
    : spChg < -0.5
    ? '華爾街昨晚又是一個難熬的夜晚，期貨交易員的臉比螢幕還綠。'
    : '美股昨晚溫吞水，老闆沒喝酒，員工也沒哭。';
  const twOutlook = spChg > 0.5
    ? '美股這樣收，台股今天開盤應該也會跟著喝到點東西，外資臉上有笑容。'
    : spChg < -0.5
    ? '美股這樣收，台股今早開盤可能也得先喝杯苦茶醒神，注意跳空低開風險。'
    : '美股溫吞，台股今天就看內資自己的本事了，量能是關鍵。';
  const spStr = sp ? `S&P 500 ${fmt(sp.price)} ${chgStr(sp.chg, sp.chgAbs)}` : 'S&P 500 資料取得中';
  const nqStr = nq ? `那斯達克 ${fmt(nq.price)} ${chgStr(nq.chg, nq.chgAbs)}` : '';
  const djStr = dj ? `道瓊 ${Math.round(dj.price).toLocaleString('en')} ${chgStr(dj.chg, dj.chgAbs, true)}` : '';
  const summary = `${vibeUS}${twOutlook}`;
  const fb = `早安！昨晚美股 ${mood} ${moodEmoji}\n\n${spStr}\n${nqStr}\n${djStr}\n\n${twOutlook}\n\n市場每天都在考你的紀律，對的配置讓你不管漲跌都睡得著。有想聊配置的朋友，早上私訊我 ☕`;
  const ig = `${d.dateLabel.split('（')[1]?.replace('）','')||''} 早盤 ${moodEmoji}\n\n${sp ? `S&P ${fmt(sp.price)} ${sp.chg>=0?'▲':'▼'}${fmt(Math.abs(sp.chg))}%` : ''}\n${nq ? `那斯達克 ${fmt(nq.price)} ${nq.chg>=0?'▲':'▼'}${fmt(Math.abs(nq.chg))}%` : ''}\n\n${twOutlook.slice(0,40)}\n漲跌是常態，配置才是底氣 💼\n\n#台股開盤 #美股收盤 #早盤觀點 #理財顧問 #資產配置 #樂爸Weber #workhardplayharder`;
  const line = `【早盤快報】美股昨收 S&P ${sp ? `${fmt(sp.price)} ${sp.chg>=0?'▲':'▼'}${fmt(Math.abs(sp.chg))}%` : ''}。${twOutlook.slice(0,30)}有問題私訊我 😊`;
  const punchline = spChg > 0.5 ? '美股收紅，今天台股跟漲機率高' : spChg < -0.5 ? '美股重挫，今早開盤先保守應對' : '美股溫吞，台股今天看量能決定';
  const marketData = [
    sp && { label: 'S&P 500', value: fmt(sp.price), change: `${sp.chg>=0?'▲':'▼'}${fmt(Math.abs(sp.chg))}%`, up: sp.chg >= 0 },
    nq && { label: '那斯達克', value: fmt(nq.price), change: `${nq.chg>=0?'▲':'▼'}${fmt(Math.abs(nq.chg))}%`, up: nq.chg >= 0 },
    dj && { label: '道瓊', value: Math.round(dj.price).toLocaleString('en'), change: `${dj.chg>=0?'▲':'▼'}${fmt(Math.abs(dj.chg))}%`, up: dj.chg >= 0 },
  ].filter(Boolean);
  return { keywords:['美股收盤','台股展望','早盤觀點','開盤策略','盤前必讀'], summary, fb, ig, line, punchline, marketData, jin10 };
}

async function buildAfternoon(d) {
  const [twii, tsmc, otc] = await Promise.all([
    fetchQuote('%5ETWII'), fetchQuote('2330.TW'), fetchQuote('%5EOTC')
  ]);
  const twChg = twii?.chg ?? 0;
  const mood = twChg > 1 ? '大漲收紅' : twChg > 0.3 ? '小漲收紅' : twChg < -1 ? '重挫收黑' : twChg < -0.3 ? '小跌收黑' : '平盤收斂';
  const moodEmoji = twChg > 0.3 ? '📈' : twChg < -0.3 ? '📉' : '➡️';
  const twStr = twii ? `加權指數 ${Math.round(twii.price).toLocaleString('en')} 點 ${chgStr(twii.chg, twii.chgAbs, true)}` : '加權指數資料取得中';
  const tsmcStr = tsmc ? `台積電 ${fmt(tsmc.price)} 元 ${chgStr(tsmc.chg, tsmc.chgAbs)}` : '';
  const vibe = twChg > 0.5
    ? '今天台股算是給力，收盤前資金沒有落跑，尾盤守得住就是健康。'
    : twChg < -0.5
    ? '今天台股有點辛苦，但跌的時候才是搞清楚自己持倉的好機會。'
    : '今天台股溫吞，量能是觀察重點，方向確定前先按兵不動也是策略。';
  const summary = `${vibe}`;
  const fb = `收盤了，今天台股 ${mood} ${moodEmoji}\n\n${twStr}\n${tsmcStr}\n\n${vibe}\n\n市場每天都在考你的紀律，而不是你的眼光。想聊聊不用每天盯盤的配置？私訊我 📩`;
  const ig = `${d.dateLabel.split('（')[1]?.replace('）','')||''} 收盤 ${moodEmoji}\n\n${twii ? `加權 ${Math.round(twii.price).toLocaleString('en')} ${twii.chg>=0?'▲':'▼'}${fmt(Math.abs(twii.chg))}%` : ''}\n${tsmc ? `台積電 ${fmt(tsmc.price)} ${tsmc.chg>=0?'▲':'▼'}${fmt(Math.abs(tsmc.chg))}%` : ''}\n\n${vibe.slice(0,35)}\n配置對了，不用每天盯盤 📊\n\n#台股收盤 #加權指數 #台積電 #理財顧問 #資產配置 #樂爸Weber #workhardplayharder`;
  const line = `【收盤快報】台股今日${mood}，${twStr.slice(0,20)}。${vibe.slice(0,25)}想聊配置，私訊我 😊`;
  const punchline = twChg > 0.5 ? '台股收紅，長線資金站穩' : twChg < -0.5 ? '台股收黑，檢視持倉的好時機' : '台股溫吞，量能是今日觀察重點';
  const marketData = [
    twii && { label: '加權指數', value: Math.round(twii.price).toLocaleString('en'), change: `${twii.chg>=0?'▲':'▼'}${fmt(Math.abs(twii.chg))}%`, up: twii.chg >= 0 },
    tsmc && { label: '台積電', value: fmt(tsmc.price), change: `${tsmc.chg>=0?'▲':'▼'}${fmt(Math.abs(tsmc.chg))}%`, up: tsmc.chg >= 0 },
    otc  && { label: '櫃買指數', value: fmt(otc.price), change: `${otc.chg>=0?'▲':'▼'}${fmt(Math.abs(otc.chg))}%`, up: otc.chg >= 0 },
  ].filter(Boolean);
  return { keywords:['台股收盤', twii?.chg > 0 ? '收紅':'收黑','台積電','收盤觀點','盤後分析'], summary, fb, ig, line, punchline, marketData, jin10: null };
}

const WEEKEND_TOPICS = ['trust','retire','insurance','estate'];
const WEEKEND_TEMPLATES = {
  trust: {
    keywords:['保險金信託','保單受益人','資產保全','身後規劃','信託架構'],
    punchline:'理賠金不直接給人，交給信託按月撥',
    summary:`保險金信託把「保險給付」和「信託保護」結合在一起。身故後，理賠金不直接給受益人，而是先進入信託帳戶，再依你設定的條件按時撥付。適合：子女未成年的家長、擔心繼承糾紛的長輩、有大額保單的保戶。部分銀行信託最低30萬就可設立。`,
    fb:`有個問題我常被問：「保險買了，受益人指定了，這樣就夠了嗎？」\n\n大多數情況夠了。但如果受益人是未成年小孩、花錢比較沒節制的家人、或有被借錢糾纏風險的人——那可能還差一步：保險金信託。\n\n理賠金不直接給人，而是先進信託帳戶，按你的規劃慢慢撥出去。你說了算，不是別人。\n\n身故之後，你的錢還在幫你保護家人。有興趣了解，私訊我 💬`,
    ig:`保險買了就夠了嗎？🤔\n\n如果受益人是未成年小孩\n如果擔心錢一次花光\n→ 保險金信託是下一步\n\n理賠金進信託，按設定慢慢撥付\n身後的錢，還在保護家人\n\n想了解？私訊我 👇\n#保險金信託 #信託規劃 #資產保全 #樂爸Weber #workhardplayharder`,
    line:`【今日分享】保險金信託：理賠金不直接給人，進信託帳戶按設定撥付，子女動不了。有興趣了解，私訊我 😊`,
    marketData: [], jin10: null,
  },
  retire: {
    keywords:['退休缺口','長照費用','通膨侵蝕','退休金試算','老後現金流'],
    punchline:'1000萬退休夠嗎？長照7年算進去了嗎',
    summary:`退休準備三個盲點：1. 只算生活費，沒算長照。台灣平均長照 7.3 年，每月 5~8 萬。2. 只看帳戶數字，沒考慮通膨。500萬放定存20年，購買力縮水三分之一。3. 錢不分層。正確做法：近期定存保流動、中期儲蓄險穩增值、長期ETF對抗通膨。知道缺口在哪，才能提前補上。`,
    fb:`「退休有1,000萬，應該夠了吧？」這句話我聽過很多次。\n\n然後我問：「長照費算進去了嗎？」\n\n台灣平均長照 7.3 年，每月 5~8 萬，光這個就要 440~700 萬。\n加上通膨吃掉購買力，1,000 萬可能真的不夠。\n\n退休金要分四層：生活費、醫療備用、長照準備、緊急備用金。\n\n還沒算缺口的朋友，現在算才不慌。私訊我 👇`,
    ig:`1,000萬退休夠嗎？🤔\n\n長照費每月5~8萬 × 7.3年\n通膨再吃20年\n\n退休金要分四層放\n近期定存→中期儲蓄險→長期ETF\n\n還沒算缺口的，現在算 👇\n#退休規劃 #長照保險 #退休金 #樂爸Weber #workhardplayharder`,
    line:`【今日分享】1,000萬退休夠嗎？長照每月5~8萬撐7年以上，加通膨缺口很大。現在算清楚，私訊我 😊`,
    marketData: [], jin10: null,
  },
  insurance: {
    keywords:['壽險規劃','長照險','醫療險','保障缺口','保單健診'],
    punchline:'保費繳了10年，你的保障升級了嗎',
    summary:`保險買對了是最便宜的風險轉移工具，買錯了每年白繳保費。四個常見問題：順序搞反（先買儲蓄險）、保額不夠、沒有長照險、保單從不健診。正確順序：意外險→醫療險→重疾險→壽險→才是儲蓄型。一年一次保單健診，通常可以用同樣保費提升一個等級的保障。`,
    fb:`保險買了10年，你有多久沒「健診」了？\n\n很多人保費越繳越多，但保障沒跟上：壽險保額只夠喪葬費、長照沒有保障、條款已落後好幾代。\n\n保單健診不是要你換保單，是幫你搞清楚：現有保障夠不夠、有沒有重複浪費、有沒有明顯缺口。\n\n一年一次，同樣保費，保障升一個等級。免費幫你看，私訊我 👇`,
    ig:`你的保單，多久沒健診了？🏥\n\n條款可能已落後\n長照缺口？壽險保額不夠？\n\n一年一次保單健診\n同樣保費，保障升級\n\n免費幫你看 👇\n#保單健診 #保險規劃 #長照險 #樂爸Weber #workhardplayharder`,
    line:`【今日分享】保單健診：同樣保費，可以有更好保障。免費幫你確認有沒有缺口，私訊我 😊`,
    marketData: [], jin10: null,
  },
  estate: {
    keywords:['以房養老','不動產活化','不動產信託','老後現金流','沉睡資產'],
    punchline:'有房沒錢？以房養老讓你不搬家每月領',
    summary:`台灣越來越多長輩面對「有房沒錢」困境。2025年以房養老申辦件數年增42%。以房養老：不搬家，銀行每月給生活費，身故後繼承人決定是否贖回。不動產信託：信託給銀行管理，設定居住權保障，防止被子女處分或因債務拍賣。提早規劃的重要性：60歲前選擇多，70歲後很多條件已不同。`,
    fb:`「我有一間好房子，但口袋沒錢，買東西都要想一下。」\n\n這是最讓我揪心的退休描述。房子不只有「賣掉」或「留給孩子」這兩個選項。\n\n以房養老：不搬家，每月從銀行領生活費。\n不動產信託：保護居住安全，不怕子女財務出問題。\n\n趁還有選擇的時候提早規劃。60歲前佈局，選擇多；70歲才動，選擇就少了。私訊我聊聊 👇`,
    ig:`有房沒錢，是真實的困境 🏠\n\n以房養老：不搬家，每月領生活費\n不動產信託：保護居住安全\n\n趁還有選擇，提早規劃 👇\n#以房養老 #不動產活化 #退休規劃 #樂爸Weber #workhardplayharder`,
    line:`【今日分享】有房沒現金，以房養老讓你不搬家不賣房、每月有生活費。趁有選擇時提早規劃，私訊我 😊`,
    marketData: [], jin10: null,
  },
};

function getWeekendTopic(d) {
  const start = new Date('2026-01-04');
  const week = Math.floor((new Date() - start) / (7*24*60*60*1000));
  return WEEKEND_TOPICS[Math.abs(week) % 4];
}

async function enhanceWithClaude(mode, base, d) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.log('ℹ️  無 ANTHROPIC_API_KEY，使用模板'); return null; }
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });

    const styleGuide = {
      morning:  '幽默風趣的華爾街菁英/基金分析師，帶點台灣接地氣的比喻，讓人覺得你很懂又很好笑',
      afternoon:'收盤後的資深分析師，帶一點「我早說了吧」的語氣，但結尾要給建設性建議',
      weekend:  'Weber顧問親切有溫度，像在和老朋友聊財務規劃，不說術語，說故事',
    };

    const marketNumbers = (base.marketData || [])
      .map(m => `${m.label} ${m.value} ${m.change}`)
      .join('、') || '（盤中資料取得中）';

    const marketCtx = mode === 'weekend'
      ? '今天是週末，不聊盤，聊長期財務規劃與資產保全。'
      : marketNumbers !== '（盤中資料取得中）'
        ? `今日${mode === 'morning' ? '早盤' : '收盤'}數據：${marketNumbers}`
        : `今天是${d.dateLabel}，市場數據暫時取得中。請根據近期市場趨勢（AI科技股、台積電、美元走勢）生成分析。`;

    const jin10Section = base.jin10
      ? `\n\n【金十數據全球財經早餐原文重點（請據此寫 jin10_summary）】\n${base.jin10.slice(0, 700)}`
      : '';

    const prompt = `你是「樂爸 Weber」，台灣的資深理財顧問，同時也是貝萊德合作顧問，專注保險金信託、退休規劃、不動產活化。
今天是 ${d.dateLabel}，要發的內容模式：${mode}。
${marketCtx}${jin10Section}

【風格要求】${styleGuide[mode]}
- 語氣像一個很懂市場的老朋友，白話、接地氣，偶爾一點幽默
- 不要講廢話、不要全是術語
- 數字要具體，要說得出為什麼漲跌跟你有關係
- 結尾一定要有 CTA，讓人想私訊你

【summary 欄位要求】100-180字，含真實數字、影響說明、Weber的一句話建議
${base.jin10 ? '【jin10_summary 欄位要求】根據金十數據早餐原文，用300字整理成Weber華爾街菁英風格的繁體中文市場分析，要有具體數字、各市場表現、對台灣投資人的影響，以及Weber的一句話結論' : ''}

【絕對重要】不管有無數據，你必須直接回傳以下 JSON 格式，不要加任何說明文字，不要問問題：
{
  "keywords": ["關鍵字1","關鍵字2","關鍵字3","關鍵字4","關鍵字5"],
  "punchline": "圖卡用的一句話（20-30字，Weber風格，有畫面感）",
  "summary": "100-180字的今日行情分析（含數字、含影響、含建議）",
  "jin10_summary": "${base.jin10 ? '300字的金十數據重點整理（Weber華爾街菁英風格，繁體中文）' : ''}",
  "fb": "Facebook文案（300-400字，可換行，結尾要有CTA邀請私訊）",
  "ig": "Instagram文案（120字內，結尾必須含#樂爸Weber #workhardplayharder）",
  "line": "LINE文案（80字內，口語化，結尾有emoji）"
}`;

    console.log('🤖 呼叫 Claude API...');
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }]
    });
    const text = msg.content[0].text.trim();
    console.log('Claude 回應長度:', text.length);
    const match = text.match(/\{[\s\S]+\}/);
    if (!match) { console.warn('⚠️  Claude 回應無法解析為 JSON:', text.slice(0,200)); return null; }
    const parsed = JSON.parse(match[0]);
    console.log('✅ Claude 增強成功');
    return parsed;
  } catch(e) {
    console.warn('⚠️  Claude API 失敗:', e.message);
    return null;
  }
}

async function main() {
  const d = getTaiwanDate();
  const mode = detectMode(d);
  console.log(`📅 ${d.dateLabel}  🎯 模式：${mode}`);

  let content;
  if (mode === 'morning') {
    console.log('📈 抓取美股數據 + 金十數據...');
    content = await buildMorning(d);
  } else if (mode === 'afternoon') {
    console.log('📉 抓取台股數據...');
    content = await buildAfternoon(d);
  } else {
    const topic = getWeekendTopic(d);
    console.log(`📌 週末主題：${topic}`);
    content = WEEKEND_TEMPLATES[topic];
  }

  if (process.env.ANTHROPIC_API_KEY) {
    const enhanced = await enhanceWithClaude(mode, content, d);
    if (enhanced) content = { ...content, ...enhanced };
  }

  writeFileSync(OUTPUT, JSON.stringify({
    date: d.date, dateLabel: d.dateLabel, mode,
    keywords: content.keywords,
    punchline: content.punchline || '',
    marketData: content.marketData || [],
    summary: content.summary,
    jin10_summary: content.jin10_summary || '',
    fb: content.fb, ig: content.ig, line: content.line,
  }, null, 2), 'utf-8');
  console.log(`✅ brief.json 更新完成（${mode} 模式）`);
}
main().catch(e => { console.error(e); process.exit(1); });
