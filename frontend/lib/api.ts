import { getAuthToken } from "@/lib/auth"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/backend"

export type Account = {
  id: string
  name: string
  email?: string
  imap_host: string
  imap_port: number
  username: string
  secure: boolean
  enabled?: boolean
  smtp_host?: string | null
  smtp_port?: number | null
  smtp_username?: string | null
  smtp_secure?: boolean | null
  smtp_enabled?: boolean | null
  smtp_from_name?: string | null
  smtp_from_email?: string | null
  created_at: string
  updated_at?: string
}

export async function sendEmail(input: SendEmailInput) {
  return fetchJson<{ message_id: string; sent_at: string; recipients: string[] }>("/messages/send", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export type MessageSummary = {
  id: string
  account_id: string
  account: string
  folder: string
  subject: string
  from: string
  date: string
  snippet: string
}

export type AttachmentSummary = {
  id: string
  filename: string
  content_type: string
  size: number
  disposition: string
}

export type MessageDetail = {
  id: string
  text_body: string
  html_body: string | null
  attachments: AttachmentSummary[]
}

export type RecipientInput = {
  email: string
  name?: string | null
}

export type AttachmentUpload = {
  filename?: string | null
  content_type?: string | null
  content_base64: string
}

export type SendEmailInput = {
  account_id: string
  to: RecipientInput[]
  cc?: RecipientInput[]
  bcc?: RecipientInput[]
  subject?: string
  text_body?: string | null
  html_body?: string | null
  in_reply_to?: string | null
  references?: string[] | null
  attachments?: AttachmentUpload[]
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

export type SMTPSettingsInput = {
  host?: string
  port?: number
  username?: string
  password?: string
  secure?: boolean
  enabled?: boolean
  from_name?: string
  from_email?: string
}

export type CreateAccountInput = {
  name: string
  email?: string
  imap_host: string
  imap_port?: number
  username: string
  password: string
  secure?: boolean
  enabled?: boolean
  smtp?: SMTPSettingsInput
}

export async function createAccount(input: CreateAccountInput) {
  return fetchJson<Account>("/accounts", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export type UpdateAccountInput = Partial<Omit<CreateAccountInput, "password">> & {
  password?: string
}

export async function updateAccount(accountId: string, input: UpdateAccountInput) {
  return fetchJson<Account>(`/accounts/${accountId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  })
}

export type TestAccountInput = UpdateAccountInput & {
  account_id?: string
}

export type TestAccountResult = {
  imap_success: boolean
  imap_error?: string | null
  smtp_success: boolean
  smtp_error?: string | null
}

export async function testAccountConnection(input: TestAccountInput) {
  return fetchJson<TestAccountResult>("/accounts/test", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function deleteAccount(accountId: string) {
  return fetchJson<void>(`/accounts/${accountId}`, {
    method: "DELETE",
  })
}

type MessageActionResponse = {
  processed: number
  errors: Array<{ account_id: string; error: string }>
}

type MessageActionInput = {
  message_ids: string[]
}

export async function getMessages(
  params?: { folder?: string; limit?: number },
  init?: RequestInit,
): Promise<MessageSummary[]> {
  const searchParams = new URLSearchParams()
  if (params?.folder) {
    searchParams.set("folder", params.folder)
  }
  if (params?.limit) {
    searchParams.set("limit", String(params.limit))
  }
  const query = searchParams.toString()
  const path = query ? `/messages?${query}` : "/messages"
  return fetchJson<MessageSummary[]>(path, init)
}

export async function getMessageBody(id: string, init?: RequestInit): Promise<MessageDetail> {
  return fetchJson<MessageDetail>(`/messages/${encodeURIComponent(id)}`, init)
}

export async function downloadMessageAttachment(messageId: string, attachmentId: string) {
  const response = await fetch(
    `${API_BASE_URL}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
    {
      cache: "no-store",
      headers: {
        ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
      },
    },
  )

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
    throw new ApiError(message || "Failed to download attachment", response.status)
  }

  const blob = await response.blob()
  const disposition = response.headers.get("Content-Disposition") ?? ""
  const match = /filename="?([^";]+)"?/i.exec(disposition)
  const filename = match ? match[1] : undefined
  const contentType = response.headers.get("Content-Type") ?? "application/octet-stream"
  return { blob, filename, contentType }
}

export async function moveMessages(input: MessageActionInput & { destination_folder: string }) {
  return fetchJson<MessageActionResponse>("/messages/actions/move", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function deleteMessages(input: MessageActionInput & { permanent?: boolean }) {
  return fetchJson<MessageActionResponse>("/messages/actions/delete", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function markMessagesAsSpam(input: MessageActionInput) {
  return fetchJson<MessageActionResponse>("/messages/actions/spam", {
    method: "POST",
    body: JSON.stringify(input),
  })
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
