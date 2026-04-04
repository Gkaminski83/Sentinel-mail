"use client"

import { MessageSummary } from "@/lib/api"

type MessageViewProps = {
  message: MessageSummary | null
  body: string | null
  loading: boolean
  error?: string | null
}

export function MessageView({ message, body, loading, error }: MessageViewProps) {
  const formattedDate = message
    ? new Date(message.date).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null

  return (
    <section className="flex flex-1 flex-col bg-background/80 text-text">
      <header className="border-b border-white/5 px-10 py-8">
        {message ? (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.4em] text-muted">{message.account}</p>
            <h2 className="text-3xl font-semibold text-text">{message.subject || "(No subject)"}</h2>
            <div className="text-sm text-muted">
              <p className="font-semibold text-text">{message.from}</p>
              <p>{formattedDate}</p>
            </div>
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

        {!loading && error && <p className="text-red-400">{error}</p>}

        {!loading && !error && body && (
          <article className="mx-auto max-w-3xl space-y-4 text-lg leading-relaxed text-text">
            {body.split(/\n\s*\n/).map((paragraph, index) => (
              <p key={index} className="whitespace-pre-line text-muted">
                {paragraph}
              </p>
            ))}
          </article>
        )}

        {!loading && !error && message && !body && (
          <p className="text-muted">No body available for this email.</p>
        )}

        {!loading && !message && (
          <div className="text-muted">Choose an email from the inbox to preview it here.</div>
        )}
      </div>
    </section>
  )
}
