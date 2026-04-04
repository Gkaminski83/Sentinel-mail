"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

import {
  type Account,
  type CreateAccountInput,
  type TestAccountResult,
  type UpdateAccountInput,
  ApiError,
  createAccount,
  deleteAccount,
  getAccounts,
  testAccountConnection,
  updateAccount,
} from "@/lib/api"
import { clearAuthToken, getAuthToken } from "@/lib/auth"

type AccountFormState = {
  name: string
  email: string
  imap_host: string
  imap_port: number
  username: string
  password: string
  secure: boolean
  enabled: boolean
  smtp_host: string
  smtp_port: number
  smtp_username: string
  smtp_password: string
  smtp_secure: boolean
  smtp_enabled: boolean
  smtp_from_name: string
  smtp_from_email: string
}

const DEFAULT_FORM: AccountFormState = {
  name: "",
  email: "",
  imap_host: "",
  imap_port: 993,
  username: "",
  password: "",
  secure: true,
  enabled: true,
  smtp_host: "",
  smtp_port: 587,
  smtp_username: "",
  smtp_password: "",
  smtp_secure: true,
  smtp_enabled: false,
  smtp_from_name: "",
  smtp_from_email: "",
}

export default function AccountSettingsPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<AccountFormState>(DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<TestAccountResult | null>(null)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  const handleAuthError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        clearAuthToken()
        router.replace("/login?redirectTo=/settings/accounts")
        return true
      }
      return false
    },
    [router],
  )

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const data = await getAccounts()
      setAccounts(data)
    } catch (error) {
      if (!handleAuthError(error)) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to load accounts")
      }
    } finally {
      setLoading(false)
    }
  }, [handleAuthError])

  useEffect(() => {
    if (!getAuthToken()) {
      router.replace("/login?redirectTo=/settings/accounts")
      return
    }
    loadAccounts()
  }, [router, loadAccounts])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : type === "number" ? Number(value) : value,
    }))
    setTestResult(null)
  }

  const buildPayload = (): UpdateAccountInput => {
    const smtpPayloadProvided = Boolean(
      form.smtp_enabled ||
        form.smtp_host ||
        form.smtp_port !== DEFAULT_FORM.smtp_port ||
        form.smtp_username ||
        form.smtp_password ||
        form.smtp_from_name ||
        form.smtp_from_email ||
        form.smtp_secure !== DEFAULT_FORM.smtp_secure,
    )

    const smtpPayload = smtpPayloadProvided
      ? {
          host: form.smtp_host || undefined,
          port: form.smtp_port || DEFAULT_FORM.smtp_port,
          username: form.smtp_username || undefined,
          password: form.smtp_password || undefined,
          secure: form.smtp_secure,
          enabled: form.smtp_enabled,
          from_name: form.smtp_from_name || undefined,
          from_email: form.smtp_from_email || undefined,
        }
      : undefined

    const payload: UpdateAccountInput = {
      name: form.name,
      email: form.email || undefined,
      imap_host: form.imap_host,
      imap_port: form.imap_port,
      username: form.username,
      secure: form.secure,
      enabled: form.enabled,
      ...(smtpPayload ? { smtp: smtpPayload } : {}),
    }

    if (form.password) {
      payload.password = form.password
    }

    return payload
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingAccount && !form.password) {
      setErrorMessage("Password is required when creating a new account")
      return
    }
    if (form.smtp_enabled && !form.smtp_host) {
      setErrorMessage("SMTP host is required when SMTP is enabled")
      return
    }
    setSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    setTestResult(null)
    try {
      const basePayload = buildPayload()

      if (editingAccount) {
        await updateAccount(editingAccount.id, basePayload)
        setSuccessMessage("Account updated")
      } else {
        const createPayload: CreateAccountInput = {
          name: form.name,
          email: basePayload.email,
          imap_host: form.imap_host,
          imap_port: form.imap_port,
          username: form.username,
          password: form.password as string,
          secure: basePayload.secure ?? true,
          enabled: basePayload.enabled ?? true,
          smtp: basePayload.smtp,
        }
        await createAccount(createPayload)
        setSuccessMessage("Account added successfully")
      }
      setForm(DEFAULT_FORM)
      setEditingAccount(null)
      loadAccounts()
    } catch (error) {
      if (!handleAuthError(error)) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to add account")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleTestConnection = async () => {
    if (!form.imap_host || !form.username) {
      setErrorMessage("IMAP host and username are required to test the connection")
      return
    }
    if (!editingAccount && !form.password) {
      setErrorMessage("Password is required to test a new account")
      return
    }
    if (form.smtp_enabled && !form.smtp_host) {
      setErrorMessage("Provide SMTP host or disable SMTP before testing")
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setTestingConnection(true)
    setTestResult(null)
    try {
      const payload = buildPayload()
      const result = await testAccountConnection({
        ...payload,
        account_id: editingAccount?.id,
      })
      setTestResult(result)
    } catch (error) {
      if (!handleAuthError(error)) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to test account")
      }
    } finally {
      setTestingConnection(false)
    }
  }

  const handleDelete = async (account: Account) => {
    if (!window.confirm(`Remove ${account.name}?`)) {
      return
    }
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      await deleteAccount(account.id)
      setSuccessMessage("Account removed")
      loadAccounts()
    } catch (error) {
      if (!handleAuthError(error)) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to remove account")
      }
    }
  }

  const handleEdit = (account: Account) => {
    setEditingAccount(account)
    setSuccessMessage(null)
    setErrorMessage(null)
    setTestResult(null)
    setForm({
      name: account.name ?? "",
      email: account.email ?? "",
      imap_host: account.imap_host ?? "",
      imap_port: account.imap_port ?? 993,
      username: account.username ?? "",
      password: "",
      secure: account.secure ?? true,
      enabled: account.enabled ?? true,
      smtp_host: account.smtp_host ?? "",
      smtp_port: account.smtp_port ?? DEFAULT_FORM.smtp_port,
      smtp_username: account.smtp_username ?? "",
      smtp_password: "",
      smtp_secure: account.smtp_secure ?? true,
      smtp_enabled: account.smtp_enabled ?? false,
      smtp_from_name: account.smtp_from_name ?? "",
      smtp_from_email: account.smtp_from_email ?? "",
    })
  }

  const handleCancelEdit = () => {
    setEditingAccount(null)
    setForm(DEFAULT_FORM)
    setSuccessMessage(null)
    setErrorMessage(null)
    setTestResult(null)
  }

  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => a.name.localeCompare(b.name))
  }, [accounts])

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-text sm:px-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-[0.45em] text-muted">Settings</p>
            <h1 className="text-3xl font-semibold text-text">IMAP Accounts</h1>
            <p className="text-sm text-muted">
              Add or remove upstream mailbox credentials. Passwords are encrypted at rest.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-muted transition hover:border-accent/70 hover:text-white"
          >
            ← Inbox
          </Link>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-white/5 bg-panel/80 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.35)]">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text">Connected accounts</h2>
              {loading ? (
                <span className="text-xs text-muted">Loading…</span>
              ) : (
                <span className="text-xs text-muted">{sortedAccounts.length} configured</span>
              )}
            </div>
            {errorMessage && (
              <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {successMessage}
              </div>
            )}
            <div className="space-y-4">
              {loading && (
                <div className="rounded-2xl border border-white/5 px-4 py-10 text-center text-muted">
                  Fetching accounts…
                </div>
              )}
              {!loading && sortedAccounts.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-muted">
                  No accounts yet. Use the form to add one.
                </div>
              )}
              {!loading &&
                sortedAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between rounded-2xl border border-white/5 bg-background/40 px-4 py-4"
                  >
                    <div>
                      <p className="text-base font-semibold text-text">{account.name}</p>
                      <p className="text-xs text-muted">
                        {account.username} · {account.imap_host}:{account.imap_port} · {account.secure ? "SSL" : "Plain"}
                      </p>
                      <p className="text-xs text-muted">Password: ••••••••</p>
                      <p className="text-xs text-muted">
                        SMTP: {account.smtp_enabled ? `${account.smtp_host ?? "?"}:${account.smtp_port ?? "-"}` : "Disabled"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(account)}
                        className="rounded-2xl border border-accent/40 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-accent transition hover:border-accent hover:bg-accent/10"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(account)}
                        className="rounded-2xl border border-red-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-red-200 transition hover:border-red-500 hover:bg-red-500/10"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/5 bg-panel/80 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.35)]">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text">
                  {editingAccount ? "Update account" : "Add account"}
                </h2>
                <p className="text-xs uppercase tracking-[0.4em] text-muted">Credentials stay encrypted</p>
              </div>
              {editingAccount && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs uppercase tracking-[0.4em] text-muted transition hover:text-white"
                >
                  Cancel
                </button>
              )}
            </div>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted">Display name</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-text outline-none transition focus:border-accent"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted">From email (optional)</label>
                <input
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-text outline-none transition focus:border-accent"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted">IMAP host</label>
                <input
                  name="imap_host"
                  value={form.imap_host}
                  onChange={handleChange}
                  required
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-text outline-none transition focus:border-accent"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted">IMAP port</label>
                  <input
                    type="number"
                    name="imap_port"
                    value={form.imap_port}
                    onChange={handleChange}
                    min={1}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-text outline-none transition focus:border-accent"
                  />
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 px-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted">Secure (SSL)</p>
                    <p className="text-xs text-muted">Recommended</p>
                  </div>
                  <input
                    type="checkbox"
                    name="secure"
                    checked={form.secure}
                    onChange={handleChange}
                    className="h-5 w-5 rounded border-white/40 bg-background text-accent focus:ring-accent"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted">Account enabled</p>
                  <p className="text-xs text-muted">Disable to pause syncing</p>
                </div>
                <input
                  type="checkbox"
                  name="enabled"
                  checked={form.enabled}
                  onChange={handleChange}
                  className="h-5 w-5 rounded border-white/40 bg-background text-accent focus:ring-accent"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted">Username</label>
                <input
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  required
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-text outline-none transition focus:border-accent"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted">Password</label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  required={!editingAccount}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-text outline-none transition focus:border-accent"
                />
                {editingAccount && (
                  <p className="mt-2 text-xs text-muted">Leave blank to keep the current password.</p>
                )}
              </div>

              <div className="mt-8 space-y-4 rounded-3xl border border-white/5 bg-background/20 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-text">Outgoing SMTP</p>
                    <p className="text-xs text-muted">Configure sending credentials</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted">
                    Enabled
                    <input
                      type="checkbox"
                      name="smtp_enabled"
                      checked={form.smtp_enabled}
                      onChange={handleChange}
                      className="h-5 w-5 rounded border-white/40 bg-background text-accent focus:ring-accent"
                    />
                  </label>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-widest text-muted">SMTP host</label>
                    <input
                      name="smtp_host"
                      value={form.smtp_host}
                      onChange={handleChange}
                      placeholder="smtp.example.com"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-text outline-none transition focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-muted">SMTP port</label>
                    <input
                      type="number"
                      name="smtp_port"
                      value={form.smtp_port}
                      onChange={handleChange}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-text outline-none transition focus:border-accent"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-widest text-muted">SMTP username</label>
                    <input
                      name="smtp_username"
                      value={form.smtp_username}
                      onChange={handleChange}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-text outline-none transition focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-muted">SMTP password</label>
                    <input
                      type="password"
                      name="smtp_password"
                      value={form.smtp_password}
                      onChange={handleChange}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-text outline-none transition focus:border-accent"
                    />
                    {editingAccount && (
                      <p className="mt-2 text-xs text-muted">Leave blank to keep the current SMTP password.</p>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-widest text-muted">From name</label>
                    <input
                      name="smtp_from_name"
                      value={form.smtp_from_name}
                      onChange={handleChange}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-text outline-none transition focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-muted">From email</label>
                    <input
                      name="smtp_from_email"
                      value={form.smtp_from_email}
                      onChange={handleChange}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-text outline-none transition focus:border-accent"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted">Secure (TLS)</p>
                    <p className="text-xs text-muted">Use STARTTLS/SSL when available</p>
                  </div>
                  <input
                    type="checkbox"
                    name="smtp_secure"
                    checked={form.smtp_secure}
                    onChange={handleChange}
                    className="h-5 w-5 rounded border-white/40 bg-background text-accent focus:ring-accent"
                  />
                </div>
              </div>
              {testResult && (
                <div className="rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-sm">
                  <p className="mb-1 text-xs uppercase tracking-[0.3em] text-muted">Connection test</p>
                  <p className={`text-sm ${testResult.imap_success ? "text-emerald-300" : "text-red-300"}`}>
                    IMAP: {testResult.imap_success ? "Success" : testResult.imap_error || "Failed"}
                  </p>
                  {testResult.smtp_error !== "SMTP not configured" || testResult.smtp_success ? (
                    <p className={`text-sm ${testResult.smtp_success ? "text-emerald-300" : "text-red-300"}`}>
                      SMTP: {testResult.smtp_success ? "Success" : testResult.smtp_error || "Failed"}
                    </p>
                  ) : (
                    <p className="text-sm text-muted">SMTP: Not configured</p>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection || submitting}
                  className="w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold uppercase tracking-widest text-text transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {testingConnection ? "Testing…" : "Test connection"}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold uppercase tracking-widest text-background transition hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Saving…" : editingAccount ? "Update account" : "Add account"}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}
