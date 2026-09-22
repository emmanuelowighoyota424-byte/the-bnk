import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin } from '@/lib/auth/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = await authenticateAdmin(request, String(body.masterKey || ''))
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ authenticated: true, admin: result.admin, expiresAt: result.expiresAt })
  } catch (error) {
    console.error('[BNK] Admin authentication error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}
