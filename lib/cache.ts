import { Redis } from '@upstash/redis'

// Upstash Redisのキャッシュラッパー。UPSTASH_REDIS_URL / UPSTASH_REDIS_TOKEN が
// 未設定の環境（ローカル/テスト）ではキャッシュをスキップし、常にmiss（呼び出し元は
// 都度計算する）として振る舞う（決済系のPaymentProviderと同じ「未設定時はno-op」パターン）。
// 想定用途：文脈検索（Claude Haiku）のクエリ結果キャッシュなど、LLM呼び出しコストが
// 大きい処理の結果を一定時間再利用するため。

let redis: Redis | null = null
function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_URL
  const token = process.env.UPSTASH_REDIS_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url, token })
  return redis
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedis()
  if (!client) return null
  try {
    return await client.get<T>(key)
  } catch {
    return null
  }
}

/** ttlSec: 秒単位のキャッシュ有効期限 */
export async function cacheSet<T>(key: string, value: T, ttlSec: number): Promise<void> {
  const client = getRedis()
  if (!client) return
  try {
    await client.set(key, value, { ex: ttlSec })
  } catch {
    // キャッシュ書き込み失敗は無視する（キャッシュはあくまで最適化であり必須ではない）
  }
}

/**
 * 計算結果をキャッシュ経由で取得する。キャッシュがなければ compute() を実行し、
 * 結果を ttlSec 秒キャッシュしてから返す（Redis未設定時は毎回computeを実行する）。
 */
export async function withCache<T>(key: string, ttlSec: number, compute: () => Promise<T>): Promise<T> {
  const cached = await cacheGet<T>(key)
  if (cached !== null) return cached
  const value = await compute()
  await cacheSet(key, value, ttlSec)
  return value
}
