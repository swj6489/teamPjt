<template>
  <div class="guide page-bg-frame">
    <h2>맞춤형 가이드</h2>
    <label for="profile-select">프로필 선택:</label>
    <select id="profile-select" v-model="profile">
      <option value="family">가족</option>
      <option value="date">데이트</option>
      <option value="friends">친구</option>
      <option value="solo">혼행</option>
    </select>
    <button class="btn primary" @click="generate" style="margin-left:8px">루트 생성</button>
    <span v-if="savedNotice" class="saved-notice" style="margin-left:12px;color:green">{{ savedNotice }}</span>

    <div v-if="routes.length" class="recs">
      <h3>맞춤형 추천 루트</h3>
      <div v-for="r in routes" :key="r.id" class="route-card">
        <div class="route-head">
          <div>
            <strong>{{ r.title }}</strong>
              <div class="muted">{{ r.desc }}</div>
              <div style="margin-top:0.25rem;font-size:0.9rem">
                <span style="margin-right:0.6rem">총 거리: {{ r.totalKm || 0 }} km</span>
                <span style="margin-right:0.6rem">예상 소요: {{ r.estHours || 0 }} 시간</span>
                <span v-if="r.feasible" style="color:green;font-weight:700">실행 가능</span>
                <span v-else style="color:#b91c1c;font-weight:700">비실행 (거리 초과)</span>
              </div>
          </div>
          <div>
            <button class="btn" @click="saveRoute(r)">루트 저장</button>
          </div>
        </div>
        <ol class="route-stops">
          <li v-for="p in r.stops" :key="p.id">
            <div class="stop-name">{{ p.name }}</div>
            <div class="stop-meta muted">{{ p.category }} {{ p.raw && p.raw.eventplace ? '· ' + p.raw.eventplace : '' }}</div>
          </li>
        </ol>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'

export default {
  name:'CustomGuide',
  setup(){
    const profile = ref('family')
    const routes = ref([])
    const savedNotice = ref('')

    const prefs = {
      family: ['관광지','숙박','문화시설','여행코스'],
      date: ['문화시설','관광지','쇼핑','레포츠'],
      friends: ['레포츠','관광지','쇼핑','축제공연행사'],
      solo: ['관광지','레포츠','쇼핑','문화시설']
    }

    function labelFor(key){ return key==='family' ? '가족' : key==='date' ? '데이트' : key==='friends' ? '친구' : '혼행' }

    let mounted = false
    onMounted(()=>{ mounted = true; routes.value = [] })
    onUnmounted(()=>{ mounted = false })

    function haversine(a,b){
      const toRad = v=> v*Math.PI/180
      const R = 6371 // km
      const dLat = toRad(b.lat - a.lat)
      const dLon = toRad(b.lng - a.lng)
      const lat1 = toRad(a.lat); const lat2 = toRad(b.lat)
      const sinDlat = Math.sin(dLat/2), sinDlon = Math.sin(dLon/2)
      const c = 2 * Math.asin(Math.sqrt(sinDlat*sinDlat + Math.cos(lat1)*Math.cos(lat2)*sinDlon*sinDlon))
      return R*c
    }

    function totalDistanceKm(stops){
      let d=0
      for(let i=1;i<stops.length;i++) d+=haversine(stops[i-1], stops[i])
      return Math.round(d*10)/10
    }

    function nearestNeighborOrder(points, startIndex=0){
      if(!points || points.length<=1) return points.slice()
      const pts = points.slice()
      const out = []
      let idx = startIndex % pts.length
      out.push(pts[idx]); pts.splice(idx,1)
      while(pts.length){
        let best=-1; let bestd=1e9
        for(let i=0;i<pts.length;i++){ const dd=haversine(out[out.length-1], pts[i]); if(dd<bestd){bestd=dd;best=i}} 
        out.push(pts[best]); pts.splice(best,1)
      }
      return out
    }

    async function generate(){
      if(!mounted) return
      routes.value = []
      const files = ['부산_관광지.json','부산_레포츠.json','부산_문화시설.json','부산_쇼핑.json','부산_숙박.json','부산_축제공연행사.json','부산_여행코스.json']
      const all = []
      for (const f of files){
        try{
          const res = await fetch(`/docs/data/${f}`)
          if(!mounted) return
          if(!res.ok) continue
          const j = await res.json()
          if(!mounted) return
          const items = j.items || []
          items.forEach(it=>{
            const lat = parseFloat(it.mapy || it.latitude || it.lat || 0)
            const lng = parseFloat(it.mapx || it.longitude || it.lng || 0)
            all.push({ id: it.contentid || `${f}-${(it.title||'').slice(0,10)}`, name: it.title || it.name, category: f.replace(/^부산_/, '').replace(/\.json$/,''), lat, lng, raw: it })
          })
        }catch(e){ console.error('generate error', e) }
      }

      const want = prefs[profile.value] || []
      const maxStops = 5

      // helper: pick random candidate for each category but enforce at most one 숙박 per route
      const pickForCategory = (category, pool, limit=maxStops, allowStay=true, currentStops=[])=>{
        const cands = pool.filter(p=> (p.category||'').includes(category) && p.lat && p.lng)
        const res = []
        const shuffled = cands.sort(()=>Math.random()-0.5)
        // count existing 숙박 in currentStops
        const stayCount = (currentStops||[]).filter(x=> (x.category||'').includes('숙박')).length
        for(const s of shuffled){
          if(res.length>=limit) break
          // if candidate is 숙박 and we already have one, skip
          if((s.category||'').includes('숙박') && (stayCount + res.filter(x=> (x.category||'').includes('숙박')).length) >= 1) continue
          res.push(s)
        }
        return res
      }

      const routesArr = []
      const baseWant = prefs[profile.value] || []

      // Variant A: preference-based but choose random item per category
      const stopsA = []
      const usedA = new Set()
      for(const cat of baseWant){
        const picks = pickForCategory(cat, all, 2, true, stopsA)
        for(const p of picks){ if(stopsA.length>=maxStops) break; if(!usedA.has(p.id)){ stopsA.push(p); usedA.add(p.id) } }
        if(stopsA.length>=maxStops) break
      }
      while(stopsA.length<maxStops){ const extra = all.filter(p=>!usedA.has(p.id) && p.lat&&p.lng).sort(()=>Math.random()-0.5)[0]; if(!extra) break; stopsA.push(extra); usedA.add(extra.id) }
      // try to order by nearest neighbor to make it feasible
      const orderedA = nearestNeighborOrder(stopsA, 0)
      const distA = totalDistanceKm(orderedA)
      // dwell time per category (hours)
      const dwell = (p)=>{ const c=(p.category||''); if(c.includes('숙박')) return 8; if(c.includes('레포츠')) return 3; if(c.includes('문화시설')) return 2; if(c.includes('축제')) return 2.5; if(c.includes('쇼핑')) return 1.5; if(c.includes('여행코스')) return 2; return 1.5 }
      const dwellA = orderedA.reduce((s,p)=>s + (dwell(p)||1.5), 0)
      const travelA = Math.round(distA/40*10)/10
      const estA = Math.round((travelA + dwellA)*10)/10
      const hasStayA = orderedA.some(p=> (p.category||'').includes('숙박'))
      const dayLimitA = hasStayA ? 24 : 12
      routesArr.push({ id:`${profile.value}-${Date.now()}-a`, profile:profile.value, title:`${labelFor(profile.value)} 추천 루트`, desc:'선호도 기반 추천', stops:orderedA, totalKm:distA, estHours:estA, feasible: estA <= dayLimitA })

      // Variant B: rotated preference + randomness
      const rot = baseWant.slice(1).concat(baseWant.slice(0,1))
      const stopsB = []
      const usedB = new Set()
      for(const cat of rot){
        const picks = pickForCategory(cat, all, 2, true, stopsB)
        for(const p of picks){ if(stopsB.length>=maxStops) break; if(!usedB.has(p.id)){ stopsB.push(p); usedB.add(p.id) } }
        if(stopsB.length>=maxStops) break
      }
      while(stopsB.length<maxStops){ const extra = all.filter(p=>!usedB.has(p.id) && p.lat&&p.lng).sort(()=>Math.random()-0.5)[0]; if(!extra) break; stopsB.push(extra); usedB.add(extra.id) }
      const orderedB = nearestNeighborOrder(stopsB, 0)
      const distB = totalDistanceKm(orderedB)
      const dwellB = orderedB.reduce((s,p)=>s + (dwell(p)||1.5), 0)
      const travelB = Math.round(distB/40*10)/10
      const estB = Math.round((travelB + dwellB)*10)/10
      const hasStayB = orderedB.some(p=> (p.category||'').includes('숙박'))
      const dayLimitB = hasStayB ? 24 : 12
      routesArr.push({ id:`${profile.value}-${Date.now()}-b`, profile:profile.value, title:`${labelFor(profile.value)} 추천 루트 (대안)`, desc:'대체 선호도 + 무작위', stops:orderedB, totalKm:distB, estHours:estB, feasible: estB <= dayLimitB })

      // Variant C: purely randomized but optimized order
      if(all.length>maxStops){
        // generate random selection but ensure at most one 숙박
        const shuffledPool = all.slice().sort(()=>Math.random()-0.5).filter(p=>p.lat&&p.lng)
        const shuffled = []
        let stayIncluded = false
        for(const p of shuffledPool){
          if(shuffled.length>=maxStops) break
          if((p.category||'').includes('숙박')){
            if(stayIncluded) continue
            stayIncluded = true
          }
          shuffled.push(p)
        }
        const orderedC = nearestNeighborOrder(shuffled, 0)
        const distC = totalDistanceKm(orderedC)
        const dwellC = orderedC.reduce((s,p)=>s + (dwell(p)||1.5), 0)
        const travelC = Math.round(distC/40*10)/10
        const estC = Math.round((travelC + dwellC)*10)/10
        const hasStayC = orderedC.some(p=> (p.category||'').includes('숙박'))
        const dayLimitC = hasStayC ? 24 : 12
        routesArr.push({ id:`${profile.value}-${Date.now()}-c`, profile:profile.value, title:`${labelFor(profile.value)} 추천 루트 (랜덤)`, desc:'무작위 코스 (경로 최적화)', stops:orderedC, totalKm:distC, estHours:estC, feasible: estC <= dayLimitC })
      }

      routes.value = routesArr
    }

    function saveRoute(r){
      const all = JSON.parse(localStorage.getItem('localhub-routes')||'[]')
      // deep clone to avoid reactive references
      const toSave = JSON.parse(JSON.stringify(r || {}))
      if(!toSave.id) toSave.id = `${(toSave.profile||profile.value)}-${Date.now()}`
      if(!toSave.profile) toSave.profile = profile.value
      all.push(toSave)
      localStorage.setItem('localhub-routes', JSON.stringify(all))
      // non-blocking notice so select remains responsive
      savedNotice.value = '루트가 저장되었습니다.'
      setTimeout(()=>{ savedNotice.value = '' }, 2000)
    }

    return { profile, routes, generate, saveRoute, savedNotice }
  }
}
</script>

<style scoped>
.guide{padding:1rem}
.recs{margin-top:1rem}
.route-card{background:#fff;padding:1rem;border-radius:8px;margin-bottom:0.8rem;border:1px solid #eef2f7}
.route-head{display:flex;justify-content:space-between;align-items:center}
.route-stops{margin:0.6rem 0 0 1.2rem}
.stop-name{font-weight:700}
.stop-meta{font-size:0.9rem}
</style>
