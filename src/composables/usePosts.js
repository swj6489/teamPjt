export const STORAGE_KEY = 'localhub-posts'

export function loadPosts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    console.error('loadPosts error', e)
    return []
  }
}

let _saveTimeout = null
const DEBOUNCE_MS = 150

export function savePosts(posts) {
  // Debounce and perform async save to avoid blocking the UI thread
  if (_saveTimeout) clearTimeout(_saveTimeout)
  _saveTimeout = setTimeout(() => {
    try {
      // Use a try/catch to avoid uncaught exceptions from localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
    } catch (e) {
      console.error('savePosts error', e)
    }
    _saveTimeout = null
  }, DEBOUNCE_MS)
}

