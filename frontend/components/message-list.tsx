"use client"

import { useMemo, useState } from "react"

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
  onCompose?: () => void
  page: number
  pageSize: number
  total: number
  hasNextPage: boolean
  onNextPage: () => void
  onPrevPage: () => void
  keywordValue: string
  senderValue: string
  dateFromValue: string
  dateToValue: string
  attachmentValue: "any" | "with" | "without"
  filtersActive: boolean
  onKeywordChange: (value: string) => void
  onSenderChange: (value: string) => void
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  onAttachmentChange: (value: "any" | "with" | "without") => void
  onFiltersSubmit: () => void
  onFiltersClear: () => void
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
  onCompose,
  page,
  pageSize,
  total,
  hasNextPage,
  onNextPage,
  onPrevPage,
  keywordValue,
  senderValue,
  dateFromValue,
  dateToValue,
  attachmentValue,
  filtersActive,
  onKeywordChange,
  onSenderChange,
  onDateFromChange,
  onDateToChange,
  onAttachmentChange,
  onFiltersSubmit,
  onFiltersClear,
}: MessageListProps) {
  const selectionCount = selectedMessageIds.size
  const toolbarVisible = selectionCount > 0
  const folderLabel = useMemo(() => FOLDER_LABELS[activeFolder] ?? activeFolder, [activeFolder])
  const showingStart = messages.length > 0 ? (page - 1) * pageSize + 1 : total === 0 ? 0 : (page - 1) * pageSize + 1
  const showingEnd = messages.length > 0 ? showingStart + messages.length - 1 : showingStart
  const [keywordFocused, setKeywordFocused] = useState(false)
  const showAdvancedFilters = keywordFocused || filtersActive

  return (
    <section className="flex h-full w-[400px] flex-col border-r border-white/5 bg-panel/40">
      <header className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted">{folderLabel}</p>
          <h2 className="text-xl font-semibold text-text">
            {total > 0 ? (
              <span>
                Showing {showingStart}-{showingEnd} of {total}
              </span>
            ) : (
              "No conversations"
            )}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {onCompose && (
            <button
              onClick={onCompose}
              className="rounded-full border border-accent/40 px-4 py-1 text-sm uppercase tracking-[0.3em] text-accent transition hover:border-accent hover:text-white"
            >
              Compose
            </button>
          )}
          <button
            onClick={onRefresh}
            className="rounded-full border border-white/10 px-4 py-1 text-sm text-text transition hover:border-accent hover:text-accent"
          >
            Refresh
          </button>
          <div className="flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[11px] uppercase tracking-[0.3em] text-muted">
            <button
              onClick={onPrevPage}
              disabled={loading || page === 1}
              className="rounded-full px-2 py-0.5 text-text transition enabled:hover:text-white disabled:opacity-40"
              aria-label="Previous page"
            >
              ◀
            </button>
            <span className="min-w-[3rem] text-center text-xs text-text">Page {page}</span>
            <button
              onClick={onNextPage}
              disabled={loading || !hasNextPage}
              className="rounded-full px-2 py-0.5 text-text transition enabled:hover:text-white disabled:opacity-40"
              aria-label="Next page"
            >
              ▶
            </button>
          </div>
        </div>
      </header>
      <div className="border-b border-white/5 px-5 py-4">
        <form
          className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-panel/60 px-4 py-3 text-sm text-muted"
          onSubmit={(event) => {
            event.preventDefault()
            onFiltersSubmit()
          }}
        >
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-[0.3em] text-muted">Keyword</label>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/10 px-3 py-1.5">
              <span aria-hidden="true" className="text-base text-white/70">
                🔍
              </span>
              <input
                type="search"
                value={keywordValue}
                onChange={(event) => onKeywordChange(event.target.value)}
                onFocus={() => setKeywordFocused(true)}
                placeholder="Search subject, sender, snippet…"
                className="flex-1 bg-transparent text-sm text-text placeholder:text-muted focus:outline-none"
              />
            </div>
          </div>
          {showAdvancedFilters && (
            <>
              <div className="grid grid-cols-1 gap-3 text-text sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] uppercase tracking-[0.3em] text-muted">Sender</label>
                  <input
                    type="text"
                    value={senderValue}
                    onChange={(event) => onSenderChange(event.target.value)}
                    placeholder="Name or email"
                    className="rounded-2xl border border-white/10 bg-black/10 px-3 py-1.5 text-sm text-text placeholder:text-muted focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] uppercase tracking-[0.3em] text-muted">Attachments</label>
                  <select
                    value={attachmentValue}
                    onChange={(event) => onAttachmentChange(event.target.value as "any" | "with" | "without")}
                    className="rounded-2xl border border-white/10 bg-black/10 px-3 py-1.5 text-sm text-text focus:outline-none"
                  >
                    <option value="any">Any</option>
                    <option value="with">With attachments</option>
                    <option value="without">Without attachments</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] uppercase tracking-[0.3em] text-muted">Date from</label>
                  <input
                    type="date"
                    value={dateFromValue}
                    onChange={(event) => onDateFromChange(event.target.value)}
                    className="rounded-2xl border border-white/10 bg-black/10 px-3 py-1.5 text-sm text-text focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] uppercase tracking-[0.3em] text-muted">Date to</label>
                  <input
                    type="date"
                    value={dateToValue}
                    onChange={(event) => onDateToChange(event.target.value)}
                    className="rounded-2xl border border-white/10 bg-black/10 px-3 py-1.5 text-sm text-text focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                {filtersActive ? (
                  <p className="text-[11px] uppercase tracking-[0.3em] text-muted">Filters applied</p>
                ) : (
                  <p className="text-[11px] uppercase tracking-[0.3em] text-muted">No filters applied</p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onFiltersClear}
                    className="rounded-full border border-white/10 px-4 py-1 text-[11px] uppercase tracking-[0.3em] text-muted transition hover:border-white/30 hover:text-white"
                  >
                    Reset
                  </button>
                  <button
                    type="submit"
                    className="rounded-full border border-accent/40 px-4 py-1 text-[11px] uppercase tracking-[0.3em] text-accent transition hover:border-accent hover:text-white"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </>
          )}
        </form>
      </div>
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
