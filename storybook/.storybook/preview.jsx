import React from 'react'
import '../../app/globals.css'

const originalFetch = globalThis.fetch?.bind(globalThis)

function toMockResponse(value) {
  const status = value?.status ?? 200
  const body = value?.body ?? value ?? {}
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const decorators = [
  (Story, context) => {
    const mockApi = context.parameters.mockApi ?? {}

    globalThis.fetch = async (input, init = {}) => {
      const rawUrl = typeof input === 'string' ? input : input.url
      const url = new URL(rawUrl, globalThis.location?.origin ?? 'http://localhost')
      const method = (init.method ?? (typeof input === 'string' ? 'GET' : input.method) ?? 'GET').toUpperCase()
      const key = `${method} ${url.pathname}`
      const mock = mockApi[key] ?? mockApi[url.pathname]

      if (mock) {
        const value = typeof mock === 'function'
          ? await mock({ input, init, url, method })
          : mock
        return toMockResponse(value)
      }

      if (originalFetch) return originalFetch(input, init)
      return toMockResponse({ status: 404, body: { error: 'No Storybook mock configured' } })
    }

    return (
      <div className="min-h-screen bg-[var(--bg)] p-8 text-[var(--text)]">
        <Story />
      </div>
    )
  },
]

export const parameters = {
  layout: 'fullscreen',
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/i,
    },
  },
  a11y: {
    test: 'error',
  },
  nextjs: {
    appDirectory: true,
  },
}
