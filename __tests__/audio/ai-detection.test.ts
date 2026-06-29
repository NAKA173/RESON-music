import { detectAiGenerated } from '@/lib/audio/ai-detection'

describe('detectAiGenerated', () => {
  test('self_declared = true は即 ai_generated', () => {
    const r = detectAiGenerated({ title: '普通の曲', selfDeclared: true })
    expect(r.ai_generated).toBe(true)
    expect(r.reason).toBe('self_declared')
  })

  test('タイトルに "Suno" が含まれると検出', () => {
    const r = detectAiGenerated({ title: 'Suno AI が作った曲', selfDeclared: false })
    expect(r.ai_generated).toBe(true)
    expect(r.reason).toBe('metadata_pattern')
  })

  test('大文字小文字を無視して検出', () => {
    const r = detectAiGenerated({ title: 'udio track', selfDeclared: false })
    expect(r.ai_generated).toBe(true)
  })

  test('metadata.software に AI ツール名があると検出', () => {
    const r = detectAiGenerated({
      title: '曲',
      selfDeclared: false,
      metadata: { software: 'Stable Audio 1.0' },
    })
    expect(r.ai_generated).toBe(true)
    expect(r.reason).toBe('metadata_pattern')
  })

  test('metadata.comment に "AI Generated" があると検出', () => {
    const r = detectAiGenerated({
      title: '曲',
      selfDeclared: false,
      metadata: { comment: 'AI generated music' },
    })
    expect(r.ai_generated).toBe(true)
  })

  test('AI関連キーワードがなければ not_detected', () => {
    const r = detectAiGenerated({
      title: '春の風',
      selfDeclared: false,
      metadata: { software: 'Logic Pro X', comment: '自作曲です' },
    })
    expect(r.ai_generated).toBe(false)
    expect(r.reason).toBe('not_detected')
  })

  test('MusicGen は検出される', () => {
    const r = detectAiGenerated({
      title: '曲',
      selfDeclared: false,
      metadata: { encoder: 'MusicGen v2' },
    })
    expect(r.ai_generated).toBe(true)
  })

  test('self_declared が優先される', () => {
    // self_declared=true ならパターン関係なく reason は self_declared
    const r = detectAiGenerated({
      title: '普通の曲',
      selfDeclared: true,
      metadata: { software: 'Logic Pro' },
    })
    expect(r.reason).toBe('self_declared')
  })
})
