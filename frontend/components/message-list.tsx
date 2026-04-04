"use client"

import { MessageSummary } from "@/lib/api"
import { MessageItem } from "@/components/message-item"

type MessageListProps = {
  messages: MessageSummary[]
  loading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  unreadMessageIds: Set<string>
  onRefresh: () => void
  error?: string | null
}

export function MessageList({
  messages,
  loading,
  selectedId,
  onSelect,
  unreadMessageIds,
  onRefresh,
  error,
}: MessageListProps) {
  return (
    <section className="flex h-full w-[400px] flex-col border-r border-white/5 bg-panel/40">
      <header className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted">Inbox</p>
          <h2 className="text-xl font-semibold text-text">{messages.length} conversations</h2>
        </div>
        <button
          onClick={onRefresh}
          className="rounded-full border border-white/10 px-4 py-1 text-sm text-text transition hover:border-accent hover:text-accent"
        >
          Refresh
        </button>
      </header>
      {error && <div className="border-b border-white/5 px-5 py-2 text-xs text-red-400">{error}</div>}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading && (
          <ul className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <li key={index} className="animate-pulse rounded-3xl border border-white/5 bg-panel/60 p-4">
                <div className="mb-2 h-4 w-1/2 rounded bg-white/10" />
                <div className="mb-1 h-3 w-2/3 rounded bg-white/10" />
                <div className="h-3 w-1/3 rounded bg-white/10" />
              </li>
            ))}
          </ul>
        )}

        {!loading && messages.length === 0 && (
          <div className="mt-20 rounded-3xl border border-dashed border-white/10 px-4 py-10 text-center text-muted">
            No messages yet.
          </div>
        )}

        {!loading && messages.length > 0 && (
          <ul className="space-y-2">
            {messages.map((message) => {
              const isSelected = message.id === selectedId
              const isUnread = unreadMessageIds.has(message.id)
              return (
                <li key={message.id}>
                  <MessageItem
                    message={message}
                    selected={isSelected}
                    unread={isUnread}
                    onSelect={onSelect}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
