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
    await expect(canvas.getByLabelText('学校発行のメールアドレス')).toBeVisible()
  },
}

export const StudentVerificationError = {
  parameters: {
    mockApi: {
      ...checkoutMocks,
      'POST /api/student/verify/request': {
        status: 400,
        body: { error: '.ed.jp の学校メールを入力してください' },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Student に登録' }))
    await userEvent.type(canvas.getByLabelText('学校発行のメールアドレス'), 'student@example.com')
    await userEvent.click(canvas.getByRole('button', { name: '認証コードを送信' }))
    await expect(canvas.getByText('.ed.jp の学校メールを入力してください')).toBeVisible()
  },
}

export const MobileStudentVerification = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Student に登録' }))
    await expect(canvas.getByText('Studentプラン認証')).toBeVisible()
  },
}
