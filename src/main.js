import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/global.css'
// set background image via JS import so Vite resolves the asset path reliably
try{
	const setBg = (el)=>{
		if(!el) return
		el.style.backgroundImage = `url(/docs/data/image.png)`
		el.style.backgroundRepeat = 'no-repeat'
		el.style.backgroundSize = 'cover'
		el.style.backgroundPosition = 'center top'
		el.style.backgroundAttachment = 'fixed'
	}
	setBg(document.body)
	setBg(document.getElementById('app'))
}catch(e){}

const app = createApp(App)
app.use(router)
app.mount('#app')
