export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { q = 'taiwan stock market', count = '5' } = req.query;
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&newsCount=${count}&enableFuzzyQuery=false&quotesCount=0`;

  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    });
    if (!r.ok) throw new Error(`Yahoo news ${r.status}`);
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    res.json(data.news || []);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
