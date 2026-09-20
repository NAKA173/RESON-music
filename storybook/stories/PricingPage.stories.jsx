import React from 'react'
import { expect, userEvent, within } from 'storybook/test'
import PricingPage from '../../app/(player)/pricing/page'

const checkoutMocks = {
  'POST /api/stripe/checkout': {
    body: { url: '/pricing?success=1' },
  },
  'POST /api/stripe/portal': {
    body: { url: '/pricing' },
  },
  'POST /api/student/verify/request': {
    body: { ok: true },
  },
  'POST /api/student/verify/confirm': {
    body: { ok: true },
  },
}

const meta = {
  title: 'Pages/Listener/Pricing',
  component: PricingPage,
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/pricing',
      },
    },
    mockApi: checkoutMocks,
  },
}

export default meta

export const Default = {}

export const SubscriptionSuccess = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/pricing',
        query: { success: '1' },
      },
    },
  },
}

export const StudentVerification = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Student に登録' }))
    await expect(canvas.getByText('Studentプラン認証')).toBeVisible()
    await expect(canvas.getByPlaceholderText('example@school.ed.jp')).toBeVisible()
  },
}
