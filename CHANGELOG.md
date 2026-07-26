# Changelog

## Unreleased

### Added

- Phase 8 beta: portrait, A4-proportioned preview pages with compact responsive book columns, including matching portrait print output.
- Homebrewery import support for complete line-based `{{descriptive}}` and `{{note}}` blocks, rendered as safe, distinct callouts; existing brews can use the reversible **Convert HB** action.
- Campaign-owned custom catalogue categories and generic catalogue entries, with stable references and Drive sync.
- Campaign-owned Worldbuilding types; Worldbuilding now defaults to a preview view with explicit **Edit**, **Save**, and **Cancel** controls.
- Stable `[[world:id|label]]` Worldbuilding links from the editor context menu, compact source-editor chips, desktop hover cards, and a Preview detail dialog that can open the matching Worldbuilding entry.
- Worldbuilding notes and campaign-owned catalogue descriptions now use the same compact source chips and right-click linking flow as brews. They can link safely to other Worldbuilding records or catalogue entries, then resolve to hover/tap references in their own previews.

### Fixed

- Long document outlines keep every row at its readable height and scroll independently on mobile instead of shrinking/cropping their labels.
- The generic catalogue-reference parser now reserves encounter and Worldbuilding namespaces so those reference cards continue to render through their dedicated safe transforms.
- Campaign-data schema version 4 stores custom catalogue categories and Worldbuilding type definitions while safely reading schema versions 1–3.
- Encounter and Worldbuilding badges now distinguish a real Drive backup, an unsent change, a conflict, and a first backup that has not happened yet. After a reload, the header correctly offers **Reconnect Drive** when a campaign backup is known.

- Campaign data now uses schema version 3, preserving validated custom monster stat data across Drive sync while safely reading existing schema 1 and 2 campaign files.
- Imported private monster catalogues now sync through their own private Google Drive companion file and load when Drive connects on another device. The normalized JSON is validated again on download; archive artwork and package files remain excluded, and no archive code is executed.
- Encounter monster browsing no longer stops at the first 18 records. It shows 30 at a time and offers **Show more**, while search covers the entire catalogue.
- Encounters, the current party, Worldbuilding, and custom catalogue entries now sync to their Drive companion file automatically after a local change when Drive is connected. Connecting Drive on another device now loads that campaign data immediately instead of leaving the campaign view at “Local only”.
- Campaign data uploads label their Drive metadata with the current schema version, matching the versioned payload that carries custom catalogue entries.
- On mobile, the Markdown source now scrolls inside the editor pane so the title and formatting tools remain visible while editing.
- Encounter names now use a stable editable field and are preserved when adding combatants, starting combat, or inserting the encounter into a brew.
- **Insert into brew** no longer inserts an encounter at an old cursor position. It opens the Outline placement flow and inserts at the end of the chosen section.

- Encounter references in Preview now display the current saved encounter name after it is renamed.
- Catalogue results and the document outline now scroll independently from their content panes on desktop, while retaining the selected entry in view.

- Preview reference names now retain their validated internal link, so tapping one opens the reference detail dialog; Edit remains source-only.
- The catalogue insert action now appears directly below the selected entry heading instead of after its full stat block.
- Reference detail dialogs can navigate directly to the referenced catalogue entry without inserting another token or changing tabs.
- The mobile catalogue category selector now uses a full-width, vertically centred control so its selected label remains readable.

### Added

- Preview pages now use compact D&D-book typography and flow into two columns whenever the available preview pane is wide enough; narrow split panes and phones remain readable in one column.
- Catalogue can now create custom monsters from scratch, edit them, or duplicate any selected monster as a private campaign template. Custom monsters work in references and Encounters and sync with campaign data.
- Choosing a Reference category now creates a campaign-owned custom catalogue entry when the selected text has no matching entry. These entries sync with campaign data and use the same stable reference syntax.
- The Reference toolbar menu can turn selected matching text into a stable catalogue reference by category, while retaining the full catalogue browser.
- A validated **private monster archive** import flow in Catalogue. Compatible `monsters.json` ZIP files are normalized locally; archive artwork is not copied and imported material is never bundled or committed.
- Safe ZIP validation for private monster imports: size and record limits, allowed paths only, no encrypted or ZIP64 archives, no path traversal or symlinks, and no archive-provided executable content.
- Private monsters now work in catalogue search, stable brew references, preview reference details, and encounter monster search without overriding bundled SRD records.

- Versioned Google Drive sync for encounters, the current party roster, and Worldbuilding in a separate campaign-data file, without changing existing brew files.
- Campaign sync badges in Encounters and Worldbuilding, plus explicit options to keep Drive, keep both record sets, or replace Drive when two devices diverge.

- A local-first **Worldbuilding** tab with typed, searchable entries for towns, roads, historical figures, characters, factions, landmarks, regions, organisations, events, and custom records.
- A source-editor right-click menu for turning selected text or a word under the cursor into a typed Worldbuilding entry.

- Monster combatants now roll initiative automatically when added, using their SRD initiative bonus (or Dexterity modifier as a fallback).
- Combatant cards now include a signed damage/healing field: positive values deal damage and negative values heal, with HP clamped safely between zero and the known maximum.

- Local-first combat encounters with a reusable party roster, offline SRD monster search, initiative ordering, turn progression, and independent HP/AC tracking.
- Stable `[[encounter:id|label]]` source references, toolbar insertion, and Preview combat cards that open the associated encounter.

- Offline SRD 5.2.1 catalogue with 2,232 source-verified records across monsters, spells, items, rules, tables, and character options.
- Stable Markdown catalogue references, detail dialogs, desktop hover cards, and a mobile tap/click fallback.
- CodeMirror source editor with highlighted reference tokens and accessible hover inspection.

- Drive-backed image assets with offline IndexedDB copies, safe validation, and Image toolbar insertion.
- Homebrewery-style source import dialog with compatibility notices and script removal.
- Licensed Bookinsanity, Nodesto Caps Condensed, and Scaly Sans typography with attribution notice.

- Distinct book-style renderer with callouts, stat blocks, item and spell cards, columns, page breaks, and print styling.

- Per-brew sync badges and an explicit conflict-resolution dialog.
- Options to keep the Drive version, overwrite Drive intentionally, or retain both copies.

- Configuration-ready Google Identity Services and Google Drive sync layer.
- Manual Drive sync controls and revision-based conflict detection.
- `.env.example` for the public OAuth client ID; access tokens remain in memory only.

- Responsive local-first brew library and Markdown editor.
- D&D-inspired safe Markdown preview and generated document outline.
- IndexedDB persistence, autosave state, undo/redo, find/replace, duplication, and confirmed deletion.
- Vite PWA manifest, service worker, offline shell caching, tests, and CI.

### Notes

- Campaign data sync is separate from brew documents, so existing Drive brew files remain backward compatible.
- Worldbuilding links render only the selected label in a brew; notes remain available through the hover card or reference dialog instead of appearing inline.
