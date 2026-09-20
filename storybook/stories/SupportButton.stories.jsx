import React from 'react'
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
