"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

import {
  type Account,
  ApiError,
  createAccount,
  deleteAccount,
  getAccounts,
} from "@/lib/api"
import { clearAuthToken, getAuthToken } from "@/lib/auth"

const DEFAULT_FORM = {
  name: "",
  imap_host: "",
  imap_port: 993,
  username: "",
  password: "",
  secure: true,
}

export default function AccountSettingsPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      await createAccount(form)
      setForm(DEFAULT_FORM)
      setSuccessMessage("Account added successfully")
      loadAccounts()
    } catch (error) {
      if (!handleAuthError(error)) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to add account")
      }
    } finally {
      setSubmitting(false)
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

  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => a.name.localeCompare(b.name))
  }, [accounts])

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-text sm:px-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.45em] text-muted">Settings</p>
          <h1 className="text-3xl font-semibold text-text">IMAP Accounts</h1>
          <p className="text-sm text-muted">Add or remove upstream mailbox credentials. Passwords are encrypted at rest.</p>
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
                    </div>
                    <button
                      onClick={() => handleDelete(account)}
                      className="rounded-2xl border border-red-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-red-200 transition hover:border-red-500 hover:bg-red-500/10"
                    >
                      Remove
                    </button>
                  </div>
                ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/5 bg-panel/80 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.35)]">
            <h2 className="text-lg font-semibold text-text">Add account</h2>
            <p className="mb-6 text-xs uppercase tracking-[0.4em] text-muted">Credentials stay encrypted</p>
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
                  required
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-text outline-none transition focus:border-accent"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold uppercase tracking-widest text-background transition hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Saving…" : "Add account"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}
