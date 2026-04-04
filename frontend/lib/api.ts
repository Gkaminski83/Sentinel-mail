import { getAuthToken } from "@/lib/auth"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/backend"

export type Account = {
  id: string
  name: string
  imap_host: string
  imap_port: number
  username: string
  secure: boolean
  created_at: string
}

export type MessageSummary = {
  id: string
  account_id: string
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

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
      ...(init?.headers || {}),
    },
  })

  if (!response.ok) {
    const text = await response.text()
    let message = text
    try {
      const parsed = text ? JSON.parse(text) : null
      if (parsed) {
        message = typeof parsed === "string" ? parsed : parsed.detail ?? parsed.message ?? text
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError(message || `Request to ${path} failed`, response.status)
  }

  return response.json() as Promise<T>
}

export async function getAccounts(init?: RequestInit): Promise<Account[]> {
  return fetchJson<Account[]>("/accounts", init)
}

export type CreateAccountInput = {
  name: string
  imap_host: string
  imap_port?: number
  username: string
  password: string
  secure?: boolean
}

export async function createAccount(input: CreateAccountInput) {
  return fetchJson<Account>("/accounts", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function deleteAccount(accountId: string) {
  return fetchJson<void>(`/accounts/${accountId}`, {
    method: "DELETE",
  })
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

export async function login(username: string, password: string) {
  return fetchJson<{ token: string; expires_at: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  })
}

export async function getCurrentAdmin() {
  return fetchJson<{ username: string }>("/auth/me")
}
