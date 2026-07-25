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
  remoteBrew: Pick<Brew, 'title' | 'content' | 'createdAt' | 'updatedAt' | 'version' | 'rendererSettings'>;
  remoteRevisionId: string;
};

export type Brew = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
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
  kind: 'player' | 'monster';
  name: string;
  partyMemberId?: string;
  source?: {
    category: 'monster';
    id: string;
  };
  armorClass: number | null;
  maxHitPoints: number | null;
  currentHitPoints: number | null;
  initiative: number | null;
};

export type EncounterStatus = 'prepared' | 'active' | 'complete';

export type Encounter = {
  id: string;
  name: string;
  status: EncounterStatus;
  participants: EncounterParticipant[];
  activeCombatantId: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type OutlineItem = {
  id: string;
  level: number;
  text: string;
};

export type ViewMode = 'split' | 'editor' | 'preview';
export type MobileSection = 'library' | 'editor' | 'preview' | 'outline' | 'catalogue' | 'encounters';
