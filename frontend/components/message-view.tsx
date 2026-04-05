"use client"

import { useMemo } from "react"

import { type MessageDetail, type MessageSummary } from "@/lib/api"

type MessageViewProps = {
  message: MessageSummary | null
  detail: MessageDetail | null
  loading: boolean
  error?: string | null
  attachmentError?: string | null
  activeFolder: string
  actionLoading?: boolean
  onDelete?: (options?: { permanent?: boolean }) => Promise<void> | void
  onSpam?: () => Promise<void> | void
  onMove?: (folder: string) => Promise<void> | void
  onDownloadAttachment?: (attachmentId: string) => Promise<void> | void
  onReply?: () => Promise<void> | void
}

const QUICK_MOVE_TARGETS = [
  { id: "inbox", label: "Move to Inbox" },
  { id: "starred", label: "Move to Starred" },
  { id: "sent", label: "Move to Sent" },
  { id: "trash", label: "Move to Trash" },
  { id: "spam", label: "Move to Spam" },
]

export function MessageView({
  message,
  detail,
  loading,
  error,
  attachmentError,
  activeFolder,
  actionLoading = false,
  onDelete,
  onSpam,
  onMove,
  onDownloadAttachment,
  onReply,
}: MessageViewProps) {
  const formattedDate = message
    ? new Date(message.date).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null

  const toolbarButtons = useMemo(() => {
    const buttons: Array<{ label: string; onClick?: () => void | Promise<void>; variant?: "danger" | "muted" }>
      = []
    if (!message) {
      return buttons
    }

    const isTrash = activeFolder === "trash"
    const isSpam = activeFolder === "spam"

    if (onDelete) {
      buttons.push({
        label: isTrash ? "Delete permanently" : "Delete",
        onClick: () => onDelete({ permanent: isTrash }),
        variant: "danger",
      })
    }

    if (isTrash && onMove) {
      buttons.push({ label: "Restore", onClick: () => onMove("inbox") })
    }

    if (isSpam && onMove) {
      buttons.push({ label: "Not spam", onClick: () => onMove("inbox") })
    }

    if (!isSpam && onSpam) {
      buttons.push({ label: "Mark as spam", onClick: () => onSpam() })
    }

    return buttons
  }, [message, activeFolder, onDelete, onMove, onSpam])

  const htmlBody = detail?.html_body ?? null
  const textBody = detail?.text_body ?? ""
  const attachments = detail?.attachments ?? []

  const formatBytes = useMemo(
    () =>
      (size: number) => {
        if (size < 1024) return `${size} B`
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
        return `${(size / (1024 * 1024)).toFixed(1)} MB`
      },
    [],
  )

  return (
    <section className="flex flex-1 flex-col bg-background/80 text-text">
      <header className="border-b border-white/5 px-10 py-8">
        {message ? (
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.4em] text-muted">{message.account}</p>
            <h2 className="text-3xl font-semibold text-text">{message.subject || "(No subject)"}</h2>
            <div className="text-sm text-muted">
              <p className="font-semibold text-text">{message.from}</p>
              <p>{formattedDate}</p>
            </div>
            {(toolbarButtons.length > 0 || onMove) && (
              <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.3em] text-muted">
                {toolbarButtons.map((button) => (
                  <button
                    key={button.label}
                    disabled={actionLoading}
                    onClick={() => button.onClick?.()}
                    className={`rounded-full border px-3 py-1 text-[11px] transition hover:text-white ${
                      button.variant === "danger"
                        ? "border-red-400/40 hover:border-red-400"
                        : "border-white/10 hover:border-accent/60"
                    } ${actionLoading ? "opacity-50" : ""}`}
                  >
                    {button.label}
                  </button>
                ))}
                {onMove && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] tracking-[0.4em] text-muted">Move to:</span>
                    <select
                      className="rounded-full border border-white/10 bg-transparent px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-text"
                      disabled={actionLoading}
                      onChange={(event) => {
                        const value = event.target.value
                        if (!value) return
                        onMove(value)
                        event.target.selectedIndex = 0
                      }}
                      value=""
                    >
                      <option value="" disabled>
                        Select
                      </option>
                      {QUICK_MOVE_TARGETS.filter((target) => target.id !== activeFolder).map((target) => (
                        <option key={target.id} value={target.id} className="bg-panel text-text text-[11px]">
                          {target.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {onReply && (
                  <button
                    className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-accent transition hover:border-accent/60 hover:text-white"
                    onClick={() => onReply()}
                    disabled={actionLoading}
                  >
                    Reply
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-muted">Select a message to view details.</div>
        )}
      </header>
      <div className="flex-1 overflow-y-auto px-10 py-8">
        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="animate-pulse space-y-2">
                <div className="h-4 w-3/4 rounded bg-white/5" />
                <div className="h-4 w-2/3 rounded bg-white/5" />
                <div className="h-4 w-1/2 rounded bg-white/5" />
              </div>
            ))}
          </div>
        )}

        {!loading && (error || attachmentError) && (
          <div className="space-y-2">
            {error && <p className="text-red-400">{error}</p>}
            {attachmentError && <p className="text-amber-300">{attachmentError}</p>}
          </div>
        )}

        {!loading && !error && detail && (htmlBody || textBody) && (
          <article className="mx-auto max-w-3xl space-y-6 text-lg leading-relaxed text-text">
            {htmlBody ? (
              <div
                className="prose prose-invert max-w-none prose-headings:text-text prose-p:text-muted prose-a:text-accent"
                dangerouslySetInnerHTML={{ __html: htmlBody }}
              />
            ) : (
              textBody.split(/\n\s*\n/).map((paragraph, index) => (
                <p key={index} className="whitespace-pre-line text-muted">
                  {paragraph}
                </p>
              ))
            )}

            {attachments.length > 0 && (
              <div className="rounded-3xl border border-white/10 bg-panel/40 px-6 py-5 text-sm">
                <p className="mb-3 text-xs uppercase tracking-[0.3em] text-muted">Attachments</p>
                <ul className="space-y-2">
                  {attachments.map((attachment) => (
                    <li
                      key={attachment.id}
                      className="flex items-center justify-between rounded-2xl border border-white/5 bg-background/50 px-4 py-3"
                    >
                      <div>
                        <p className="text-text">{attachment.filename}</p>
                        <p className="text-xs uppercase tracking-[0.3em] text-muted">
                          {attachment.content_type} · {formatBytes(attachment.size)}
                        </p>
                      </div>
                      {onDownloadAttachment && (
                        <button
                          className="rounded-full border border-white/10 px-4 py-1 text-[11px] uppercase tracking-[0.3em] text-muted transition hover:border-accent/60 hover:text-white"
                          disabled={actionLoading}
                          onClick={() => onDownloadAttachment(attachment.id)}
                        >
                          Download
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        )}

        {!loading && !error && message && !detail && (
          <p className="text-muted">No body available for this email.</p>
        )}

        {!loading && !message && (
          <div className="text-muted">Choose an email from the inbox to preview it here.</div>
        )}
      </div>
    </section>
  )
}
