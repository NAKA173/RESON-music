import React from 'react'
import PrivacyRequestsPage from '../../app/(player)/privacy-requests/page'

const meta = {
  title: 'Pages/Account/PrivacyRequests',
  component: PrivacyRequestsPage,
  parameters: {
    nextjs: { navigation: { pathname: '/privacy-requests' } },
  },
}

export default meta

export const EmptyHistory = {
  parameters: { mockApi: { 'GET /api/privacy/requests': { body: { requests: [] } } } },
}

export const WithHistory = {
  parameters: {
    mockApi: {
      'GET /api/privacy/requests': {
        body: { requests: [
          { id: 'pr-1', request_type: 'access', details: '自分の再生履歴を確認したい', status: 'completed', response: 'データを準備しました。', created_at: '2026-08-20T00:00:00.000Z', responded_at: '2026-08-25T00:00:00.000Z' },
          { id: 'pr-2', request_type: 'rectification', details: 'プロフィール情報の訂正', status: 'in_progress', response: null, created_at: '2026-09-15T00:00:00.000Z', responded_at: null },
        ] },
      },
      'POST /api/privacy/requests': { body: { request: { id: 'pr-new', request_type: 'access', details: '', status: 'received', response: null, created_at: '2026-09-21T00:00:00.000Z', responded_at: null } } },
    },
  },
}
