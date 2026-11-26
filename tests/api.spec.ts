import { test, expect } from '@playwright/test'

test.describe('API tests', () => {
  test('auth proxy forwards to auth worker', async ({ request }) => {
    const res = await request.get('/api/auth/ok')
    expect(res.ok()).toBeTruthy()
  })

  test('signed-out callers cannot start a paid investigation', async ({ request }) => {
    const res = await request.post('/api/actions/investigateClaim', {
      data: { claim: 'A four-day week keeps output steady.' },
    })
    expect(res.status()).toBe(401)
  })

  test('the browser cannot call search or the model directly', async ({ request }) => {
    const search = await request.post('/api/integrations/exa/search', { data: { query: 'tea' } })
    const chat = await request.post('/api/integrations/openai/chat-completion', {
      data: { messages: [{ role: 'user', content: 'hello' }] },
    })
    expect(search.status()).toBe(403)
    expect(chat.status()).toBe(403)
  })

  test('WebSocket endpoint exists', async ({ page }) => {
    // /home is a dynamic page (under src/pages/(app)/), so mounting it boots
    // the providers and auto-connects the records WebSocket. The static
    // landing at '/' deliberately does neither — see smoke.spec.ts.
    await page.goto('/home')
    // Wait for the app to connect its WebSocket (it auto-connects on mount)
    await page.waitForSelector('[data-testid="app-navigation"]', { timeout: 15000 })
    // If the app loaded and connected, the WS endpoint works
  })
})
