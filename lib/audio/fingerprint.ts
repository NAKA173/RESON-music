/**
 * AcoustID フィンガープリント照合ロジック
 *
 * クライアント側で fpcalc (Chromaprint) を実行してフィンガープリントと
 * duration を取得し、このモジュールに渡す。
 * サーバー側では AcoustID Web API でルックアップし、重複を検知する。
 *
 * 利用規約: https://acoustid.org/webservice
 * 商用利用: AcoustID は MIT ライセンスで商用利用可（要APIキー登録）
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const ACOUSTID_API = 'https://api.acoustid.org/v2/lookup'

export interface FingerprintLookupResult {
  matched: boolean
  acoustid?: string
  score?: number
  mbTitle?: string
  mbArtist?: string
}

export async function lookupFingerprint(
  fingerprint: string,
  durationSec: number
): Promise<FingerprintLookupResult> {
  const apiKey = process.env.ACOUSTID_API_KEY
  if (!apiKey) {
    // APIキー未設定時はスキップ（開発環境互換）
    return { matched: false }
  }

  const params = new URLSearchParams({
    client: apiKey,
    duration: String(Math.round(durationSec)),
    fingerprint,
    meta: 'recordings',
  })

  let res: Response
  try {
    res = await fetch(`${ACOUSTID_API}?${params}`, {
      headers: { 'User-Agent': 'RESON/1.0' },
    })
  } catch {
    return { matched: false }
  }

  if (!res.ok) return { matched: false }

  const data = await res.json()
  const results: Array<{
    id: string
    score: number
    recordings?: Array<{ id: string; title?: string; artists?: Array<{ name: string }> }>
  }> = data.results ?? []

  if (results.length === 0) return { matched: false }

  const best = results.reduce((a, b) => (a.score > b.score ? a : b))

  // スコア 0.8 以上を「一致」とみなす
  if (best.score < 0.8) return { matched: false }

  const rec = best.recordings?.[0]
  return {
    matched: true,
    acoustid: best.id,
    score: best.score,
    mbTitle: rec?.title,
    mbArtist: rec?.artists?.[0]?.name,
  }
}

/** DB 内での重複チェック（同一 fingerprint が既に登録済みか） */
export async function isDuplicateInDb(
  supabase: SupabaseClient,
  fingerprint: string,
  excludeTrackId?: string
): Promise<{ duplicate: boolean; existingTrackId?: string }> {
  let query = supabase
    .from('tracks')
    .select('id')
    .eq('fingerprint', fingerprint)

  if (excludeTrackId) {
    query = query.neq('id', excludeTrackId)
  }

  const { data } = await query.limit(1).maybeSingle()

  if (!data) return { duplicate: false }
  return { duplicate: true, existingTrackId: data.id }
}
