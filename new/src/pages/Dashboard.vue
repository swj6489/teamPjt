<template>
  <div class="dashboard-page">
    <header class="dash-hero card">
      <div>
        <h2>데이터 대시보드</h2>
        <p class="muted">관광 데이터와 커뮤니티 현황을 한눈에</p>
      </div>
      <div class="dash-stats">
        <div class="stat card"><div class="label">총 POI</div><div class="value">{{ totalPOI }}</div></div>
        <div class="stat card"><div class="label">게시글</div><div class="value">{{ stats.totalPosts }}</div></div>
        <div class="stat card"><div class="label">댓글</div><div class="value">{{ stats.totalComments }}</div></div>
        <div class="stat card"><div class="label">좋아요</div><div class="value">{{ stats.totalLikes }}</div></div>
      </div>
    </header>

    <section class="dash-grid">
      <div class="card">
        <h4>POI 카테고리 분포</h4>
        <canvas id="poiChart"></canvas>
      </div>
      <div class="card">
        <h4>최근 게시글 월별 분포</h4>
        <canvas id="postsChart"></canvas>
      </div>
    </section>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import Chart from 'chart.js/auto'
import { loadPosts } from '../composables/usePosts'

export default {
  name:'Dashboard',
  setup(){
    const stats = ref({ totalPosts:0, totalComments:0, totalLikes:0 })
    const totalPOI = ref(0)

    let poiChart = null
    let postsChart = null

    async function loadPOIcounts(){
      const files = ['부산_관광지.json','부산_레포츠.json','부산_문화시설.json','부산_쇼핑.json','부산_숙박.json','부산_여행코스.json','부산_축제공연행사.json']
      let sum=0; const map={}
      for(const f of files){ try{ const r=await fetch(`/docs/data/${f}`); if(!r.ok) continue; const j=await r.json(); const cnt=j.total||(j.items&&j.items.length)||0; const cat=f.replace(/^부산_/,'').replace(/\.json$/,''); map[cat]=cnt; sum+=cnt }catch(e){} }
      totalPOI.value = sum
      renderPoiChart(map)
    }

    function loadCommunityStats(){
      const posts = loadPosts()||[]
      stats.value.totalPosts = posts.length
      stats.value.totalComments = posts.reduce((s,p)=> s + ((p.comments && p.comments.length) || 0), 0)
      stats.value.totalLikes = posts.reduce((s,p)=> s + (p.likes||0), 0)
      const now=new Date(); const months=[]
      for(let i=5;i>=0;i--){ months.push(new Date(now.getFullYear(), now.getMonth()-i,1)) }
      const postsCounts = months.map(()=>0)
      const commentsCounts = months.map(()=>0)
      const likesCounts = months.map(()=>0)

      posts.forEach(p=>{
        const pDate = p.createdAt ? new Date(p.createdAt) : null
        // post counts and likes are attributed to post created month
        if(pDate){ months.forEach((m,i)=>{ if(pDate.getFullYear()===m.getFullYear() && pDate.getMonth()===m.getMonth()) { postsCounts[i]++; likesCounts[i] += (p.likes||0) } }) }
        // comments: try to use comment.createdAt else fallback to post createdAt
        const cmts = p.comments || []
        cmts.forEach(c=>{
          const cDate = c.createdAt ? new Date(c.createdAt) : (pDate || null)
          if(!cDate) return
          months.forEach((m,i)=>{ if(cDate.getFullYear()===m.getFullYear() && cDate.getMonth()===m.getMonth()) commentsCounts[i]++ })
          // if comments have likes field, include them in likesCounts as well
          if(c.likes) months.forEach((m,i)=>{ if(cDate.getFullYear()===m.getFullYear() && cDate.getMonth()===m.getMonth()) likesCounts[i] += c.likes })
        })
      })

      renderPostsChart({months,postsCounts,commentsCounts,likesCounts})
    }

    function renderPoiChart(map){ const labels=Object.keys(map); const data=labels.map(l=>map[l]); const ctx=document.getElementById('poiChart'); if(!ctx) return; if(poiChart){ try{ poiChart.destroy() }catch(e){} } poiChart = new Chart(ctx,{type:'doughnut',data:{labels,datasets:[{data,backgroundColor:labels.map((_,i)=>`hsl(${(i*50)%360}deg 70% 55%)`)}]}})
    }

    function renderPostsChart(md){
      const labels = md.months.map(m=>`${m.getFullYear()}-${String(m.getMonth()+1).padStart(2,'0')}`)
      const ctx = document.getElementById('postsChart')
      if(!ctx) return
      if(postsChart){ try{ postsChart.destroy() }catch(e){} }
      postsChart = new Chart(ctx,{
        type:'bar',
        data:{
          labels,
          datasets:[
            { label:'게시글', data: md.postsCounts, backgroundColor:'rgba(14,165,163,0.85)' },
            { label:'댓글', data: md.commentsCounts, backgroundColor:'rgba(99,102,241,0.85)' },
            { label:'좋아요', data: md.likesCounts, backgroundColor:'rgba(245,158,11,0.85)' }
          ]
        },
        options:{
          responsive:true,
          interaction:{mode:'index',intersect:false},
          scales:{ y:{ beginAtZero:true } }
        }
      })
    }

    onMounted(async()=>{ await loadPOIcounts(); loadCommunityStats() })
    return { stats, totalPOI }
  }
}
</script>

<style scoped>
.dash-hero{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:1rem}
.dash-stats{display:flex;gap:0.75rem}
.stat{min-width:120px;text-align:center}
.dash-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem}
.card{padding:1rem;border-radius:10px}
</style>

