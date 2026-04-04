"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { getAuthToken, setAuthToken } from "@/lib/auth"
import { login } from "@/lib/api"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirectTo") ?? "/"

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (getAuthToken()) {
      router.replace(redirectTo)
    }
  }, [router, redirectTo])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await login(username, password)
      setAuthToken(response.token)
      router.replace(redirectTo)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-panel/90 px-8 py-10 shadow-[0_20px_80px_rgba(0,0,0,0.45)]"
      >
        <h1 className="text-center text-2xl font-semibold text-text">Sentinel Mail</h1>
        <p className="mb-8 text-center text-sm text-muted">Secure access to your command center</p>

        {error && <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}

        <label className="block text-xs uppercase tracking-widest text-muted">Username</label>
        <input
          className="mb-4 mt-2 w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-text outline-none transition focus:border-accent"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />

        <label className="block text-xs uppercase tracking-widest text-muted">Password</label>
        <input
          type="password"
          className="mb-6 mt-2 w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-text outline-none transition focus:border-accent"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-background transition hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  )
}
