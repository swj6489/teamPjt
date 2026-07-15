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

  try {
    const filePath = path.resolve(__dirname, '..', 'docs', 'data', fileName)
    const content = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(content)
    dataCache[category] = data
    return data
  } catch (e) {
    console.log('[data] failed to load', category, e.message)
    return null
  }
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

  return '관광지'
}

function buildSmartReply(messages = []) {
  const userMessages = (messages || []).filter(m => m.role === 'user').map(m => m.content)
  const lastQuestion = userMessages[userMessages.length - 1] || ''

  const category = detectCategory(lastQuestion)
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
