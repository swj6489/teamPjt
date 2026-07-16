<template>
  <div class="time-now">{{ nowDisplay }}</div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'
export default {
  name: 'TimeNow',
  setup(){
    const now = ref(new Date())
    const nowDisplay = ref('')
    function updateNow(){ now.value = new Date(); nowDisplay.value = now.value.toLocaleString() }
    let t = null
    onMounted(()=>{ updateNow(); t = setInterval(updateNow, 1000) })
    onUnmounted(()=>{ if(t) clearInterval(t) })
    return { nowDisplay }
  }
}
</script>

<style scoped>
.time-now{margin-right:0.6rem;color:var(--muted);font-weight:600}
</style>