"use client"

import type { DragEvent, KeyboardEvent } from "react"

import { MessageSummary } from "@/lib/api"
import { cn } from "@/lib/utils"

interface MessageItemProps {
  message: MessageSummary
  selected?: boolean
  unread?: boolean
  selectionChecked?: boolean
  onSelect: (id: string) => void
  onToggleSelect?: (id: string) => void
  draggableIds?: string[]
}

export function MessageItem({
  message,
  selected = false,
  unread = false,
  selectionChecked = false,
  onSelect,
  onToggleSelect,
  draggableIds,
}: MessageItemProps) {
  const formattedTime = new Date(message.date).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })

  const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
    if (!draggableIds || draggableIds.length === 0) {
      return
    }
    event.dataTransfer.setData("application/x-message-ids", JSON.stringify(draggableIds))
    event.dataTransfer.setData("text/plain", draggableIds.join(","))
    event.dataTransfer.effectAllowed = "move"
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(message.id)}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelect(message.id)
        }
      }}
      draggable={Boolean(draggableIds?.length)}
      onDragStart={handleDragStart}
      className={cn(
        "group w-full rounded-3xl border border-transparent bg-panel/60 px-4 py-4 text-left transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        "hover:-translate-y-0.5 hover:border-accent/40 hover:bg-panel/80 hover:shadow-glow",
        selected && "border-accent/70 bg-panel shadow-glow",
        selectionChecked && "border-accent/60",
      )}
    >
      <div className="flex items-start justify-between text-sm text-muted">
        <div className="flex items-center gap-2 text-text">
          {onToggleSelect && (
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-white/20 bg-transparent text-accent focus:ring-accent"
              checked={selectionChecked}
              onChange={(event) => {
                event.stopPropagation()
                onToggleSelect(message.id)
              }}
              onClick={(event) => event.stopPropagation()}
            />
          )}
          <span className={cn("font-semibold", unread && "text-white")}>{message.from}</span>
        </div>
        <span className="text-xs tracking-wide text-muted">{formattedTime}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <p className={cn("text-base font-semibold text-text", unread && "text-white")}>{message.subject || "(No subject)"}</p>
        {unread && <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />}
      </div>
      <p className="mt-1 text-sm text-muted line-clamp-1">{message.snippet || "No preview available"}</p>
    </div>
  )
}
