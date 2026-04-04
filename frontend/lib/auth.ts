export const TOKEN_KEY = "sentinel_auth_token"

const isBrowser = () => typeof window !== "undefined"

export function getAuthToken(): string | null {
  if (!isBrowser()) {
    return null
  }
  return localStorage.getItem(TOKEN_KEY)
}

export function setAuthToken(token: string) {
  if (!isBrowser()) {
    return
  }
  localStorage.setItem(TOKEN_KEY, token)
  document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=86400; sameSite=Lax`
}

export function clearAuthToken() {
  if (!isBrowser()) {
    return
  }
  localStorage.removeItem(TOKEN_KEY)
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0; sameSite=Lax`
}
