# Homebrewry

A responsive, local-first editor for D&D-style brew documents.

## Current features

- Local brew library backed by IndexedDB
- Markdown editor with autosave, manual save feedback, undo/redo, and find/replace
- Responsive editor, preview, library, and outline layouts
- Safe Markdown rendering with a distinct, D&D-book-inspired layout system
- Portrait, A4-proportioned D&D-book preview pages with compact responsive two-column typography, plus callouts, stat blocks, item and spell cards, explicit page breaks, and print/PDF styling
- Drive-backed image uploads with local offline copies and accessible alt text
- Safe pasted or text-file import of Homebrewery-style source, with a compatibility report
- Offline, searchable SRD 5.2.1 catalogue for monsters, spells, items, rules, and character options
- Stable in-brew catalogue references with desktop hover cards and tap/click detail views
- Local-first combat encounters with a reusable party roster, SRD monster search, initiative order, turn tracking, and hit-point tracking
- Local-first Worldbuilding entries with custom types, stable in-brew links, hover cards, and preview/detail views
- Installable PWA base with offline application-shell caching
- Optional Google Drive backup, automatic campaign-data sync after connection, manual full sync, and explicit conflict resolution

The renderer is independent from IndexedDB and Google Drive. See [architecture notes](docs/architecture.md).

## Renderer syntax

Use normal Markdown plus these optional blocks:

````markdown
:::note Travel warning
The road is watched.
:::

:::descriptive
Read this aloud to the table.
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

`warning`, `tip`, `item`, and `spell` are also supported block types. `descriptive` is a visually distinct read-aloud callout but does not add a label or expose a secret to players. The preview never renders raw HTML or scripts.

## Images and imports

Use **Image** in the editor toolbar to insert a local image. Supported types are PNG, JPEG, WebP, and GIF, up to 8 MB. If Drive is connected, the image uploads to Drive immediately; otherwise it uploads on the next sync.

Use **Import** in the brew library to paste source or select a `.md`, `.markdown`, or `.txt` file. Imports always create a new local brew and do not overwrite an existing one. Complete line-based Homebrewery `{{descriptive ... }}` and `{{note ... }}` wrappers are converted into safe callouts; incomplete wrappers are deliberately retained with a notice. Use **Convert HB** in the editor to apply the same reversible conversion to an already imported brew.

## iPhone and iPad

Homebrewry is configured as a standalone PWA. Install it with Safari’s **Share → Add to Home Screen** and open the installed app to remove Safari’s normal URL controls. A URL pill shown by Safari while using the browser is owned by iOS and cannot be removed by page CSS or JavaScript; the editor instead follows the visual viewport so the usable area stays filled while the keyboard is open. Apple documents the standalone-web-app metadata used here in [Configuring Web Applications](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html).

## Catalogue and references

The **Catalogue** tab provides a versioned offline reference for SRD 5.2.1 monsters, spells, items, rules, tables, classes, subclasses, species, backgrounds, and feats. It is part of the application bundle and does not add a Google permission or upload catalogue lookups to Drive.

Use **Reference** in the editor toolbar, choose a category to turn selected matching text into a reference, or select **Browse catalogue** for the full picker. If there is no matching entry, Homebrewry creates a synced custom catalogue entry in that category. The app inserts stable source syntax such as:

```markdown
[[monster:c674b91f-94c8-5c80-9d1d-31bef50bc779|Aboleth]]
```

The preview displays only `Aboleth`; hover it on desktop to inspect a reference card, or tap/click to open its complete entry. In the source editor, the underlying stable token is shown as a compact reference chip. References use IDs rather than just names, so renaming or duplicate names cannot silently point at the wrong record.

### Custom catalogue categories and entries

Use **Catalogue → New category** to add campaign-owned categories such as deities, locations, or factions, then use **New entry** to add an entry in the selected category. Custom categories and entries sync with campaign data and use the same stable reference format as SRD entries. Category identifiers remain stable even if their display names later change, so existing brew references keep working. In a campaign-owned entry or custom monster description, right-click selected text to link it to another Worldbuilding record or catalogue entry; its preview resolves the link safely just like a brew preview.

### Custom monsters

Use **Catalogue → New custom monster** for a blank stat block, or select any monster and choose **Duplicate as custom monster**. The editor covers identity, AC, HP, speed, challenge rating, ability scores, description, traits, actions, bonus actions, reactions, and legendary actions. Custom monsters are campaign-owned: they can be referenced in brews, added to Encounters, and sync with your current party and Worldbuilding data through Google Drive.

### Private monster archives

Use **Catalogue → Import monster archive** to add a compatible ZIP containing `monsters.json`. Imported monsters are validated, stored locally first, then backed up to a separate private Google Drive companion file when Drive is connected. They never enter brew files, GitHub, or the public application bundle.

The importer accepts only a small, safe ZIP layout; it limits archive size, rejects encrypted, ZIP64, path-traversal, or unsupported files, and reads only the JSON data. Artwork files in the archive are never copied. Existing bundled monster IDs remain authoritative, so matching SRD records are skipped rather than overwritten. Connecting Drive on another device loads the private catalogue automatically. Replacing or removing the private catalogue always asks for confirmation.

## Encounters (Phase 6 beta)

The **Encounters** tab keeps a local current-party roster, creates independent encounter snapshots, and can add SRD monsters from the offline catalogue. Monster initiatives roll automatically when added; player-character initiatives remain manual. Each combatant has editable initiative, current/max hit points, armor class, a signed damage/healing field (`10` deals 10 damage; `-10` heals 10), and a current-turn marker. Updating a party roster never changes an already prepared encounter.

Use **Encounter** in the editor toolbar, then select **Insert into brew**. The Outline opens in placement mode; select a heading and the stable source reference is added at the end of that section, before its next peer heading:

```markdown
[[encounter:329dec56-7f04-49b2-98b2-5710e54f3de2|The flooded vault]]
```

In Preview, the reference becomes a combat card. Select it to open that encounter directly.

## Worldbuilding (Phase 8 beta)

The **Worldbuilding** tab is a local campaign reference notebook, separate from individual brews. Create entries for towns, roads, historical figures, characters, factions, landmarks, regions, organisations, events, or campaign-created types. Entries support aliases and private notes, and can be searched or filtered by type. Entries open in a read-friendly preview by default; choose **Edit** and then **Save** to change them, or **Cancel** to discard a draft.

In the source editor, select a word or phrase and right-click it (or right-click a single word). Choose **Link “…” as** and an entry type to create or reuse a Worldbuilding record and replace the selection with a stable reference:

```markdown
[[world:c674b91f-94c8-5c80-9d1d-31bef50bc779|Sund]]
```

The editor presents that source as a compact bold reference chip. Preview displays the readable label, shows the entry’s notes on desktop hover, and opens a detail dialog on click/tap with **Open in Worldbuilding**. The Worldbuilding **Notes** editor has the same right-click menu, so one entry can safely link to another—for example, a historical figure can link to a Region—or to a catalogue entry without putting that context in a particular brew.

## Campaign data sync

Encounters, the current party roster, Worldbuilding, Worldbuilding type definitions, custom catalogue categories, and custom catalogue entries (including custom monster stat blocks) sync through one separate, versioned Drive file: `Homebrewry campaign data.homebrewry.json`. Brew files remain unchanged and backward compatible.

After you connect Drive, campaign changes are backed up automatically shortly after they are saved locally. Connecting Drive on another device also checks for and loads the companion file, so the current party and encounters follow you without a separate refresh. **Drive backed up** means that companion file exists; **Drive sync pending** means a local change is waiting to upload; **Not yet backed up** means no cloud copy has been created. Access tokens remain memory-only, so a reload may show **Reconnect Drive** before the next refresh. **Refresh & sync** remains available to back up brews and images immediately. If both devices change campaign data before syncing, Homebrewry stops and asks whether to keep Drive, keep both record sets, or replace Drive intentionally. No campaign records are silently overwritten.

Private monster archives use their own private Drive companion file, so a large imported catalogue is not re-uploaded with every combat update. The same revision checks prevent one device from silently replacing another device's imported catalogue.

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

Brews are always stored locally first. Google Drive copies are optional and conflicts require an explicit choice; deletion always asks for confirmation. Campaign-data schema 4 is backward-readable for schema 1–3 Drive files; older files gain empty custom taxonomy collections until a later campaign save. A Drive sync is recommended before clearing browser data or changing devices.
