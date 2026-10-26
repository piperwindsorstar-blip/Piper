const ua = { 'user-agent': 'piper-site-distance-check/1.0' }
async function geo(q) {
  const r = await fetch('https://photon.komoot.io/api/?limit=1&q=' + encodeURIComponent(q), { headers: ua })
  const t = await r.text(); let j
  try { j = JSON.parse(t) } catch { console.log(`::notice title=geo fail::${r.status} ${t.slice(0, 200)}`); return null }
  const f = j.features?.[0]; if (!f) return null
  const p = f.properties
  return [f.geometry.coordinates[0], f.geometry.coordinates[1], [p.housenumber, p.street ?? p.name, p.city, p.state].filter(Boolean).join(' ')]
}
const home = await geo('39 Butcher Crescent, Brantford, Ontario') || await geo('Butcher Crescent, Brantford, Ontario')
console.log(`::notice title=home::${home}`)
for (const town of ['Woodstock, Ontario', 'Burlington, Ontario', 'Guelph, Ontario', 'Oakville, Ontario', 'Hamilton, Ontario', 'Cambridge, Ontario']) {
  const t = await geo(town)
  const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${home[0]},${home[1]};${t[0]},${t[1]}?overview=false`, { headers: ua })
  const j = await r.json()
  console.log(`::notice title=${town}::${(j.routes[0].distance / 1000).toFixed(1)} km to ${t[2]}`)
}
