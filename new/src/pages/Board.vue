<template>
  <div class="board-page">
    <header class="board-header">
      <div class="header-left">
        <h2>지역 게시판</h2>
        <p class="muted">총 {{ filteredPosts.length }}개의 글</p>
      </div>
      <div class="header-right">
        <button class="btn primary" @click="openEditor">✏️ 글쓰기</button>
      </div>
    </header>

    <!-- Inline editor shown when editing an existing post -->
    <aside v-if="editingId" class="card editor-inline">
      <h3>글 수정</h3>
      <form @submit.prevent="onSubmit">
        <label>제목
          <input v-model="form.title" required />
        </label>
        <label>작성자
          <input v-model="form.author" required />
        </label>
        <label>비밀번호(수정/삭제용)
          <input v-model="form.password" type="password" />
        </label>
        <label>태그 (쉼표로 구분)
          <input v-model="form.tagsRaw" placeholder="예: 축제,한강" />
        </label>
        <label>내용
          <textarea v-model="form.content" rows="6" required></textarea>
        </label>
        <div class="editor-actions">
          <button class="btn primary" type="submit">저장</button>
          <button class="btn" type="button" @click="closeEditor">취소</button>
        </div>
      </form>
    </aside>

    <section class="board-controls card">
      <div class="search-wrap">
        <input class="search-input" v-model="searchQuery" @keyup.enter="onSearch" placeholder="🔍 제목·내용·태그 검색" />
      </div>
      <div class="filter-wrap">
        <select v-model="tagFilter">
          <option value="">전체 태그</option>
          <option v-for="t in tagsList" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>
    </section>

    <main class="post-list card">
      <div class="table-header">
        <div class="col title">제목</div>
        <div class="col author">작성자</div>
        <div class="col views">조회</div>
        <div class="col likes">좋아요</div>
        <div class="col bookmark">북마크</div>
        <div class="col date">작성일</div>
      </div>

      <div v-if="filteredPosts.length===0" class="empty">등록된 게시글이 없습니다.</div>

      <ul class="posts">
        <li v-for="p in pagedPosts" :key="p.id" class="post-row" @click="openPostRow(p)">
          <div class="col title">
            <div class="post-title">{{ p.title }}</div>
            <div class="tags">
              <span class="tag" v-for="tg in p.tags||[]" :key="tg">#{{ tg }}</span>
            </div>
          </div>
          <div class="col author">{{ p.author }}</div>
          <div class="col views">{{ p.views||0 }}</div>
              <div class="col likes">
                <button class="btn" :class="{liked: p.liked}" @click.stop="toggleLike(p)">👍 {{ p.likes||0 }}</button>
              </div>
          <div class="col bookmark">
            <button class="btn" :class="{booked: isBookmarked(p.id)}" @click.stop="toggleBookmark(p)">🔖</button>
          </div>
          <div class="col date">{{ formatDate(p.createdAt) }}</div>
        </li>
      </ul>
    </main>

    <!-- New post modal (only for creating new posts) -->
    <div v-if="showEditor && !editingId" class="modal" @click.self="closeEditor">
      <div class="modal-card card editor-modal">
        <button class="close" @click="closeEditor">✕</button>
        <h3>새 글 작성</h3>
        <form @submit.prevent="onSubmit">
          <label>제목
            <input v-model="form.title" required />
          </label>
          <label>작성자
            <input v-model="form.author" required />
          </label>
          <label>비밀번호(수정/삭제용)
            <input v-model="form.password" type="password" required />
          </label>
          <label>태그 (쉼표로 구분)
            <input v-model="form.tagsRaw" placeholder="예: 축제,한강" />
          </label>
          <label>내용
            <textarea v-model="form.content" rows="8" required></textarea>
          </label>
          <div class="editor-actions">
            <button class="btn primary" type="submit">작성</button>
            <button class="btn" type="button" @click="closeEditor">취소</button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="selected" class="modal" @click.self="selected=null">
      <div class="modal-card">
        <button class="close" @click="selected=null">✕</button>
        <h3>{{ selected.title }}</h3>
        <p class="muted">{{ selected.author }} · {{ formatDate(selected.createdAt) }}</p>
        <div class="content" v-html="selected.content"></div>
        <div style="margin-top:0.75rem">
          <strong>댓글</strong>
          <div class="comments" style="margin-top:0.5rem">
            <div v-if="!(selected.comments && selected.comments.length)" class="muted">댓글이 없습니다.</div>
            <div v-for="c in (selected.comments||[])" :key="c.id" style="padding:0.4rem 0;border-bottom:1px solid #f1f5f9">
              <div style="font-weight:600">{{ c.author }} <span class="muted" style="font-weight:400;font-size:0.85rem">· {{ formatDate(c.createdAt) }}</span></div>
              <div>{{ c.text }}</div>
            </div>
          </div>
          <div class="add-comment" style="margin-top:0.6rem;display:flex;gap:0.5rem;align-items:start">
            <input v-model="commentAuthor" placeholder="작성자(선택)" style="padding:0.45rem;border:1px solid #e6eef0;border-radius:6px" />
            <input v-model="commentText" placeholder="댓글을 입력하세요" style="flex:1;padding:0.45rem;border:1px solid #e6eef0;border-radius:6px" />
            <button class="btn primary" @click.stop="addComment(selected.id)">댓글</button>
          </div>
        </div>
        <div class="modal-actions" style="margin-top:0.75rem;display:flex;gap:0.5rem">
          <button class="btn" @click.stop="requestEdit(selected)">수정</button>
          <button class="btn danger" @click.stop="requestDelete(selected.id)">삭제</button>
        </div>
      </div>
    </div>
    <div v-if="pwDialog.open" class="modal" @click.self="closePwDialog">
      <div class="modal-card" style="max-width:420px;">
        <button class="close" @click="closePwDialog">✕</button>
        <h3>비밀번호 확인</h3>
        <p class="muted">{{ pwDialog.message }}</p>
        <div style="margin-top:0.6rem;display:flex;gap:0.5rem">
          <input v-model="pwInput" type="password" placeholder="비밀번호" style="flex:1;padding:0.6rem;border:1px solid #e6eef0;border-radius:6px" />
          <button class="btn primary" @click="confirmPwDialog">확인</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { loadPosts, savePosts, STORAGE_KEY } from '../composables/usePosts'

export default {
  name: 'Board',
  setup(){
    const posts = ref([])
    const selected = ref(null)
    const editingId = ref(null)
    const showEditor = ref(false)
    const form = ref({ title:'', author:'', content:'', password:'', tagsRaw:'' })
    const bookmarks = ref([])
    const searchQuery = ref('')
    const tagFilter = ref('')
    const page = ref(1)
    const perPage = 50

    const route = useRoute()
    onMounted(()=>{
      posts.value = loadPosts() || []
      // ensure numeric fields
      posts.value.forEach(p=>{ p.views = p.views || 0; p.likes = p.likes || 0; })
      try{ bookmarks.value = JSON.parse(localStorage.getItem('localhub-bookmarks')||'[]') }catch(e){ bookmarks.value=[] }
      // mark posts that are bookmarked so their UI can mirror `liked` behaviour
      posts.value.forEach(p=>{ p.bookmarked = bookmarks.value.includes(p.id) })
      // if navigated with ?postId=..., open that post
      try{
        const id = route.query.postId
        if(id){ const found = posts.value.find(x=>x.id===id.toString()); if(found) { openPostRow(found) } }
      }catch(e){}
    })

    function persist(){
      savePosts(posts.value)
      try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(posts.value)) }catch(e){/* ignore sync write errors */}
    }

    function resetForm(){ editingId.value=null; form.value={ title:'', author:'', content:'', password:'', tagsRaw:'' } }

    function openEditor(){ resetForm(); showEditor.value = true }
    function closeEditor(){ showEditor.value = false; resetForm(); editingId.value=null }

    const commentAuthor = ref('')
    const commentText = ref('')

    function onSubmit(){
      const tags = (form.value.tagsRaw||'').split(',').map(s=>s.trim()).filter(Boolean)
      if(editingId.value){
        const idx = posts.value.findIndex(x=>x.id===editingId.value)
        if(idx!==-1){
          const existing = posts.value[idx]
          const newPassword = (form.value.password && form.value.password.length) ? form.value.password : existing.password
          const updated = { ...existing, title:form.value.title, author:form.value.author, content:form.value.content, tags, updatedAt:Date.now(), password: newPassword }
          posts.value.splice(idx,1,updated)
        }
      } else {
        const newPost = { id:Date.now().toString(), title:form.value.title, author:form.value.author, content:form.value.content, createdAt:Date.now(), likes:0, liked:false, comments:[], password:form.value.password, tags, views:0 }
        posts.value.push(newPost)
      }
      persist(); closeEditor()
    }

    const filteredPosts = computed(()=>{
      const q = (searchQuery.value||'').toLowerCase().trim()
      return posts.value.filter(p=>{
        if(tagFilter.value){ if(!(p.tags||[]).includes(tagFilter.value)) return false }
        if(!q) return true
        return (p.title||'').toLowerCase().includes(q) || (p.content||'').toLowerCase().includes(q) || (p.tags||[]).some(t=>t.toLowerCase().includes(q))
      }).slice().sort((a,b)=>b.createdAt-a.createdAt)
    })

    const tagsList = computed(()=>{
      const s = new Set()
      posts.value.forEach(p=> (p.tags||[]).forEach(t=>s.add(t)))
      return Array.from(s)
    })

    const pagedPosts = computed(()=>{
      const all = filteredPosts.value
      const start = (page.value-1)*perPage
      return all.slice(start, start+perPage)
    })

    function formatDate(ts){ return new Date(ts).toLocaleDateString() }

    function openPostRow(p){
      // increment view count and open modal using canonical post object
      const idx = posts.value.findIndex(x=>x.id===p.id)
      if(idx!==-1){ posts.value[idx].views = (posts.value[idx].views||0)+1; persist(); selected.value = posts.value[idx] }
      else selected.value = p
    }

    function requestEdit(p){
      // open internal password dialog for edit
      pwDialog.value = { open: true, action: 'edit', postId: p.id, message: '수정용 비밀번호를 입력하세요' }
    }

    function requestDelete(id){
      // open internal password dialog for delete
      pwDialog.value = { open: true, action: 'delete', postId: id, message: '삭제용 비밀번호를 입력하세요' }
    }

    function toggleLike(p){ const idx=posts.value.findIndex(x=>x.id===p.id); if(idx===-1) return; const cur=posts.value[idx]; const up={...cur, liked:!cur.liked, likes: cur.liked?Math.max(0,cur.likes-1):(cur.likes||0)+1}; posts.value.splice(idx,1,up); persist(); if(selected.value && selected.value.id===p.id) selected.value=up }

    function addComment(postId){
      const idx = posts.value.findIndex(x=>x.id===postId)
      if(idx===-1) return
      const author = (commentAuthor.value||'익명').trim()
      const text = (commentText.value||'').trim()
      if(!text) return
      const c = { id: Date.now().toString(), author, text, createdAt: Date.now() }
      posts.value[idx].comments = posts.value[idx].comments || []
      posts.value[idx].comments.push(c)
      persist()
      commentAuthor.value = ''
      commentText.value = ''
      // refresh selected view
      if(selected.value && selected.value.id===postId) selected.value = posts.value[idx]
    }

    const pwDialog = ref({ open:false, action:'', postId:null, message:'' })
    const pwInput = ref('')

    function closePwDialog(){ pwDialog.value = { open:false, action:'', postId:null, message:'' }; pwInput.value = '' }

    function confirmPwDialog(){
      const id = pwDialog.value.postId
      const p = posts.value.find(x=>x.id===id)
      if(!p){ closePwDialog(); return }
      if((p.password||'') !== (pwInput.value||'')){ alert('비밀번호가 일치하지 않습니다.'); return }
      if(pwDialog.value.action === 'edit'){
        editingId.value = p.id
        form.value = { title: p.title, author: p.author, content: p.content, password: '', tagsRaw: (p.tags||[]).join(',') }
        showEditor.value = true
        // scroll to top and focus the inline editor input for better UX
        try{ window.scrollTo({ top: 0, behavior: 'smooth' }) }catch(e){}
        setTimeout(()=>{ try{ const el = document.querySelector('.editor-inline input'); if(el) el.focus() }catch(e){} }, 250)
      } else if(pwDialog.value.action === 'delete'){
        if(confirm('정말 삭제하시겠습니까?')){ posts.value = posts.value.filter(pp=>pp.id!==id); persist(); selected.value = null }
      }
      closePwDialog()
    }

    function isBookmarked(id){ return bookmarks.value.includes(id) }
    function toggleBookmark(p){
      const id = p.id
      if(isBookmarked(id)){
        bookmarks.value = bookmarks.value.filter(x=>x!==id)
      } else {
        bookmarks.value.push(id)
      }
      // persist
      localStorage.setItem('localhub-bookmarks', JSON.stringify(bookmarks.value))
      // update post object bookmarked flag for immediate UI parity with likes
      const idx = posts.value.findIndex(x=>x.id===id)
      if(idx!==-1){ posts.value[idx] = { ...posts.value[idx], bookmarked: bookmarks.value.includes(id) } }
    }

    function onSearch(){ page.value = 1 }

    return { posts, filteredPosts, pagedPosts, selected, form, editingId, showEditor, searchQuery, tagFilter, tagsList, page, onSubmit, resetForm, formatDate, openPostRow, requestEdit, requestDelete, toggleLike, toggleBookmark, isBookmarked, openEditor, closeEditor, onSearch, commentAuthor, commentText, addComment, pwDialog, pwInput, closePwDialog, confirmPwDialog }
  }
}
</script>

<style scoped>
.board-page{padding:1rem}
.board-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem}
.muted{color:#6b7280}
.card{background:#fff;padding:1rem;border-radius:10px;box-shadow:0 6px 18px rgba(2,6,23,0.04)}
.board-controls{display:flex;gap:1rem;margin-bottom:1rem;align-items:center}
.search-input{width:480px;padding:0.6rem 0.75rem;border:1px solid #e6eef0;border-radius:8px}
.filter-wrap select{padding:0.5rem;border-radius:8px;border:1px solid #e6eef0}
.btn{padding:0.5rem 0.9rem;border-radius:8px;border:none;cursor:pointer}
.btn.primary{background:#2b6ef6;color:#fff}
.post-list{padding:0}
  .table-header{display:grid;grid-template-columns:1fr 120px 80px 80px 80px 140px;padding:0.75rem 1rem;border-bottom:1px solid #eef2f7;font-weight:600;color:#374151}
.posts{list-style:none;padding:0;margin:0}
  .post-row{display:grid;grid-template-columns:1fr 120px 80px 80px 80px 140px;padding:0.9rem 1rem;border-bottom:1px solid #f1f5f9;cursor:pointer}
.post-row:hover{background:#fbfdff}
.post-title{font-weight:600}
.tags{margin-top:0.45rem}
.tag{display:inline-block;background:#f1f5f9;color:#374151;padding:0.18rem 0.45rem;border-radius:999px;margin-right:0.35rem;font-size:0.82rem}
.empty{padding:1rem;text-align:center;color:#6b7280}
.modal{position:fixed;inset:0;background:rgba(2,6,23,0.45);display:flex;align-items:center;justify-content:center;padding:1rem}
.modal-card{background:#fff;padding:1rem;border-radius:8px;max-width:720px;width:100%}
.editor-modal label{display:block;margin-bottom:0.7rem}
.editor-modal input,.editor-modal textarea{width:100%;padding:0.6rem;border:1px solid #e6eef0;border-radius:8px}
.editor-actions{display:flex;gap:0.5rem;margin-top:0.6rem}
.close{background:transparent;border:none;position:absolute;right:12px;top:12px;font-size:1.05rem}

.editor-inline{margin:0 0 1rem 0}
.editor-inline input,.editor-inline textarea{width:100%;padding:0.6rem;border:1px solid #e6eef0;border-radius:8px}

@media (max-width:900px){
  .search-input{width:100%}
  .table-header,.post-row{grid-template-columns:1fr 90px 60px 60px 60px 120px}
}

.btn.booked{background:rgba(37,99,235,0.08);color:#2563eb}
</style>
