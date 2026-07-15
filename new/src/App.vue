<template>
  <div class="app">
    <header class="header">
      <div class="brand">
        <router-link to="/" class="logo">📍 LocalHub</router-link>
        <div class="tag">공공데이터로 만나는 지역정보 커뮤니티</div>
      </div>
      <nav class="nav">
        <router-link class="nav-item" to="/board">게시판</router-link>
        <router-link class="nav-item" to="/map">지도</router-link>
        <router-link class="nav-item" to="/dashboard">대시보드</router-link>
        <router-link class="nav-item" to="/calendar">캘린더</router-link>
        <router-link class="nav-item" to="/guide">가이드</router-link>
        <router-link class="nav-item" to="/bookmarks">북마크</router-link>
      </nav>
    </header>

    <main class="main">
      <router-view />
    </main>

    <footer class="footer">© LocalHub · 교육용 프로젝트 · 데이터 출처: 한국관광공사</footer>
    <Chatbot />
  </div>
</template>

<script>
import Chatbot from './components/Chatbot.vue'
export default { components: { Chatbot } }
</script>

<style scoped>
:root{--bg:#f6f8fb;--card:#ffffff;--muted:#6b7280;--primary:#0ea5a3;--accent:#0ea5a3}
body,html,#app{height:100%;margin:0}
.app{min-height:100vh;display:flex;flex-direction:column;background:var(--bg);font-family:'Noto Sans KR',Inter,Arial,Helvetica,sans-serif;color:#0f172a}
.header{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.5rem;background:linear-gradient(180deg,#ffffff88,#f7fbfb);box-shadow:0 6px 20px rgba(2,6,23,0.04)}
.brand{display:flex;flex-direction:column}
.logo{font-weight:800;color:var(--primary);font-size:1.1rem;text-decoration:none}
.tag{font-size:0.9rem;color:var(--muted)}
.nav{display:flex;gap:0.5rem;align-items:center}
.nav-item{color:#0f172a;text-decoration:none;padding:0.5rem 0.9rem;border-radius:8px;font-weight:600}
.nav-item.router-link-active{background:rgba(14,165,163,0.12);color:var(--primary)}
.main{flex:1;padding:2rem}
.hero{background:linear-gradient(90deg,rgba(14,165,163,0.06),transparent);padding:2rem;border-radius:10px;margin-bottom:1.25rem}
.hero h1{margin:0 0 0.5rem 0}
.preview{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem}
.card{background:var(--card);padding:1rem;border-radius:12px;box-shadow:0 6px 18px rgba(2,6,23,0.04);min-height:100px;display:flex;flex-direction:column;justify-content:center;color:var(--muted)}
.footer{padding:1rem 1.5rem;background:transparent;text-align:center;color:var(--muted);font-size:0.9rem}
@media (max-width:600px){.nav{display:none}.header{padding:0.75rem 1rem}.main{padding:1rem}}
</style>
