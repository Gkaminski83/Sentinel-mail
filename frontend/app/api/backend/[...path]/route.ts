import { NextResponse } from "next/server"

const BACKEND_URL =
  process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://backend:8000"

async function proxy(request: Request, pathSegments: string[]) {
  const path = pathSegments.join("/")
  const search = new URL(request.url).search
  const targetBase = BACKEND_URL.replace(/\/$/, "")
  const targetUrl = `${targetBase}/${path}${search}`

  const headers = new Headers(request.headers)
  headers.delete("host")
  headers.delete("content-length")

  let body: BodyInit | undefined
  if (!['GET', 'HEAD'].includes(request.method)) {
    const buffer = await request.arrayBuffer()
    body = buffer.byteLength ? buffer : undefined
  }

  let backendResponse: Response
  try {
    backendResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
    })
  } catch (error) {
    return NextResponse.json(
      { detail: "Failed to reach backend" },
      { status: 502 },
    )
  }

  const responseHeaders = new Headers(backendResponse.headers)
  const responseBody = await backendResponse.arrayBuffer()

  return new NextResponse(responseBody, {
    status: backendResponse.status,
    headers: responseHeaders,
  })
}

export async function GET(
  request: Request,
  { params }: { params: { path: string[] } },
) {
  return proxy(request, params.path ?? [])
}

export async function POST(
  request: Request,
  { params }: { params: { path: string[] } },
) {
  return proxy(request, params.path ?? [])
}

export async function PUT(
  request: Request,
  { params }: { params: { path: string[] } },
) {
  return proxy(request, params.path ?? [])
}

export async function PATCH(
  request: Request,
  { params }: { params: { path: string[] } },
) {
  return proxy(request, params.path ?? [])
}

export async function DELETE(
  request: Request,
  { params }: { params: { path: string[] } },
) {
  return proxy(request, params.path ?? [])
}
