<template>
  <div class="map-page">
    <div class="controls card" style="display:flex;align-items:center;gap:0.75rem">
      <input class="input" v-model="searchQuery" @keyup.enter="performSearch" placeholder="장소 검색 (이름 입력)" />
      <button class="btn ghost" @click="performSearch">검색</button>
      <button class="btn" @click="clearSearch">초기화</button>
      <div style="display:flex;gap:0.5rem;margin-left:auto;flex-wrap:wrap">
        <button v-for="cat in categories" :key="cat" @click="selectCategory(cat)" class="btn ghost" :class="{active:cat===activeCategory}">{{ cat }}</button>
        <button class="btn ghost" @click="selectCategory('All')">All</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 340px;gap:1rem;align-items:start">
      <div>
        <div id="map" class="map card" style="height:65vh;padding:0"></div>
      </div>
      <aside class="card" style="padding:0.75rem">
        <h4 v-if="!searchQuery">POI 목록 <span class="count">({{ filteredPOIs.length }})</span></h4>
        <h4 v-else>검색 결과 <span class="count">({{ searchResults.length }})</span></h4>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:0.5rem;max-height:60vh;overflow:auto">
          <li v-for="p in (searchQuery ? searchResults : filteredPOIs)" :key="p.id" @click="openPOIModal(p)" style="padding:0.5rem;border-radius:8px;cursor:pointer;border:1px solid #f1f5f9;display:flex;flex-direction:column">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div style="font-weight:600">{{ p.name }}</div>
            </div>
            <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.25rem;color:var(--muted);font-size:0.85rem">
              <div>{{ p.category }}</div>
              <button class="bookmark-small" @click.stop="togglePoiBookmark(p)" :class="{booked:isPoiBookmarked(p.id)}">🔖</button>
            </div>
          </li>
        </ul>
      </aside>
    </div>
    <div v-if="selectedPOI" class="modal" @click.self="closePOIModal">
      <div class="modal-card card" style="max-width:820px;">
        <button class="close" @click="closePOIModal">✕</button>
        <div class="modal-body">
          <div class="modal-image">
            <img v-if="selectedPOI.image" :src="selectedPOI.image" alt="" />
            <div v-else class="muted">이미지 없음</div>

            <div class="image-meta">
              <div style="margin-top:0.6rem" class="directions-small">
                <button class="btn small" @click.prevent="openDirections('driving')">🚗 길찾기</button>
                <button class="btn small" @click.prevent="openDirections('transit')">🚇 대중교통</button>
                <button class="btn small" @click.prevent="openDirections('walking')">🚶 도보</button>
              </div>

              <div class="meta-block" style="margin-top:0.8rem">
                <div class="meta-row"><div class="meta-label">주소</div><div class="meta-value muted addr">{{ selectedPOI.addr }}</div></div>
                <div style="margin-top:0.5rem" class="meta-row"><div class="meta-label">전화</div><div class="meta-value muted tel">{{ selectedPOI.tel || '정보 없음' }}</div></div>
                <div style="margin-top:0.6rem" class="meta-overview"><strong>상세 설명</strong><div class="muted" style="margin-top:0.35rem">{{ selectedPOI.overview }}</div></div>
              </div>
            </div>
          </div>

          <div class="modal-info">
            <h3 class="poi-title">{{ selectedPOI.name }}</h3>
            <div class="poi-cat-row">
              <div class="muted poi-cat">{{ selectedPOI.category }}</div>
              <button class="btn poi-bookmark" @click.stop="togglePoiBookmark(selectedPOI)" :class="{booked:isPoiBookmarked(selectedPOI.id)}">🔖 북마크</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { onMounted, onUnmounted, ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

export default {
  name: 'Map',
  setup() {
    const map = ref(null)
    const markers = ref([])
    let clusterGroup = null
    let _markerBatchId = 0
    let _markerBatchTimer = null
    const pois = ref([])
    // Use explicit allowed categories; remove '음식점' and default to '관광지'
    const allowedCategories = ['관광지', '레포츠', '문화시설', '숙박', '쇼핑', '여행코스', '축제공연행사']
    const categories = ref([])
    const activeCategory = ref('관광지')

    const dataFiles = [
      '부산_관광지.json',
      '부산_레포츠.json',
      '부산_문화시설.json',
      '부산_쇼핑.json',
      '부산_숙박.json',
      '부산_여행코스.json',
      '부산_축제공연행사.json'
    ]

    const loadPOIs = async () => {
      const all = []
      for (const file of dataFiles) {
        try {
          const res = await fetch(`/docs/data/${file}`)
          if (!res.ok) continue
          const json = await res.json()
          const items = Array.isArray(json.items) ? json.items : []
          const category = file.replace(/^부산_/, '').replace(/\.json$/, '')
          items.forEach(it => {
            const lat = parseFloat(it.mapy || it.latitude || it.lat || 0)
            const lng = parseFloat(it.mapx || it.longitude || it.lng || 0)
            if (!lat || !lng) return
            const image = it.firstimage || it.firstimage2 || it.image || ''
            const addr = it.addr1 || it.address || ''
            const tel = it.tel || it.telno || it.phone || ''
            const opentime = it.opentime || it.opentime || it.usetime || it.operating_time || ''
            const overview = it.overview || it.intro || it.detail || it.content || it.summary || ''
            // store raw item for later lookup
            all.push({ id: it.contentid || it.id || `${file}-${it.title}`, name: it.title || it.name, lat, lng, category, image, addr, tel, opentime, overview, raw: it })
          })
        } catch (e) {
          // ignore file errors
        }
      }
      pois.value = all
      // initialize categories from allowed list intersection
      categories.value = allowedCategories.filter(c => all.some(p => p.category === c))
      // ensure activeCategory exists; default to '관광지' if present
      if (!categories.value.includes(activeCategory.value)) {
        activeCategory.value = categories.value.length ? categories.value[0] : 'All'
      }
    }

    // after loading POIs, if route has lat/lng query, open nearest POI
    const route = useRoute()
    function tryOpenFromQuery(){
      const q = route.query
      const lat = parseFloat(q.lat || q.mapy || 0)
      const lng = parseFloat(q.lng || q.mapx || 0)
      if(!lat || !lng) return
      // find nearest poi
      let best = null
      let bestDist = Infinity
      for(const p of pois.value){
        const d = haversineDistance(lat, lng, p.lat, p.lng)
        if(d < bestDist){ bestDist = d; best = p }
      }
      if(best){
        // open modal for that poi
        openPOIModal(best)
      }
    }

    const initMap = () => {
      map.value = L.map('map').setView([35.1796, 129.0756], 11) // Busan center
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(map.value)
      // initialize cluster group
      clusterGroup = L.markerClusterGroup()
      map.value.addLayer(clusterGroup)
    }

    const clearMarkers = () => {
      if (clusterGroup) {
        clusterGroup.clearLayers()
      }
      markers.value = []
      // cancel any pending batch work
      _markerBatchId++
      if (_markerBatchTimer) { clearTimeout(_markerBatchTimer); _markerBatchTimer = null }
    }

    const renderMarkers = () => {
      clearMarkers()
      const list = pois.value.filter(p => activeCategory.value === 'All' || p.category === activeCategory.value)
      // limit to reasonable amount to avoid extreme load
      const toRender = list.slice(0, 2000)
      // batch add markers to avoid blocking the UI
      const BATCH = 200
      let i = 0
      const myBatchId = ++_markerBatchId
      function addBatch(){
        // if a newer batch started, abort this one
        if (myBatchId !== _markerBatchId) return
        const end = Math.min(i + BATCH, toRender.length)
        for(; i<end; i++){
          const p = toRender[i]
          const m = L.marker([p.lat, p.lng]).bindPopup(`<b>${p.name}</b><br/>${p.category}`)
          m.on('click', () => openPOIModal(p))
          markers.value.push(m)
          if (clusterGroup) clusterGroup.addLayer(m)
          else m.addTo(map.value)
        }
        if(i < toRender.length) {
          _markerBatchTimer = setTimeout(addBatch, 50)
        } else {
          _markerBatchTimer = null
        }
      }
      addBatch()
    }

    function selectCategory(cat) {
      activeCategory.value = cat
      renderMarkers()
    }

    function flyToPOI(p) {
      map.value.flyTo([p.lat, p.lng], 15)
    }

    const selectedPOI = ref(null)
    const poiBookmarks = ref([])

    function loadPoiBookmarks() {
      try { poiBookmarks.value = JSON.parse(localStorage.getItem('localhub-bookmarks-poi')||'[]') } catch(e){ poiBookmarks.value = [] }
    }

    function savePoiBookmarks() {
      try { localStorage.setItem('localhub-bookmarks-poi', JSON.stringify(poiBookmarks.value)) } catch(e){}
    }

    function isPoiBookmarked(id){ return poiBookmarks.value.includes(id) }

    function togglePoiBookmark(p){
      const id = p.id
      if(isPoiBookmarked(id)) poiBookmarks.value = poiBookmarks.value.filter(x=>x!==id)
      else poiBookmarks.value.push(id)
      savePoiBookmarks()
    }

    // Try to extract best available overview and tel from raw data or nearby items
    function resolveDetails(p) {
      const result = { overview: p.overview || '', tel: p.tel || '', addr: p.addr || '', image: p.image || '' }
      const raw = p.raw || {}
      // try several possible keys on raw
      result.overview = result.overview || raw.overview || raw.intro || raw.detail || raw.content || raw.summary || raw.info || raw.event || ''
      result.tel = result.tel || raw.tel || raw.telno || raw.phone || raw.telephone || raw.infonet || raw.infoTel || ''
      result.addr = result.addr || raw.addr1 || raw.address || ''
      result.image = result.image || raw.firstimage || raw.firstimage2 || raw.image || ''
      // fallback: search other POIs with same name for missing tel/overview
      if ((!result.tel || !result.overview) && pois.value.length) {
        const name = (p.name || '').toLowerCase()
        for (const other of pois.value) {
          if (other.id === p.id) continue
          const oname = (other.name || '').toLowerCase()
          const same = oname === name || oname.includes(name) || name.includes(oname)
          if (!same) continue
          if (!result.tel && other.tel) result.tel = other.tel
          if (!result.overview && other.overview) result.overview = other.overview
          if (!result.tel && other.raw) {
            const ro = other.raw
            result.tel = result.tel || ro.tel || ro.telno || ro.phone || ro.telephone || ro.infonet || ''
            result.overview = result.overview || ro.overview || ro.intro || ro.detail || ''
          }
          if (result.tel && result.overview) break
        }
      }
      // as last resort, try fuzzy search across names for phone
      if (!result.tel && pois.value.length) {
        const parts = (p.name || '').split(/\s+|,|·|\//).filter(Boolean)
        for (const other of pois.value) {
          if (other.id === p.id) continue
          const oname = (other.name || '').toLowerCase()
          if (parts.some(part => oname.includes(part.toLowerCase()))) {
            result.tel = result.tel || other.tel || (other.raw && (other.raw.tel||other.raw.phone)) || ''
            if (result.tel) break
          }
        }
      }
      // generate a simple fallback overview from name when none found
      if (!result.overview && p.name) {
        const name = p.name.trim()
        if (!name.startsWith('부산')) {
          const parts = name.split(/\s+/)
          if (parts.length >= 2) {
            const first = parts[0]
            const rest = parts.slice(1).join(' ')
            result.overview = `${rest}에 있는 ${first}입니다.`
          } else {
            result.overview = `${name}입니다.`
          }
        } else {
          result.overview = `${name}입니다.`
        }
      }
      return result
    }

    function openPOIModal(p) {
      const details = resolveDetails(p)
      selectedPOI.value = Object.assign({}, p, details)
      if (map.value) map.value.flyTo([p.lat, p.lng], 15)
    }

    function closePOIModal() {
      selectedPOI.value = null
    }

    onMounted(async () => {
      initMap()
      await loadPOIs()
      // if a category was provided in the route query, set it when available
      try{
        const catQ = route.query.category
        if(catQ && categories.value.includes(catQ)) activeCategory.value = catQ
      }catch(e){}
      tryOpenFromQuery()
      loadPoiBookmarks()
      // defer marker rendering slightly to avoid blocking transition
      setTimeout(()=>{ renderMarkers() }, 100)
    })

    const filteredPOIs = computed(() => {
      return pois.value.filter(p => activeCategory.value === 'All' || p.category === activeCategory.value)
    })

    const searchQuery = ref('')
    const searchResults = computed(() => {
      const q = (searchQuery.value || '').trim().toLowerCase()
      if (!q) return []
      return pois.value.filter(p => (p.name || '').toLowerCase().includes(q)).slice(0,200)
    })

    function performSearch() {
      if (!searchQuery.value) return
      // if results exist, fly to first
      const r = searchResults.value
      if (r && r.length) {
        const first = r[0]
        if (map.value) map.value.flyTo([first.lat, first.lng], 15)
        selectedPOI.value = Object.assign({}, first, resolveDetails(first))
      }
    }

    function clearSearch() {
      searchQuery.value = ''
      // re-render markers to reset any highlights
      if (map.value) renderMarkers()
    }

    function haversineDistance(lat1, lon1, lat2, lon2) {
      const toRad = v => v * Math.PI / 180
      const R = 6371000 // meters
      const dLat = toRad(lat2 - lat1)
      const dLon = toRad(lon2 - lon1)
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
      return R * c
    }

    const nearby = computed(() => {
      if (!selectedPOI.value) return []
      const lat = selectedPOI.value.lat
      const lng = selectedPOI.value.lng
      const list = pois.value.map(p => ({ ...p, dist: haversineDistance(lat, lng, p.lat, p.lng) }))
      const filtered = list.filter(p => p.id !== selectedPOI.value.id && p.dist <= 2000)
      filtered.sort((a,b)=>a.dist-b.dist)
      return filtered.slice(0,5)
    })

    // Clean up map and markers on unmount (important for HMR)
    onUnmounted(() => {
      try {
        clearMarkers()
        if (map.value) {
          map.value.remove()
          map.value = null
        }
      } catch (e) {
        // ignore
      }
    })

    // watch pois or activeCategory to re-render markers
    watch([pois, activeCategory], () => {
      if (map.value) renderMarkers()
    })

    function openDirections(mode) {
      if (!selectedPOI.value || !selectedPOI.value.lat || !selectedPOI.value.lng) return
      const lat = selectedPOI.value.lat
      const lng = selectedPOI.value.lng
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${mode}`
      // Use same-tab navigation to avoid popup blocking issues
      window.location.href = url
    }

    return { categories, activeCategory, selectCategory, filteredPOIs, flyToPOI, selectedPOI, openPOIModal, closePOIModal, openDirections, nearby, searchQuery, searchResults, performSearch, clearSearch, isPoiBookmarked, togglePoiBookmark }
  }
}
</script>

<style scoped>
.map-page{display:grid;grid-template-columns:1fr 320px;gap:1rem;padding:1rem}
.controls{grid-column:1/-1;display:flex;gap:0.5rem;margin-bottom:0.5rem}
.controls button{padding:0.4rem 0.6rem;border-radius:6px;border:1px solid #e5e7eb;background:#fff}
.controls button.active{background:rgba(25,118,210,0.08);color:#1976d2;font-weight:600}
.map{height:60vh;border-radius:8px}
.poi-list{background:#fff;padding:0.5rem;border-radius:8px;height:60vh;overflow:auto}
.poi-list ul{padding:0;margin:0;list-style:none}
.poi-list li{padding:0.5rem;border-bottom:1px solid #f1f5f9;cursor:pointer}
.poi-list li:hover{background:#f8fafc}
@media (max-width:900px){.map-page{grid-template-columns:1fr;}.poi-list{height:35vh}.map{height:40vh}}

.modal-body{display:flex;gap:1rem;align-items:flex-start}
.modal-image{width:140px;flex:0 0 140px;display:flex;flex-direction:column;align-items:flex-start}
.modal-image img{width:140px;height:100px;object-fit:cover;border-radius:6px}
.image-meta{margin-top:0.5rem;font-size:0.92rem}
.image-meta .small{font-size:0.86rem;color:var(--muted)}
.image-meta .addr{font-weight:600;margin-top:0.16rem;line-height:1.08;font-size:0.92rem}
.image-meta .tel{color:var(--muted);margin-top:0.12rem;font-size:0.85rem}
.btn.small{padding:0.45rem 0.7rem;font-size:0.88rem;border-radius:8px;min-width:92px}
.directions-small{display:flex;gap:0.5rem}
.bookmark-small{background:transparent;border:none;padding:0.15rem 0.35rem;border-radius:6px;cursor:pointer;color:var(--muted)}
.bookmark-small.booked{color:#f59e0b}

.modal-info{flex:1;min-width:0}
.poi-cat-row{display:flex;align-items:center;gap:0.45rem;margin-top:0.18rem}
.poi-cat{font-size:0.88rem}
.poi-bookmark{margin-left:8px;padding:0.2rem 0.45rem;border-radius:6px;font-size:0.82rem}
.poi-bookmark.booked{background:#fff8e1;color:#f59e0b}
.poi-title{font-size:1.05rem;margin:0 0 0.18rem 0;line-height:1.15}
.poi-cat{margin:0}
.overview{margin:0 0 0.75rem 0;color:#0f172a;line-height:1.4}
.poi-meta{border-top:1px dashed #eef2f7;padding-top:0.6rem}
.meta-row{display:grid;grid-template-columns:72px 1fr;gap:0.5rem;align-items:start}
.meta-label{font-weight:700;color:#0f172a;font-size:0.95rem}
.meta-value{color:var(--muted);font-size:0.95rem}
.meta-overview{font-size:0.95rem}

@media (max-width:900px){.modal-body{flex-direction:column}.modal-image{width:100%;flex:0 0 auto}.modal-image img{width:100%;height:160px}}
</style>
