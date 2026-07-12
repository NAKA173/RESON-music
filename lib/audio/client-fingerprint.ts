// ブラウザ側の楽曲フィンガープリント生成。
//
// 注意：これは真のAcoustID/Chromaprint互換フィンガープリントではない（簡易実装）。
// Chromaprint WASMビルドをブラウザに統合していないため、Web Audio APIで音声を
// デコードしてラウドネス（RMS）のエンベロープを抽出し、そのハッシュ値を
// フィンガープリントとして使う。目的はRESON内の完全一致・ほぼ一致の重複アップロード
// を検知することであり、AcoustIDの外部データベース（MusicBrainz）とのマッチングは
// 期待できない（lib/audio/fingerprint.ts の lookupFingerprint は形式が合わず
// 常に不一致を返すが、エラーにはならない）。
const ENVELOPE_POINTS = 512

export async function computeClientFingerprint(file: File): Promise<string | null> {
  try {
    const AudioContextCtor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return null

    const arrayBuffer = await file.arrayBuffer()
    const ctx = new AudioContextCtor()
    let audioBuffer: AudioBuffer
    try {
      audioBuffer = await ctx.decodeAudioData(arrayBuffer)
    } finally {
      ctx.close()
    }

    const channel = audioBuffer.getChannelData(0)
    const windowSize = Math.max(Math.floor(channel.length / ENVELOPE_POINTS), 1)
    const envelope = new Float32Array(ENVELOPE_POINTS)
    for (let i = 0; i < ENVELOPE_POINTS; i++) {
      const start = i * windowSize
      const end = Math.min(start + windowSize, channel.length)
      let sumSquares = 0
      for (let j = start; j < end; j++) sumSquares += channel[j] * channel[j]
      envelope[i] = Math.sqrt(sumSquares / Math.max(end - start, 1))
    }

    // 音量差の影響を減らすため最大値で正規化してから量子化する
    let max = 0
    for (const v of envelope) if (v > max) max = v
    const quantized = new Uint8Array(ENVELOPE_POINTS)
    if (max > 0) {
      for (let i = 0; i < ENVELOPE_POINTS; i++) {
        quantized[i] = Math.round((envelope[i] / max) * 255)
      }
    }

    const hashBuffer = await crypto.subtle.digest('SHA-256', quantized)
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    // デコードに失敗した場合はフィンガープリント生成をスキップする
    // （重複検知が効かなくなるだけで、アップロード自体は継続させる）
    return null
  }
}
