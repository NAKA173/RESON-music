import React from 'react'
import UploadPage from '../../app/(artist)/upload/page'

const meta = {
  title: 'Pages/Artist/Upload',
  component: UploadPage,
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/upload',
      },
    },
  },
}

export default meta

export const Empty = {
  parameters: {
    mockApi: {
      'GET /api/genres': { body: { genres: [] } },
      'GET /api/albums': { body: { albums: [] } },
    },
  },
}

export const WithGenresAndAlbums = {
  parameters: {
    mockApi: {
      'GET /api/genres': {
        body: {
          genres: [
            { id: 'pop', name: 'Pop', parent_id: null },
            { id: 'rock', name: 'Rock', parent_id: null },
            { id: 'alt-rock', name: 'Alternative Rock', parent_id: 'rock' },
          ],
        },
      },
      'GET /api/albums': {
        body: {
          albums: [
            {
              id: 'album-1',
              title: 'Storybook Album',
              release_type: 'album',
              cover_r2_key: null,
            },
          ],
        },
      },
    },
  },
}
