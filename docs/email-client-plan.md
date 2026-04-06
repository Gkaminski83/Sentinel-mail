# Sentinel Mail – Web Email Client Feature Plan

## Status Legend
- ✅ Completed (implemented and verified)
- 🟡 In Progress (partially implemented or being built)
- ⬜ Not Started (planned / future work)

## 1. Authentication & Access Control
| Feature | Status | Notes |
| --- | --- | --- |
| Admin login via `/auth/login` using `ADMIN_USERNAME`/`ADMIN_PASSWORD` | ✅ | Backend issues 24h JWT tokens (PyJWT). |
| Frontend login page with dark UI, loading/error states | ✅ | `/login` route stores token in `localStorage` + cookie, handles redirects. |
| Protected API consumption & route guarding | ✅ | Next.js middleware checks token cookie; frontend fetch helper injects bearer header. |
| Logout control | ✅ | Sidebar exposes logout action clearing token + redirect. |
| Multi-user / per-tenant auth model | ⬜ | Currently single admin credential. |
| Role-based access (reader vs admin) | ⬜ | Not implemented. |
| MFA / hardware key support | ⬜ | Not implemented. |
| Audit logging for auth events | ⬜ | No audit trail yet. |

## 2. Inbox & Message Consumption
| Feature | Status | Notes |
| --- | --- | --- |
| Fetch accounts from backend + display in sidebar | ✅ | Uses `/accounts`, shows workspace + account filter. |
| Folder navigation (Inbox, Starred, Sent, Trash) | ✅ | UI toggles folder tabs; backend still returns inbox data only. |
| Message list with unread indicators & hover states | ✅ | `MessageList` + `MessageItem` components show metadata, caching read state locally. |
| Message selection & detailed view | ✅ | `MessageView` fetches body lazily via `/messages/{id}` with caching & skeletons. |
| Account filtering of messages | ✅ | Filters by selected account email. |
| Auto-refresh / manual refresh control | ✅ | Refresh button triggers `getMessages()`. |
| Loading + error states across list/view | ✅ | Implemented across components. |
| Pagination / infinite scroll | ✅ | Server-side pagination with prev/next controls, totals, and query params. |
| Threaded conversation view | ⬜ | Not implemented. |
| Rich rendering of attachments / inline images | 🟡 | HTML body rendering + attachment list/download shipped; inline images still pending. |

## 3. Message Composition & Sending
| Feature | Status | Notes |
| --- | --- | --- |
| Compose new email UI | ✅ | Full-screen composer with account switcher, recipients, subject/body, and attachment controls. |
| Draft saving & autosave | ⬜ | Not implemented. |
| Send via SMTP / provider API | 🟡 | SMTP service + send endpoint wired from frontend; delivery telemetry + retries pending. |
| Reply / Reply-all / Forward | 🟡 | Single-message reply supported from detail view; reply-all/forward still pending. |
| Signature management | ⬜ | Not available. |
| Attachment upload & sending | ✅ | Compose UI supports up to 5×5MB files with validation, sent via SMTP payload. |

## 4. Search, Filtering & Organization
| Feature | Status | Notes |
| --- | --- | --- |
| Keyword search (server-side or local) | ✅ | Backend filters subject/sender/snippet/account; UI exposes search bar. |
| Advanced filters (date, sender, has attachment) | ⬜ | Not implemented. |
| Labels / tags | ⬜ | Not implemented. |
| Rules / automations (move, mark, notify) | ⬜ | Not implemented. |
| Snooze / reminders | ⬜ | Not implemented. |

## 5. Notifications & Presence
| Feature | Status | Notes |
| --- | --- | --- |
| Real-time updates (WebSocket, SSE, IMAP IDLE) | ⬜ | Currently manual refresh only. |
| Desktop / push notifications | ⬜ | Not implemented. |
| Mobile-responsive layout | 🟡 | Layout responsive but needs dedicated QA + gestures. |

## 6. Settings & Personalization
| Feature | Status | Notes |
| --- | --- | --- |
| Theme customization (colors, density) | ⬜ | Only fixed Sentinel theme. |
| Keyboard shortcuts | ⬜ | Not implemented. |
| Localization / i18n | ⬜ | En-US hardcoded. |
| Accessibility pass (focus states, aria) | 🟡 | Base focus styles exist; full audit pending. |

## 7. Account & Admin Operations
| Feature | Status | Notes |
| --- | --- | --- |
| Backend config endpoints for IMAP accounts | ✅ | `/admin/accounts` CRUD protected by JWT. |
| Admin UI for account CRUD | ⬜ | Only backend endpoints exist; no frontend surface yet. |
| Secrets management (per-account credentials) | 🟡 | Stored via config service; needs vault/integration. |
| Audit log / change history | ⬜ | Not tracked. |

## 8. Observability, Reliability & Ops
| Feature | Status | Notes |
| --- | --- | --- |
| Health checks for backend/frontend | ⬜ | No dedicated `/health` endpoint. |
| Structured logging + tracing | ⬜ | Minimal logging only. |
| Error reporting (Sentry, etc.) | ⬜ | Not integrated. |
| Metrics / monitoring dashboards | ⬜ | Not set up. |
| Backup / restore of account config | ⬜ | Manual via file edits only. |

## 9. Integrations & Platform
| Feature | Status | Notes |
| --- | --- | --- |
| API client for third-party actions (Slack, CRM) | ⬜ | No integrations yet. |
| Mobile / desktop apps | ⬜ | Web-only experience. |
| Import/export (MBOX, EML) | ⬜ | Not supported. |

## 10. Documentation & Tooling
| Feature | Status | Notes |
| --- | --- | --- |
| Developer onboarding docs | 🟡 | Basic README exists; needs Sentinel-specific guide. |
| User-facing guide / handbook | ⬜ | Not written. |
| Automated tests (unit/e2e) | ⬜ | No dedicated test suites. |

---
**Next Steps Suggestions**
1. Prioritize sending/compose pipeline to reach feature parity with standard clients.
2. Add search & pagination to improve usability for larger inboxes.
3. Build admin UI over `/admin/accounts` for non-developer management.
4. Plan observability + health checks before production rollout.
