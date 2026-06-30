'use client'

import { useEffect, useState } from 'react'

interface Supporter {
  user_id: string
  display_name: string | null
}

export function SupportGraph({ trackId }: { trackId: string }) {
  const [supporters, setSupporters] = useState<Supporter[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
    fetch(`/api/tracks/${trackId}/support-graph`)
      .then((r) => (r.ok ? r.json() : { supporters: [], total_support_count: 0 }))
      .then((d) => {
        setSupporters(d.supporters ?? [])
        setTotalCount(d.total_support_count ?? 0)
        setLoaded(true)
      })
  }, [trackId])

  if (!loaded || (supporters.length === 0 && totalCount === 0)) return null

  return (
    <div className="text-center text-xs text-zinc-500">
      {supporters.length > 0 ? (
        <p>
          フォロー中の
          <span className="text-zinc-300">
            {supporters.slice(0, 3).map((s) => s.display_name ?? '名無しのリスナー').join('、')}
          </span>
          {supporters.length > 3 && ` ほか${supporters.length - 3}人`}
          が応援しています
        </p>
      ) : (
        <p>{totalCount}人が応援しています</p>
      )}
    </div>
  )
}
