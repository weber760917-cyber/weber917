export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { count = '5' } = req.query;
  try {
    const rssUrl = 'https://news.google.com/rss/search?q=%E5%B7%A5%E5%95%86%E6%99%82%E5%A0%B1+%E5%8F%B0%E8%82%A1&hl=zh-TW&gl=TW&ceid=TW:zh-Hant';
    const r = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!r.ok) throw new Error(`Google News ${r.status}`);
    const xml = await r.text();

    const items = [];
    const n = parseInt(count, 10) || 5;
    const itemRe = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = itemRe.exec(xml)) !== null) {
      const block = m[1];
      const titleRaw = (block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
                        block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
      const link    = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
      const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
      const source  = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || '';
      if (!source.includes('工商')) continue; // 工商
      const title = titleRaw
        .replace(/\s*-\s*日報\s*-\s*工商時報$/, '')   // - 日報 - 工商時報
        .replace(/\s*-\s*([一-鿿]+)\s*-\s*工商時報$/, '') // - 分類 - 工商時報
        .replace(/\s*-\s*工商時報$/, '')                         // - 工商時報
        .trim();
      items.push({
        title,
        link,
        publisher: '工商時報',
        providerPublishTime: pubDate ? Math.floor(new Date(pubDate).getTime() / 1000) : null
      });
      if (items.length >= n) break;
    }
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    res.json(items);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
