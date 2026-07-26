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

`renderer/blocks` parses a small, documented directive syntax into typed display blocks. The preview renders those blocks independently of storage and continues to use a safe Markdown renderer for prose. Raw HTML is not enabled. Explicit `:::pagebreak` directives create print pages; desktop and wide preview panes use portrait A4-proportioned book pages with compact columns while narrow panes remain single-column.

## Phase 4 assets and import

`assetStore` keeps validated image blobs in IndexedDB. `assetSync` stores a matching app-owned Drive file and a stable asset identifier; the Markdown document references that identifier instead of a temporary Drive URL. The renderer resolves only local `asset://` identifiers and HTTPS image URLs.

`importer` accepts pasted or text-file source, converts only known page commands and complete line-based Homebrewery `descriptive`/`note` wrappers, and reports unsupported or incomplete constructs. It never enables imported script, style, raw HTML, or CSS execution. The conversion is source-only and can be applied to existing brews through a normal undoable editor update.

## Phase 5 catalogue and reference boundary

`catalogue/catalogueData` lazily loads the versioned, local SRD data files and accepts only records marked `SRD-521`. The catalogue is a read-only data provider: it has no IndexedDB, Google Drive, OAuth, or renderer dependency. The current data import intentionally excludes upstream source code, UI, themes, fonts, images, and unverified records.

`catalogue/references` owns the stable `[[category:id|label]]` syntax, URL conversion, and Markdown AST transformation. It is pure and data-provider independent. The preview resolves a reference only through a supplied read-only entry map; an absent entry is visibly marked rather than guessed. The CodeMirror editor uses the same parser for hover cards, and does not execute catalogue text or imported Markdown.

## Private monster import boundary

`lib/privateMonsterImport` accepts only a constrained Encounter+-style ZIP layout. Before decompression it validates the central directory, entry count and size limits, allowed paths, compression types, encryption, ZIP64 flags, and Unix symlinks. It extracts only `monsters.json`, parses it as plain UTF-8 JSON, limits record complexity, strips artwork references, and normalizes records into safe `CatalogueEntry` values. No archive code, markup, image, or script is executed.

`lib/privateMonsterStore` stores those normalized monster entries in a dedicated IndexedDB store. They are combined with the read-only SRD provider in `App`, but never overwrite a bundled SRD ID. `lib/privateMonsterSync` stores only the normalized JSON in a separate, user-owned private Drive companion file; it is never added to brew documents, asset storage, GitHub, or the public build. The app validates the Drive JSON again before it can replace local data and surfaces an explicit choice if two devices import different catalogues.

## Phase 6 encounter boundary

`lib/encounterStore` persists `PartyMember` and `Encounter` records in dedicated IndexedDB stores. The current party is a reusable local roster; an encounter copies its members into independent combatants so later roster edits cannot alter a prepared or active fight. `lib/encounters` contains the pure operations for adding SRD monsters, updating combatants, sorting initiative, and advancing a turn.

`lib/encounterReferences` owns the `[[encounter:id|label]]` syntax. The preview receives only a read-only encounter map and a callback, so the renderer still has no storage, OAuth, or Google Drive dependency.

The Outline placement flow derives a selected heading's section boundary from pure Markdown heading locations. It inserts a reference before the next heading at the same or higher level, rather than relying on the editor's cursor position.

## Phase 7–8 Worldbuilding boundary

`lib/worldbuildingStore` persists versioned `WorldbuildingEntry` and `WorldbuildingType` records in dedicated IndexedDB stores. `lib/worldbuilding` owns normalization, creation, lookup, and update rules for typed entries; it does not depend on a brew, the renderer, or Google Drive. The CodeMirror context menu passes only selected plain text and a user-chosen type to the Worldbuilding layer.

`lib/worldbuildingReferences` owns the `[[world:id|label]]` syntax and Markdown AST transformation. The preview receives only a read-only entry map, type list, and open callback. It can render a desktop hover card and a click/tap detail dialog without importing from IndexedDB or Google Drive. The shared CodeMirror source editor keeps the underlying stable source syntax but renders it as a compact reference chip. The same right-click flow is available in Worldbuilding notes and campaign-owned catalogue descriptions; `ReferenceContent` resolves their safe catalogue and Worldbuilding links without coupling either view to storage.

Custom catalogue categories use stable opaque IDs and are stored separately from campaign-owned catalogue entries. The generic catalogue-reference parser intentionally reserves `encounter` and `world` namespaces so dedicated reference transformers cannot be shadowed by a custom category.

## Campaign-data sync boundary

`lib/campaignData` validates the versioned campaign snapshot before remote data can replace local IndexedDB records. `lib/campaignSync` compares the companion Drive file revision with local change metadata, and never merges diverging records automatically. It stores Encounters, the current party, Worldbuilding, Worldbuilding types, custom catalogue categories, and custom catalogue entries in one app-owned Drive file rather than modifying any brew document. `App` schedules a short, serialized Drive backup after a successful local campaign-data save whenever Drive is connected, and it checks this companion file immediately when a device connects. The tab badge derives its wording from stored Drive metadata rather than the ephemeral in-memory OAuth token, so it does not mislabel an existing backup as local-only after a reload.

An explicit conflict choice can keep Drive, keep both record sets, or replace Drive intentionally. `brewStore.replaceCampaignData` performs a transactional local replacement only after that result is known. The renderer continues to receive only read-only encounter data, never Drive or IndexedDB access.

`catalogue/customEntries` creates the smallest safe custom record from selected editor text and validates structured custom monster data before storage or Drive sync. `customCatalogueStore` keeps campaign-owned entries and category definitions separate from bundled SRD and private imports. Campaign-data schema version 4 preserves bounded JSON stat-block fields plus custom catalogue categories and Worldbuilding types across devices; schema versions 1–3 remain readable and migrate safely, with v2's historical custom payloads treated as empty.
