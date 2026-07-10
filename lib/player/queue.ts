import { useCallback, useMemo, useRef, useState } from 'react'

export type RepeatMode = 'off' | 'all' | 'one'

interface Track {
  id: string
}

function shuffleIndices(length: number): number[] {
  const arr = Array.from({ length }, (_, i) => i)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * 曲リスト（アルバム・プレイリスト・ホームの一覧など）に対する
 * シャッフル・リピート・キュー（次に再生）の再生順管理。
 * 曲リスト自体はページ側が持ち、このフックは「今どれを再生するか」だけを管理する。
 */
export function usePlayerQueue<T extends Track>(baseTracks: T[]) {
  const [baseIndex, setBaseIndex] = useState(0)
  const [shuffleOn, setShuffleOn] = useState(false)
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off')
  const [queue, setQueue] = useState<T[]>([])
  const shuffleOrderRef = useRef<number[]>([])

  if (shuffleOn && shuffleOrderRef.current.length !== baseTracks.length) {
    shuffleOrderRef.current = shuffleIndices(baseTracks.length)
  }

  const orderPos = useMemo(() => {
    if (!shuffleOn) return baseIndex
    const pos = shuffleOrderRef.current.indexOf(baseIndex)
    return pos < 0 ? 0 : pos
  }, [shuffleOn, baseIndex])

  const current: T | null = queue[0] ?? baseTracks[baseIndex] ?? null

  function toggleShuffle() {
    if (!shuffleOn) shuffleOrderRef.current = shuffleIndices(baseTracks.length)
    setShuffleOn((v) => !v)
  }

  function cycleRepeat() {
    setRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'))
  }

  function addToQueue(track: T) {
    setQueue((q) => [...q, track])
  }

  function removeFromQueue(index: number) {
    setQueue((q) => q.filter((_, i) => i !== index))
  }

  const playAt = useCallback((index: number) => {
    setQueue([])
    setBaseIndex(index)
  }, [])

  function playNext() {
    // キューに次の曲があれば先に消費する
    if (queue.length > 0) {
      setQueue((q) => q.slice(1))
      return
    }
    if (repeatMode === 'one') return // onEndedから呼ばれた場合は同じ曲を再生し直す（呼び出し側でseek(0)）

    if (!shuffleOn) {
      const next = baseIndex + 1
      if (next < baseTracks.length) {
        setBaseIndex(next)
      } else if (repeatMode === 'all') {
        setBaseIndex(0)
      }
      return
    }
    const nextPos = orderPos + 1
    if (nextPos < shuffleOrderRef.current.length) {
      setBaseIndex(shuffleOrderRef.current[nextPos])
    } else if (repeatMode === 'all') {
      shuffleOrderRef.current = shuffleIndices(baseTracks.length)
      setBaseIndex(shuffleOrderRef.current[0])
    }
  }

  function playPrev() {
    if (!shuffleOn) {
      setBaseIndex((i) => Math.max(i - 1, 0))
      return
    }
    const prevPos = Math.max(orderPos - 1, 0)
    setBaseIndex(shuffleOrderRef.current[prevPos])
  }

  const hasNext =
    queue.length > 0 ||
    repeatMode !== 'off' ||
    (!shuffleOn && baseIndex + 1 < baseTracks.length) ||
    (shuffleOn && orderPos + 1 < shuffleOrderRef.current.length)

  return {
    current,
    baseIndex,
    playAt,
    playNext,
    playPrev,
    hasNext,
    shuffleOn,
    toggleShuffle,
    repeatMode,
    cycleRepeat,
    queue,
    addToQueue,
    removeFromQueue,
  }
}
