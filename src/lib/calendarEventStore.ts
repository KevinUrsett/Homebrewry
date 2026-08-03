import { openDB } from 'idb';
import type { DriveMetadata, SyncState } from '../types';
import { getDriveAccessToken, invalidateDriveAccessToken } from './googleIdentity';
import { isLocalPreviewMode } from './runtimeMode';

const DATABASE_NAME = 'homebrewry-calendar';
const STORE_NAME = 'calendar-state';
const RECORD_ID = 'belentor-calendar';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const CALENDAR_MIME_TYPE = 'application/vnd.homebrewry.calendar+json';

export const calendarEventKinds = ['holiday', 'major-event', 'event', 'note'] as const;
export type CalendarEventKind = (typeof calendarEventKinds)[number];

export type BelentorCalendarEvent = {
  id: string;
  title: string;
  notes: string;
  kind: CalendarEventKind;
  year: number;
  monthIndex: number;
  day: number;
  annual: boolean;
  worldbuildingIds: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

type CalendarSnapshot = {
  schemaVersion: 1;
  updatedAt: string;
  events: BelentorCalendarEvent[];
};

type CalendarState = CalendarSnapshot & {
  id: typeof RECORD_ID;
  drive?: DriveMetadata;
  syncState: SyncState;
};

type DriveFile = {
  id: string;
  name: string;
  modifiedTime: string;
  headRevisionId?: string;
};

type RemoteCalendar = {
  file: DriveFile;
  snapshot: CalendarSnapshot;
};

export type CalendarStoreResult = {
  events: BelentorCalendarEvent[];
  status: string;
  syncState: SyncState;
};

const databasePromise = openDB(DATABASE_NAME, 1, {
  upgrade(database) {
    database.createObjectStore(STORE_NAME, { keyPath: 'id' });
  }
});

function now() {
  return new Date().toISOString();
}

function emptyState(): CalendarState {
  return {
    id: RECORD_ID,
    schemaVersion: 1,
    updatedAt: now(),
    events: [],
    syncState: 'local'
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCalendarEvent(value: unknown): BelentorCalendarEvent {
  if (!isRecord(value)) throw new Error('The Drive calendar contains an invalid entry.');
  if (typeof value.id !== 'string' || typeof value.title !== 'string' || typeof value.notes !== 'string') {
    throw new Error('The Drive calendar contains an invalid entry.');
  }
  if (!calendarEventKinds.includes(value.kind as CalendarEventKind)) {
    throw new Error('The Drive calendar contains an invalid entry type.');
  }
  if (typeof value.year !== 'number' || !Number.isInteger(value.year) || value.year < 1 || value.year > 9999) {
    throw new Error('The Drive calendar contains an invalid year.');
  }
  if (typeof value.monthIndex !== 'number' || !Number.isInteger(value.monthIndex) || value.monthIndex < 0 || value.monthIndex > 11) {
    throw new Error('The Drive calendar contains an invalid month.');
  }
  if (typeof value.day !== 'number' || !Number.isInteger(value.day) || value.day < 1 || value.day > 30) {
    throw new Error('The Drive calendar contains an invalid day.');
  }
  if (!Array.isArray(value.worldbuildingIds) || value.worldbuildingIds.some((item) => typeof item !== 'string')) {
    throw new Error('The Drive calendar contains invalid Worldbuilding links.');
  }
  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') {
    throw new Error('The Drive calendar contains invalid timestamps.');
  }
  if (value.deletedAt !== undefined && typeof value.deletedAt !== 'string') {
    throw new Error('The Drive calendar contains an invalid deletion marker.');
  }
  return {
    id: value.id,
    title: value.title,
    notes: value.notes,
    kind: value.kind as CalendarEventKind,
    year: value.year,
    monthIndex: value.monthIndex,
    day: value.day,
    annual: value.annual === true,
    worldbuildingIds: [...value.worldbuildingIds] as string[],
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    ...(value.deletedAt === undefined ? {} : { deletedAt: value.deletedAt })
  };
}

function parseSnapshot(value: unknown): CalendarSnapshot {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.updatedAt !== 'string' || !Array.isArray(value.events)) {
    throw new Error('This Drive file is not a supported Homebrewry calendar.');
  }
  return {
    schemaVersion: 1,
    updatedAt: value.updatedAt,
    events: value.events.map(parseCalendarEvent)
  };
}

async function getState(): Promise<CalendarState> {
  const database = await databasePromise;
  const stored = await database.get(STORE_NAME, RECORD_ID) as CalendarState | undefined;
  return stored ?? emptyState();
}

async function putState(state: CalendarState) {
  const database = await databasePromise;
  await database.put(STORE_NAME, state);
}

function currentToken(fallback: string) {
  return getDriveAccessToken() ?? fallback;
}

async function driveRequest<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${currentToken(token)}`,
      ...init?.headers
    }
  });
  if (response.status === 401) invalidateDriveAccessToken();
  if (!response.ok) throw new Error(`Google Drive calendar request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

function createMultipartBody(metadata: object, content: object) {
  const boundary = `homebrewry-calendar-${crypto.randomUUID()}`;
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${CALENDAR_MIME_TYPE}`,
    '',
    JSON.stringify(content),
    `--${boundary}--`,
    ''
  ].join('\r\n');
  return { body, contentType: `multipart/related; boundary=${boundary}` };
}

async function listRemoteCalendars(token: string): Promise<RemoteCalendar[]> {
  const query = encodeURIComponent("appProperties has { key='homebrewry' and value='calendar-data' } and trashed = false");
  const fields = encodeURIComponent('files(id,name,modifiedTime,headRevisionId)');
  const result = await driveRequest<{ files?: DriveFile[] }>(
    token,
    `${DRIVE_API}/files?q=${query}&fields=${fields}&orderBy=modifiedTime desc&pageSize=10`
  );
  return Promise.all((result.files ?? []).map(async (file) => ({
    file,
    snapshot: parseSnapshot(await driveRequest<unknown>(token, `${DRIVE_API}/files/${file.id}?alt=media`))
  })));
}

async function uploadCalendar(token: string, snapshot: CalendarSnapshot, file?: DriveFile): Promise<DriveFile> {
  const { body, contentType } = createMultipartBody(
    {
      name: 'Homebrewry Belentor calendar.homebrewry.json',
      mimeType: CALENDAR_MIME_TYPE,
      appProperties: { homebrewry: 'calendar-data', schemaVersion: '1' }
    },
    snapshot
  );
  const url = file
    ? `${DRIVE_UPLOAD_API}/files/${file.id}?uploadType=multipart&fields=id,name,modifiedTime,headRevisionId`
    : `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,modifiedTime,headRevisionId`;
  return driveRequest<DriveFile>(token, url, {
    method: file ? 'PATCH' : 'POST',
    headers: { 'Content-Type': contentType },
    body
  });
}

function eventTimestamp(event: BelentorCalendarEvent) {
  return event.deletedAt && event.deletedAt > event.updatedAt ? event.deletedAt : event.updatedAt;
}

function mergeEvents(remote: BelentorCalendarEvent[], local: BelentorCalendarEvent[]) {
  const merged = new Map(remote.map((event) => [event.id, event]));
  for (const event of local) {
    const existing = merged.get(event.id);
    if (!existing || eventTimestamp(event) >= eventTimestamp(existing)) merged.set(event.id, event);
  }
  return [...merged.values()].sort((left, right) => {
    if (left.year !== right.year) return left.year - right.year;
    if (left.monthIndex !== right.monthIndex) return left.monthIndex - right.monthIndex;
    if (left.day !== right.day) return left.day - right.day;
    return left.title.localeCompare(right.title);
  });
}

function visibleEvents(state: CalendarState) {
  return state.events.filter((event) => !event.deletedAt);
}

function result(state: CalendarState, status: string): CalendarStoreResult {
  return { events: visibleEvents(state), status, syncState: state.syncState };
}

async function syncState(state: CalendarState): Promise<CalendarStoreResult> {
  const token = getDriveAccessToken();
  if (!token || isLocalPreviewMode()) {
    return result(state, isLocalPreviewMode() ? 'Preview calendar saved on this device.' : 'Calendar saved locally. Connect Drive to sync.');
  }

  const remoteCalendars = await listRemoteCalendars(token);
  const remote = remoteCalendars[0];

  if (!remote) {
    const snapshot: CalendarSnapshot = { schemaVersion: 1, updatedAt: state.updatedAt, events: state.events };
    const file = await uploadCalendar(token, snapshot);
    const synced: CalendarState = {
      ...state,
      drive: { fileId: file.id, revisionId: file.headRevisionId ?? '', lastSyncedAt: now() },
      syncState: 'synced'
    };
    await putState(synced);
    return result(synced, 'Calendar saved to Google Drive.');
  }

  const shouldAdoptRemote = state.events.length === 0 && !state.drive;
  const mergedEvents = shouldAdoptRemote ? remote.snapshot.events : mergeEvents(remote.snapshot.events, state.events);
  const mergedChangedRemote = JSON.stringify(mergedEvents) !== JSON.stringify(remote.snapshot.events);
  const snapshot: CalendarSnapshot = {
    schemaVersion: 1,
    updatedAt: mergedChangedRemote ? now() : remote.snapshot.updatedAt,
    events: mergedEvents
  };
  const file = mergedChangedRemote ? await uploadCalendar(token, snapshot, remote.file) : remote.file;
  const synced: CalendarState = {
    id: RECORD_ID,
    ...snapshot,
    drive: { fileId: file.id, revisionId: file.headRevisionId ?? '', lastSyncedAt: now() },
    syncState: 'synced'
  };
  await putState(synced);
  return result(synced, mergedChangedRemote ? 'Calendar changes synced to Google Drive.' : 'Calendar loaded from Google Drive.');
}

export async function loadCalendarEvents(): Promise<CalendarStoreResult> {
  const state = await getState();
  try {
    return await syncState(state);
  } catch (error) {
    const failed = { ...state, syncState: 'error' as const };
    await putState(failed);
    return result(failed, error instanceof Error ? error.message : 'Calendar sync failed.');
  }
}

export async function saveCalendarEvent(event: BelentorCalendarEvent): Promise<CalendarStoreResult> {
  const state = await getState();
  const timestamp = now();
  const saved: BelentorCalendarEvent = {
    ...event,
    title: event.title.trim(),
    notes: event.notes.trim(),
    worldbuildingIds: [...new Set(event.worldbuildingIds)],
    updatedAt: timestamp,
    deletedAt: undefined
  };
  const next: CalendarState = {
    ...state,
    updatedAt: timestamp,
    events: [saved, ...state.events.filter((item) => item.id !== saved.id)],
    syncState: getDriveAccessToken() && !isLocalPreviewMode() ? 'pending' : 'local'
  };
  await putState(next);
  try {
    return await syncState(next);
  } catch (error) {
    const failed = { ...next, syncState: 'error' as const };
    await putState(failed);
    return result(failed, error instanceof Error ? error.message : 'Calendar sync failed.');
  }
}

export async function deleteCalendarEvent(id: string): Promise<CalendarStoreResult> {
  const state = await getState();
  const timestamp = now();
  const events = state.events.map((event) => event.id === id
    ? { ...event, updatedAt: timestamp, deletedAt: timestamp }
    : event);
  const next: CalendarState = {
    ...state,
    updatedAt: timestamp,
    events,
    syncState: getDriveAccessToken() && !isLocalPreviewMode() ? 'pending' : 'local'
  };
  await putState(next);
  try {
    return await syncState(next);
  } catch (error) {
    const failed = { ...next, syncState: 'error' as const };
    await putState(failed);
    return result(failed, error instanceof Error ? error.message : 'Calendar sync failed.');
  }
}
