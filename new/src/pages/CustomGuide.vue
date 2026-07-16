<template>
  <div class="guide">
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
      const stops = []
      const used = new Set()
      for(const cat of want){
        if(stops.length>=5) break
        const cands = all.filter(p=> (p.category||'').includes(cat) && p.lat && p.lng && !used.has(p.id))
        for(const c of cands){ if(stops.length>=5) break; stops.push(c); used.add(c.id) }
      }
      if(stops.length<5){
        for(const p of all){ if(stops.length>=5) break; if(!used.has(p.id) && p.lat && p.lng){ stops.push(p); used.add(p.id) } }
      }

      // produce multiple route variants (2~3) by varying selection strategy
      const makeStops = (allList, wantOrder, maxStops=5) => {
        const picked = []
        const usedIds = new Set()
        for(const cat of wantOrder){
          if(picked.length>=maxStops) break
          const cands = allList.filter(p=> (p.category||'').includes(cat) && p.lat && p.lng && !usedIds.has(p.id))
          for(const c of cands){ if(picked.length>=maxStops) break; picked.push(c); usedIds.add(c.id) }
        }
        if(picked.length<maxStops){
          for(const p of allList){ if(picked.length>=maxStops) break; if(!usedIds.has(p.id) && p.lat && p.lng){ picked.push(p); usedIds.add(p.id) } }
        }
        return picked
      }

      const routesArr = []
      const baseWant = prefs[profile.value] || []
      // variant 0: base preference order
      routesArr.push({ id: `${profile.value}-${Date.now()}-0`, profile: profile.value, title: `${labelFor(profile.value)} 추천 루트`, desc: `${labelFor(profile.value)} 분들에게 적합한 코스`, stops: makeStops(all, baseWant) })
      // variant 1: rotated preferences (alternative)
      const rot = baseWant.slice(1).concat(baseWant.slice(0,1))
      routesArr.push({ id: `${profile.value}-${Date.now()}-1`, profile: profile.value, title: `${labelFor(profile.value)} 추천 루트 (대안)`, desc: `다른 취향을 고려한 대안 코스`, stops: makeStops(all, rot) })
      // variant 2: mixed/randomized alternative (only if enough items)
      if(all.length>8){
        const shuffled = all.slice().sort(()=>Math.random()-0.5)
        routesArr.push({ id: `${profile.value}-${Date.now()}-2`, profile: profile.value, title: `${labelFor(profile.value)} 추천 루트 (랜덤)`, desc: `무작위로 구성한 대안 코스`, stops: shuffled.filter(p=>p.lat&&p.lng).slice(0,5) })
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
