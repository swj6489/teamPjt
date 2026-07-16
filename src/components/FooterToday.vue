<template>
  <div class="footer-today">
    <div class="time-row">
        <div class="now">{{ nowDisplay }}</div>
      </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'

function parseYmd(s){
  if(!s) return null
  const m = s.toString().trim()
  if(m.length===8){
    const y=+m.slice(0,4), mo=+m.slice(4,6)-1, d=+m.slice(6,8)
    return new Date(y,mo,d)
  }
  const d = new Date(m)
  if(!isNaN(d)) return d
  return null
}

export default {
  name: 'FooterToday',
  setup(){
    const now = ref(new Date())
    const nowDisplay = ref('')
    // removed events fetching here; Home page will show today's events under recs
    let timer = null

    function updateNow(){
      now.value = new Date()
      nowDisplay.value = now.value.toLocaleString()
    }

    onMounted(()=>{
      updateNow(); timer = setInterval(updateNow, 1000)
    })
    onUnmounted(()=>{ if(timer) clearInterval(timer) })

    return { nowDisplay }
  }
}
</script>

<style scoped>
.footer-today{padding:0.6rem 1rem;border-top:1px solid rgba(0,0,0,0.04);background:transparent;color:var(--muted);font-size:0.95rem}
.time-row{display:flex;justify-content:space-between;align-items:center;gap:1rem}
.now{font-weight:700}
.today-events{display:flex;align-items:center;gap:0.6rem}
.today-events ul{list-style:none;margin:0;padding:0;display:flex;gap:0.6rem}
.today-events li{background:#fff;padding:0.3rem 0.6rem;border-radius:6px;border:1px solid #eef2f7}
.ev-title{font-weight:600}
.ev-place{color:#6b7280;margin-left:0.25rem}
.muted{color:#6b7280;margin-left:0.6rem}
@media (max-width:700px){.time-row{flex-direction:column;align-items:flex-start}.today-events ul{flex-direction:column}}
</style>