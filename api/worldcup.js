export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const mode = req.query.mode || 'matches';

  try {
    if (mode === 'standings') {
      const r = await fetch('https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings',
        { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) throw new Error(`ESPN standings ${r.status}`);
      const data = await r.json();
      const val = (stats, name) => { const s=(stats||[]).find(s=>s.name===name); return s?parseInt(s.displayValue,10)||0:0; };
      const groups = (data.children || []).map(g => ({
        name: g.name,
        entries: (g.standings?.entries || []).map(e => {
          const st = e.stats || [];
          return { team:e.team?.displayName||'', logo:e.team?.logos?.[0]?.href||'',
            P:val(st,'gamesPlayed'), W:val(st,'wins'), D:val(st,'ties'), L:val(st,'losses'),
            GF:val(st,'pointsFor'), GA:val(st,'pointsAgainst'), Pts:val(st,'points') };
        })
      }));
      res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=240');
      return res.json(groups);
    }

    // ── 台灣時間當日可能橫跨兩個 UTC 日期，同時查兩天 ──
    const twNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
    const fmt = d => `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    const todayUTC  = fmt(new Date());
    const prevUTC   = fmt(new Date(Date.now() - 86400000));

    const fetchDay = async (dateStr) => {
      const r = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${dateStr}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      if (!r.ok) return [];
      const data = await r.json();
      return data.events || [];
    };

    const [eventsToday, eventsPrev] = await Promise.all([fetchDay(todayUTC), fetchDay(prevUTC)]);
    // 合併去重
    const seen = new Set();
    const allEvents = [...eventsToday, ...eventsPrev].filter(ev => {
      if (seen.has(ev.id)) return false;
      seen.add(ev.id); return true;
    });

    const parseMatch = ev => {
      const comp = ev.competitions?.[0];
      const teams = (comp?.competitors || []).map(c => ({
        homeAway: c.homeAway, name: c.team?.displayName||'', logo: c.team?.logo||'',
        score: c.score||'0',
        espnUrl: (c.team?.links?.find(l=>l.rel?.includes('clubhouse'))||c.team?.links?.[0])?.href||''
      }));
      const st = comp?.status?.type;
      return { id:ev.id, date:ev.date, status:st?.state||'pre', statusDesc:st?.shortDetail||'',
               venue:comp?.venue?.fullName||'', teams,
               matchUrl:`https://www.espn.com/soccer/match/_/gameId/${ev.id}` };
    };

    const matches = allEvents.map(parseMatch);
    const live     = matches.filter(m=>m.status==='in');
    const done     = matches.filter(m=>m.status==='post').sort((a,b)=>new Date(b.date)-new Date(a.date));
    const upcoming = matches.filter(m=>m.status==='pre').sort((a,b)=>new Date(a.date)-new Date(b.date));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.json([...live,...done,...upcoming]);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
