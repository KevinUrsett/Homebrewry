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
- Local-first combat encounters with a reusable party roster, SRD monster search, initiative order, turn tracking, and hit-point tracking
- Local-first Worldbuilding entries for campaign places, people, history, factions, and custom reference types
- Installable PWA base with offline application-shell caching
- Optional Google Drive backup, automatic campaign-data sync after connection, manual full sync, and explicit conflict resolution

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

Use **Reference** in the editor toolbar, choose a category to turn selected matching text into a reference, or select **Browse catalogue** for the full picker. If there is no matching entry, Homebrewry creates a synced custom catalogue entry in that category. The app inserts stable source syntax such as:

```markdown
[[monster:c674b91f-94c8-5c80-9d1d-31bef50bc779|Aboleth]]
```

The preview displays only `Aboleth`; hover it on desktop to inspect a reference card, or tap/click to open its complete entry. In the source editor, hover the highlighted reference token to inspect it. References use IDs rather than just names, so renaming or duplicate names cannot silently point at the wrong record.

### Private monster archives

Use **Catalogue → Import monster archive** to add a compatible ZIP containing `monsters.json`. Imported monsters are validated, stored only in this browser's IndexedDB, and are intentionally excluded from Google Drive sync, brew files, GitHub, and the public application bundle. This protects user-supplied or unprovenanced material from accidental redistribution.

The importer accepts only a small, safe ZIP layout; it limits archive size, rejects encrypted, ZIP64, path-traversal, or unsupported files, and reads only the JSON data. Artwork files in the archive are never copied. Existing bundled monster IDs remain authoritative, so matching SRD records are skipped rather than overwritten. A private monster reference resolves only on devices where that archive has been imported. Replacing or removing the private catalogue always asks for confirmation.

## Encounters (Phase 6 beta)

The **Encounters** tab keeps a local current-party roster, creates independent encounter snapshots, and can add SRD monsters from the offline catalogue. Monster initiatives roll automatically when added; player-character initiatives remain manual. Each combatant has editable initiative, current/max hit points, armor class, a signed damage/healing field (`10` deals 10 damage; `-10` heals 10), and a current-turn marker. Updating a party roster never changes an already prepared encounter.

Use **Encounter** in the editor toolbar, then select **Insert into brew**. The Outline opens in placement mode; select a heading and the stable source reference is added at the end of that section, before its next peer heading:

```markdown
[[encounter:329dec56-7f04-49b2-98b2-5710e54f3de2|The flooded vault]]
```

In Preview, the reference becomes a combat card. Select it to open that encounter directly.

## Worldbuilding (Phase 7 beta)

The **Worldbuilding** tab is a local campaign reference notebook, separate from individual brews. Create entries for towns, roads, historical figures, characters, factions, landmarks, regions, organisations, events, or a custom type. Entries support aliases and private notes, and can be searched or filtered by type.

In the source editor, select a word or phrase and right-click it (or right-click a single word). Choose **Add “…” as** and an entry type to create a Worldbuilding record without interrupting your writing flow. The first version intentionally does not alter source text, create automatic links, or render notes in Preview.

## Campaign data sync

Encounters, the current party roster, Worldbuilding, and custom catalogue entries sync through one separate, versioned Drive file: `Homebrewry campaign data.homebrewry.json`. Brew files remain unchanged and backward compatible.

After you connect Drive, campaign changes are backed up automatically shortly after they are saved locally. Connecting Drive on another device also checks for and loads the companion file, so the current party and encounters follow you without a separate refresh. **Refresh & sync** remains available to back up brews and images immediately. If both devices change campaign data before syncing, Homebrewry stops and asks whether to keep Drive, keep both record sets, or replace Drive intentionally. No campaign records are silently overwritten.

Private monster archives are deliberately not part of this campaign-data sync. Import the archive directly on each device that needs it.

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
