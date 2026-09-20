import React from 'react'
import MessagesPage from '../../app/(player)/messages/page'

const conversations = [
  {
    user_id: 'partner-1',
    display_name: 'Storybook Listener',
    last_body: 'この曲どう？',
    last_at: '2026-09-21T00:00:00.000Z',
    unread: true,
  },
]

const meta = {
  title: 'Pages/Social/Messages',
  component: MessagesPage,
  parameters: {
    nextjs: { navigation: { pathname: '/messages' } },
  },
}

export default meta

export const ConversationList = {
  parameters: {
    mockApi: {
      'GET /api/messages/conversations': { body: { conversations } },
    },
  },
}

export const OpenThread = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/messages',
        query: { with: 'partner-1' },
      },
    },
    mockApi: {
      'GET /api/messages/conversations': { body: { conversations } },
      'GET /api/messages': {
        body: {
          messages: [
            {
              id: 'msg-1',
              sender_id: 'partner-1',
              recipient_id: 'me-storybook',
              body: 'この曲どう？',
              track_id: null,
              created_at: '2026-09-21T00:00:00.000Z',
              tracks: null,
            },
            {
              id: 'msg-2',
              sender_id: 'me-storybook',
              recipient_id: 'partner-1',
              body: 'かなり好きです。',
              track_id: 'track-share',
              created_at: '2026-09-21T00:01:00.000Z',
              tracks: {
                id: 'track-share',
                title: 'Shared Track',
                artists: { id: 'artist-share', name: 'Shared Artist' },
              },
            },
          ],
        },
      },
    },
  },
}
