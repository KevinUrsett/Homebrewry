# Homebrewry

A responsive, local-first editor for D&D-style brew documents.

## Current features

- Local brew library backed by IndexedDB
- Markdown editor with autosave, manual save feedback, undo/redo, and find/replace
- Responsive editor, preview, library, and outline layouts
- Safe Markdown rendering with a distinct, D&D-book-inspired layout system
- Callouts, stat blocks, item and spell cards, two-column sections, explicit page breaks, and print/PDF styling
- Drive-backed image uploads with local offline copies and accessible alt text
- Safe pasted or text-file import of Homebrewery-style source, with a compatibility report
- Offline, searchable SRD 5.2.1 catalogue for monsters, spells, items, rules, and character options
- Stable in-brew catalogue references with desktop hover cards and tap/click detail views
- Installable PWA base with offline application-shell caching
- Optional Google Drive backup, manual sync, and explicit conflict resolution

The renderer is independent from IndexedDB and Google Drive. See [architecture notes](docs/architecture.md).

## Renderer syntax

Use normal Markdown plus these optional blocks:

````markdown
:::note Travel warning
The road is watched.
:::

:::columns
Left and right columns on desktop.
:::

```statblock
Ashbound Scout
*Medium humanoid, neutral*
Armor Class 14
```

:::pagebreak
````

`warning`, `tip`, `item`, and `spell` are also supported block types. The preview never renders raw HTML or scripts.

## Images and imports

Use **Image** in the editor toolbar to insert a local image. Supported types are PNG, JPEG, WebP, and GIF, up to 8 MB. If Drive is connected, the image uploads to Drive immediately; otherwise it uploads on the next sync.

Use **Import** in the brew library to paste source or select a `.md`, `.markdown`, or `.txt` file. Imports always create a new local brew and do not overwrite an existing one.

## Catalogue and references

The **Catalogue** tab provides a versioned offline reference for SRD 5.2.1 monsters, spells, items, rules, tables, classes, subclasses, species, backgrounds, and feats. It is part of the application bundle and does not add a Google permission or upload catalogue lookups to Drive.

Use **Reference** in the editor toolbar or **Insert reference into brew** in the catalogue. The app inserts stable source syntax such as:

```markdown
[[monster:c674b91f-94c8-5c80-9d1d-31bef50bc779|Aboleth]]
```

The preview displays only `Aboleth`; hover it on desktop to inspect a reference card, or tap/click to open its complete entry. In the source editor, hover the highlighted reference token to inspect it. References use IDs rather than just names, so renaming or duplicate names cannot silently point at the wrong record.

## Font attribution

The preview bundles Bookinsanity, Nodesto Caps Condensed, and Scaly Sans under CC-BY-SA-4.0. See [third-party notices](THIRD_PARTY_NOTICES.md).

The catalogue uses SRD 5.2.1 content under CC-BY-4.0 with attribution. The imported data set is restricted to records marked `SRD-521`; it does not include the Encounter+ repository's code, UI, themes, images, fonts, or other app assets. See [third-party notices](THIRD_PARTY_NOTICES.md).

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

Brews are always stored locally first. Google Drive copies are optional and conflicts require an explicit choice; deletion always asks for confirmation. A Drive sync is recommended before clearing browser data or changing devices.
