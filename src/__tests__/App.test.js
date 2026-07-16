import { render } from '@testing-library/vue'
import { describe, it, expect } from 'vitest'
import App from '../App.vue'

describe('App', () => {
  it('renders Hello LocalHub', () => {
    const { getByText } = render(App)
    getByText('Hello LocalHub')
    getByText('Vue Hello World')
  })
})
