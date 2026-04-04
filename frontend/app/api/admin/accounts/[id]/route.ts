import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:8000'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.headers.get('authorization') || ''
  const body = await req.json()
  const res = await fetch(`${BACKEND_URL}/admin/accounts/${params.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token
    },
    body: JSON.stringify(body)
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.headers.get('authorization') || ''
  const res = await fetch(`${BACKEND_URL}/admin/accounts/${params.id}`, {
    method: 'DELETE',
    headers: { Authorization: token }
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
