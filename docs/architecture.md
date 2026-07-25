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

The renderer reads only the active brew content. It does not import from IndexedDB or any future cloud provider. Phase 2 will add a Google Drive adapter behind the storage boundary, with conflict checks before remote writes.
