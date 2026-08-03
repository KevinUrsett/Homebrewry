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

export type CalendarView = {
  year: number;
  monthIndex: number;
  day: number;
};

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
  view: CalendarView;
};

type CalendarState = CalendarSnapshot & {
  id: typeof RECORD_ID;
  drive?: DriveMetadata;
  syncState: SyncState;
};

type StoredCalendarState = Omit<CalendarState, 'view'> & { view?: unknown };

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
  view: CalendarView;
  status: string;
  syncState: SyncState;
  lastSavedAt?: string;
};

const DEFAULT_VIEW: CalendarView = { year: 641, monthIndex: 0, day: 1 };

const databasePromise = openDB(DATABASE_NAME, 1, {
  upgrade(database) {
    database.createObjectStore(STORE_NAME, { keyPath: 'id' });
  }
});

let mutationQueue: Promise<void> = Promise.resolve();

function enqueueMutation<T>(work: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(work, work);
  mutationQueue = result.then(() => undefined, () => undefined);
  return result;
}

function now() {
  return new Date().toISOString();
}

function clampView(view: CalendarView): CalendarView {
  const year = Number.isFinite(view.year) ? Math.min(9999, Math.max(1, Math.trunc(view.year))) : DEFAULT_VIEW.year;
  const monthIndex = Number.isFinite(view.monthIndex) ? Math.min(11, Math.max(0, Math.trunc(view.monthIndex))) : DEFAULT_VIEW.monthIndex;
  const day = Number.isFinite(view.day) ? Math.min(30, Math.max(1, Math.trunc(view.day))) : DEFAULT_VIEW.day;
  return { year, monthIndex, day };
}

function parseCalendarView(value: unknown): CalendarView {
  if (!isRecord(value)) return { ...DEFAULT_VIEW };
  return clampView({
    year: typeof value.year === 'number' ? value.year : DEFAULT_VIEW.year,
    monthIndex: typeof value.monthIndex === 'number' ? value.monthIndex : DEFAULT_VIEW.monthIndex,
    day: typeof value.day === 'number' ? value.day : DEFAULT_VIEW.day
  });
}

function sameView(left: CalendarView, right: CalendarView) {
  return left.year === right.year && left.monthIndex === right.monthIndex && left.day === right.day;
}

function emptyState(): CalendarState {
  return {
    id: RECORD_ID,
    schemaVersion: 1,
    updatedAt: now(),
    events: [],
    view: { ...DEFAULT_VIEW },
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
    events: value.events.map(parseCalendarEvent),
    view: parseCalendarView(value.view)
  };
}

async function getState(): Promise<CalendarState> {
  const database = await databasePromise;
  const stored = await database.get(STORE_NAME, RECORD_ID) as StoredCalendarState | undefined;
  if (!stored) return emptyState();
  return {
    ...stored,
    view: parseCalendarView(stored.view)
  };
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
  return {
    events: visibleEvents(state),
    view: state.view,
    status,
    syncState: state.syncState,
    ...(state.drive?.lastSyncedAt ? { lastSavedAt: state.drive.lastSyncedAt } : {})
  };
}

export async function loadCalendarEvents(options: { discardPending?: boolean } = {}): Promise<CalendarStoreResult> {
  await mutationQueue;
  const state = await getState();
  const token = getDriveAccessToken();

  if (isLocalPreviewMode()) {
    return result(state, state.syncState === 'pending' ? 'Unsaved preview calendar changes.' : 'Preview calendar loaded from this device.');
  }
  if (!token) {
    return result(state, state.syncState === 'pending' ? 'Unsaved calendar changes on this device.' : 'Login to Google Drive to load the calendar.');
  }

  try {
    const remote = (await listRemoteCalendars(token))[0];
    if (!remote) {
      return result(state, state.syncState === 'pending' ? 'Unsaved calendar changes on this device.' : 'No calendar has been saved to Google Drive yet.');
    }
    if (!options.discardPending && (state.syncState === 'pending' || state.syncState === 'error')) {
      return result(state, 'Unsaved calendar changes on this device.');
    }

    const synced: CalendarState = {
      id: RECORD_ID,
      ...remote.snapshot,
      drive: { fileId: remote.file.id, revisionId: remote.file.headRevisionId ?? '', lastSyncedAt: remote.file.modifiedTime },
      syncState: 'synced'
    };
    await putState(synced);
    return result(synced, 'Calendar loaded from Google Drive.');
  } catch (error) {
    const failed = { ...state, syncState: 'error' as const };
    await putState(failed);
    return result(failed, error instanceof Error ? error.message : 'Calendar load failed.');
  }
}

export function stageCalendarView(view: CalendarView): Promise<CalendarStoreResult> {
  return enqueueMutation(async () => {
    const state = await getState();
    const nextView = clampView(view);
    if (sameView(state.view, nextView)) {
      return result(state, state.syncState === 'pending' ? 'Unsaved calendar changes.' : 'Calendar date unchanged.');
    }
    const next: CalendarState = {
      ...state,
      view: nextView,
      updatedAt: now(),
      syncState: 'pending'
    };
    await putState(next);
    return result(next, 'Unsaved calendar changes.');
  });
}

export function saveCalendarEvent(event: BelentorCalendarEvent, view?: CalendarView): Promise<CalendarStoreResult> {
  return enqueueMutation(async () => {
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
      view: view ? clampView(view) : state.view,
      syncState: 'pending'
    };
    await putState(next);
    return result(next, 'Calendar entry applied. Save Calendar to store it in Google Drive.');
  });
}

export function deleteCalendarEvent(id: string, view?: CalendarView): Promise<CalendarStoreResult> {
  return enqueueMutation(async () => {
    const state = await getState();
    const timestamp = now();
    const events = state.events.map((event) => event.id === id
      ? { ...event, updatedAt: timestamp, deletedAt: timestamp }
      : event);
    const next: CalendarState = {
      ...state,
      updatedAt: timestamp,
      events,
      view: view ? clampView(view) : state.view,
      syncState: 'pending'
    };
    await putState(next);
    return result(next, 'Calendar entry removed. Save Calendar to store the change in Google Drive.');
  });
}

export function saveCalendarToDrive(view?: CalendarView): Promise<CalendarStoreResult> {
  return enqueueMutation(async () => {
    const state = await getState();
    const timestamp = now();
    const pending: CalendarState = {
      ...state,
      view: view ? clampView(view) : state.view,
      updatedAt: timestamp,
      syncState: 'pending'
    };
    await putState(pending);

    if (isLocalPreviewMode()) {
      const local: CalendarState = { ...pending, syncState: 'local' };
      await putState(local);
      return result(local, 'Preview calendar saved on this device.');
    }

    const token = getDriveAccessToken();
    if (!token) return result(pending, 'Login to Google Drive before saving the calendar.');

    try {
      const remote = (await listRemoteCalendars(token))[0];
      const snapshot: CalendarSnapshot = {
        schemaVersion: 1,
        updatedAt: timestamp,
        events: remote ? mergeEvents(remote.snapshot.events, pending.events) : pending.events,
        view: pending.view
      };
      const file = await uploadCalendar(token, snapshot, remote?.file);
      const synced: CalendarState = {
        id: RECORD_ID,
        ...snapshot,
        drive: { fileId: file.id, revisionId: file.headRevisionId ?? '', lastSyncedAt: file.modifiedTime || timestamp },
        syncState: 'synced'
      };
      await putState(synced);
      return result(synced, 'Calendar saved to Google Drive.');
    } catch (error) {
      const failed = { ...pending, syncState: 'error' as const };
      await putState(failed);
      return result(failed, error instanceof Error ? error.message : 'Calendar save failed.');
    }
  });
}
