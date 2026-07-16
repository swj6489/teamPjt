<template>
  <div class="calendar-page">
    <header class="cal-header">
      <div class="nav">
        <button class="nav-btn" @click="prevMonth">◀ 이전달</button>
        <div class="month-title">
          <div class="title">{{ currentYear }}년 {{ String(currentMonth+1).padStart(2,'0') }}월</div>
          <div class="month-badge">{{ monthEventCount }}건</div>
        </div>
        <button class="nav-btn" @click="nextMonth">다음달 ▶</button>
      </div>
      <div class="controls">
        <label>배치 기준: 
          <select v-model="groupBy">
            <option value="event">행사일 기준</option>
            <option value="modified">갱신일 기준</option>
          </select>
        </label>
        <label style="margin-left:1rem">카테고리: 
          <button class="btn" :class="{primary: categoryFilter==='all'}" @click="setCategory('all')">전체</button>
          <button class="btn" :class="{primary: categoryFilter==='festival'}" @click="setCategory('festival')" style="margin-left:0.4rem">축제만</button>
        </label>
      </div>
      <div class="legend">
        <span class="legend-item"><b style="background:#06b6d4"></b> 축제/공연</span>
      </div>
    </header>

    <div class="content">
      <main class="main-cal">
        <div class="weekdays">
          <div v-for="d in ['일','월','화','수','목','금','토']" :key="d">{{ d }}</div>
        </div>
        <div class="days">
          <div v-for="cell in calendarCells" :key="cell.key" class="day" :class="{other: !cell.currentMonth, selected: selectedDate && selectedDate.toDateString()===cell.date.toDateString(), today: isToday(cell.date)}" @click="onDayClick(cell, $event)">
                <div class="date">{{ cell.date.getDate() }}</div>
                <div class="day-badges">
                  <template v-for="(ev, idx) in cell.events" :key="ev.id">
                    <div v-if="idx < 3" class="event-badge" :style="{background: getColor(ev)}" @click.stop="openEvent(ev)">
                      {{ truncate(ev.title, 28) }}
                    </div>
                    <div v-else-if="idx === 3" class="event-badge more" @click.stop="selectDayEvents(cell.date, cell.events)">
                      +{{ cell.events.length - 3 }} more
                    </div>
                  </template>
                </div>
          </div>
          <!-- event bars that span multiple days (rendered per-week as grid items) -->
          <template v-for="seg in visibleEventBars" :key="seg.id + '-' + seg.row + '-' + seg.startCol">
            <div class="event-bar" :style="{gridColumn: seg.startCol + ' / span ' + seg.span, gridRow: seg.row, background: getColor(seg.ev)}" @click.stop="openEvent(seg.ev)">
              {{ truncate(seg.ev.title, 60) }}
            </div>
          </template>
        </div>
      </main>
    </div>

      <div v-if="openDayModal" class="modal" @click.self="openDayModal=false">
        <div class="modal-card day-modal-card" style="max-width:720px;">
          <button @click="openDayModal=false" style="float:right;border:none;background:transparent">✕</button>
          <h3 style="margin-bottom:0.5rem">{{ selectedDateDisplay }}의 이벤트 ({{ dayModalEvents.length }})</h3>
          <div style="margin-top:0.5rem">
            <ul style="list-style:none;padding:0;margin:0">
              <li v-for="ev in dayModalEvents" :key="ev.id" style="padding:0.6rem 0;border-bottom:1px solid #f1f5f9">
                <div style="display:flex;justify-content:space-between;align-items:start;gap:1rem">
                  <div style="flex:1">
                    <div style="font-weight:700">{{ ev.title }}</div>
                    <div class="meta" style="margin-top:0.25rem">{{ ev.start }} ~ {{ ev.end }} · {{ ev.raw && ev.raw.eventplace ? ev.raw.eventplace : (ev.raw && ev.raw.addr1 ? ev.raw.addr1 : '') }}</div>
                    <div style="margin-top:0.5rem;color:#374151;white-space:pre-wrap">{{ ev.program || (ev.raw && (ev.raw.overview||ev.raw.program||ev.raw.usetimefestival)) || '' }}</div>
                  </div>
                  <div style="flex:0 0 110px;text-align:right">
                    <button class="btn" @click.stop="openEventFromModal(ev)">상세 보기</button>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

    <div class="events-list card">
      <div v-if="selectedDate">
        <h3>{{ selectedDate.getFullYear() }}년 {{ String(selectedDate.getMonth()+1).padStart(2,'0') }}월 {{ String(selectedDate.getDate()).padStart(2,'0') }}일 · {{ eventsForSelected.length }}건</h3>
        <ul>
          <li v-for="ev in eventsForSelected" :key="ev.id">
            <div style="font-weight:700">{{ ev.title }}</div>
            <div class="meta">● {{ ev.raw && ev.raw.eventplace ? ev.raw.eventplace : (ev.raw && ev.raw.addr1 ? ev.raw.addr1 : '') }} {{ ev.raw && ev.raw.tel ? '· ' + ev.raw.tel : '' }}</div>
          </li>
        </ul>
      </div>
      <div v-else>
        <h3>{{ currentYear }}년 {{ String(currentMonth+1).padStart(2,'0') }}월 · {{ monthEventCount }}건</h3>
        <ul>
          <li v-for="ev in monthEvents" :key="ev.id">
            <div style="font-weight:700">{{ ev.title }}</div>
            <div class="meta">● {{ ev.start }} ~ {{ ev.end }} {{ ev.raw && ev.raw.eventplace ? '· ' + ev.raw.eventplace : '' }} {{ ev.raw && ev.raw.tel ? '· ' + ev.raw.tel : '' }}</div>
          </li>
        </ul>
      </div>
    </div>

    <div v-if="selectedEvent" class="modal" @click.self="selectedEvent=null">
      <div class="modal-card">
        <button @click="selectedEvent=null" style="float:right;border:none;background:transparent">✕</button>
        <h3>{{ selectedEvent.title }}</h3>
        <div><strong>기간:</strong> {{ selectedEvent.start }} ~ {{ selectedEvent.end }}</div>
        <div style="margin-top:0.5rem">{{ selectedEvent.program || selectedEvent.overview || selectedEvent.usetimefestival || '' }}</div>
        <div style="margin-top:0.5rem"><strong>갱신일:</strong> {{ selectedEvent.modified }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'

function parseYmd(s){
  if(!s) return null
  const m = s.toString().trim()
  if(m.length===8){
    const y=+m.slice(0,4), mo=+m.slice(4,6)-1, d=+m.slice(6,8)
    return new Date(y,mo,d)
  }
  return new Date(m)
}

function formatYmdToDisplay(s){
  if(!s) return ''
  const m = s.toString().trim()
  if(m.length===8) return `${m.slice(0,4)}-${m.slice(4,6)}-${m.slice(6,8)}`
  try{ const d=new Date(m); return d.toLocaleDateString() }catch(e){return s}
}

export default {
  name: 'Calendar',
  setup(){
    const events = ref([])
    const now = new Date()
    const currentYear = ref(now.getFullYear())
    const currentMonth = ref(now.getMonth())
    const groupBy = ref('event')
    const selectedEvent = ref(null)
    const selectedDate = ref(null)

    async function load(){
      const files = [
        '부산_축제공연행사.json',
        '부산_문화시설.json',
        '부산_레포츠.json',
        '부산_관광지.json',
        '부산_쇼핑.json',
        '부산_숙박.json',
        '부산_여행코스.json'
      ]
      const all = []
      for(const f of files){
        try{
          const res = await fetch(`/docs/data/${f}`)
          if(!res.ok) continue
          const j = await res.json()
          const items = j.items || []
          items.forEach(it=>{
            // only include items that have an event start date or clearly are events
            const evStart = it.eventstartdate || it.eventStartDate || it.createdtime || it.modifiedtime
            if(!evStart) return
            const startDate = parseYmd(it.eventstartdate) || parseYmd(it.createdtime) || parseYmd(it.modifiedtime)
            const endDate = parseYmd(it.eventenddate) || startDate
            const isFestival = f.includes('축제') || (it.contenttypeid && it.contenttypeid.toString()==='15') || (it.lclsSystm1 && it.lclsSystm1.toString().toUpperCase().startsWith('EV'))
            const startStr = it.eventstartdate || it.createdtime || it.modifiedtime || ''
            const endStr = it.eventenddate || it.eventstartdate || it.createdtime || ''
            all.push({
              id: it.contentid || `${f}-${(it.title||'').slice(0,20)}`,
              title: it.title || it.name || '이벤트',
              start: formatYmdToDisplay(startStr),
              end: formatYmdToDisplay(endStr),
              startDate,
              endDate,
              modified: it.modifiedtime || it.createdtime,
              program: it.program || it.overview || it.usetimefestival || '',
              raw: it,
              source: f,
              category: isFestival ? '축제/공연' : (it.lclsSystm1 || '')
            })
          })
        }catch(e){ /* ignore file errors */ }
      }
      events.value = all
    }

    const filteredEvents = computed(()=>{
      if(categoryFilter.value==='festival'){
        return events.value.filter(ev=> (ev.category||'').toString().includes('축제') || (ev.raw && (ev.raw.lclsSystm1||'').toString().toUpperCase().startsWith('EV')) )
      }
      return events.value
    })

    function monthRange(year,month){
      const first = new Date(year,month,1)
      const last = new Date(year,month+1,0)
      return { first, last }
    }

    const calendarCells = computed(()=>{
      const { first, last } = monthRange(currentYear.value, currentMonth.value)
      const startDay = new Date(first)
      startDay.setDate(1 - startDay.getDay())
      const cells = []
      for(let i=0;i<42;i++){
        const date = new Date(startDay); date.setDate(startDay.getDate()+i)
        const currentMonthFlag = date.getMonth()===currentMonth.value
        // collect events that cover this date depending on group/filter
          const list = filteredEvents.value.filter(ev=>{
          const s = ev.startDate
          const e = ev.endDate
          if(!s) return false
          // normalize dates to ignore time
          const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
          const sDay = new Date(s.getFullYear(), s.getMonth(), s.getDate())
          const eDay = new Date(e.getFullYear(), e.getMonth(), e.getDate())
          return dayStart >= sDay && dayStart <= eDay
        })
        cells.push({ key: date.toISOString(), date, currentMonth: currentMonthFlag, events: list })
      }
      return cells
    })

    const visibleEventBars = computed(()=>{
      const cells = calendarCells.value
      if(!cells || cells.length===0) return []
      const first = cells[0].date
      const last = cells[cells.length-1].date
      const firstDay = new Date(first.getFullYear(), first.getMonth(), first.getDate())
      const lastDay = new Date(last.getFullYear(), last.getMonth(), last.getDate())
      const bars = []
      const dayMs = 24*60*60*1000
      // iterate filtered events and create week-segments
      filteredEvents.value.forEach(ev=>{
        const s = ev.startDate
        const e = ev.endDate
        if(!s) return
        const evStart = new Date(s.getFullYear(), s.getMonth(), s.getDate())
        const evEnd = new Date(e.getFullYear(), e.getMonth(), e.getDate())
        if(evEnd < firstDay || evStart > lastDay) return
        const startIdx = Math.max(0, Math.floor((evStart - firstDay) / dayMs))
        const endIdx = Math.min(cells.length-1, Math.floor((evEnd - firstDay) / dayMs))
        const startRow = Math.floor(startIdx/7)
        const endRow = Math.floor(endIdx/7)
        for(let r = startRow; r<=endRow; r++){
          const rowStartIdx = r*7
          const segStart = Math.max(startIdx, rowStartIdx)
          const segEnd = Math.min(endIdx, rowStartIdx+6)
          const startCol = (segStart % 7) + 1
          const span = segEnd - segStart + 1
          bars.push({ id: ev.id, ev, startCol, span, row: r+1 })
        }
      })
      return bars
    })

    const eventsForSelected = computed(()=>{
      if(!selectedDate.value) return []
      const d = new Date(selectedDate.value.getFullYear(), selectedDate.value.getMonth(), selectedDate.value.getDate())
      return filteredEvents.value.filter(ev=>{
        const s = ev.startDate, e = ev.endDate
        if(!s) return false
        const sDay = new Date(s.getFullYear(), s.getMonth(), s.getDate())
        const eDay = new Date(e.getFullYear(), e.getMonth(), e.getDate())
        return d >= sDay && d <= eDay
      })
    })

    const monthEvents = computed(()=>{
      return filteredEvents.value.filter(ev=>{
        const s = ev.startDate
        if(!s) return false
        return s.getFullYear()===currentYear.value && s.getMonth()===currentMonth.value
      }).sort((a,b)=>a.startDate-b.startDate)
    })

    const monthEventCount = computed(()=> monthEvents.value.length)

    function prevMonth(){ if(currentMonth.value===0){ currentMonth.value=11; currentYear.value-- } else currentMonth.value-- }
    function nextMonth(){ if(currentMonth.value===11){ currentMonth.value=0; currentYear.value++ } else currentMonth.value++ }

    // removed modified filter/grouping as it's not used
    function openEvent(ev){
      // ensure day selection panel doesn't open when directly opening an event
      selectedDate.value = null
      selectedEvent.value = ev
    }

    const openDayModal = ref(false)
    const dayModalEvents = ref([])
    function selectDayEvents(date, evs){
      selectedDate.value = date
      if(!evs || evs.length===0) return
      if(evs.length===1){ openEvent(evs[0]); return }
      dayModalEvents.value = evs
      openDayModal.value = true
    }

    function openEventFromModal(ev){
      openDayModal.value = false
      // small timeout to allow modal close animation if any
      setTimeout(()=>{ openEvent(ev) }, 80)
    }

    function onDayClick(cell, e){
      // if clicked inside an event badge, ignore and let that handler run
      try{
        if(e && e.target && e.target.closest && e.target.closest('.event-badge')) return
      }catch(err){}
      selectedDate.value = cell.date
    }

    function truncate(s, n){
      if(!s) return ''
      return s.length > n ? s.slice(0,n-1) + '…' : s
    }

    function getColor(ev){
      const cat = (ev.category || '').toString().toLowerCase()
      const rawCat = (ev.raw && (ev.raw.lclsSystm1 || ev.raw.lclsSystm2 || '')).toString().toLowerCase()
      const title = (ev.title||'').toLowerCase()
      // festival/performance uses 문화시설 색상 (#06b6d4)
      if(cat.includes('축제') || cat.includes('공연') || rawCat.includes('ev') || title.includes('축제') || title.includes('페스티벌')) return '#06b6d4'
      // default: 숙박/기타
      return '#34d399'
    }

    const categoryFilter = ref('all')
    function setCategory(v){ categoryFilter.value = v }

    function isToday(date){
      if(!date) return false
      const t = new Date()
      return date.getFullYear()===t.getFullYear() && date.getMonth()===t.getMonth() && date.getDate()===t.getDate()
    }

    const selectedDateDisplay = computed(()=>{
      if(!selectedDate.value) return ''
      const d = selectedDate.value
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    })

    onMounted(load)
    return { currentYear, currentMonth, calendarCells, prevMonth, nextMonth, groupBy, selectedEvent, openEvent, categoryFilter, setCategory, getColor, eventsForSelected, selectedDate, monthEventCount, monthEvents, openDayModal, dayModalEvents, selectDayEvents, openEventFromModal, selectedDateDisplay, isToday, truncate, visibleEventBars, onDayClick }
  }
}
</script>

<style scoped>
.calendar-page{padding:1rem}
.cal-header{display:flex;flex-direction:column;gap:0.75rem}
.cal-header .spacer{flex:1}
.content{display:flex;gap:1rem;margin-top:1rem}
.side{width:240px;background:#fff;padding:0.75rem;border-radius:8px}
.main-cal{flex:1}
.weekdays{display:grid;grid-template-columns:repeat(7,1fr);background:transparent;padding:0 6px;border-radius:6px}
.weekdays div{text-align:center;font-weight:700;color:#9ca3af;padding:10px 0}
.days{display:grid;grid-template-columns:repeat(7,1fr);grid-auto-rows:100px;gap:10px;margin-top:6px}
.day{background:#fff;padding:10px;border-radius:8px;overflow:auto;box-shadow:0 1px 2px rgba(2,6,23,0.04);border:1px solid #eef2f7}
.day.other{opacity:0.5;background:transparent;border-color:transparent}
.date{font-weight:700;margin-bottom:6px;color:#374151}
.day.selected{outline:3px solid rgba(59,130,246,0.12);background:linear-gradient(180deg,#fff8ed,#fff)}
.day.today{background:#fffbe6;border:1px solid #fde68a}
.day-badges{display:flex;flex-direction:column;gap:6px}
.day-count{padding:4px 6px;border-radius:8px;color:#fff;font-size:0.85rem;cursor:pointer;display:inline-block}
.event-badge{padding:6px 8px;border-radius:8px;color:#fff;font-size:0.75rem;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.event-badge.more{background:#94a3b8}
.event-bar{z-index:2;padding:6px 8px;border-radius:6px;color:#fff;font-size:0.85rem;align-self:start;height:28px;display:flex;align-items:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.days .day{z-index:1}
/* Hide multi-day spanning event bars when user requests removal */
.event-bar{display:none !important}
.modal{position:fixed;inset:0;background:rgba(2,6,23,0.6);display:flex;align-items:center;justify-content:center;padding:1rem;z-index:99999}
.modal-card{background:#fff;padding:1rem;border-radius:8px;max-width:720px;width:100%;position:relative;z-index:100000}
.modal-card{max-height:80vh;overflow:auto}
.day-modal-card{max-height:70vh;overflow:auto;padding:1rem}

.legend{display:flex;gap:0.75rem;align-items:center;margin-top:0.5rem}
.legend-item b{display:inline-block;width:14px;height:14px;border-radius:3px;margin-right:0.4rem}

.nav{display:flex;align-items:center;gap:0.5rem;justify-content:space-between}
.nav .title{font-size:1.1rem;font-weight:700}
.nav-btn{background:#fff;border:1px solid #e6eef0;padding:6px 10px;border-radius:8px}
.month-title{display:flex;align-items:center;gap:12px}
.month-badge{background:#eef2ff;color:#1e3a8a;padding:6px 10px;border-radius:999px;font-weight:700;font-size:0.95rem}

.events-list{margin-top:18px;background:#fff;padding:1rem;border-radius:10px;border:1px solid #eef2f7}
.events-list h3{margin:0 0 8px 0}
.events-list ul{list-style:none;padding:0;margin:0}
.events-list li{padding:0.4rem 0;border-bottom:1px dashed #f1f5f9}
.events-list li .meta{color:#6b7280;font-size:0.9rem;margin-left:6px}

.nav{display:flex;align-items:center;gap:0.5rem}
.nav .title{font-size:1.1rem;font-weight:700}
.controls{margin-left:auto}
</style>
