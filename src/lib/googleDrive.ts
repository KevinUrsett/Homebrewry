import type { Brew, BrewAsset, CampaignDataSnapshot, DriveMetadata } from '../types';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const BREW_MIME_TYPE = 'application/vnd.homebrewry.brew+json';
const CAMPAIGN_DATA_MIME_TYPE = 'application/vnd.homebrewry.campaign-data+json';

type DriveFile = {
  id: string;
  name: string;
  modifiedTime: string;
  headRevisionId?: string;
  mimeType?: string;
  appProperties?: Record<string, string>;
};

export type RemoteBrew = {
  file: DriveFile;
  brew: Brew;
};

export type RemoteAsset = {
  file: DriveFile;
  asset: BrewAsset;
};

export type RemoteCampaignData = {
  file: DriveFile;
  data: unknown;
};

async function driveRequest<T>(accessToken: string, url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers
    }
  });

  if (!response.ok) {
    throw new Error(`Google Drive request failed (${response.status}).`);
  }

  return response.json() as Promise<T>;
}

async function driveBlobRequest(accessToken: string, url: string): Promise<Blob> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Google Drive asset request failed (${response.status}).`);
  return response.blob();
}

function createMultipartBody(metadata: object, content: object, contentMimeType: string) {
  const boundary = `homebrewry-${crypto.randomUUID()}`;
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${contentMimeType}`,
    '',
    JSON.stringify(content),
    `--${boundary}--`,
    ''
  ].join('\r\n');

  return { body, contentType: `multipart/related; boundary=${boundary}` };
}

function createMultipartBlobBody(metadata: object, content: Blob) {
  const boundary = `homebrewry-${crypto.randomUUID()}`;
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${content.type}\r\n\r\n`,
    content,
    `\r\n--${boundary}--\r\n`
  ]);
  return { body, contentType: `multipart/related; boundary=${boundary}` };
}

function documentName(title: string) {
  const safeTitle = title.trim().replace(/[\\/:*?"<>|]/g, '-').slice(0, 100) || 'Untitled Brew';
  return `${safeTitle}.homebrewry.json`;
}

function campaignDataName() {
  return 'Homebrewry campaign data.homebrewry.json';
}

export async function listRemoteBrews(accessToken: string): Promise<RemoteBrew[]> {
  const query = encodeURIComponent("appProperties has { key='homebrewry' and value='brew' } and trashed = false");
  const fields = encodeURIComponent('files(id,name,modifiedTime,headRevisionId)');
  const result = await driveRequest<{ files?: DriveFile[] }>(
    accessToken,
    `${DRIVE_API}/files?q=${query}&fields=${fields}&orderBy=modifiedTime desc&pageSize=100`
  );

  const files = result.files ?? [];
  return Promise.all(files.map(async (file) => ({
    file,
    brew: await driveRequest<Brew>(accessToken, `${DRIVE_API}/files/${file.id}?alt=media`)
  })));
}

export async function uploadBrew(accessToken: string, brew: Brew, expectedRevisionId?: string): Promise<DriveFile> {
  if (brew.drive && expectedRevisionId) {
    const current = await driveRequest<DriveFile>(
      accessToken,
      `${DRIVE_API}/files/${brew.drive.fileId}?fields=id,name,modifiedTime,headRevisionId`
    );
    if (current.headRevisionId !== expectedRevisionId) {
      throw new DriveConflictError('The Drive copy changed since the last sync.');
    }
  }

  const { body, contentType } = createMultipartBody(
    {
      name: documentName(brew.title),
      mimeType: BREW_MIME_TYPE,
      appProperties: { homebrewry: 'brew', schemaVersion: '1' }
    },
    brew,
    BREW_MIME_TYPE
  );
  const url = brew.drive
    ? `${DRIVE_UPLOAD_API}/files/${brew.drive.fileId}?uploadType=multipart&fields=id,name,modifiedTime,headRevisionId`
    : `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,modifiedTime,headRevisionId`;

  return driveRequest<DriveFile>(accessToken, url, {
    method: brew.drive ? 'PATCH' : 'POST',
    headers: { 'Content-Type': contentType },
    body
  });
}

export async function listRemoteCampaignData(accessToken: string): Promise<RemoteCampaignData[]> {
  const query = encodeURIComponent("appProperties has { key='homebrewry' and value='campaign-data' } and trashed = false");
  const fields = encodeURIComponent('files(id,name,modifiedTime,headRevisionId)');
  const result = await driveRequest<{ files?: DriveFile[] }>(
    accessToken,
    `${DRIVE_API}/files?q=${query}&fields=${fields}&orderBy=modifiedTime desc&pageSize=10`
  );

  const files = result.files ?? [];
  return Promise.all(files.map(async (file) => ({
    file,
    data: await driveRequest<unknown>(accessToken, `${DRIVE_API}/files/${file.id}?alt=media`)
  })));
}

export async function uploadCampaignData(
  accessToken: string,
  data: CampaignDataSnapshot,
  drive?: DriveMetadata,
  expectedRevisionId?: string
): Promise<DriveFile> {
  if (drive && expectedRevisionId) {
    const current = await driveRequest<DriveFile>(
      accessToken,
      `${DRIVE_API}/files/${drive.fileId}?fields=id,name,modifiedTime,headRevisionId`
    );
    if (current.headRevisionId !== expectedRevisionId) {
      throw new DriveConflictError('The Drive campaign data changed since the last sync.');
    }
  }

  const { body, contentType } = createMultipartBody(
    {
      name: campaignDataName(),
      mimeType: CAMPAIGN_DATA_MIME_TYPE,
      appProperties: { homebrewry: 'campaign-data', schemaVersion: '1' }
    },
    data,
    CAMPAIGN_DATA_MIME_TYPE
  );
  const url = drive
    ? `${DRIVE_UPLOAD_API}/files/${drive.fileId}?uploadType=multipart&fields=id,name,modifiedTime,headRevisionId`
    : `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,modifiedTime,headRevisionId`;

  return driveRequest<DriveFile>(accessToken, url, {
    method: drive ? 'PATCH' : 'POST',
    headers: { 'Content-Type': contentType },
    body
  });
}

export async function listRemoteAssets(accessToken: string): Promise<RemoteAsset[]> {
  const query = encodeURIComponent("appProperties has { key='homebrewry' and value='asset' } and trashed = false");
  const fields = encodeURIComponent('files(id,name,mimeType,modifiedTime,headRevisionId,appProperties)');
  const result = await driveRequest<{ files?: DriveFile[] }>(
    accessToken,
    `${DRIVE_API}/files?q=${query}&fields=${fields}&orderBy=modifiedTime desc&pageSize=100`
  );
  const files = (result.files ?? []).filter((file) => Boolean(file.appProperties?.assetId));

  return Promise.all(files.map(async (file) => {
    const blob = await driveBlobRequest(accessToken, `${DRIVE_API}/files/${file.id}?alt=media`);
    const now = new Date().toISOString();
    return {
      file,
      asset: {
        id: file.appProperties?.assetId ?? crypto.randomUUID(),
        name: file.appProperties?.assetName ?? file.name,
        alt: file.appProperties?.assetAlt ?? file.name,
        mimeType: file.mimeType ?? blob.type,
        size: blob.size,
        blob,
        createdAt: file.appProperties?.createdAt ?? now,
        updatedAt: file.modifiedTime,
        drive: {
          fileId: file.id,
          revisionId: file.headRevisionId ?? '',
          lastSyncedAt: now
        },
        syncState: 'synced' as const
      }
    };
  }));
}

export async function uploadAsset(accessToken: string, asset: BrewAsset): Promise<DriveFile> {
  const { body, contentType } = createMultipartBlobBody(
    {
      name: asset.name,
      mimeType: asset.mimeType,
      appProperties: {
        homebrewry: 'asset',
        assetId: asset.id,
        assetName: asset.name,
        assetAlt: asset.alt,
        createdAt: asset.createdAt
      }
    },
    asset.blob
  );
  const url = asset.drive
    ? `${DRIVE_UPLOAD_API}/files/${asset.drive.fileId}?uploadType=multipart&fields=id,name,mimeType,modifiedTime,headRevisionId,appProperties`
    : `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,headRevisionId,appProperties`;
  return driveRequest<DriveFile>(accessToken, url, {
    method: asset.drive ? 'PATCH' : 'POST',
    headers: { 'Content-Type': contentType },
    body
  });
}

export class DriveConflictError extends Error {}
