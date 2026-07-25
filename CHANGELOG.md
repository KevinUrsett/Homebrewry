# Changelog

## Unreleased

### Fixed

- Preview reference names now retain their validated internal link, so tapping one opens the reference detail dialog; Edit remains source-only.
- The catalogue insert action now appears directly below the selected entry heading instead of after its full stat block.
- Reference detail dialogs can navigate directly to the referenced catalogue entry without inserting another token or changing tabs.
- The mobile catalogue category selector now uses a full-width, vertically centred control so its selected label remains readable.

### Added

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

- Encounter and current-party records are initially local IndexedDB data. They do not yet sync to Google Drive, so the existing Drive brew-file format remains backward compatible.
