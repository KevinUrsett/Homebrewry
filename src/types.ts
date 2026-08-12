import type { CatalogueEntry, CustomCatalogueCategory, CustomCatalogueEntry } from './catalogue/types';

export type RendererSettings = {
  accentColor: string;
  parchmentTone: 'warm' | 'light';
};

export type SyncState = 'local' | 'synced' | 'pending' | 'conflict' | 'error';

export type DriveMetadata = {
  fileId: string;
  revisionId: string;
  lastSyncedAt: string;
};

export type AssetDriveMetadata = {
  fileId: string;
  revisionId: string;
  lastSyncedAt: string;
};

export type BrewAsset = {
  id: string;
  name: string;
  alt: string;
  mimeType: string;
  size: number;
  blob: Blob;
  createdAt: string;
  updatedAt: string;
  drive?: AssetDriveMetadata;
  syncState?: SyncState;
};

export type ConflictSnapshot = {
  remoteBrew: Pick<Brew, 'title' | 'content' | 'createdAt' | 'createdOn' | 'updatedAt' | 'version' | 'rendererSettings'>;
  remoteRevisionId: string;
};

export type Brew = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  /** A concise device class recorded when this brew was created. */
  createdOn?: string;
  updatedAt: string;
  version: number;
  rendererSettings: RendererSettings;
  drive?: DriveMetadata;
  syncState?: SyncState;
  conflict?: ConflictSnapshot;
};

export type PartyMember = {
  id: string;
  name: string;
  armorClass: number | null;
  maxHitPoints: number | null;
  createdAt: string;
  updatedAt: string;
};

export type EncounterParticipant = {
  id: string;
  kind: 'player' | 'monster' | 'npc';
  name: string;
  partyMemberId?: string;
  /** Stable Living World identity for confirmed NPC combatants. */
  entityId?: string;
  /** A deliberate one-encounter exception for flashbacks or temporary returns. */
  availabilityOverride?: 'flashback' | 'temporary';
  source?: {
    category: 'monster';
    id: string;
  };
  armorClass: number | null;
  maxHitPoints: number | null;
  currentHitPoints: number | null;
  initiative: number | null;
};

export type EncounterStatus = 'not-started' | 'active' | 'completed' | 'skipped';

export type Encounter = {
  id: string;
  name: string;
  /** Optional in-world date for planning and campaign order. */
  date?: BelentorDate;
  status: EncounterStatus;
  optional: boolean;
  participants: EncounterParticipant[];
  activeCombatantId: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type CampaignEntityKind =
  | 'npc'
  | 'item'
  | 'settlement'
  | 'location'
  | 'faction'
  | 'quest'
  | 'creature'
  | 'vehicle'
  | 'other';

/** A stable, campaign-scoped identity. Authored brew text never stores or mutates this record. */
export type CampaignEntity = {
  id: string;
  campaignId: string;
  kind: CampaignEntityKind;
  name: string;
  aliases: string[];
  source: { kind: 'worldbuilding'; id: string } | { kind: 'catalogue'; id: string } | { kind: 'manual' };
  createdAt: string;
  updatedAt: string;
  version: number;
};

/** References are annotations around authored content, never edits to brew Markdown. */
export type EntityReference = {
  id: string;
  campaignId: string;
  entityId: string;
  source: { kind: 'brew'; brewId: string; start: number; end: number } | { kind: 'encounter'; encounterId: string };
  label: string;
  createdAt: string;
};

export type WorldStateValue = string | number | boolean | null;

export type WorldStateChange = {
  field: string;
  previousValue: WorldStateValue;
  nextValue: WorldStateValue;
};

/**
 * Append-only provenance. Events describe structured actions; prose recognition
 * is intentionally not an event source and cannot establish campaign canon.
 */
export type WorldEvent = {
  id: string;
  campaignId: string;
  entityId?: string;
  type: string;
  source:
    | { kind: 'manual' }
    | { kind: 'encounter'; encounterId: string }
    | { kind: 'combat'; encounterId: string; participantId?: string }
    | { kind: 'system-migration'; schemaVersion: number };
  changes: WorldStateChange[];
  occurredAt: string;
  recordedAt: string;
};

export type TimelineLane = 'main' | 'quest' | 'backstory';
export type TimelineStatus = 'planned' | 'current' | 'past';
export type BelentorEra = 'BA' | 'AA';
export type BelentorMonth = 'Quen' | 'Incan' | 'Abjar' | 'Methyl Melt' | 'Illin' | 'Evao' | 'Eryl' | 'Conjun' | 'Din' | 'Albedo Perigee' | 'Unri' | 'Trin';
export type BelentorDate = {
  era: BelentorEra;
  year: number;
  month: BelentorMonth;
  day: number;
};

/** A DM-authored timeline beat. Unlike World Events, it is planning/context, not an asserted state change. */
export type TimelineEntry = {
  id: string;
  campaignId: string;
  lane: TimelineLane;
  status: TimelineStatus;
  title: string;
  when: string;
  order: number;
  notes: string;
  entityIds: string[];
  /** Structured Belentor calendar date. `when` remains for legacy/imported free-text dates. */
  date?: BelentorDate;
  /** Optional source Worldbuilding entry for a timeline beat authored from that entry. */
  worldbuildingId?: string;
  /** Optional story node this beat branches from. Timeline nodes never change campaign state. */
  parentId?: string;
  encounterId?: string;
  brewId?: string;
  sectionId?: string;
  createdAt: string;
  updatedAt: string;
};

/** A private capture linked to a brew until the DM deliberately creates it. */
export type IdeaDraft = {
  id: string;
  brewId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};

export type CampaignMapNode = {
  id: string;
  label: string;
  kind: 'note' | 'entity';
  entityId?: string;
  x: number;
  y: number;
  createdAt: string;
  updatedAt: string;
};

export type CampaignMapLink = {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  createdAt: string;
};

/** A deliberate, editable campaign-planning board. Generated references remain separate. */
export type CampaignMap = {
  nodes: CampaignMapNode[];
  links: CampaignMapLink[];
  updatedAt: string;
};

export type PlotBeatStatus = 'seed' | 'planned' | 'active' | 'resolved';

/** A named column in the campaign's manual narrative outline. */
export type PlotBoardPhase = {
  id: string;
  title: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

/** A named narrative thread, displayed as one row in the Plot Board. */
export type PlotBoardLane = {
  id: string;
  title: string;
  tone: 'main' | 'side' | 'character' | 'secret';
  order: number;
  createdAt: string;
  updatedAt: string;
};

/** A DM-authored plot beat. It never alters World State or campaign position. */
export type PlotBoardBeat = {
  id: string;
  /** The first phase occupied by this beat. Additional occupied phases are stored below. */
  laneId: string;
  /** Contiguous phases this beat visually spans, starting with phaseId. */
  spanPhaseIds?: string[];
  phaseId: string;
  title: string;
  notes: string;
  status: PlotBeatStatus;
  entityIds: string[];
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type PlotBoardLink = {
  id: string;
  sourceBeatId: string;
  targetBeatId: string;
  label: string;
  createdAt: string;
};

/** A deliberately empty, manual campaign-narrative outline. */
export type PlotBoard = {
  phases: PlotBoardPhase[];
  lanes: PlotBoardLane[];
  beats: PlotBoardBeat[];
  links: PlotBoardLink[];
  updatedAt: string;
};

export type CurrentStateField = {
  value: WorldStateValue;
  eventId: string;
  updatedAt: string;
  authority: 'structured' | 'manual';
};

export type EntityCurrentState = {
  campaignId: string;
  entityId: string;
  fields: Record<string, CurrentStateField>;
};

export type LivingWorldData = {
  id: 'living-world';
  campaignId: string;
  entities: CampaignEntity[];
  entityReferences: EntityReference[];
  worldEvents: WorldEvent[];
  timelineEntries?: TimelineEntry[];
  ideaDrafts?: IdeaDraft[];
  campaignMap?: CampaignMap;
  plotBoard?: PlotBoard;
  /** Deliberately selected campaign brew, independent from the editor tab. */
  currentBrewId?: string;
};

export const worldbuildingKinds = [
  'town',
  'road',
  'historical-figure',
  'character',
  'faction',
  'landmark',
  'region',
  'organization',
  'event',
  'deity',
  'item',
  'creature',
  'custom'
] as const;

export type BuiltInWorldbuildingKind = (typeof worldbuildingKinds)[number];

/** Built-in kinds remain stable; campaigns may add safe custom type IDs. */
export type WorldbuildingKind = string;

export type WorldbuildingType = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type WorldbuildingEntry = {
  id: string;
  name: string;
  kind: WorldbuildingKind;
  aliases: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};

/**
 * Campaign-preparation data is deliberately kept outside individual brew files.
 * That lets encounters and Worldbuilding sync between devices without changing
 * the established brew document schema.
 */
export type CampaignDataSnapshot = {
  schemaVersion: 5;
  campaignId: string;
  updatedAt: string;
  encounters: Encounter[];
  partyMembers: PartyMember[];
  worldbuildingEntries: WorldbuildingEntry[];
  customCatalogueEntries: CustomCatalogueEntry[];
  customCatalogueCategories: CustomCatalogueCategory[];
  worldbuildingTypes: WorldbuildingType[];
  entities: CampaignEntity[];
  entityReferences: EntityReference[];
  worldEvents: WorldEvent[];
  /** Optional to retain compatibility with existing schema-5 Drive files. */
  timelineEntries?: TimelineEntry[];
  /** Optional to retain compatibility with existing campaign backups. */
  ideaDrafts?: IdeaDraft[];
  campaignMap?: CampaignMap;
  plotBoard?: PlotBoard;
  /** Optional manual campaign brew selection. */
  currentBrewId?: string;
};

export type CampaignDataConflict = {
  remoteData: CampaignDataSnapshot;
  remoteRevisionId: string;
};

export type CampaignDataSyncMetadata = {
  id: 'campaign-data';
  lastLocalChangeAt: string;
  drive?: DriveMetadata;
  syncState: SyncState;
  conflict?: CampaignDataConflict;
};

/**
 * User-imported monsters are kept in a separate companion file. This avoids
 * re-uploading a large private catalogue whenever combat state changes.
 */
export type PrivateMonsterCatalogueSnapshot = {
  schemaVersion: 1;
  updatedAt: string;
  entries: CatalogueEntry[];
};

export type PrivateMonsterCatalogueConflict = {
  remoteEntries: CatalogueEntry[];
  remoteRevisionId: string;
};

export type PrivateMonsterSyncMetadata = {
  id: 'private-monster-catalogue';
  lastLocalChangeAt: string;
  drive?: DriveMetadata;
  syncState: SyncState;
  conflict?: PrivateMonsterCatalogueConflict;
};

export type OutlineItem = {
  id: string;
  level: number;
  text: string;
};

export type ViewMode = 'split' | 'editor' | 'preview';
export type MobileSection = 'library' | 'editor' | 'preview' | 'outline' | 'catalogue' | 'campaign' | 'encounters' | 'worldbuilding';
