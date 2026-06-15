const Anthropic = require('@anthropic-ai/sdk').default;
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function getTomorrowESPNDate() {
  // 台灣時間明天，轉為 ESPN API 格式 YYYYMMDD
  const utcNow = Date.now();
  const twOffset = 8 * 60 * 60 * 1000; // UTC+8
  const twTomorrow = new Date(utcNow + twOffset);
  twTomorrow.setUTCDate(twTomorrow.getUTCDate() + 1);
  return twTomorrow.toISOString().slice(0, 10).replace(/-/g, '');
}

async function fetchTomorrowMatches(dateStr) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${dateStr}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`ESPN ${r.status}`);
  const data = await r.json();

  return (data.events || []).slice(0, 8).map(ev => {
    const comp  = ev.competitions?.[0];
    const teams = comp?.competitors || [];
    const home  = teams.find(t => t.homeAway === 'home')?.team?.displayName || '主場';
    const away  = teams.find(t => t.homeAway === 'away')?.team?.displayName || '客場';
    const venue = comp?.venue?.fullName || '';
    // 台灣時間
    const d = new Date(ev.date);
    const twTime = new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(d);
    return { home, away, venue, time: twTime, date: ev.date };
  });
}

async function generateAnalysis(client, match) {
  const { home, away, venue, time } = match;
  const prompt = `你是世界盃賽事分析師，同時具備莊家視角。請用繁體中文針對以下比賽寫出約300字的賽前分析：

主場：${home}
客場：${away}
台灣時間：${time}
場地：${venue || '待定'}

請依序包含：
① 認識主場隊（本屆狀態、戰術風格、1~2位關鍵球員）
② 認識客場隊（同上）
③ 莊家角度分析（從雙方實力、近況、傷兵、心理面分析）
④ 大膽預測正確比分（說出確切比數，例如「預測比分：2-1」）

語氣要生動有趣、帶點熱血球評節目感，但分析要精準有根據。直接開始寫，不要加標題。`;

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [
      { role: 'user', content: prompt },
      { role: 'assistant', content: '【' }
    ]
  });

  return '【' + msg.content[0].text.trim();
}

async function main() {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const dateStr = await getTomorrowESPNDate();
  console.log(`📅 抓取 ${dateStr} 的賽程`);

  const matches = await fetchTomorrowMatches(dateStr);
  console.log(`找到 ${matches.length} 場比賽`);

  if (!matches.length) {
    const output = { date: dateStr, generatedAt: new Date().toISOString(), matches: [] };
    fs.writeFileSync(path.join('data', 'wc-preview.json'), JSON.stringify(output, null, 2), 'utf8');
    console.log('無比賽，已寫入空資料');
  } else {
    const results = [];
    for (const match of matches) {
      console.log(`🤖 分析 ${match.home} vs ${match.away}...`);
      try {
        const analysis = await generateAnalysis(client, match);
        results.push({ ...match, analysis });
        console.log(`✓ 完成（${analysis.length}字）`);
      } catch (e) {
        console.error(`✗ 失敗: ${e.message}`);
        results.push({ ...match, analysis: '本場分析暫時無法取得，請至 ESPN 查看賽事資訊。' });
      }
      // 避免 rate limit
      if (matches.indexOf(match) < matches.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    const output = { date: dateStr, generatedAt: new Date().toISOString(), matches: results };
    fs.writeFileSync(path.join('data', 'wc-preview.json'), JSON.stringify(output, null, 2), 'utf8');
    console.log(`✅ 已寫入 ${results.length} 場分析`);
  }

  execSync('git config user.name "Weber Bot"');
  execSync('git config user.email "weber760917@gmail.com"');
  execSync('git add data/wc-preview.json');
  try {
    execSync(`git commit -m "chore: 世界盃賽前分析 ${dateStr}"`);
    execSync('git push');
    console.log('🚀 推送完成');
  } catch (e) {
    console.log('無異動，略過推送');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
