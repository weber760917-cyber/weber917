export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { cate = '5590', count = '5' } = req.query;
  try {
    const r = await fetch(`https://money.udn.com/money/cate/${cate}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
        'Referer': 'https://money.udn.com/',
      }
    });
    if (!r.ok) throw new Error(`UDN HTTP ${r.status}`);
    const html = await r.text();

    const dateMap = {};
    const jlRe = /"url"\s*:\s*"(https:\/\/money\.udn\.com\/money\/story\/[^"?]+)[^"]*"[^}]{0,300}?"datePublished"\s*:\s*"([^"]+)"/g;
    let jm;
    while ((jm = jlRe.exec(html)) !== null) {
      dateMap[jm[1]] = Math.floor(new Date(jm[2]).getTime() / 1000);
    }

    const items = [], seen = new Set();
    const re = /href="(https:\/\/money\.udn\.com\/money\/story\/[^"]+)"[^>]{0,300}?title="([^"]{5,}?)"/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const link = m[1].split('?')[0];
      const title = m[2].trim();
      if (seen.has(link) || title.length < 5) continue;
      seen.add(link);
      items.push({ title, link, publisher: '經濟日報', providerPublishTime: dateMap[link] || null });
      if (items.length >= parseInt(count, 10)) break;
    }

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    return res.json(items);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
