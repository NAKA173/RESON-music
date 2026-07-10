import { requireAdmin } from '@/lib/admin/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const { isAdmin } = await requireAdmin()
  return NextResponse.json({ is_admin: isAdmin })
}
