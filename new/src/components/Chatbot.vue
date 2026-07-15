<template>
  <div>
    <button class="chat-button" @click="open = true" v-if="!open" aria-label="Open chatbot">💬 고객센터</button>

    <div v-if="open" class="chat-overlay" @click.self="open=false">
      <div class="chat-card">
        <div class="chat-header">
          <div>
            <strong>LocalHub 고객센터 (AI)</strong>
            <div class="muted small">공공데이터 기반 지역정보 질의응답</div>
          </div>
          <div class="chat-actions">
            <button class="btn ghost" @click="clearHistory">초기화</button>
            <button class="btn" @click="open=false">닫기</button>
          </div>
        </div>

        <div class="chat-body">
          <div v-for="(m,idx) in history" :key="idx" :class="['msg', m.role]">
            <div class="msg-role">{{ m.role==='user' ? '나' : 'AI' }}</div>
            <div class="msg-text" v-html="escapeHtml(m.content)"></div>
          </div>
        </div>

        <form class="chat-input" @submit.prevent="send()">
          <input v-model="input" placeholder="질문을 입력하세요. 예: 부산 추천 관광지 3곳 알려줘" />
          <button class="btn primary" :disabled="sending">전송</button>
        </form>

        <div class="chat-footer muted small">키는 환경변수 `VITE_OPENAI_KEY`에서 읽습니다. 키 노출에 주의하세요.</div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'

export default {
  name: 'Chatbot',
  setup(){
    const open = ref(false)
    const input = ref('')
    const sending = ref(false)
    const history = ref([])
    const STORAGE = 'localhub-chat-history'

    onMounted(()=>{
      try{ const raw = localStorage.getItem(STORAGE); if(raw) history.value = JSON.parse(raw) }catch(e){}
    })

    function persist(){ try{ localStorage.setItem(STORAGE, JSON.stringify(history.value)) }catch(e){} }

    function escapeHtml(s){ if(!s) return ''; return s.replace(/\n/g,'<br/>') }

    async function callOpenAI(messages){
      const candidates = [
        import.meta.env.VITE_PROXY_URL || 'http://localhost:3001',
        'http://localhost:3001',
        'http://localhost:3002'
      ].filter((value, index, arr) => arr.indexOf(value) === index)

      let lastError = null
      for (const base of candidates) {
        try {
          const res = await fetch(`${base}/api/chat`, {
            method: 'POST', headers: { 'Content-Type':'application/json' },
            body: JSON.stringify({ messages })
          })
          const j = await res.json().catch(() => null)
          
          // Check for content first (handles fallback responses)
          const content = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content
          if (content) return content
          
          // Then check response status
          if (!res.ok) {
            throw new Error((j && (j.error || j.message)) || res.statusText)
          }
          
          // Finally check for explicit errors if no content
          if (j && j.error) throw new Error(j.error.message || JSON.stringify(j.error))
          
          throw new Error('No assistant message in response')
        } catch (error) {
          lastError = error
        }
      }

      throw lastError || new Error('Failed to reach chat proxy')
    }

    async function send(){
      const text = (input.value||'').trim()
      if(!text) return
      history.value.push({ role:'user', content: text, ts: Date.now() })
      persist()
      input.value = ''
      sending.value = true
      try{
        const system = { role:'system', content: 'You are LocalHub customer support assistant. Answer briefly in Korean. Use available LocalHub data (POI, 게시판) when helpful and suggest map links as /map?lat=...&lng=... when referring to locations.' }
        const msgs = [system].concat(history.value.map(h=>({ role: h.role, content: h.content })))
        const reply = await callOpenAI(msgs)
        history.value.push({ role:'assistant', content: reply||'죄송합니다. 응답을 받지 못했습니다.' , ts: Date.now() })
        persist()
      }catch(e){ history.value.push({ role:'assistant', content: '오류: '+ (e.message||e), ts: Date.now() }); persist() }
      sending.value = false
    }

    function clearHistory(){ history.value = []; persist() }

    return { open, input, history, send, sending, escapeHtml, clearHistory }
  }
}
</script>

<style scoped>
.chat-button{position:fixed;right:18px;bottom:18px;background:#2563eb;color:#fff;border:none;padding:0.6rem 0.9rem;border-radius:999px;box-shadow:0 8px 24px rgba(2,6,23,0.2);cursor:pointer}
.chat-overlay{position:fixed;inset:0;display:flex;align-items:flex-end;justify-content:flex-end;padding:18px;z-index:9999}
.chat-card{width:360px;max-height:72vh;background:#fff;border-radius:12px;box-shadow:0 20px 50px rgba(2,6,23,0.2);display:flex;flex-direction:column;overflow:hidden}
.chat-header{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #f1f5f9}
.chat-body{padding:12px;overflow:auto;flex:1;display:flex;flex-direction:column;gap:8px}
.msg{padding:8px;border-radius:8px}
.msg.user{align-self:flex-end;background:#e6fffa;color:#0f172a}
.msg.assistant{align-self:flex-start;background:#f1f5f9;color:#0f172a}
.msg-role{font-size:0.75rem;color:#6b7280;margin-bottom:4px}
.chat-input{display:flex;border-top:1px solid #f1f5f9;padding:10px}
.chat-input input{flex:1;padding:0.5rem;border:1px solid #e6eef0;border-radius:8px;margin-right:0.5rem}
.chat-footer{padding:8px 12px;border-top:1px solid #fafafa;text-align:center}
.muted{color:#6b7280}
.small{font-size:0.85rem}
.btn.ghost{background:transparent;border:1px solid #e6eef0;padding:0.35rem 0.6rem;border-radius:8px}
.btn{padding:0.4rem 0.6rem;border-radius:8px;border:none}
.btn.primary{background:#2563eb;color:#fff}
@media (max-width:500px){.chat-card{width:100%;border-radius:12px 12px 0 0}}
</style>
