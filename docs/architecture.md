# Architecture

## Phase 1 boundary

Phase 1 is a local-first, browser-only application. It creates and edits brew documents in IndexedDB, renders a safe Markdown preview, derives a heading outline, and caches the application shell for offline use. No account, network storage, or user content leaves the device.

## Module boundaries

| Module | Responsibility | Phase 1 implementation |
| --- | --- | --- |
| `lib/brewStore` | Persist and retrieve document records | IndexedDB adapter |
| `lib/outline` | Parse headings for navigation | Pure Markdown parser |
| `components` | Library, editor, outline, preview UI | React components |
| PWA layer | Install metadata and offline shell cache | `vite-plugin-pwa` |

The renderer reads only the active brew content. It does not import from IndexedDB or any cloud provider.

## Phase 2 cloud boundary

`lib/googleIdentity` obtains a short-lived Google access token through Google Identity Services. The token remains in memory only. `lib/googleDrive` is the sole module that calls the Drive API, while `lib/sync` compares the stored Drive revision with the current remote revision before writing. A changed local and remote copy is marked as a conflict; it is not overwritten automatically.

`lib/conflicts` converts an explicit user decision into a safe local state. Keeping both versions preserves the Drive version and creates a separate local brew with no Drive file ID, so its next sync creates a separate remote file.

Google Drive integration is disabled until `VITE_GOOGLE_CLIENT_ID` is supplied by the hosting environment. The renderer remains independent from authentication, Drive, and IndexedDB.

## Phase 3 renderer boundary

`renderer/blocks` parses a small, documented directive syntax into typed display blocks. The preview renders those blocks independently of storage and continues to use a safe Markdown renderer for prose. Raw HTML is not enabled. Explicit `:::pagebreak` directives create print pages; ordinary screen content remains responsive rather than pretending every phone screen is a sheet of paper.
