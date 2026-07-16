const path = require('path')
const dotenv = require('dotenv')
const fs = require('fs')

dotenv.config({ path: path.resolve(__dirname, '..', '.env') })
dotenv.config({ path: path.resolve(__dirname, '..', '.env.server') })

const express = require('express')
const fetch = require('node-fetch')
const bodyParser = require('body-parser')
const cors = require('cors')
const app = express()

const dataCache = {}

function loadCategoryData(category) {
  if (dataCache[category]) return dataCache[category]
  const fileMap = {
    '관광지': '부산_관광지.json',
    '레포츠': '부산_레포츠.json',
    '문화시설': '부산_문화시설.json',
    '쇼핑': '부산_쇼핑.json',
    '숙박': '부산_숙박.json',
    '여행코스': '부산_여행코스.json',
    '축제공연행사': '부산_축제공연행사.json'
  }

  const fileName = fileMap[category]
  if (!fileName) return null

  // Try multiple likely locations for data depending on deployment:
  const candidates = [
    path.resolve(__dirname, '..', 'docs', 'data', fileName),     // repo layout
    path.resolve(process.cwd(), 'docs', 'data', fileName),        // current working dir
    path.resolve(process.cwd(), 'public', 'data', fileName),      // Vite public folder (after build)
    path.resolve(__dirname, '..', 'dist', 'data', fileName)       // possible dist packaging
  ]

  for (const filePath of candidates) {
    try {
      if (!fs.existsSync(filePath)) continue
      const content = fs.readFileSync(filePath, 'utf-8')
      const data = JSON.parse(content)
      dataCache[category] = data
      console.log(`[data] loaded ${fileName} from ${filePath}`)
      return data
    } catch (e) {
      console.warn(`[data] failed to parse ${filePath}:`, e && e.message)
      continue
    }
  }

  console.warn('[data] failed to load any candidate for', category, fileName)
  return null
}

function detectCategory(text) {
  const normalized = String(text)
  const keywords = {
    '관광지': ['관광지', '관광', '볼거리', 'tourist', 'attraction'],
    '레포츠': ['레포츠', '스포츠', '활동', '체험', 'sports', 'activity'],
    '문화시설': ['문화', '박물관', '갤러리', '전시', 'culture', 'museum'],
    '쇼핑': ['쇼핑', '쇼핑몰', '마켓', '시장', '상점', 'shopping', 'mall'],
    '숙박': ['숙박', '호텔', '모텔', '펜션', '게스트하우스', 'hotel', 'accommodation'],
    '여행코스': ['여행코스', '코스', '여행 코스', 'tour', 'package'],
    '축제공연행사': ['축제', '공연', '행사', '뮤지컬', '콘서트', 'festival', 'event']
  }

  // Check longest keywords first to prioritize specific categories
  const sortedEntries = Object.entries(keywords).sort((a, b) => {
    const maxLenA = Math.max(...a[1].map(kw => kw.length))
    const maxLenB = Math.max(...b[1].map(kw => kw.length))
    return maxLenB - maxLenA
  })

  for (const [category, kws] of sortedEntries) {
    const match = kws.some(kw => normalized.includes(kw))
    if (match) return category
  }

  return null
}

function buildSmartReply(messages = []) {
  const userMessages = (messages || []).filter(m => m.role === 'user').map(m => m.content)
  const lastQuestion = userMessages[userMessages.length - 1] || ''
  const normalizedQuestion = String(lastQuestion).toLowerCase()
  console.log('[findPoiTimeReply] lastQuestion:', JSON.stringify(lastQuestion))
  console.log('[buildSmartReply] lastQuestion:', JSON.stringify(lastQuestion))

  // If user asks about opening hours or operating time, try to find the POI in data
  const timeKeywords = ['영업시간', '운영시간', '영업', '운영', '몇시', '몇 시', '시간']
  const asksForTime = timeKeywords.some(k => normalizedQuestion.includes(k))
  console.log('[buildSmartReply] asksForTime:', asksForTime, 'normalized:', normalizedQuestion.slice(0,200))

  // Delegate time/place lookups to the central helper that returns a single-match reply
  try {
    const local = findPoiTimeReply(messages)
    if (local) return local
  } catch (e) {
    console.warn('buildSmartReply findPoiTimeReply error', e && e.message)
  }

  const category = detectCategory(lastQuestion)
  if (!category) {
    return `죄송합니다. 해당 질문은 자동 추천 대상이 아닙니다. 관광지 추천을 원하시면 예: '부산 추천 관광지 3곳 알려줘'처럼 구체적으로 물어보세요.`
  }

  const data = loadCategoryData(category)

  if (!data || !data.items || data.items.length === 0) {
    return `죄송합니다. ${category} 정보를 불러올 수 없습니다. 다시 시도해 주세요.`
  }

  const items = data.items.slice(0, 5)
  const samples = items
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map(item => `• ${item.title}`)
    .join('\n')

  return `부산의 ${category} 중 추천 장소입니다:\n${samples}\n\n지도에서 더 많은 장소와 상세 정보를 확인할 수 있습니다.`
}

// Return POI detail reply for time-related questions, or null if not applicable
function findPoiTimeReply(messages = []) {
  const userMessages = (messages || []).filter(m => m.role === 'user').map(m => m.content)
  const lastQuestion = userMessages[userMessages.length - 1] || ''
  const normalizedQuestion = String(lastQuestion).toLowerCase()
  const timeKeywords = ['영업시간', '운영시간', '영업', '운영', '몇시', '몇 시', '시간']
  const asksForTime = timeKeywords.some(k => normalizedQuestion.includes(k))

  function normalizeText(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^\uAC00-\uD7A3a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  const qNorm = normalizeText(normalizedQuestion)
  const qTokens = qNorm.split(' ').filter(Boolean).filter(t => {
    if (/[\uAC00-\uD7A3]/.test(t)) return t.length >= 2
    return t.length >= 3
  })
  if (qTokens.length === 0) {
    if (asksForTime) return `어떤 장소의 운영시간을 알고 싶으신가요? 장소명을 포함해 주세요. 예: 'KT&G 상상마당 부산 영업시간 알려줘'`
    return null
  }

  const categories = ['관광지','레포츠','문화시설','쇼핑','숙박','여행코스','축제공연행사']
  const matches = []
    for (const cat of categories) {
    const data = loadCategoryData(cat)
    if (!data || !data.items) continue
    for (const item of data.items) {
      if (!item.title) continue
        const titleNorm = normalizeText(item.title)

        // score by token matches
        let matchCount = 0
        for (const tk of qTokens) {
          if (titleNorm.includes(tk) || tk.includes(titleNorm) || titleNorm.includes(tk.substring(0, Math.min(4, tk.length)))) matchCount++
        }

        if (matchCount > 0) {
          matches.push({ item, category: cat, score: matchCount })
          if (matches.length >= 6) break
        }
    }
    if (matches.length >= 3) break
  }

    if (matches.length === 0) {
      if (asksForTime) return `해당 장소 정보를 데이터에서 찾지 못했습니다. 장소명을 정확히 입력해 주세요 (예: 'KT&G 상상마당 부산 영업시간').`
      return null
    }

    // sort by score desc and prefer exact-ish matches
    matches.sort((a, b) => (b.score || 0) - (a.score || 0))

    const top = matches[0]

    // Decide whether to return details:
    // - if user explicitly asked about time (asksForTime)
    // - or top match has multiple token matches (score >= 2)
    // - or a non-generic token matched (token length >=3)
    const hasStrongMatch = asksForTime || (top.score || 0) >= 2 || qTokens.some(t => t.length >= 3 && top.item.title.toLowerCase().includes(t))
    if (!hasStrongMatch) {
      // avoid returning details for generic queries like '부산'
      return null
    }

  // Return only the top (best) matched POI to match user's requested place
  const chosen = matches[0]

  const it = chosen.item
  const lines = []
  lines.push(`• ${it.title}`)
  if (it.addr1) lines.push(`  - 주소: ${it.addr1}`)
  if (it.tel) lines.push(`  - 전화: ${it.tel}`)
  if (it.playtime) lines.push(`  - 운영시간: ${it.playtime}`)
  else if (it.usetimefestival) lines.push(`  - 운영시간: ${it.usetimefestival}`)
  else lines.push(`  - 운영시간 정보가 없습니다.`)
  if (it.mapy && it.mapx) lines.push(`  - 지도: /map?lat=${it.mapy}&lng=${it.mapx}`)

  return `찾은 장소 정보입니다:\n${lines.join('\n')}\n\n정확한 영업시간이 필요하면 해당 기관에 직접 문의하시거나 공식 웹사이트를 확인해주세요.`
}

function resolveModelName(modelName) {
  const raw = String(modelName || process.env.OPENAI_MODEL || 'gpt-4o-mini').trim()
  if (!raw) return 'gpt-4o-mini'
  const normalized = raw.toLowerCase().replace(/[_\s]+/g, '-')
  const aliases = {
    'gpt-5-mini': 'gpt-4o-mini',
    'gpt5-mini': 'gpt-4o-mini',
    'gpt-4o-mini': 'gpt-4o-mini',
    'gpt-4.1-mini': 'gpt-4o-mini',
    'gpt-3.5-turbo': 'gpt-3.5-turbo'
  }
  return aliases[normalized] || normalized
}

app.use(bodyParser.json({ limit: '50mb' }))
app.use(bodyParser.text({ limit: '50mb' }))
app.use(cors())

app.post('/api/chat', async (req, res) => {
  const key = process.env.OPENAI_API_KEY || process.env.GPT_API_KEY
  if (!key) {
    return res.status(500).json({ error: 'Server OpenAI key not configured (OPENAI_API_KEY or GPT_API_KEY)' })
  }

  // If this is a time-related POI query, return local data immediately
  try {
    const localReply = findPoiTimeReply(req.body.messages || [])
    if (localReply) {
      console.log('[api] returning localReply:', String(localReply).slice(0,200))
      return res.status(200).json({ choices: [{ message: { role: 'assistant', content: localReply } }], fallback: false })
    }
  } catch (e) {
    console.warn('findPoiTimeReply error', e && e.message)
  }

  try {
    const preferredModels = [resolveModelName(req.body.model), 'gpt-4o-mini']
    const uniqueModels = preferredModels.filter((value, index, arr) => arr.indexOf(value) === index)

    let lastPayload = null
    for (const model of uniqueModels) {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: req.body.messages || [],
          max_tokens: 600
        })
      })

      const j = await resp.json().catch(() => null)
      lastPayload = j
      if (resp.ok) {
        return res.json(j)
      }

      const errorMessage = j && (j.error && (j.error.message || j.error.code)) ? `${j.error.message || j.error.code}` : String(j)
      const isUnsupportedModel = /model|not found|access/i.test(errorMessage)
      if (!isUnsupportedModel || model === 'gpt-4o-mini') {
        const smartReply = buildSmartReply(req.body.messages || [])
        return res.status(200).json({
          choices: [{ message: { role: 'assistant', content: smartReply } }],
          fallback: true,
          warning: errorMessage,
          error: j && j.error ? j.error : { message: errorMessage }
        })
      }
    }

    return res.status(500).json({ error: lastPayload && lastPayload.error ? lastPayload.error : 'OpenAI request failed' })
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) })
  }
})

// lightweight POI lookup endpoint used by client as a fallback
app.post('/api/poi-lookup', (req, res) => {
  console.log('[api/poi-lookup] received messages:', JSON.stringify(req.body && req.body.messages && req.body.messages.slice(-3)))
  try {
    const reply = findPoiTimeReply(req.body.messages || [])
    if (reply) return res.json({ found: true, content: reply })
    return res.json({ found: false })
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) })
  }
})

function startServer(port = Number(process.env.PORT || process.env.OPENAI_PROXY_PORT || 3001)) {
  const tryListen = (currentPort) => {
    const server = app.listen(currentPort, () => {
      console.log('LocalHub proxy server listening on', currentPort)
    })

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        const fallbackPort = currentPort + 1
        console.warn(`Port ${currentPort} is busy, retrying on ${fallbackPort}`)
        server.close()
        tryListen(fallbackPort)
      } else {
        console.error(err)
        process.exit(1)
      }
    })
  }

  tryListen(port)
}

if (require.main === module) {
  startServer()
}

module.exports = { app, detectCategory, buildSmartReply, loadCategoryData, startServer }
