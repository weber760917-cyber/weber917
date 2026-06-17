const fs   = require('fs');
const path = require('path');
const https = require('https');

const TOKEN = process.env.LINE_CHANNEL_TOKEN;
if (!TOKEN) { console.error('❌ LINE_CHANNEL_TOKEN 未設定'); process.exit(1); }

// ── 讀取今日 brief ──
let briefSnippet = '台股・美股・匯率重點整理';
try {
  const brief = JSON.parse(fs.readFileSync(path.join(__dirname,'../data/brief.json'),'utf8'));
  const raw = brief?.morning?.summary || brief?.text || '';
  if (raw) briefSnippet = raw.replace(/<[^>]+>/g,'').slice(0,55) + '…';
} catch(e) {}

// ── 日期 ──
const now  = new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Taipei'}));
const days = ['日','一','二','三','四','五','六'];
const dateStr = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')} (${days[now.getDay()]})`;

// ── Flex Message ──
const flex = {
  type: 'flex',
  altText: `📰 Weber 今日財金快報 ${dateStr}`,
  contents: {
    type: 'bubble',
    size: 'giga',
    hero: {
      type: 'image',
      url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80',
      size: 'full',
      aspectRatio: '20:11',
      aspectMode: 'cover',
      action: { type: 'uri', uri: 'https://weber917.vercel.app/#news' }
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '16px',
      contents: [
        {
          type: 'box', layout: 'horizontal',
          contents: [
            { type: 'text', text: '🏦 樂爸Weber金融分享', size: 'xs', color: '#D4A843', weight: 'bold', flex: 1 },
            { type: 'text', text: dateStr, size: 'xs', color: '#aaaaaa', align: 'end' }
          ]
        },
        { type: 'text', text: '今日財金快報', weight: 'bold', size: 'xl', color: '#1B2A4A', margin: 'sm' },
        { type: 'text', text: briefSnippet, wrap: true, size: 'sm', color: '#555555', margin: 'sm' }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '12px',
      contents: [
        {
          type: 'button', style: 'primary', color: '#1B2A4A', height: 'sm',
          action: { type: 'uri', label: '📰 今日新聞', uri: 'https://weber917.vercel.app/#news' }
        },
        {
          type: 'box', layout: 'horizontal', spacing: 'sm',
          contents: [
            {
              type: 'button', style: 'secondary', height: 'sm', flex: 1,
              action: { type: 'uri', label: '📈 今日行情', uri: 'https://weber917.vercel.app/#market' }
            },
            {
              type: 'button', style: 'secondary', height: 'sm', flex: 1,
              action: { type: 'uri', label: '💬 預約諮詢', uri: 'https://line.me/ti/p/weber917' }
            }
          ]
        }
      ]
    }
  }
};

// ── POST to LINE API ──
const body = JSON.stringify({ messages: [flex] });
const opts = {
  hostname: 'api.line.me',
  path: '/v2/bot/message/broadcast',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Length': Buffer.byteLength(body)
  }
};
const req = https.request(opts, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log(`✅ LINE 推播成功 ${dateStr}`);
    } else {
      console.error(`❌ LINE API ${res.statusCode}:`, data);
      process.exit(1);
    }
  });
});
req.on('error', e => { console.error('❌ 請求失敗:', e.message); process.exit(1); });
req.write(body);
req.end();
