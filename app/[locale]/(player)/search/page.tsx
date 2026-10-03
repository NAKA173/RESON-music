'use client'

import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

export default function SearchPage() {
  const tr = useTranslations('Search')

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center px-4">
      <div className="max-w-sm text-center space-y-4">
        <p className="text-4xl">🚧</p>
        <h1 className="font-display text-xl font-bold">{tr('title')}</h1>
        <p className="text-sm text-[var(--faint)]">{tr('description')}</p>
        <div className="flex justify-center gap-3 pt-2">
          <Link href="/home" className="text-sm text-[var(--accent)] underline">
            {tr('backHome')}
          </Link>
          <Link href="/explore" className="text-sm text-[var(--accent)] underline">
            {tr('tryExplore')}
          </Link>
        </div>
      </div>
    </div>
  )
}
