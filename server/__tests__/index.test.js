import { describe, it, expect } from 'vitest'
import { detectCategory, buildSmartReply } from '../index.js'

describe('detectCategory', () => {
  it('detects 관광지 from user input', () => {
    expect(detectCategory('부산 관광지 추천해줘')).toBe('관광지')
  })

  it('detects 숙박 from hotel keywords', () => {
    expect(detectCategory('부산 숙박시설 알려줘')).toBe('숙박')
  })

  it('detects 쇼핑 from shopping keywords', () => {
    expect(detectCategory('부산 쇼핑 가볼 곳')).toBe('쇼핑')
  })
})

describe('buildSmartReply', () => {
  it('returns a dynamic reply with POI data', () => {
    const reply = buildSmartReply([{ role: 'user', content: '부산 관광지 추천해줘' }])
    expect(reply).toContain('부산')
    expect(reply).toContain('관광지')
    expect(reply).toContain('•')
  })
})
