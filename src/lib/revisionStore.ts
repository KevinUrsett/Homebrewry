export type BrewRevision = {
  id: string;
  brewId: string;
  title: string;
  content: string;
  createdAt: string;
};

const databaseName = 'homebrewry-local-revisions';
const storeName = 'revisions';
const maxRevisionsPerBrew = 20;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (database.objectStoreNames.contains(storeName)) return;
      const store = database.createObjectStore(storeName, { keyPath: 'id' });
      store.createIndex('brewId', 'brewId', { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open revision storage.'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Revision storage request failed.'));
  });
}

export async function listBrewRevisions(brewId: string): Promise<BrewRevision[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, 'readonly');
    const index = transaction.objectStore(storeName).index('brewId');
    const revisions = await requestResult(index.getAll(brewId) as IDBRequest<BrewRevision[]>);
    return revisions.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  } finally {
    database.close();
  }
}

export async function saveBrewRevision(revision: BrewRevision): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(revision);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not save revision.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Revision save was aborted.'));
    });
  } finally {
    database.close();
  }

  const revisions = await listBrewRevisions(revision.brewId);
  const stale = revisions.slice(maxRevisionsPerBrew);
  if (!stale.length) return;

  const cleanupDatabase = await openDatabase();
  try {
    const transaction = cleanupDatabase.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    stale.forEach((item) => store.delete(item.id));
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not trim revision history.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Revision cleanup was aborted.'));
    });
  } finally {
    cleanupDatabase.close();
  }
}
