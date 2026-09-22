import { NextResponse } from 'next/server'
import { destroyCurrentSession } from '@/lib/auth/session'

export async function POST() {
  try {
    await destroyCurrentSession()
    return NextResponse.json({ success: true, loggedOut: true })
  } catch (error) {
    console.error('[BNK] Logout error:', error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
