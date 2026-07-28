# Living World foundation

This foundation deliberately separates authored documents from current campaign state.

## Non-negotiable boundaries

- Brew Markdown is never migrated, rewritten, or treated as canon by this system.
- Text recognition may create reference candidates or classifications only.
- Explicit structured actions and manual DM edits may append world events.
- Current state is a projection of append-only events and can always be overridden by a newer manual edit.
- A future Campaign view must be derived from encounters, references, and projected state.

## Schema version 5

Campaign snapshots add a file-scoped `campaignId`, stable campaign entities, source-position references, and immutable world events. Existing Worldbuilding records remain intact during the rollout; the new collections are additive.

Legacy encounter statuses migrate in memory:

- `prepared` → `not-started`
- `active` → `active`
- `complete` → `completed`

Legacy encounters default to `optional: false`. New statuses also support `skipped`.

Versions 1–4 remain readable. They are upgraded only when the normal campaign-data save flow next writes the companion file. No destructive IndexedDB migration, Drive file replacement, or brew conversion occurs.

## Planned follow-up deployments

1. Persist entity/reference indexes from confirmed Worldbuilding classifications.
2. Add encounter progression controls and derived “Now” queries.
3. Connect explicit combat outcomes to append-only events.
4. Surface current-state fields and manual DM overrides.
