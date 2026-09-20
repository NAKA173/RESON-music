import React from 'react'
import SettingsPage from '../../app/(player)/settings/page'

const settings = {
  is_private: false,
  profile_public: true,
  feed_enabled: true,
  follow_enabled: true,
  matching_enabled: true,
  comment_enabled: true,
  community_enabled: true,
  collection_public: true,
  follow_request_from: '全員',
  dm_from: 'フォロワーのみ',
  comment_notif_from: '全員',
  like_notif: true,
  matching_suggestion: true,
  artist_news: '重要のみ',
  support_history_public: true,
  exclusive_content: true,
  backer_community: true,
  score_public: true,
  listening_data_use: false,
}

const meta = {
  title: 'Pages/Account/Settings',
  component: SettingsPage,
  parameters: {
    nextjs: { navigation: { pathname: '/settings' } },
    mockApi: {
      'GET /api/settings': { body: { settings } },
      'PATCH /api/settings': { body: { ok: true } },
    },
  },
}

export default meta

export const Default = {}
