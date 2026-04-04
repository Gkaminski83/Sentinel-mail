"use client"

import { useMemo } from "react"

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
  selectedMessageIds: Set<string>
  onToggleSelect: (id: string) => void
  onSelectAll: () => void
  onClearSelection: () => void
  onMoveSelected: (folder: string) => Promise<void>
  onDeleteSelected: (options?: { permanent?: boolean }) => Promise<void>
  onSpamSelected: () => Promise<void>
  actionLoading?: boolean
  actionError?: string | null
  activeFolder: string
}

const FOLDER_LABELS: Record<string, string> = {
  inbox: "Inbox",
  starred: "Starred",
  sent: "Sent",
  trash: "Trash",
  spam: "Spam",
}

export function MessageList({
  messages,
  loading,
  selectedId,
  onSelect,
  unreadMessageIds,
  onRefresh,
  error,
  selectedMessageIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onMoveSelected,
  onDeleteSelected,
  onSpamSelected,
  actionLoading = false,
  actionError,
  activeFolder,
}: MessageListProps) {
  const selectionCount = selectedMessageIds.size
  const toolbarVisible = selectionCount > 0
  const folderLabel = useMemo(() => FOLDER_LABELS[activeFolder] ?? activeFolder, [activeFolder])

  return (
    <section className="flex h-full w-[400px] flex-col border-r border-white/5 bg-panel/40">
      <header className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted">{folderLabel}</p>
          <h2 className="text-xl font-semibold text-text">{messages.length} conversations</h2>
        </div>
        <button
          onClick={onRefresh}
          className="rounded-full border border-white/10 px-4 py-1 text-sm text-text transition hover:border-accent hover:text-accent"
        >
          Refresh
        </button>
      </header>
      {toolbarVisible && (
        <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-4 py-3 text-xs text-muted">
          <span className="text-text">{selectionCount} selected</span>
          <button
            className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-widest transition hover:border-accent/60 hover:text-white"
            onClick={onSelectAll}
            disabled={loading}
          >
            Select all
          </button>
          <button
            className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-widest transition hover:border-accent/60 hover:text-white"
            onClick={onClearSelection}
            disabled={loading}
          >
            Clear
          </button>
          <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-widest">
            <button
              onClick={() => onMoveSelected("inbox")}
              className="rounded-full border border-white/10 px-3 py-1 transition hover:border-accent/60 hover:text-white"
              disabled={loading || actionLoading}
            >
              Move to Inbox
            </button>
            <button
              onClick={() => onMoveSelected("trash")}
              className="rounded-full border border-white/10 px-3 py-1 transition hover:border-rose-400/60 hover:text-white"
              disabled={loading || actionLoading}
            >
              Move to Trash
            </button>
            <button
              onClick={() => onSpamSelected()}
              className="rounded-full border border-white/10 px-3 py-1 transition hover:border-yellow-400/60 hover:text-white"
              disabled={loading || actionLoading}
            >
              Mark Spam
            </button>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-widest">
            <button
              onClick={() => onDeleteSelected({ permanent: activeFolder === "trash" })}
              className="rounded-full border border-white/10 px-3 py-1 transition hover:border-red-400/60 hover:text-white"
              disabled={loading || actionLoading}
            >
              {activeFolder === "trash" ? "Delete permanently" : "Delete"}
            </button>
            {activeFolder === "spam" && (
              <button
                onClick={() => onMoveSelected("inbox")}
                className="rounded-full border border-white/10 px-3 py-1 transition hover:border-green-400/60 hover:text-white"
                disabled={loading || actionLoading}
              >
                Not spam
              </button>
            )}
            {activeFolder === "trash" && (
              <button
                onClick={() => onMoveSelected("inbox")}
                className="rounded-full border border-white/10 px-3 py-1 transition hover:border-green-400/60 hover:text-white"
                disabled={loading || actionLoading}
              >
                Restore
              </button>
            )}
          </div>
          {actionError && <span className="text-red-400">{actionError}</span>}
        </div>
      )}
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
                    selectionChecked={selectedMessageIds.has(message.id)}
                    onToggleSelect={onToggleSelect}
                    draggableIds={toolbarVisible ? Array.from(selectedMessageIds) : [message.id]}
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
