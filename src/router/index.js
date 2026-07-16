import { createRouter, createWebHistory } from 'vue-router'
const Home = () => import('../pages/Home.vue')
const Board = () => import('../pages/Board.vue')
const MapPage = () => import('../pages/Map.vue')
const Dashboard = () => import('../pages/Dashboard.vue')
const Calendar = () => import('../pages/Calendar.vue')
const Bookmarks = () => import('../pages/Bookmarks.vue')
const CustomGuide = () => import('../pages/CustomGuide.vue')

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/board', name: 'Board', component: Board },
  { path: '/map', name: 'Map', component: MapPage },
  { path: '/dashboard', name: 'Dashboard', component: Dashboard },
  { path: '/calendar', name: 'Calendar', component: Calendar },
  { path: '/bookmarks', name: 'Bookmarks', component: Bookmarks }
  ,{ path: '/guide', name: 'Guide', component: CustomGuide }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
