'use client'

import { useEffect, useState } from 'react'

const THEME_STORAGE_KEY = 'reson_theme'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    setTheme(stored === 'light' ? 'light' : 'dark')
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem(THEME_STORAGE_KEY, next)
  }

  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
      className="rounded-full border border-[var(--line)] p-2 text-sm text-[var(--dim)] hover:text-[var(--text)] hover:border-[var(--line-md)] transition"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
