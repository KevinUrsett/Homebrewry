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

## Google Drive (Phase 2)

The app stays usable without Google Drive. To enable the optional Drive connection, create a Google OAuth **Web application** client and add its client ID as `VITE_GOOGLE_CLIENT_ID` in Vercel. Do not add a client secret to this browser application.

For local development, copy `.env.example` to `.env.local` and add the client ID. Use `http://localhost:5173` as an authorised JavaScript origin. Add the Vercel production URL before deploying.

The app requests only the `drive.file` scope. Access tokens are kept in memory and are never written to IndexedDB or source control.

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the local app |
| `pnpm run lint` | Run ESLint |
| `pnpm run typecheck` | Run TypeScript checks |
| `pnpm run test` | Run unit tests |
| `pnpm run build` | Create a production PWA build |

## Data safety

Phase 1 data is stored only in the browser's IndexedDB. Clearing browser site data removes local brews; Google Drive backup and conflict resolution arrive in Phase 2. Deletion always asks for confirmation.
