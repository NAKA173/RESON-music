import React from 'react'
import { expect, userEvent, within } from 'storybook/test'
import ProfilePage from '../../app/(player)/profile/page'

const profileMocks = {
  'GET /api/profile': {
    body: {
      profile: {
        display_name: 'Storybook Listener',
        bio: 'インディー音楽を探すのが好きです。',
        persona_tags: ['夜更かし', 'ギターロック'],
      },
    },
  },
  'GET /api/profile/suggested-tags': {
    body: { suggested_tags: ['シティポップ', 'ライブ好き'] },
  },
  'GET /api/best-tracks': {
    body: {
      best_tracks: [
        {
          rank: 1,
          track_id: 'best-track-1',
          tracks: {
            id: 'best-track-1',
            title: 'Best Storybook Track',
            artists: { id: 'best-artist-1', name: 'Best Artist' },
          },
        },
      ],
    },
  },
  'PATCH /api/profile': { body: { ok: true } },
  'PUT /api/best-tracks': { body: { ok: true } },
}

const meta = {
  title: 'Pages/Account/Profile',
  component: ProfilePage,
  parameters: {
    nextjs: { navigation: { pathname: '/profile' } },
    mockApi: profileMocks,
  },
}

export default meta

export const Populated = {}

export const SaveSuccess = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const displayName = await canvas.findByLabelText('表示名')
    await userEvent.clear(displayName)
    await userEvent.type(displayName, 'Updated Listener')
    await userEvent.click(canvas.getByRole('button', { name: '保存する' }))
    await expect(canvas.getByText('保存しました')).toBeVisible()
  },
}

export const SaveFailure = {
  parameters: {
    mockApi: {
      ...profileMocks,
      'PATCH /api/profile': {
        status: 500,
        body: { error: 'プロフィールを保存できませんでした' },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: '保存する' }))
    await expect(canvas.getByText('プロフィールを保存できませんでした')).toBeVisible()
  },
}

export const Mobile = {
  globals: {
    viewport: { value: 'mobile2', isRotated: false },
  },
}
