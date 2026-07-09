#!/usr/bin/env python3
"""每週一推播 LINE OA Broadcast — 讀取 weekly_content.json 組成 Flex Message"""
import json, os, urllib.request

TOKEN = os.environ.get('LINE_CHANNEL_ACCESS_TOKEN', '')
if not TOKEN:
    raise SystemExit('❌ 缺少環境變數 LINE_CHANNEL_ACCESS_TOKEN')

with open('weekly_content.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

case = d['case']
news = d['news']
week = d.get('week', '')

# ── Bubble 1：案例 ──
case_tags = '  '.join([f'#{t}' for t in case.get('tags', [])])
case_bubble = {
    "type": "bubble",
    "size": "mega",
    "header": {
        "type": "box", "layout": "vertical", "paddingAll": "14px",
        "backgroundColor": "#0d47a1",
        "contents": [
            {"type": "text", "text": "💼 本週精選案例", "color": "#ffffff", "size": "sm", "weight": "bold"},
            {"type": "text", "text": week, "color": "#90caf9", "size": "xs", "margin": "xs"}
        ]
    },
    "body": {
        "type": "box", "layout": "vertical", "spacing": "md", "paddingAll": "16px",
        "contents": [
            {"type": "text", "text": case['title'], "weight": "bold", "size": "md", "wrap": True, "color": "#1a237e"},
            {"type": "text", "text": case['summary'], "size": "sm", "wrap": True, "color": "#424242", "margin": "sm"},
            {"type": "text", "text": case_tags, "size": "xs", "color": "#1565c0", "margin": "md", "wrap": True}
        ]
    },
    "footer": {
        "type": "box", "layout": "vertical", "paddingAll": "12px",
        "contents": [{
            "type": "button", "style": "primary", "color": "#1565c0", "height": "sm",
            "action": {"type": "uri", "label": "🔗 前往理財試算", "uri": case['url']}
        }]
    }
}

# ── Bubble 2：本週大事 ──
news_rows = []
for i, n in enumerate(news):
    if i > 0:
        news_rows.append({"type": "separator", "margin": "sm"})
    news_rows.append({
        "type": "box", "layout": "horizontal", "spacing": "md", "margin": "sm",
        "contents": [
            {"type": "text", "text": n['date'], "size": "xs", "color": "#78909c", "flex": 2, "gravity": "center"},
            {"type": "text", "text": n['title'], "size": "sm", "wrap": True, "color": "#212121", "flex": 10}
        ]
    })

news_bubble = {
    "type": "bubble",
    "size": "mega",
    "header": {
        "type": "box", "layout": "vertical", "paddingAll": "14px",
        "backgroundColor": "#1b5e20",
        "contents": [
            {"type": "text", "text": "📰 理財一週大事", "color": "#ffffff", "size": "sm", "weight": "bold"},
            {"type": "text", "text": week, "color": "#a5d6a7", "size": "xs", "margin": "xs"}
        ]
    },
    "body": {
        "type": "box", "layout": "vertical", "paddingAll": "16px",
        "contents": news_rows
    }
}

# ── Carousel ──
msg = {
    "messages": [{
        "type": "flex",
        "altText": f"📊 Weber 週報 {week}｜{case['title'][:20]}…",
        "contents": {
            "type": "carousel",
            "contents": [case_bubble, news_bubble]
        }
    }]
}

req = urllib.request.Request(
    'https://api.line.me/v2/bot/message/broadcast',
    data=json.dumps(msg).encode(),
    headers={'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json'},
    method='POST'
)
try:
    with urllib.request.urlopen(req) as r:
        body = r.read().decode()
        print(f'✅ LINE broadcast 成功: {r.status} {body}')
except urllib.error.HTTPError as e:
    print(f'❌ LINE API 錯誤: {e.code} {e.read().decode()}')
    raise
