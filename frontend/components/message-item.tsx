"use client"

import { MessageSummary } from "@/lib/api"
import { cn } from "@/lib/utils"

interface MessageItemProps {
  message: MessageSummary
  selected?: boolean
  unread?: boolean
  onSelect: (id: string) => void
}

export function MessageItem({ message, selected = false, unread = false, onSelect }: MessageItemProps) {
  const formattedTime = new Date(message.date).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <button
      onClick={() => onSelect(message.id)}
      className={cn(
        "group w-full rounded-3xl border border-transparent bg-panel/60 px-4 py-4 text-left transition duration-200",
        "hover:-translate-y-0.5 hover:border-accent/40 hover:bg-panel/80 hover:shadow-glow",
        selected && "border-accent/70 bg-panel shadow-glow",
      )}
    >
      <div className="flex items-start justify-between text-sm text-muted">
        <div className={cn("font-semibold text-text", unread && "text-white")}>{message.from}</div>
        <span className="text-xs tracking-wide text-muted">{formattedTime}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <p className={cn("text-base font-semibold text-text", unread && "text-white")}>{message.subject || "(No subject)"}</p>
        {unread && <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />}
      </div>
      <p className="mt-1 text-sm text-muted line-clamp-1">{message.snippet || "No preview available"}</p>
    </button>
  )
}
