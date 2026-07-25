import type { Brew } from '../types';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const MIME_TYPE = 'application/vnd.homebrewry.brew+json';

type DriveFile = {
  id: string;
  name: string;
  modifiedTime: string;
  headRevisionId?: string;
};

export type RemoteBrew = {
  file: DriveFile;
  brew: Brew;
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

function createMultipartBody(metadata: object, content: object) {
  const boundary = `homebrewry-${crypto.randomUUID()}`;
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${MIME_TYPE}`,
    '',
    JSON.stringify(content),
    `--${boundary}--`,
    ''
  ].join('\r\n');

  return { body, contentType: `multipart/related; boundary=${boundary}` };
}

function documentName(title: string) {
  const safeTitle = title.trim().replace(/[\\/:*?"<>|]/g, '-').slice(0, 100) || 'Untitled Brew';
  return `${safeTitle}.homebrewry.json`;
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
      mimeType: MIME_TYPE,
      appProperties: { homebrewry: 'brew', schemaVersion: '1' }
    },
    brew
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

export class DriveConflictError extends Error {}
