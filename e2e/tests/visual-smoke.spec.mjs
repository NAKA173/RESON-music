import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const targets = [
  {
    name: 'home',
    path: '/home',
    ready: (page) => page.getByPlaceholder('アーティスト・楽曲・気分で探す'),
  },
  {
    name: 'profile',
    path: '/profile',
    ready: (page) => page.getByRole('heading', { name: '音楽人格・プロフィール' }),
  },
  {
    name: 'pricing',
    path: '/pricing',
    ready: (page) => page.getByRole('heading', { name: '料金プラン' }),
  },
  {
    name: 'privacy-requests',
    path: '/privacy-requests',
    ready: (page) => page.getByRole('heading', { name: '個人データに関する請求' }),
  },
  {
    name: 'messages',
    path: '/messages',
    ready: (page) => page.getByRole('heading', { name: 'メッセージ' }),
  },
  {
    name: 'upload',
    path: '/upload',
    ready: (page) => page.getByRole('heading', { name: '楽曲をアップロード' }),
  },
]

test.describe('mobile visual smoke', () => {
  for (const target of targets) {
    test(`${target.name} has no horizontal overflow and emits a reference screenshot`, async ({ page }) => {
      await page.goto(target.path)
      await expect(target.ready(page)).toBeVisible()

      const layout = await page.evaluate(() => {
        const clientWidth = document.documentElement.clientWidth
        const offenders = Array.from(document.querySelectorAll('*'))
          .map((element) => {
            const rect = element.getBoundingClientRect()
            return {
              tag: element.tagName.toLowerCase(),
              className: typeof element.className === 'string' ? element.className : '',
              text: (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 80),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            }
          })
          .filter((item) => item.right > clientWidth + 1 || item.left < -1)
          .sort((a, b) => b.right - a.right)
          .slice(0, 12)

        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth,
          offenders,
        }
      })

      if (layout.scrollWidth > layout.clientWidth) {
        console.log('Horizontal overflow diagnostics:', JSON.stringify(layout, null, 2))
      }

      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth)

      await mkdir('visual-artifacts', { recursive: true })
      await page.screenshot({
        path: `visual-artifacts/${target.name}-mobile.png`,
        fullPage: true,
        animations: 'disabled',
      })
    })
  }
})
