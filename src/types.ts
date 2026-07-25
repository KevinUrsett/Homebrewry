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

export type OutlineItem = {
  id: string;
  level: number;
  text: string;
};

export type ViewMode = 'split' | 'editor' | 'preview';
export type MobileSection = 'library' | 'editor' | 'preview' | 'outline';
