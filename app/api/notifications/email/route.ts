import { NextRequest, NextResponse } from 'next/server'

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { success: false, error: 'Email delivery is disabled until an approved transactional email provider is configured.' },
    { status: 503 },
  )
}
