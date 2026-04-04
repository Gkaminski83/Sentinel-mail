"use client"

import Link from "next/link"
import { DragEvent } from "react"

import { Account } from "@/lib/api"

const folders = [
  { id: "inbox", label: "Inbox", glyph: "✉" },
  { id: "starred", label: "Starred", glyph: "★" },
  { id: "sent", label: "Sent", glyph: "↗" },
  { id: "trash", label: "Trash", glyph: "⌫" },
  { id: "spam", label: "Spam", glyph: "⚠" },
]

type SidebarProps = {
  accounts: Account[]
  loadingAccounts?: boolean
  activeAccountFilter: string
  onSelectAccount: (accountId: string) => void
  activeFolder: string
  onSelectFolder: (folderId: string) => void
  errorMessage?: string | null
  currentAdmin?: string | null
  onLogout?: () => void
  onDropMessages?: (folderId: string, messageIds: string[]) => void
}

export function Sidebar({
  accounts,
  loadingAccounts = false,
  activeAccountFilter,
  onSelectAccount,
  activeFolder,
  onSelectFolder,
  errorMessage,
  currentAdmin,
  onLogout,
  onDropMessages,
}: SidebarProps) {
  const extractDraggedMessageIds = (event: DragEvent) => {
    const raw =
      event.dataTransfer.getData("application/x-message-ids") ||
      event.dataTransfer.getData("text/plain")
    if (!raw) {
      return []
    }
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.filter((id): id is string => typeof id === "string")
      }
    } catch {
      // fall through to comma separated parsing
    }
    return raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  }

  const handleFolderDrop = (event: DragEvent, folderId: string) => {
    if (!onDropMessages) return
    event.preventDefault()
    event.stopPropagation()
    const ids = extractDraggedMessageIds(event)
    if (ids.length === 0) {
      return
    }
    onDropMessages(folderId, ids)
  }

  return (
    <aside className="flex h-full w-60 flex-col gap-6 border-r border-white/5 bg-panel/80 px-5 py-6 text-sm text-muted">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Workspace</p>
        <h1 className="text-xl font-semibold text-text">Sentinel Mail</h1>
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/5 px-3 py-2 text-xs text-muted">
          <span className="text-text">{currentAdmin ?? "Admin"}</span>
          <button
            onClick={onLogout}
            className="text-[11px] uppercase tracking-widest text-accent transition hover:text-white"
          >
            Logout
          </button>
        </div>
      </div>

      <nav className="space-y-2">
        <p className="text-xs uppercase tracking-tight text-slate-500">Folders</p>
        {folders.map((folder) => {
          const isActive = folder.id === activeFolder
          return (
            <button
              key={folder.id}
              onClick={() => onSelectFolder(folder.id)}
              onDragOver={(event) => {
                if (!onDropMessages) return
                event.preventDefault()
                event.dataTransfer.dropEffect = "move"
              }}
              onDrop={(event) => handleFolderDrop(event, folder.id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition hover:bg-white/5 ${
                isActive ? "bg-white/10 text-white" : "text-slate-300"
              }`}
            >
              <span className="text-base text-text/70">{folder.glyph}</span>
              <span className="flex-1 text-sm font-medium text-text">{folder.label}</span>
              {isActive && <span className="h-1 w-6 rounded-full bg-accent" aria-hidden />}
            </button>
          )
        })}
      </nav>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-tight text-slate-500">Accounts</p>
            <p className="text-[10px] text-slate-500">Manage IMAP sources</p>
          </div>
          <Link
            href="/settings/accounts"
            className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-wider text-accent transition hover:border-accent/60 hover:text-white"
          >
            Configure
          </Link>
        </div>
        {errorMessage && (
          <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {errorMessage}
          </p>
        )}
        <div className="space-y-2">
          <button
            onClick={() => onSelectAccount("all")}
            className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition hover:bg-white/5 ${
              activeAccountFilter === "all" ? "bg-white/10 text-white" : "text-slate-300"
            }`}
          >
            <span>All accounts</span>
          </button>
          {accounts.map((account) => {
            const isActive = account.id === activeAccountFilter
            return (
              <button
                key={account.id}
                onClick={() => onSelectAccount(account.id)}
                className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition hover:bg-white/5 ${
                  isActive ? "bg-white/10 text-white" : "text-slate-300"
                }`}
              >
                <div>
                  <p className="font-medium text-text">{account.name}</p>
                  <p className="text-xs text-slate-500">{account.username} · {account.imap_host}</p>
                </div>
              </button>
            )
          })}
          {loadingAccounts && (
            <div className="animate-pulse rounded-2xl border border-white/5 px-3 py-6 text-center text-slate-500">
              Loading accounts…
            </div>
          )}
          {!loadingAccounts && accounts.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 px-3 py-6 text-center text-slate-500">
              No accounts configured
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
