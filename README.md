# Homebrewry

A responsive, local-first editor for D&D-style brew documents.

## Phase 1: local editor MVP

- Local brew library backed by IndexedDB
- Markdown editor with autosave, manual save feedback, undo/redo, and find/replace
- Responsive editor, preview, library, and outline layouts
- Safe Markdown rendering with D&D-inspired book styling
- Installable PWA base with offline application-shell caching
- No account, Google Drive access, or cloud sync yet

The renderer is independent from IndexedDB. Future Google Drive sync will be added behind the storage boundary, with conflict detection before remote writes. See [architecture notes](docs/architecture.md).

## Development

Requires Node.js 22 or newer and pnpm 11.

```bash
corepack enable
pnpm install
pnpm dev
```

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the local app |
| `pnpm run lint` | Run ESLint |
| `pnpm run typecheck` | Run TypeScript checks |
| `pnpm run test` | Run unit tests |
| `pnpm run build` | Create a production PWA build |

## Data safety

Phase 1 data is stored only in the browser's IndexedDB. Clearing browser site data removes local brews; Google Drive backup and conflict resolution arrive in Phase 2. Deletion always asks for confirmation.
