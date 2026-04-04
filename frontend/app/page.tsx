"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

import { MessageList } from "@/components/message-list"
import { MessageView } from "@/components/message-view"
import { Sidebar } from "@/components/sidebar"
import {
  type Account,
  type MessageSummary,
  ApiError,
  getAccounts,
  getCurrentAdmin,
  getMessageBody,
  getMessages,
} from "@/lib/api"
import { clearAuthToken, getAuthToken } from "@/lib/auth"

export default function HomePage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [accountsError, setAccountsError] = useState<string | null>(null)

  const [messages, setMessages] = useState<MessageSummary[]>([])
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [messagesError, setMessagesError] = useState<string | null>(null)

  const [currentAdmin, setCurrentAdmin] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  const [activeAccountFilter, setActiveAccountFilter] = useState("all")
  const [activeFolder, setActiveFolder] = useState("inbox")

  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [readMessageIds, setReadMessageIds] = useState<Set<string>>(new Set())

  const [messageBodies, setMessageBodies] = useState<Record<string, string>>({})
  const [messageBodyLoading, setMessageBodyLoading] = useState(false)
  const [messageBodyError, setMessageBodyError] = useState<string | null>(null)

  const handleAuthError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        clearAuthToken()
        router.replace("/login?redirectTo=/")
        return true
      }
      return false
    },
    [router],
  )

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true)
    setAccountsError(null)
    try {
      const data = await getAccounts()
      setAccounts(data)
    } catch (error) {
      if (handleAuthError(error)) {
        return
      }
      setAccountsError(error instanceof Error ? error.message : "Failed to load accounts")
    } finally {
      setAccountsLoading(false)
    }
  }, [handleAuthError])

  const loadMessages = useCallback(async () => {
    setMessagesLoading(true)
    setMessagesError(null)
    try {
      const data = await getMessages()
      setMessages(data)
      setReadMessageIds((prev) => {
        const next = new Set<string>()
        data.forEach((message) => {
          if (prev.has(message.id)) {
            next.add(message.id)
          }
        })
        return next
      })
    } catch (error) {
      if (handleAuthError(error)) {
        return
      }
      setMessagesError(error instanceof Error ? error.message : "Failed to load messages")
    } finally {
      setMessagesLoading(false)
    }
  }, [handleAuthError])

  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      router.replace("/login?redirectTo=/")
      return
    }

    let cancelled = false

    getCurrentAdmin()
      .then((data) => {
        if (cancelled) return
        setCurrentAdmin(data.username)
        setAuthChecked(true)
      })
      .catch((error) => {
        if (cancelled) return
        if (!handleAuthError(error)) {
          setAccountsError(error instanceof Error ? error.message : "Failed to validate session")
        }
      })

    return () => {
      cancelled = true
    }
  }, [router, handleAuthError])

  useEffect(() => {
    if (!authChecked) {
      return
    }
    loadAccounts()
    loadMessages()
  }, [authChecked, loadAccounts, loadMessages])

  const selectedAccountId = useMemo(() => {
    if (activeAccountFilter === "all") {
      return null
    }
    return accounts.find((account) => account.id === activeAccountFilter)?.id ?? null
  }, [accounts, activeAccountFilter])

  const filteredMessages = useMemo(() => {
    if (!selectedAccountId) {
      return messages
    }
    return messages.filter((message) => message.account_id === selectedAccountId)
  }, [messages, selectedAccountId])

  useEffect(() => {
    if (filteredMessages.length === 0) {
      setSelectedMessageId(null)
      return
    }

    if (!selectedMessageId || !filteredMessages.some((message) => message.id === selectedMessageId)) {
      setSelectedMessageId(filteredMessages[0].id)
    }
  }, [filteredMessages, selectedMessageId])

  const selectedMessage = selectedMessageId
    ? messages.find((message) => message.id === selectedMessageId) ?? null
    : null

  const selectedMessageBody = selectedMessageId
    ? messageBodies[selectedMessageId] ?? null
    : null

  const unreadMessageIds = useMemo(() => {
    const unread = new Set<string>()
    messages.forEach((message) => {
      if (!readMessageIds.has(message.id)) {
        unread.add(message.id)
      }
    })
    return unread
  }, [messages, readMessageIds])

  const handleSelectMessage = useCallback((messageId: string) => {
    setSelectedMessageId(messageId)
    setReadMessageIds((prev) => {
      if (prev.has(messageId)) {
        return prev
      }
      const next = new Set(prev)
      next.add(messageId)
      return next
    })
  }, [])

  const handleAccountFilterChange = useCallback((accountId: string) => {
    setActiveAccountFilter(accountId)
  }, [])

  const handleFolderChange = useCallback((folderId: string) => {
    setActiveFolder(folderId)
  }, [])

  const handleRefresh = useCallback(() => {
    loadMessages()
  }, [loadMessages])

  const handleLogout = useCallback(() => {
    clearAuthToken()
    router.replace("/login?redirectTo=/")
  }, [router])

  const cachedMessageBody = selectedMessageBody

  useEffect(() => {
    const messageId = selectedMessageId
    if (!messageId) {
      setMessageBodyLoading(false)
      setMessageBodyError(null)
      return
    }

    if (cachedMessageBody) {
      setMessageBodyLoading(false)
      setMessageBodyError(null)
      return
    }

    let cancelled = false
    setMessageBodyLoading(true)
    setMessageBodyError(null)

    getMessageBody(messageId)
      .then(({ body }) => {
        if (cancelled) return
        setMessageBodies((prev) => {
          if (prev[messageId]) {
            return prev
          }
          return { ...prev, [messageId]: body }
        })
        setMessageBodyLoading(false)
      })
      .catch((error) => {
        if (cancelled) return
        setMessageBodyError(error instanceof Error ? error.message : "Failed to load message body")
        setMessageBodyLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedMessageId, cachedMessageBody])

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted">
        Initializing secure workspace…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 text-text sm:px-8 sm:py-10">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-[1600px] flex-1 overflow-hidden rounded-[32px] border border-white/5 bg-panel/80 shadow-[0_40px_160px_rgba(0,0,0,0.45)] backdrop-blur-3xl">
        <Sidebar
          accounts={accounts}
          loadingAccounts={accountsLoading}
          activeAccountFilter={activeAccountFilter}
          onSelectAccount={handleAccountFilterChange}
          activeFolder={activeFolder}
          onSelectFolder={handleFolderChange}
          errorMessage={accountsError}
          currentAdmin={currentAdmin}
          onLogout={handleLogout}
        />
        <MessageList
          messages={filteredMessages}
          loading={messagesLoading}
          selectedId={selectedMessageId}
          onSelect={handleSelectMessage}
          unreadMessageIds={unreadMessageIds}
          onRefresh={handleRefresh}
          error={messagesError}
        />
        <MessageView
          message={selectedMessage}
          body={selectedMessageBody}
          loading={messageBodyLoading}
          error={messageBodyError}
        />
      </div>
    </div>
  )
}
