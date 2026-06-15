export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { content, platform = 'fb' } = req.body || {};
  if (!content || content.trim().length < 10) return res.status(400).json({ error: '請提供足夠的內容' });

  const platDesc = {
    fb: 'Facebook（600~900字，親切感強，自然換行，2~4個emoji，不需要 hashtag）',
    ig: 'Instagram（300~500字，每段落2~3行，排版簡潔，結尾加5~8個 hashtag，例如 #理財規劃 #Weber理財 #財務自由）',
    line: 'LINE（200~300字，精簡有力，每句話短，像傳訊息給朋友）'
  };

  const prompt = `你是台灣理財顧問 Weber（Weber 理財筆記）的社群媒體編輯。
請將以下內容整理成適合發布在 ${platDesc[platform] || platDesc.fb} 的社群文案。

要求：
- 語氣親切有溫度，像朋友分享而非業務推銷
- 保留原文核心知識點，用白話重新包裝
- 結尾固定加：「有問題歡迎私訊 Weber 👋 LINE / IG：weber917」
- 使用繁體中文，直接輸出文案，不要加說明

原始內容：
${content}`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error?.message || `API ${r.status}`);
    return res.json({ result: data.content[0].text.trim() });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
