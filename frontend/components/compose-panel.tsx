"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import type { Account } from "@/lib/api"

const ATTACHMENT_LIMIT = 5
const ATTACHMENT_SIZE_LIMIT_BYTES = 5 * 1024 * 1024 // 5MB

export type ComposeDraft = {
  accountId: string
  to: string
  cc: string
  bcc: string
  subject: string
  body: string
  inReplyTo?: string | null
  references?: string[] | null
  attachments: AttachmentDraft[]
}

export type AttachmentDraft = {
  id: string
  name: string
  size: number
  type: string
  base64: string
}

type ComposePanelProps = {
  open: boolean
  accounts: Account[]
  initialDraft: ComposeDraft | null
  sending?: boolean
  error?: string | null
  onClose: () => void
  onSubmit: (draft: ComposeDraft) => Promise<void> | void
  onDraftChange?: (draft: ComposeDraft) => void
  draftSavedAt?: number | null
  onDiscardDraft?: () => void
}

const defaultDraft: ComposeDraft = {
  accountId: "",
  to: "",
  cc: "",
  bcc: "",
  subject: "",
  body: "",
  attachments: [],
}

export function ComposePanel({
  open,
  accounts,
  initialDraft,
  sending = false,
  error,
  onClose,
  onSubmit,
  onDraftChange,
  draftSavedAt,
  onDiscardDraft,
}: ComposePanelProps) {
  const [draft, setDraft] = useState<ComposeDraft>(defaultDraft)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    if (initialDraft) {
      setDraft((prev) => ({
        ...prev,
        ...initialDraft,
        attachments: initialDraft.attachments ?? [],
      }))
      return
    }
    const fallbackAccountId = accounts[0]?.id ?? ""
    setDraft({ ...defaultDraft, accountId: fallbackAccountId })
  }, [open, initialDraft, accounts])

  const canSend = useMemo(() => {
    return Boolean(
      draft.accountId && draft.to.trim().length > 0 && (draft.body.trim().length > 0 || draft.subject.trim().length > 0),
    )
  }, [draft])

  const attachmentLimitReached = useMemo(() => draft.attachments.length >= ATTACHMENT_LIMIT, [draft.attachments.length])

  const onPickFiles = () => {
    fileInputRef.current?.click()
  }

  const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) {
      return
    }

    const remainingSlots = ATTACHMENT_LIMIT - draft.attachments.length
    if (remainingSlots <= 0) {
      setLocalError("Attachment limit reached. Remove a file before adding another.")
      event.target.value = ""
      return
    }

    if (files.length > remainingSlots) {
      setLocalError(`You can add only ${remainingSlots} more attachment${remainingSlots === 1 ? "" : "s"}.`)
      event.target.value = ""
      return
    }

    const oversizeFiles: string[] = []
    const attachments = await Promise.all(
      Array.from(files).map(async (file) => {
        if (file.size > ATTACHMENT_SIZE_LIMIT_BYTES) {
          oversizeFiles.push(file.name)
          return null
        }
        const base64 = await readFileAsBase64(file)
        return {
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          base64,
        } satisfies AttachmentDraft
      }),
    )

    const validAttachments = attachments.filter((attachment): attachment is AttachmentDraft => Boolean(attachment))

    if (oversizeFiles.length > 0) {
      setLocalError(`Files over 5MB removed: ${oversizeFiles.join(", ")}`)
    } else {
      setLocalError(null)
    }

    if (validAttachments.length > 0) {
      setDraft((prev) => ({ ...prev, attachments: [...prev.attachments, ...validAttachments] }))
    }
    event.target.value = ""
  }

  const removeAttachment = (id: string) => {
    setDraft((prev) => ({ ...prev, attachments: prev.attachments.filter((attachment) => attachment.id !== id) }))
    setLocalError(null)
  }

  const clearAttachments = () => {
    setDraft((prev) => ({ ...prev, attachments: [] }))
    setLocalError(null)
  }

  if (!open) {
    return null
  }

  const accountOptions = accounts.map((account) => (
    <option key={account.id} value={account.id}>
      {account.name} · {account.email ?? account.username}
    </option>
  ))

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSend) {
      return
    }
    await onSubmit(draft)
  }

  const updateField = (field: keyof ComposeDraft, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    if (!open) {
      return
    }
    onDraftChange?.(draft)
  }, [draft, onDraftChange, open])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-md">
      <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-panel/90 shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/5 px-8 py-6">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-muted">Secure compose</p>
            <h2 className="text-2xl font-semibold text-text">New message</h2>
          </div>
          <div className="text-right">
            {draftSavedAt ? (
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted">
                Autosaved {new Date(draftSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            ) : (
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted/50">Draft not saved yet</p>
            )}
            <button
              type="button"
              className="mt-2 rounded-full border border-white/10 px-4 py-1 text-sm uppercase tracking-[0.3em] text-muted transition hover:border-accent/60 hover:text-white"
              onClick={onClose}
              disabled={sending}
            >
              Close
            </button>
          </div>
        </header>
        <form onSubmit={handleSubmit} className="space-y-5 px-8 py-6">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-muted">From</label>
            <select
              className="w-full rounded-2xl border border-white/10 bg-background/40 px-4 py-3 text-text"
              value={draft.accountId}
              onChange={(event) => updateField("accountId", event.target.value)}
              disabled={accounts.length === 0 || sending}
              required
            >
              <option value="" disabled>
                Select account
              </option>
              {accountOptions}
            </select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.3em] text-muted">To</label>
              <input
                type="text"
                className="w-full rounded-2xl border border-white/10 bg-background/40 px-4 py-3 text-text"
                placeholder="alice@example.com, bob@example.com"
                value={draft.to}
                onChange={(event) => updateField("to", event.target.value)}
                disabled={sending}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.3em] text-muted">Cc</label>
              <input
                type="text"
                className="w-full rounded-2xl border border-white/10 bg-background/40 px-4 py-3 text-text"
                placeholder="Optional"
                value={draft.cc}
                onChange={(event) => updateField("cc", event.target.value)}
                disabled={sending}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.3em] text-muted">Bcc</label>
              <input
                type="text"
                className="w-full rounded-2xl border border-white/10 bg-background/40 px-4 py-3 text-text"
                placeholder="Optional"
                value={draft.bcc}
                onChange={(event) => updateField("bcc", event.target.value)}
                disabled={sending}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.3em] text-muted">Subject</label>
              <input
                type="text"
                className="w-full rounded-2xl border border-white/10 bg-background/40 px-4 py-3 text-text"
                placeholder="Subject"
                value={draft.subject}
                onChange={(event) => updateField("subject", event.target.value)}
                disabled={sending}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-muted">Message</label>
            <textarea
              rows={10}
              className="w-full rounded-3xl border border-white/10 bg-background/40 px-4 py-3 text-text"
              placeholder="Write your secure message..."
              value={draft.body}
              onChange={(event) => updateField("body", event.target.value)}
              disabled={sending}
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted">Attachments</p>
                <p className="text-[11px] text-muted/70">Up to {ATTACHMENT_LIMIT} files · 5MB each</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/10 px-4 py-1 text-[11px] uppercase tracking-[0.3em] text-muted transition hover:border-accent/60 hover:text-white"
                onClick={onPickFiles}
                disabled={sending || attachmentLimitReached}
              >
                Add files
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={handleFilesSelected}
            />
            {draft.attachments.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-muted">
                  <span>{draft.attachments.length} file{draft.attachments.length === 1 ? "" : "s"} attached</span>
                  <button
                    type="button"
                    className="text-muted transition hover:text-white"
                    onClick={clearAttachments}
                    disabled={sending}
                  >
                    Clear all
                  </button>
                </div>
                <ul className="space-y-2" aria-live="polite">
                  {draft.attachments.map((attachment) => (
                    <li
                      key={attachment.id}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-background/40 px-4 py-2 text-sm"
                    >
                      <div>
                        <p className="text-text">{attachment.name}</p>
                        <p className="text-[11px] uppercase tracking-[0.3em] text-muted">
                          {formatSize(attachment.size)} · {attachment.type || "application/octet-stream"}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-xs uppercase tracking-[0.3em] text-rose-300 transition hover:text-rose-100"
                        onClick={() => removeAttachment(attachment.id)}
                        disabled={sending}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {localError && (
              <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-200" role="status">
                {localError}
              </p>
            )}
          </div>
          {error && <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-200">{error}</p>}
          <div className="flex items-center justify-between">
            <small className="text-xs uppercase tracking-[0.3em] text-muted">
              Recipients separated by commas. Attachments are encrypted in transit.
            </small>
            <div className="flex gap-3">
              {onDiscardDraft && (
                <button
                  type="button"
                  className="rounded-full border border-white/10 px-4 py-2 text-sm uppercase tracking-[0.3em] text-rose-200 transition hover:border-rose-400/60 hover:text-white"
                  onClick={() => {
                    if (sending) return
                    onDiscardDraft()
                  }}
                  disabled={sending}
                >
                  Discard
                </button>
              )}
              <button
                type="button"
                className="rounded-full border border-white/10 px-5 py-2 text-sm uppercase tracking-[0.3em] text-muted transition hover:border-accent/60 hover:text-white"
                onClick={onClose}
                disabled={sending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full border border-accent/60 bg-accent/10 px-6 py-2 text-sm uppercase tracking-[0.3em] text-accent transition hover:bg-accent/20 hover:text-white disabled:opacity-50"
                disabled={!canSend || sending}
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== "string") {
        reject(new Error("Failed to read file"))
        return
      }
      const base64 = result.split(",", 2)[1] ?? ""
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
