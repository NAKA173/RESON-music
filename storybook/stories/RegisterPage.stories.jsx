import React from 'react'
import RegisterPage from '../../app/(auth)/register/page'

const meta = {
  title: 'Pages/Auth/Register',
  component: RegisterPage,
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/register',
      },
    },
    mockApi: {
      'POST /api/auth/register': {
        body: { needs_email_confirmation: false },
      },
    },
  },
}

export default meta

export const AccountStep = {}

export const ReferralEntry = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/register',
        query: { ref: 'storybook-referral' },
      },
    },
  },
}
