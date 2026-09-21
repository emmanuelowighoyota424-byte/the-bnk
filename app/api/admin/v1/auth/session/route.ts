import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/admin'
export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ authenticated: false }, { status: 401 })
  return NextResponse.json({ authenticated: true, admin: { id: session.admin.id, email: session.admin.email, displayName: session.admin.displayName, role: session.admin.role.name }, expiresAt: session.expiresAt })
}
