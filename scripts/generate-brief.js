/**
 * generate-brief.js — morning / afternoon / weekend 三種模式
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
  const [sp, nq, dj, twii] = await Promise.all([
    fetchQuote('%5EGSPC'), fetchQuote('%5EIXIC'), fetchQuote('%5EDJI'), fetchQuote('%5ETWII')
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
  const spStr = sp ? `S&P 500 ${fmt(sp.price)} ${chgStr(sp.chg, sp.chgAbs)}` : 'S&P 500 資料載入中';
  const nqStr = nq ? `那斯達克 ${fmt(nq.price)} ${chgStr(nq.chg, nq.chgAbs)}` : '';
  const djStr = dj ? `道瓊 ${Math.round(dj.price).toLocaleString('en')} ${chgStr(dj.chg, dj.chgAbs, true)}` : '';
  const summary = `【${d.dateLabel} 早盤觀點】\n\n${vibeUS}\n\n🇺🇸 美股昨日收盤\n${spStr}\n${nqStr ? nqStr+'\n' : ''}${djStr ? djStr+'\n' : ''}\n${twOutlook}\n\n操作提醒：行情數字是背景，資產配置才是主角。開盤前確認你的持倉比例，別讓單一事件影響長期規劃。`;
  const fb = `早安！昨晚美股 ${mood} ${moodEmoji}\n\n${spStr}\n${nqStr}\n${djStr}\n\n${twOutlook}\n\n市場每天都在考你的紀律，對的配置讓你不管漲跌都睡得著。有想聊配置的朋友，早上私訊我 ☕`;
  const ig = `${d.dateLabel.split('（')[1]?.replace('）','')||''} 早盤 ${moodEmoji}\n\n${sp ? `S&P ${fmt(sp.price)} ${sp.chg>=0?'▲':'▼'}${fmt(Math.abs(sp.chg))}%` : ''}\n${nq ? `那斯達克 ${fmt(nq.price)} ${nq.chg>=0?'▲':'▼'}${fmt(Math.abs(nq.chg))}%` : ''}\n\n${twOutlook.slice(0,40)}...\n漲跌是常態，配置才是底氣 💼\n\n#台股開盤 #美股收盤 #早盤觀點 #理財顧問 #資產配置`;
  const line = `【早盤快報】美股昨收 S&P ${sp ? `${fmt(sp.price)} ${sp.chg>=0?'▲':'▼'}${fmt(Math.abs(sp.chg))}%` : ''}。${twOutlook.slice(0,30)}有問題私訊我 😊`;
  return { keywords:['美股收盤','台股展望','早盤觀點','開盤策略','盤前必讀'], summary, fb, ig, line };
}

async function buildAfternoon(d) {
  const [twii, tsmc, otc] = await Promise.all([
    fetchQuote('%5ETWII'), fetchQuote('2330.TW'), fetchQuote('%5EOTC')
  ]);
  const twChg = twii?.chg ?? 0;
  const mood = twChg > 1 ? '大漲收紅' : twChg > 0.3 ? '小漲收紅' : twChg < -1 ? '重挫收黑' : twChg < -0.3 ? '小跌收黑' : '平盤收斂';
  const moodEmoji = twChg > 0.3 ? '📈' : twChg < -0.3 ? '📉' : '➡️';
  const twStr = twii ? `加權指數 ${Math.round(twii.price).toLocaleString('en')} 點 ${chgStr(twii.chg, twii.chgAbs, true)}` : '加權指數資料載入中';
  const tsmcStr = tsmc ? `台積電 ${fmt(tsmc.price)} 元 ${chgStr(tsmc.chg, tsmc.chgAbs)}` : '';
  const vibe = twChg > 0.5
    ? '今天台股算是給力，收盤前資金沒有落跑，尾盤守得住就是健康。'
    : twChg < -0.5
    ? '今天台股有點辛苦，但跌的時候才是搞清楚自己持倉的好機會。'
    : '今天台股溫吞，量能是觀察重點，方向確定前先按兵不動也是策略。';
  const summary = `【${d.dateLabel} 收盤觀點】\n\n🇹🇼 今日台股 ${mood} ${moodEmoji}\n${twStr}\n${tsmcStr ? tsmcStr+'\n' : ''}\n${vibe}\n\n投資提醒：今天的漲跌不決定你的退休品質，長期配置才是。如果今天的走勢讓你睡不著，可能是配置需要重新校準了。`;
  const fb = `收盤了，今天台股 ${mood} ${moodEmoji}\n\n${twStr}\n${tsmcStr}\n\n${vibe}\n\n市場每天都在考你的紀律，而不是你的眼光。想聊聊不用每天盯盤的配置？私訊我 📩`;
  const ig = `${d.dateLabel.split('（')[1]?.replace('）','')||''} 收盤 ${moodEmoji}\n\n${twii ? `加權 ${Math.round(twii.price).toLocaleString('en')} ${twii.chg>=0?'▲':'▼'}${fmt(Math.abs(twii.chg))}%` : ''}\n${tsmc ? `台積電 ${fmt(tsmc.price)} ${tsmc.chg>=0?'▲':'▼'}${fmt(Math.abs(tsmc.chg))}%` : ''}\n\n${vibe.slice(0,35)}...\n配置對了，不用每天盯盤 📊\n\n#台股收盤 #加權指數 #台積電 #理財顧問 #資產配置`;
  const line = `【收盤快報】台股今日${mood}，${twStr.slice(0,20)}。${vibe.slice(0,25)}想聊配置，私訊我 😊`;
  return { keywords:['台股收盤', twii?.chg > 0 ? '收紅':'收黑','台積電','收盤觀點','盤後分析'], summary, fb, ig, line };
}

const WEEKEND_TOPICS = ['trust','retire','insurance','estate'];
const WEEKEND_TEMPLATES = {
  trust: {
    keywords:['保險金信託','保單受益人','資產保全','身後規劃','信託架構'],
    summary:`保險金信託把「保險給付」和「信託保護」結合在一起。\n\n身故後，理賠金不直接給受益人，而是先進入信託帳戶，再依你設定的條件（每月生活費、年齡限制等）按時撥付。\n\n適合：子女未成年的家長、擔心繼承糾紛的長輩、有大額保單（300萬以上）的保戶。\n\n部分銀行信託最低30萬就可設立，是少數讓你「生前安心、身後也放心」的工具組合。`,
    fb:`有個問題我常被問：「保險買了，受益人指定了，這樣就夠了嗎？」\n\n大多數情況夠了。但如果受益人是未成年小孩、花錢比較沒節制的家人、或有被借錢糾纏風險的人——那可能還差一步：保險金信託。\n\n理賠金不直接給人，而是先進信託帳戶，按你的規劃慢慢撥出去。你說了算，不是別人。\n\n身故之後，你的錢還在幫你保護家人。有興趣了解，私訊我 💬`,
    ig:`保險買了就夠了嗎？🤔\n\n如果受益人是未成年小孩\n如果擔心錢一次花光\n→ 保險金信託是下一步\n\n理賠金進信託，按設定慢慢撥付\n身後的錢，還在保護家人\n\n想了解適不適合？私訊我 👇\n#保險金信託 #信託規劃 #資產保全 #理財顧問 #身後規劃`,
    line:`【今日分享】保險金信託：理賠金不直接給人，進信託帳戶按設定撥付，子女動不了。有興趣了解，私訊我 😊`,
  },
  retire: {
    keywords:['退休缺口','長照費用','通膨侵蝕','退休金試算','老後現金流'],
    summary:`退休準備三個盲點：\n\n1. 只算生活費，沒算長照。台灣平均長照 7.3 年，每月 5~8 萬，很少人提早準備。\n\n2. 只看帳戶數字，沒考慮通膨。500萬放定存20年，購買力縮水三分之一以上。\n\n3. 錢不分層。正確做法：近期定存保流動、中期儲蓄險穩增值、長期 ETF 對抗通膨。\n\n知道缺口在哪裡，才能提前補上。`,
    fb:`「退休有1,000萬，應該夠了吧？」這句話我聽過很多次。\n\n然後我問：「長照費算進去了嗎？」\n\n台灣平均長照 7.3 年，每月 5~8 萬，光這個就要 440~700 萬。\n加上通膨吃掉購買力，1,000 萬可能真的不夠。\n\n退休金要分四層：生活費、醫療備用（200萬不動）、長照準備、緊急備用金。\n\n還沒算缺口的朋友，現在算才不慌。私訊我 👇`,
    ig:`1,000萬退休夠嗎？🤔\n\n長照費每月5~8萬 × 7.3年\n通膨再吃20年\n\n退休金要分四層放\n近期定存 → 中期儲蓄險 → 長期ETF\n\n還沒算缺口的，現在算 👇\n#退休規劃 #長照保險 #退休金 #理財顧問 #財務自由`,
    line:`【今日分享】1,000萬退休夠嗎？長照每月5~8萬撐7年以上，加通膨缺口很大。現在算清楚，私訊我 😊`,
  },
  insurance: {
    keywords:['壽險規劃','長照險','醫療險','保障缺口','保單健診'],
    summary:`保險買對了是最便宜的風險轉移工具，買錯了每年白繳保費。\n\n四個常見問題：順序搞反（先買儲蓄險）、保額不夠（壽險只夠付喪葬費）、沒有長照險、保單從不健診。\n\n正確順序：意外險→醫療險→重疾險→壽險→才是儲蓄型。\n\n一年一次保單健診，通常可以用同樣保費提升一個等級的保障。`,
    fb:`保險買了10年，你有多久沒「健診」了？\n\n很多人保費越繳越多，但保障沒跟上：壽險保額只夠喪葬費、長照沒有保障、條款已落後好幾代。\n\n保單健診不是要你換保單，是幫你搞清楚：現有保障夠不夠、有沒有重複浪費、有沒有明顯缺口。\n\n一年一次，同樣保費，保障升一個等級。\n免費幫你看，私訊我 👇`,
    ig:`你的保單，多久沒健診了？🏥\n\n條款可能已落後\n長照缺口？壽險保額不夠？\n\n一年一次保單健診\n同樣保費，保障升級\n\n免費幫你看 👇\n#保單健診 #保險規劃 #長照險 #壽險 #理財顧問`,
    line:`【今日分享】保單健診：同樣保費，可以有更好保障。免費幫你確認有沒有缺口，私訊我 😊`,
  },
  estate: {
    keywords:['以房養老','不動產活化','不動產信託','老後現金流','沉睡資產'],
    summary:`台灣越來越多長輩面對「有房沒錢」困境。2025年以房養老申辦件數年增42%。\n\n以房養老：不搬家，銀行每月給生活費。身故後繼承人決定是否贖回。\n\n不動產信託：信託給銀行管理，設定居住權保障，防止被子女處分或因債務拍賣。\n\n提早規劃的重要性：60歲前選擇多，70歲後很多條件已不同。`,
    fb:`「我有一間好房子，但口袋沒錢，買東西都要想一下。」\n\n這是最讓我揪心的退休描述。房子不只有「賣掉」或「留給孩子」這兩個選項。\n\n以房養老：不搬家，每月從銀行領生活費。\n不動產信託：保護居住安全，不怕子女財務出問題。\n\n趁還有選擇的時候提早規劃。60歲前佈局，選擇多；70歲才動，選擇就少了。私訊我聊聊 👇`,
    ig:`有房沒錢，是真實的困境 🏠\n\n以房養老：不搬家，每月領生活費\n不動產信託：保護居住安全\n\n趁還有選擇，提早規劃 👇\n#以房養老 #不動產活化 #退休規劃 #老後生活 #理財顧問`,
    line:`【今日分享】有房沒現金，以房養老讓你不搬家不賣房、每月有生活費。趁有選擇時提早規劃，私訊我 😊`,
  },
};

function getWeekendTopic(d) {
  const start = new Date('2026-01-04');
  const week = Math.floor((new Date() - start) / (7*24*60*60*1000));
  return WEEKEND_TOPICS[Math.abs(week) % 4];
}

async function enhanceWithClaude(mode, base, d) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    const modeDesc = {
      morning:'早盤觀點，幽默風趣的華爾街菁英/基金分析師口吻，帶梗但專業',
      afternoon:'收盤觀點，同樣幽默有深度的分析師口吻，帶點收盤後的反思',
      weekend:'Weber顧問親切有溫度的風格',
    };
    const prompt = `你是 Weber，資深理財顧問。今天是 ${d.dateLabel}。
以下初稿請用更生動有個性的方式重寫，風格：${modeDesc[mode]}。

初稿 summary：${base.summary}

回傳 JSON：{"keywords":[...],"summary":"...","fb":"...","ig":"...","line":"..."}
只回 JSON。`;
    const msg = await client.messages.create({ model:'claude-haiku-4-5-20251001', max_tokens:1500, messages:[{role:'user',content:prompt}] });
    const text = msg.content[0].text.trim();
    const match = text.match(/\{[\s\S]+\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch(e) { console.warn('Claude API:', e.message); return null; }
}

async function main() {
  const d = getTaiwanDate();
  const mode = detectMode(d);
  console.log(`📅 ${d.dateLabel}  🎯 模式：${mode}`);

  let content;
  if (mode === 'morning') {
    console.log('📈 抓取美股數據...');
    content = await buildMorning(d);
  } else if (mode === 'afternoon') {
    console.log('📉 抓取台股數據...');
    content = await buildAfternoon(d);
  } else {
    const topic = getWeekendTopic(d);
    console.log(`📌 週末主題：${topic}`);
    content = WEEKEND_TEMPLATES[topic];
  }

  if (process.env.ANTHROPIC_API_KEY && mode !== 'weekend') {
    const enhanced = await enhanceWithClaude(mode, content, d);
    if (enhanced) { content = enhanced; console.log('✅ Claude 增強成功'); }
  }

  writeFileSync(OUTPUT, JSON.stringify({
    date: d.date, dateLabel: d.dateLabel, mode,
    keywords: content.keywords, summary: content.summary,
    fb: content.fb, ig: content.ig, line: content.line,
  }, null, 2), 'utf-8');
  console.log(`✅ brief.json 更新完成（${mode} 模式）`);
}
main().catch(e => { console.error(e); process.exit(1); });
