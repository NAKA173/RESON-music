import React from 'react'
import ProfilePage from '../../app/(player)/profile/page'

const meta = {
  title: 'Pages/Account/Profile',
  component: ProfilePage,
  parameters: {
    nextjs: { navigation: { pathname: '/profile' } },
    mockApi: {
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
    },
  },
}

export default meta

export const Populated = {}
