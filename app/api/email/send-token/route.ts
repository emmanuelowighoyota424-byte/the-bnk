import { NextRequest, NextResponse } from 'next/server'

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { success: false, error: 'Email delivery is not configured. Configure an approved transactional email provider before enabling email verification.' },
    { status: 503 },
  )
}
