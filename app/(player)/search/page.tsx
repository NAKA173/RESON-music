'use client'

import Link from 'next/link'

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center px-4">
      <div className="max-w-sm text-center space-y-4">
        <p className="text-4xl">🚧</p>
        <h1 className="font-display text-xl font-bold">文脈検索は準備中です</h1>
        <p className="text-sm text-[var(--faint)]">
          「夜に聴きたい曲」のような自然な言葉で楽曲を探せる機能を準備しています。
          それまでは楽曲名での検索をご利用ください。
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link href="/home" className="text-sm text-[var(--accent)] underline">
            ホームへ戻る
          </Link>
          <Link href="/explore" className="text-sm text-[var(--accent)] underline">
            探索モードを試す
          </Link>
        </div>
      </div>
    </div>
  )
}
