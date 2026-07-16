<template>
  <div class="home">
    <section class="hero">
      <div class="hero-left">
        <h1>LocalHub - Busan</h1>
        <p>공공데이터로 만나는 우리 동네 — 익명으로 자유롭게 지역 정보를 나눠요.</p>
        <div class="hero-cta">
          <router-link to="/map" class="btn primary">지도로 둘러보기</router-link>
          <router-link to="/dashboard" class="btn">데이터 대시보드</router-link>
        </div>
      </div>
      <div class="hero-right">
        <div class="stats">
          <div class="stat">총 POI<br/><strong>{{ totalPOI }}</strong></div>
          <div class="stat">게시글<br/><strong>{{ totalPosts }}</strong></div>
          <div class="stat">북마크<br/><strong>{{ totalBookmarks }}</strong></div>
        </div>
      </div>
    </section>

    <section class="categories">
      <h3>카테고리별 데이터</h3>
      <div class="cats">
        <div v-for="(n,cat) in poiCounts" :key="cat" class="cat">
          <router-link :to="`/map?category=${cat}`">{{ cat }} <span class="count">{{ n }}</span></router-link>
        </div>
      </div>
    </section>

    <section class="recent">
      <h3>최근 게시글</h3>
      <div v-if="!recentPosts || recentPosts.length===0" class="no-posts">현재 게시글이 없습니다.</div>
      <div v-else class="recent-box">
        <ul>
          <li v-for="p in recentPosts" :key="p.id" class="recent-item">
            <a href="#" @click.prevent="openPost(p)">{{ p.title }}</a>
            <div class="meta">{{ formatDate(p.createdAt) }}</div>
          </li>
        </ul>
      </div>
    </section>

    <section class="recommend">
      <h3>부산 추천 관광지</h3>
      <div class="recs">
        <div v-for="r in recs" :key="r.id" class="rec">
          <router-link :to="`/map?lat=${r.lat}&lng=${r.lng}&name=${encodeURIComponent(r.name)}`">
            <div class="rec-image">
              <img v-if="r.image" :src="r.image" alt="" />
              <div v-else class="muted">이미지 없음</div>
            </div>
            <div class="rec-title">{{ r.name }}</div>
          </router-link>
        </div>
      </div>
    </section>
    <section class="today-events-section">
      <h3>오늘의 행사</h3>
      <div v-if="!todayEvents || todayEvents.length===0" class="no-posts">오늘의 행사가 없습니다.</div>
      <div v-else class="today-events-list">
        <ul>
          <li v-for="ev in todayEvents" :key="ev.id" class="today-ev-item">
            <div class="ev-title">{{ ev.title }}</div>
            <div class="ev-meta">{{ ev.start }} {{ ev.end ? ' ~ ' + ev.end : '' }} {{ ev.raw && (ev.raw.eventplace||ev.raw.addr1) ? '· ' + (ev.raw.eventplace||ev.raw.addr1) : '' }}</div>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { loadPosts } from '../composables/usePosts'

export default {
  name: 'Home',
  setup(){
    const router = useRouter()
    const poiCounts = ref({})
    const totalPOI = ref(0)
    const totalPosts = ref(0)
    const totalBookmarks = ref(0)
    const recentPosts = ref([])
    const recs = ref([])

    async function loadPOIcounts(){
      const files = ['부산_관광지.json','부산_레포츠.json','부산_문화시설.json','부산_쇼핑.json','부산_숙박.json','부산_여행코스.json','부산_축제공연행사.json']
      const map = {}
      let sum =0
      for(const f of files){
        try{ const res = await fetch(`/docs/data/${f}`); if(!res.ok) continue; const j=await res.json(); const cnt = j.total || (j.items && j.items.length) || 0; const cat = f.replace(/^부산_/,'').replace(/\.json$/,''); map[cat]=cnt; sum+=cnt }catch(e){}
      }
      poiCounts.value = map
      totalPOI.value = sum
    }

    function loadPostsSummary(){
      const posts = loadPosts()||[]
      totalPosts.value = posts.length
      recentPosts.value = posts.slice().sort((a,b)=>b.createdAt-a.createdAt).slice(0,6)
      try{ const b = JSON.parse(localStorage.getItem('localhub-bookmarks')||'[]'); totalBookmarks.value = b.length }catch(e){ totalBookmarks.value=0 }
    }

    function openPost(p){
      // navigate to board and request opening the post by id
      try{ router.push({ path: '/board', query: { postId: p.id } }) }catch(e){ /* fallback */ alert(p.title) }
    }
    function formatDate(ts){ return new Date(ts).toLocaleString() }

    onMounted(()=>{
      // defer heavy data loads to avoid blocking navigation/render
      setTimeout(()=>{
        loadPOIcounts();
        loadPostsSummary()
        loadRecs()
        loadTodaysEvents && loadTodaysEvents()
      }, 200)
    })

    // today's events under recs
    const todayEvents = ref([])
    async function loadTodaysEvents(){
      const files = ['부산_축제공연행사.json','부산_문화시설.json','부산_레포츠.json']
      const all = []
      const today = new Date()
      const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      for(const f of files){
        try{
          const res = await fetch(`/docs/data/${f}`)
          if(!res.ok) continue
          const j = await res.json()
          const items = j.items || []
          items.forEach(it=>{
            const s = it.eventstartdate || it.createdtime || it.modifiedtime
            const e = it.eventenddate || s
            const sd = (s && s.toString().length===8) ? new Date(+s.slice(0,4), +s.slice(4,6)-1, +s.slice(6,8)) : (s? new Date(s): null)
            const ed = (e && e.toString().length===8) ? new Date(+e.slice(0,4), +e.slice(4,6)-1, +e.slice(6,8)) : (e? new Date(e): sd)
            if(!sd) return
            const sDay = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate())
            const eDay = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate())
            if(t0 >= sDay && t0 <= eDay){
              all.push({ id: it.contentid || `${f}-${(it.title||'').slice(0,20)}`, title: it.title || it.name || '행사', raw: it, start: s, end: e })
            }
          })
        }catch(e){ }
      }
      todayEvents.value = all
    }

    async function loadRecs(){
      try{
        const res = await fetch('/docs/data/부산_관광지.json')
        if(!res.ok) return
        const j = await res.json()
        const items = Array.isArray(j.items) ? j.items : (j.items||[])
        const parsed = items.map(it=>({
          id: it.contentid || it.id || (it.title||Date.now()),
          name: it.title || it.name || '',
          lat: parseFloat(it.mapy || it.latitude || it.lat || 0),
          lng: parseFloat(it.mapx || it.longitude || it.lng || 0),
          image: it.firstimage || it.firstimage2 || it.image || ''
        })).filter(x=>x.lat && x.lng)
        // pick 6 random
        const shuffled = parsed.sort(()=>Math.random()-0.5)
        recs.value = shuffled.slice(0,6)
      }catch(e){ }
    }
return { poiCounts, totalPOI, totalPosts, totalBookmarks, recentPosts, openPost, formatDate, recs, todayEvents }
    }
  }
</script>

<style scoped>
.home{display:flex;flex-direction:column;gap:1rem}
/* Busan (Gwangan Bridge) photo background from assets */
.home{background-image: linear-gradient(rgba(0,18,36,0.25), rgba(0,18,36,0.05)), url('/docs/data/image.png');
background-size:cover;background-position:center;background-attachment:fixed;padding:1rem}
.home h3{color:#ffffff !important;text-shadow:0 2px 8px rgba(0,0,0,0.7);}
.hero{display:flex;gap:1rem;align-items:center;justify-content:space-between;background:linear-gradient(90deg,#f0fdfa,#ffffff);padding:1.5rem;border-radius:12px}
.hero-left h1{margin:0;font-size:2rem}
.hero-cta{margin-top:0.75rem;display:flex;gap:0.5rem}
.btn{padding:0.5rem 0.9rem;border-radius:8px;background:#fff;border:1px solid #e5e7eb;text-decoration:none;color:#0f172a}
.btn.primary{background:var(--primary);color:#fff;border:none}
.stats{display:flex;gap:1rem}
.stat{background:#fff;padding:0.75rem;border-radius:8px;min-width:100px;text-align:center}
.categories .cats{display:flex;gap:0.5rem;flex-wrap:wrap}
.cat{background:#fff;padding:0.6rem 0.8rem;border-radius:8px}
.cat .count{display:block;font-weight:700;color:var(--primary)}
.recent ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:0.4rem}
.recent .meta{color:var(--muted);font-size:0.85rem}

.recent-box{background:#fff;border:1px solid #e6eef2;border-radius:10px;padding:0.6rem;max-height:220px;overflow:auto;box-shadow:0 6px 18px rgba(2,6,23,0.04)}
.recent-item{display:flex;justify-content:space-between;align-items:flex-start;padding:0.6rem;border-bottom:1px solid #f1f5f8}
.recent-item:last-child{border-bottom:none}
.recent-item a{color:var(--text);text-decoration:none;font-weight:600}
.no-posts{background:#fff;border:1px dashed #e6eef2;border-radius:10px;padding:0.8rem;color:#475569}

.recommend .recs{display:flex;gap:0.6rem;flex-wrap:wrap}
.rec{background:#fff;padding:0.5rem;border-radius:8px;width:calc(16.66% - 0.5rem);box-shadow:0 4px 10px rgba(2,6,23,0.04);text-align:center}
.rec-image img{width:100%;height:84px;object-fit:cover;border-radius:6px}
.rec-title{margin-top:0.45rem;font-weight:600;font-size:0.95rem}

.today-events-section{margin-top:0.6rem}
.today-events-list{background:#fff;border:1px solid #eef2f7;border-radius:10px;padding:0.6rem}
.today-ev-item{padding:0.5rem;border-bottom:1px dashed #f1f5f9}
.today-ev-item:last-child{border-bottom:none}
.ev-title{font-weight:700}
.ev-meta{color:#6b7280;font-size:0.9rem;margin-top:0.25rem}

@media (max-width:900px){.rec{width:48%}}
</style>
