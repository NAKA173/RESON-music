import React from 'react'
import { expect, userEvent, within } from 'storybook/test'
import { SupportButton } from '../../components/SupportButton'

const meta = {
  title: 'Music/SupportButton',
  component: SupportButton,
  args: {
    trackId: 'storybook-track',
  },
  parameters: {
    mockApi: {
      'POST /api/supports': {
        body: { ok: true, type: 'heart' },
      },
    },
  },
}

export default meta

export const Default = {}

export const TipDialog = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /投げ銭/ }))
    await expect(canvas.getByText('投げ銭する')).toBeVisible()
    await expect(canvas.getByRole('button', { name: '¥100 を送る' })).toBeVisible()
  },
}

export const ApiError = {
  parameters: {
    mockApi: {
      'POST /api/supports': {
        status: 500,
        body: { error: '応援の記録に失敗しました' },
      },
    },
  },
}
