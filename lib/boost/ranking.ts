// 週間ブーストランキングは絶対数ではなく「先週比の伸び率」で並べる
// （フォロワーの多いアーティストが常に上位を占める展開を避けるため）。
export function computeGrowthRate(thisWeekCount: number, lastWeekCount: number): number {
  if (thisWeekCount <= 0) return 0
  // 前週がゼロの場合、ゼロ除算を避けつつ「新規の伸び」を正しく評価する
  return thisWeekCount / (lastWeekCount + 1)
}
