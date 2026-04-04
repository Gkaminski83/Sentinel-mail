const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export type Account = {
  id: string
  email: string
  imap_host: string
}

export type MessageSummary = {
  id: string
  account: string
  subject: string
  from: string
  date: string
  snippet: string
}

export type MessageDetail = {
  id: string
  body: string
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Request to ${path} failed: ${response.status} ${text}`)
  }

  return response.json() as Promise<T>
}

export async function getAccounts(init?: RequestInit): Promise<Account[]> {
  return fetchJson<Account[]>("/accounts", init)
}

export async function getMessages(init?: RequestInit): Promise<MessageSummary[]> {
  return fetchJson<MessageSummary[]>("/messages", init)
}

export async function getMessageBody(
  id: string,
  init?: RequestInit,
): Promise<MessageDetail> {
  return fetchJson<MessageDetail>(`/messages/${encodeURIComponent(id)}`, init)
}
