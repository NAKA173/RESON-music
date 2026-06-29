'use client'

import { useEffect, useRef, useState } from 'react'

interface Track {
  id: string
  title: string
  duration_sec: number
  artists: { name: string } | null
}

interface PlayerProps {
  track: Track
  onEnded?: () => void
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function Player({ track, onEnded }: PlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(track.duration_sec)
  const startedAtRef = useRef<number | null>(null)
  const logSentRef = useRef(false)

  useEffect(() => {
    // track が変わったらリセット
    setPlaying(false)
    setCurrentTime(0)
    logSentRef.current = false
    startedAtRef.current = null
    if (audioRef.current) {
      audioRef.current.src = `/api/tracks/${track.id}/stream`
      audioRef.current.load()
    }
  }, [track.id])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
    } else {
      if (startedAtRef.current === null) startedAtRef.current = Date.now()
      audio.play()
    }
    setPlaying(!playing)
  }

  function onTimeUpdate() {
    const audio = audioRef.current
    if (!audio) return
    setCurrentTime(audio.currentTime)
    if (audio.duration && !isNaN(audio.duration)) setDuration(audio.duration)
  }

  async function sendPlayLog(playedSec: number, completed: boolean) {
    if (logSentRef.current) return
    logSentRef.current = true
    await fetch(`/api/tracks/${track.id}/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ played_sec: Math.floor(playedSec), completed }),
    })
  }

  function onEnded_() {
    setPlaying(false)
    const played = audioRef.current?.currentTime ?? duration
    sendPlayLog(played, true)
    onEnded?.()
  }

  // ページ離脱・一時停止時にも再生ログを送信
  useEffect(() => {
    function handleUnload() {
      const audio = audioRef.current
      if (!audio || logSentRef.current) return
      sendPlayLog(audio.currentTime, false)
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [track.id])

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current
    if (!audio) return
    const t = Number(e.target.value)
    audio.currentTime = t
    setCurrentTime(t)
  }

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
      <audio
        ref={audioRef}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded_}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        preload="metadata"
      />

      {/* トラック情報 */}
      <div>
        <p className="font-semibold truncate">{track.title}</p>
        <p className="text-sm text-zinc-400">{track.artists?.name ?? '不明なアーティスト'}</p>
      </div>

      {/* シークバー */}
      <div className="space-y-1">
        <input
          type="range"
          min={0}
          max={duration}
          value={currentTime}
          onChange={seek}
          className="w-full accent-white h-1"
        />
        <div className="flex justify-between text-xs text-zinc-500">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* コントロール */}
      <div className="flex items-center justify-center">
        <button
          onClick={togglePlay}
          className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:bg-zinc-200 transition text-lg"
          aria-label={playing ? '一時停止' : '再生'}
        >
          {playing ? '⏸' : '▶'}
        </button>
      </div>

      {/* プログレス表示 */}
      <div className="w-full bg-zinc-800 rounded-full h-0.5">
        <div className="bg-white h-0.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
