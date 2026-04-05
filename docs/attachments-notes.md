# Compose Attachments – Current Capabilities & Next UX Steps

## Verified Capabilities (Apr 2026)
- **Selection**: Multiple file picker wired to the compose panel (`ComposePanel`).
- **Limit enforcement**: Up to **5 files**, each **≤ 5 MB**; oversize files are rejected with inline messaging.
- **Formats**: Any MIME type accepted; defaulted to `application/octet-stream` when missing.
- **Preview list**: Users see file name, size (human readable), and type before sending.
- **Removal controls**: Per-file remove action plus a “Clear all” shortcut.
- **Validation feedback**: Non-blocking warning pill for limits/oversize errors; disabled picker button when cap reached.
- **Transmission**: Files are read as base64 in the browser and sent via `sendEmail` → `/messages/send` (SMTP service attaches MIME parts).
- **Reply flow**: Replies inherit clean draft state with empty attachment list but can add files before sending.

## UX / Interaction Details
| Area | Behavior |
| --- | --- |
| Picker state | Hidden `<input type="file" multiple>` triggered via “Add files”. Disabled during send or when limit reached. |
| Draft persistence | Attachments stored inside `ComposeDraft.attachments`; reset on close/send to avoid stale data. |
| Error messaging | Local warning highlights which files were removed (oversize) or when limit exceeded. |
| Accessibility | Attachment list announces updates via `aria-live="polite"`; controls remain keyboard reachable. |

## Known Limits / Tech Constraints
1. Aggregate attachment size is implicitly capped at **25 MB** (5 × 5 MB) client-side; backend applies provider SMTP limits.
2. No drag-and-drop target yet; picker only.
3. No inline thumbnail previews for images/PDFs.
4. Send button disables while request is in-flight but no granular progress indicator per file.
5. Attachments are not persisted if the composer is closed without sending (no drafts cache).

## Planned UX Improvements
1. **Drag & drop zone** inside attachments card (desktop + mobile long-press upload).
2. **Thumbnail/icon chips** for common MIME types (images, PDFs, docs) with quick view tooltip.
3. **Total size indicator** (e.g., "12.4 MB of 25 MB used") plus warning near limit.
4. **Retry & progress feedback** for slow uploads/SMPP send, including failure recovery path.
5. **Draft persistence** (localStorage or backend drafts table) so attachments survive accidental closes.
6. **Attachment reuse in replies/forward** (auto-attach originals when forwarding, allow “Attach from previous message”).
7. **Security callouts** linking to encryption policy for end users before send.

_This document should be updated after each attachment UX milestone to keep PM/QA aligned on remaining scope._
