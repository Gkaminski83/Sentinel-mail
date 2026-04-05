"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

import { MessageList } from "@/components/message-list"
import { MessageView } from "@/components/message-view"
import { Sidebar } from "@/components/sidebar"
import { ComposePanel, type ComposeDraft, type AttachmentDraft } from "@/components/compose-panel"
import {
  type Account,
  type MessageSummary,
  type MessageDetail,
  ApiError,
  deleteMessages,
  downloadMessageAttachment,
  getAccounts,
  getCurrentAdmin,
  getMessageBody,
  getMessages,
  markMessagesAsSpam,
  moveMessages,
  sendEmail,
  type SendEmailInput,
} from "@/lib/api"
import { clearAuthToken, getAuthToken } from "@/lib/auth"

const COMPOSE_DRAFT_STORAGE_KEY = "sentinel_compose_draft"

type StoredComposeDraft = Partial<Omit<ComposeDraft, "attachments">> & {
  attachments?: Partial<AttachmentDraft>[] | null
}

const createAttachmentId = () => `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

const sanitizeAttachmentDraft = (attachment?: Partial<AttachmentDraft> | null): AttachmentDraft | null => {
  if (!attachment || typeof attachment !== "object" || typeof attachment.base64 !== "string" || !attachment.base64) {
    return null
  }
  return {
    id: typeof attachment.id === "string" && attachment.id.length > 0 ? attachment.id : createAttachmentId(),
    name: typeof attachment.name === "string" && attachment.name.length > 0 ? attachment.name : "attachment",
    size: typeof attachment.size === "number" && Number.isFinite(attachment.size) ? attachment.size : 0,
    type: typeof attachment.type === "string" && attachment.type.length > 0 ? attachment.type : "application/octet-stream",
    base64: attachment.base64,
  }
}

const normalizeComposeDraft = (input?: StoredComposeDraft | null): ComposeDraft => {
  return {
    accountId: typeof input?.accountId === "string" ? input.accountId : "",
    to: typeof input?.to === "string" ? input.to : "",
    cc: typeof input?.cc === "string" ? input.cc : "",
    bcc: typeof input?.bcc === "string" ? input.bcc : "",
    subject: typeof input?.subject === "string" ? input.subject : "",
    body: typeof input?.body === "string" ? input.body : "",
    inReplyTo: typeof input?.inReplyTo === "string" ? input.inReplyTo : null,
    references: Array.isArray(input?.references)
      ? input.references.filter((reference): reference is string => typeof reference === "string" && reference.length > 0)
      : input?.references === null
        ? null
        : undefined,
    attachments: Array.isArray(input?.attachments)
      ? input.attachments
          .map((attachment) => sanitizeAttachmentDraft(attachment))
          .filter((attachment): attachment is AttachmentDraft => Boolean(attachment))
      : [],
  }
}

export default function HomePage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [accountsError, setAccountsError] = useState<string | null>(null)

  const [messages, setMessages] = useState<MessageSummary[]>([])
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [messageActionLoading, setMessageActionLoading] = useState(false)
  const [messageActionError, setMessageActionError] = useState<string | null>(null)

  const [currentAdmin, setCurrentAdmin] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  const [activeAccountFilter, setActiveAccountFilter] = useState("all")
  const [activeFolder, setActiveFolder] = useState("inbox")

  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set())
  const [readMessageIds, setReadMessageIds] = useState<Set<string>>(new Set())

  const [messageDetails, setMessageDetails] = useState<Record<string, MessageDetail>>({})
  const [messageBodyLoading, setMessageBodyLoading] = useState(false)
  const [messageBodyError, setMessageBodyError] = useState<string | null>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeError, setComposeError] = useState<string | null>(null)
  const [composeSending, setComposeSending] = useState(false)
  const [composeDraft, setComposeDraft] = useState<ComposeDraft | null>(null)

  const loadStoredComposeDraft = useCallback(() => {
    if (typeof window === "undefined") {
      return null
    }
    try {
      const raw = window.localStorage.getItem(COMPOSE_DRAFT_STORAGE_KEY)
      if (!raw) {
        return null
      }
      const parsed = JSON.parse(raw) as StoredComposeDraft
      return normalizeComposeDraft(parsed)
    } catch {
      return null
    }
  }, [])

  const persistComposeDraft = useCallback((draftToSave: ComposeDraft) => {
    if (typeof window === "undefined") {
      return
    }
    try {
      window.localStorage.setItem(COMPOSE_DRAFT_STORAGE_KEY, JSON.stringify(draftToSave))
    } catch {
      // ignore quota errors
    }
  }, [])

  const clearStoredComposeDraft = useCallback(() => {
    if (typeof window === "undefined") {
      return
    }
    try {
      window.localStorage.removeItem(COMPOSE_DRAFT_STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

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
      const data = await getMessages({ folder: activeFolder })
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
  }, [handleAuthError, activeFolder])

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
  }, [authChecked, loadAccounts])

  useEffect(() => {
    if (!authChecked) {
      return
    }
    loadMessages()
  }, [authChecked, loadMessages])

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
    setSelectedMessageIds((prev) => {
      if (prev.size === 0) {
        return prev
      }
      const allowed = new Set(filteredMessages.map((message) => message.id))
      const next = new Set<string>()
      prev.forEach((id) => {
        if (allowed.has(id)) {
          next.add(id)
        }
      })
      if (next.size === prev.size) {
        return prev
      }
      return next
    })
  }, [filteredMessages])

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

  const selectedMessageDetail = selectedMessageId
    ? messageDetails[selectedMessageId] ?? null
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
    setSelectedMessageIds(new Set())
    setSelectedMessageId(null)
  }, [])

  const handleRefresh = useCallback(() => {
    loadMessages()
  }, [loadMessages])

  const handleLogout = useCallback(() => {
    clearAuthToken()
    router.replace("/login?redirectTo=/")
  }, [router])

  const cachedMessageDetail = selectedMessageDetail

  const handleToggleSelection = useCallback((messageId: string) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev)
      if (next.has(messageId)) {
        next.delete(messageId)
      } else {
        next.add(messageId)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelectedMessageIds(new Set(filteredMessages.map((message) => message.id)))
  }, [filteredMessages])

  const handleClearSelection = useCallback(() => {
    setSelectedMessageIds(new Set())
  }, [])

  const runMessageAction = useCallback(
    async (ids: string[], action: () => Promise<unknown>) => {
      if (ids.length === 0) {
        return
      }
      setMessageActionLoading(true)
      setMessageActionError(null)
      try {
        await action()
        setSelectedMessageIds((prev) => {
          const next = new Set(prev)
          ids.forEach((id) => next.delete(id))
          return next
        })
        await loadMessages()
      } catch (error) {
        if (!handleAuthError(error)) {
          setMessageActionError(error instanceof Error ? error.message : "Failed to process message action")
        }
      } finally {
        setMessageActionLoading(false)
      }
    },
    [handleAuthError, loadMessages],
  )

  const handleBulkMove = useCallback(
    async (destinationFolder: string, ids?: string[]) => {
      const targetIds = ids ?? Array.from(selectedMessageIds)
      return runMessageAction(targetIds, () =>
        moveMessages({ message_ids: targetIds, destination_folder: destinationFolder }),
      )
    },
    [runMessageAction, selectedMessageIds],
  )

  const handleBulkSpam = useCallback(
    async (ids?: string[]) => {
      const targetIds = ids ?? Array.from(selectedMessageIds)
      return runMessageAction(targetIds, () => markMessagesAsSpam({ message_ids: targetIds }))
    },
    [runMessageAction, selectedMessageIds],
  )

  const handleBulkDelete = useCallback(
    async (options?: { permanent?: boolean; ids?: string[] }) => {
      const targetIds = options?.ids ?? Array.from(selectedMessageIds)
      return runMessageAction(targetIds, () =>
        deleteMessages({ message_ids: targetIds, permanent: options?.permanent ?? false }),
      )
    },
    [runMessageAction, selectedMessageIds],
  )

  const handleDropMessages = useCallback(
    async (folderId: string, ids: string[]) => {
      await handleBulkMove(folderId, ids)
    },
    [handleBulkMove],
  )

  const handleCurrentDelete = useCallback(
    (options?: { permanent?: boolean }) => {
      if (!selectedMessageId) return Promise.resolve()
      return handleBulkDelete({ ...options, ids: [selectedMessageId] })
    },
    [handleBulkDelete, selectedMessageId],
  )

  const handleCurrentSpam = useCallback(() => {
    if (!selectedMessageId) return Promise.resolve()
    return handleBulkSpam([selectedMessageId])
  }, [handleBulkSpam, selectedMessageId])

  const handleCurrentMove = useCallback(
    (folder: string) => {
      if (!selectedMessageId) return Promise.resolve()
      return handleBulkMove(folder, [selectedMessageId])
    },
    [handleBulkMove, selectedMessageId],
  )

  useEffect(() => {
    const messageId = selectedMessageId
    if (!messageId) {
      setMessageBodyLoading(false)
      setMessageBodyError(null)
      return
    }

    if (cachedMessageDetail) {
      setMessageBodyLoading(false)
      setMessageBodyError(null)
      return
    }

    let cancelled = false
    setMessageBodyLoading(true)
    setMessageBodyError(null)

    getMessageBody(messageId)
      .then((detail) => {
        if (cancelled) return
        setMessageDetails((prev) => {
          if (prev[messageId]) {
            return prev
          }
          return { ...prev, [messageId]: detail }
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
  }, [selectedMessageId, cachedMessageDetail])

  useEffect(() => {
    setAttachmentError(null)
  }, [selectedMessageId])

  const openCompose = useCallback(() => {
    setComposeDraft(loadStoredComposeDraft())
    setComposeError(null)
    setComposeOpen(true)
  }, [loadStoredComposeDraft])

  const openReply = useCallback(() => {
    if (!selectedMessage || !selectedMessageDetail) {
      return
    }
    setComposeError(null)
    const replyDraft: ComposeDraft = {
      accountId: selectedMessage.account_id,
      to: selectedMessage.from,
      cc: "",
      bcc: "",
      subject: selectedMessage.subject.startsWith("Re:")
        ? selectedMessage.subject
        : `Re: ${selectedMessage.subject}`,
      body: `\n\nOn ${new Date(selectedMessage.date).toLocaleString()}, ${selectedMessage.from} wrote:\n${selectedMessageDetail.text_body}`,
      inReplyTo: selectedMessageDetail.id,
      references: [selectedMessageDetail.id],
      attachments: [],
    }
    setComposeDraft(replyDraft)
    setComposeOpen(true)
  }, [selectedMessage, selectedMessageDetail])

  const closeCompose = useCallback(() => {
    if (composeSending) return
    setComposeOpen(false)
  }, [composeSending])

  const parseRecipients = useCallback((value: string) => {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((email) => ({ email }))
  }, [])

  const handleSendEmail = useCallback(
    async (draftPayload: ComposeDraft) => {
      if (composeSending) return
      setComposeSending(true)
      setComposeError(null)
      const payload: SendEmailInput = {
        account_id: draftPayload.accountId,
        to: parseRecipients(draftPayload.to),
        cc: parseRecipients(draftPayload.cc),
        bcc: parseRecipients(draftPayload.bcc),
        subject: draftPayload.subject,
        text_body: draftPayload.body,
        in_reply_to: draftPayload.inReplyTo,
        references: draftPayload.references ?? undefined,
        attachments:
          draftPayload.attachments.length > 0
            ? draftPayload.attachments.map((attachment) => ({
                filename: attachment.name,
                content_type: attachment.type,
                content_base64: attachment.base64,
              }))
            : undefined,
      }
      try {
        await sendEmail(payload)
        setComposeSending(false)
        setComposeOpen(false)
        setComposeDraft(null)
        clearStoredComposeDraft()
        if (activeFolder === "sent") {
          loadMessages()
        }
      } catch (error) {
        setComposeSending(false)
        if (!handleAuthError(error)) {
          setComposeError(error instanceof Error ? error.message : "Failed to send message")
        }
      }
    },
    [activeFolder, composeSending, handleAuthError, loadMessages, parseRecipients],
  )

  const handleComposeDraftChange = useCallback(
    (draftPayload: ComposeDraft) => {
      persistComposeDraft(draftPayload)
    },
    [persistComposeDraft],
  )

  const handleDownloadAttachment = useCallback(
    async (attachmentId: string) => {
      if (!selectedMessageId) {
        return
      }
      try {
        setAttachmentError(null)
        const { blob, filename } = await downloadMessageAttachment(selectedMessageId, attachmentId)
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = filename ?? attachmentId
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      } catch (error) {
        if (!handleAuthError(error)) {
          setAttachmentError(error instanceof Error ? error.message : "Failed to download attachment")
        }
      }
    },
    [handleAuthError, selectedMessageId],
  )

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
          onDropMessages={handleDropMessages}
        />
        <MessageList
          messages={filteredMessages}
          loading={messagesLoading}
          selectedId={selectedMessageId}
          onSelect={handleSelectMessage}
          unreadMessageIds={unreadMessageIds}
          onRefresh={handleRefresh}
          error={messagesError}
          selectedMessageIds={selectedMessageIds}
          onToggleSelect={handleToggleSelection}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
          onMoveSelected={handleBulkMove}
          onDeleteSelected={handleBulkDelete}
          onSpamSelected={handleBulkSpam}
          actionLoading={messageActionLoading}
          actionError={messageActionError}
          activeFolder={activeFolder}
        />
        <MessageView
          message={selectedMessage}
          detail={selectedMessageDetail}
          loading={messageBodyLoading}
          error={messageBodyError}
          attachmentError={attachmentError}
          activeFolder={activeFolder}
          actionLoading={messageActionLoading}
          onDelete={handleCurrentDelete}
          onSpam={handleCurrentSpam}
          onMove={handleCurrentMove}
          onDownloadAttachment={handleDownloadAttachment}
          onReply={openReply}
        />
        <button
          type="button"
          className="fixed bottom-8 right-10 z-30 rounded-full border border-accent/40 bg-accent/20 px-6 py-3 text-sm uppercase tracking-[0.3em] text-white shadow-lg transition hover:bg-accent/30"
          onClick={openCompose}
        >
          Compose
        </button>
        <ComposePanel
          open={composeOpen}
          accounts={accounts}
          initialDraft={composeDraft}
          sending={composeSending}
          error={composeError}
          onClose={closeCompose}
          onSubmit={handleSendEmail}
          onDraftChange={handleComposeDraftChange}
        />
      </div>
    </div>
  )
}
