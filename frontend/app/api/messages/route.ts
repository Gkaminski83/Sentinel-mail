import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:8000'

export async function GET(req: NextRequest) {
  const res = await fetch(`${BACKEND_URL}/messages`)
  const data = await res.json()
  return NextResponse.json(data)
}
