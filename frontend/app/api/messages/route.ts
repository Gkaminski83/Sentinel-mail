import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:8000'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const res = await fetch(`${BACKEND_URL}/messages`, { cache: 'no-store' })
    if (!res.ok) {
      throw new Error(`Backend responded with ${res.status}`)
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to fetch messages from backend', error)
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 502 })
  }
}
