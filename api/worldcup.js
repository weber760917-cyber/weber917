export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    // ESPN public scoreboard — FIFA World Cup 2026 (no key needed)
    const r = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!r.ok) throw new Error(`ESPN ${r.status}`);
    const data = await r.json();

    const matches = (data.events || []).slice(0, 16).map(ev => {
      const comp = ev.competitions?.[0];
      const teams = (comp?.competitors || []).map(c => ({
        homeAway: c.homeAway,
        name: c.team?.displayName || c.team?.name || '',
        logo: c.team?.logo || '',
        score: c.score || '0',
        espnUrl: (c.team?.links?.find(l => l.rel?.includes('clubhouse')) || c.team?.links?.[0])?.href || '',
      }));
      const st = comp?.status?.type;
      return {
        id: ev.id,
        date: ev.date,
        status: st?.state || 'pre',      // pre | in | post
        statusDesc: st?.shortDetail || '',
        venue: comp?.venue?.fullName || '',
        teams,
        matchUrl: `https://www.espn.com/soccer/match/_/gameId/${ev.id}`,
      };
    });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.json(matches);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
