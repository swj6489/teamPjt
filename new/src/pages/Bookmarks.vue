<template>
  <div class="bookmarks page-bg-frame">
    <h2>북마크</h2>
      <section>
        <h3>북마크한 게시글</h3>
        <div v-if="items.length===0">북마크한 게시글이 없습니다.</div>
        <ul>
          <li v-for="p in items" :key="p.id" class="bm-item">
            <div class="bm-main">
              <div class="bm-title">{{ p.title }}</div>
              <div class="bm-meta">작성자: {{ p.author }} · {{ formatDate(p.createdAt) }}</div>
            </div>
            <div class="bm-actions">
              <button @click="view(p)">보기</button>
              <button @click="removePost(p.id)">북마크 해제</button>
            </div>
          </li>
        </ul>
      </section>
      

      <section style="margin-top:1rem">
        <h3>북마크한 장소(POI)</h3>
        <div v-if="poiItems.length===0">북마크한 장소가 없습니다.</div>
        <ul>
          <li v-for="p in poiItems" :key="p.id" class="bm-item">
            <div class="bm-main">
              <div class="bm-title">{{ p.name }}</div>
              <div class="bm-meta">카테고리: {{ p.category }}</div>
            </div>
            <div class="bm-actions">
              <button @click="viewPoi(p)">보기</button>
              <button @click="removePoi(p.id)">북마크 해제</button>
            </div>
          </li>
        </ul>
      </section>
      <section style="margin-top:1rem">
        <h3>저장된 맞춤형 추천 루트</h3>
        <div v-if="routes.length===0">저장된 맞춤형 루트가 없습니다.</div>
        <ul>
          <li v-for="r in routes" :key="r.id" class="bm-item">
            <div class="bm-main">
              <div class="bm-title">{{ r.title }}</div>
              <div class="bm-meta">{{ r.desc }} · {{ profileLabel(r.profile) }}</div>
            </div>
            <div class="bm-actions">
              <button @click="viewRoute(r)">보기</button>
              <button @click="removeRoute(r.id)">삭제</button>
            </div>
          </li>
        </ul>
      </section>
    <div v-if="selected" class="modal" @click.self="selected=null">
      <div class="modal-card">
        <button @click="selected=null" style="float:right;border:none;background:transparent">✕</button>
        <h3>{{ selected.title }}</h3>
        <div>{{ selected.content }}</div>
      </div>
    </div>
    <div v-if="routeSelected" class="modal" @click.self="routeSelected=null">
      <div class="modal-card">
        <button @click="routeSelected=null" style="float:right;border:none;background:transparent">✕</button>
        <h3>{{ routeSelected.title }}</h3>
        <div>{{ routeSelected.desc }}</div>
        <ol style="margin-top:0.6rem">
          <li v-for="p in routeSelected.stops" :key="p.id" style="margin-bottom:0.5rem">
            <div style="font-weight:700">{{ p.name }}</div>
            <div style="font-size:0.9rem;color:#666">{{ p.category }}</div>
          </li>
        </ol>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { loadPosts } from '../composables/usePosts'

export default {
  name:'Bookmarks',
  setup(){
    const router = useRouter()
    const bookmarks = ref([])
    const poiBookmarks = ref([])
    const items = ref([])
    const selected = ref(null)

    function loadBookmarks(){
      try{ bookmarks.value = JSON.parse(localStorage.getItem('localhub-bookmarks')||'[]') }catch(e){ bookmarks.value = [] }
      try{ poiBookmarks.value = JSON.parse(localStorage.getItem('localhub-bookmarks-poi')||'[]') }catch(e){ poiBookmarks.value = [] }
    }

    function loadItems(){
      const posts = loadPosts() || []
      items.value = posts.filter(p => bookmarks.value.includes(p.id))
    }

    async function loadPoiItems(){
      const all = []
      try{
        const files = ['부산_관광지.json','부산_레포츠.json','부산_문화시설.json','부산_쇼핑.json','부산_숙박.json','부산_여행코스.json','부산_축제공연행사.json']
        for(const f of files){
          const res = await fetch(`/docs/data/${f}`)
          if(!res.ok) continue
          const j = await res.json()
          const itemsArr = j.items||[]
          itemsArr.forEach(it=> {
            const lat = parseFloat(it.mapy || it.latitude || it.lat || 0)
            const lng = parseFloat(it.mapx || it.longitude || it.lng || 0)
            all.push({ id: it.contentid, name: it.title, category: f.replace(/^부산_/, '').replace(/\.json$/,''), raw: it, lat, lng })
          })
        }
      }catch(e){}
      poiItems.value = all.filter(p=> poiBookmarks.value.includes(p.id))
    }

    function removePost(id){
      bookmarks.value = bookmarks.value.filter(x=>x!==id)
      localStorage.setItem('localhub-bookmarks', JSON.stringify(bookmarks.value))
      loadItems()
    }

    function view(p){ selected.value = p }
    function formatDate(ts){ return new Date(ts).toLocaleString() }

    // existing lifecycle and POI handlers
    onMounted(()=>{ loadBookmarks(); loadItems(); loadPoiItems(); loadRoutes() })
    function removePoi(id){ poiBookmarks.value = poiBookmarks.value.filter(x=>x!==id); localStorage.setItem('localhub-bookmarks-poi', JSON.stringify(poiBookmarks.value)); loadPoiItems() }
    function viewPoi(p){
      // if POI has coordinates, navigate to map and open it
      const lat = p.lat || (p.raw && (p.raw.mapy || p.raw.latitude || p.raw.lat))
      const lng = p.lng || (p.raw && (p.raw.mapx || p.raw.longitude || p.raw.lng))
      if(lat && lng){
        router.push({ path: '/map', query: { lat: lat, lng: lng, category: p.category } })
        return
      }
      selected.value = { title: p.name, content: p.raw ? (p.raw.overview||p.raw.program||'') : '' }
    }

    const poiItems = ref([])

    // saved custom routes created from CustomGuide
    const routes = ref([])
    const routeSelected = ref(null)

    function loadRoutes(){
      try{ routes.value = JSON.parse(localStorage.getItem('localhub-routes')||'[]') }catch(e){ routes.value = [] }
    }

    function viewRoute(r){ routeSelected.value = r }
    function removeRoute(id){ routes.value = routes.value.filter(x=>x.id!==id); localStorage.setItem('localhub-routes', JSON.stringify(routes.value)); }

    function profileLabel(key){
      return key==='family'? '가족' : key==='date'? '데이트' : key==='friends'? '친구' : key==='solo'? '혼행' : (key||'')
    }

    return { items, removePost, view, selected, formatDate, poiItems, removePoi, viewPoi, routes, viewRoute, removeRoute, routeSelected, profileLabel }
  }
}
</script>

<style scoped>
.bookmarks{padding:1rem}
.bm-item{display:flex;justify-content:space-between;padding:0.5rem;background:#fff;border-radius:8px;margin-bottom:0.5rem}
.bm-title{font-weight:600}
.bm-actions button{margin-left:0.5rem}
.modal{position:fixed;inset:0;background:rgba(2,6,23,0.6);display:flex;align-items:center;justify-content:center;padding:1rem}
.modal-card{background:#fff;padding:1rem;border-radius:8px;max-width:720px;width:100%}
</style>
