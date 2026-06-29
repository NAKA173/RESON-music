/**
 * AI生成楽曲の判定ロジック
 *
 * 現時点では自己申告 + メタデータヒューリスティックで判定。
 * 将来的に Claude Haiku による音楽的特徴分析を追加可能。
 *
 * 判定結果は tracks.ai_generated に反映され、重み係数が 0.1 に強制される。
 */

// AI生成ツールのメタデータパターン（大文字小文字不問）
const AI_TOOL_PATTERNS = [
  /suno/i,
  /udio/i,
  /stable\s*audio/i,
  /musicgen/i,
  /audiogen/i,
  /soundraw/i,
  /aiva/i,
  /mubert/i,
  /beatoven/i,
  /loudly/i,
  /ai[\s-]?generated/i,
  /generated\s+by\s+ai/i,
]

export interface AiDetectionInput {
  title: string
  selfDeclared: boolean
  metadata?: {
    comment?: string
    software?: string
    encoder?: string
  }
}

export interface AiDetectionResult {
  ai_generated: boolean
  reason: 'self_declared' | 'metadata_pattern' | 'not_detected'
  matched_pattern?: string
}

export function detectAiGenerated(input: AiDetectionInput): AiDetectionResult {
  if (input.selfDeclared) {
    return { ai_generated: true, reason: 'self_declared' }
  }

  const targets = [
    input.title,
    input.metadata?.comment ?? '',
    input.metadata?.software ?? '',
    input.metadata?.encoder ?? '',
  ].join(' ')

  for (const pattern of AI_TOOL_PATTERNS) {
    if (pattern.test(targets)) {
      return {
        ai_generated: true,
        reason: 'metadata_pattern',
        matched_pattern: pattern.source,
      }
    }
  }

  return { ai_generated: false, reason: 'not_detected' }
}
