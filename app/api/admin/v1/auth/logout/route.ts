import { NextResponse } from 'next/server'
import { revokeAdminSession } from '@/lib/auth/admin'
export async function POST() {
  await revokeAdminSession()
  return NextResponse.json({ authenticated: false })
}
