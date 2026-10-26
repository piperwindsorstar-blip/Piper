const ua = { 'user-agent': 'piper-site-distance-check/1.0' }
async function geo(q) {
  const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q), { headers: ua })
  const j = await r.json(); await new Promise((s) => setTimeout(s, 1200))
  return j[0] ? [Number(j[0].lon), Number(j[0].lat), j[0].display_name] : null
}
const home = await geo('39 Butcher Crescent, Brantford, Ontario') || await geo('Butcher Crescent, Brantford, Ontario')
console.log(`::notice title=home::${home}`)
for (const town of ['Woodstock, Ontario', 'Burlington, Ontario', 'Guelph, Ontario', 'Oakville, Ontario', 'Hamilton, Ontario', 'Cambridge, Ontario']) {
  const t = await geo(town)
  const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${home[0]},${home[1]};${t[0]},${t[1]}?overview=false`, { headers: ua })
  const j = await r.json()
  console.log(`::notice title=${town}::${(j.routes[0].distance / 1000).toFixed(1)} km to ${t[2]}`)
}
