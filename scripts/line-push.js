import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN = process.env.LINE_CHANNEL_TOKEN;
if (!TOKEN) { console.error('❌ LINE_CHANNEL_TOKEN 未設定'); process.exit(1); }

// ── 讀取今日 brief（如果有）──
let briefSnippet = '台股・美股・匯率重點整理';
let briefTitle   = '今日財金快報';
try {
  const brief = JSON.parse(readFileSync(resolve(__dirname,'../data/brief.json'),'utf8'));
  if (brief.morning?.summary) {
    briefSnippet = brief.morning.summary.slice(0,50).replace(/<[^>]+>/g,'') + '…';
  } else if (brief.text) {
    briefSnippet = brief.text.slice(0,50).replace(/<[^>]+>/g,'') + '…';
  }
} catch(e) { /* 使用預設值 */ }

// ── 今日日期 ──
const now  = new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Taipei'}));
const days = ['日','一','二','三','四','五','六'];
const dateStr = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')} (${days[now.getDay()]})`;

// ── Flex Message ──
const flexMsg = {
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
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: '🏦 樂爸Weber金融分享',
              size: 'xs',
              color: '#D4A843',
              weight: 'bold',
              flex: 1
            },
            {
              type: 'text',
              text: dateStr,
              size: 'xs',
              color: '#aaaaaa',
              align: 'end'
            }
          ]
        },
        {
          type: 'text',
          text: briefTitle,
          weight: 'bold',
          size: 'xl',
          color: '#1B2A4A',
          margin: 'sm'
        },
        {
          type: 'text',
          text: briefSnippet,
          wrap: true,
          size: 'sm',
          color: '#555555',
          margin: 'sm'
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '12px',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#1B2A4A',
          height: 'sm',
          action: {
            type: 'uri',
            label: '📰 今日新聞',
            uri: 'https://weber917.vercel.app/#news'
          }
        },
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'uri',
                label: '📈 今日行情',
                uri: 'https://weber917.vercel.app/#market'
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'uri',
                label: '💬 預約諮詢',
                uri: 'https://line.me/ti/p/weber917'
              }
            }
          ]
        }
      ]
    }
  }
};

// ── 發送廣播 ──
const res = await fetch('https://api.line.me/v2/bot/message/broadcast', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TOKEN}`
  },
  body: JSON.stringify({ messages: [flexMsg] })
});

const text = await res.text();
if (!res.ok) {
  console.error(`❌ LINE API 錯誤 ${res.status}:`, text);
  process.exit(1);
}
console.log(`✅ LINE 推播成功 ${dateStr}`, text || '(no body)');
