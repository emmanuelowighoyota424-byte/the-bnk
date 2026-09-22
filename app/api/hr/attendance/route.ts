import { NextResponse } from "next/server"

// Legacy HR endpoint retained without the removed Supabase integration.
export async function GET() {
  return NextResponse.json({ items: [], message: "HR attendance storage is not configured." })
}

export async function POST() {
  return NextResponse.json({ error: "HR attendance storage is not configured." }, { status: 503 })
}

export async function PATCH() {
  return NextResponse.json({ error: "HR attendance storage is not configured." }, { status: 503 })
}
