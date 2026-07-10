import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await params
  const supabase = await createClient()

  const { data: track } = await supabase
    .from('tracks')
    .select('lyrics')
    .eq('id', trackId)
    .single()

  return NextResponse.json({ lyrics: track?.lyrics ?? null })
}
