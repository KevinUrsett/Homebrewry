import type { BrewAsset } from '../types';
import { ASSET_STORE_NAME, getDatabase } from './brewStore';

export const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
export const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function createAsset(file: File, alt = file.name.replace(/\.[^.]+$/, '')): BrewAsset {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) throw new Error('Use a PNG, JPEG, WebP, or GIF image.');
  if (file.size > MAX_IMAGE_SIZE) throw new Error('Images must be 8 MB or smaller.');
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    name: file.name,
    alt: alt.trim() || 'Brew illustration',
    mimeType: file.type,
    size: file.size,
    blob: file,
    createdAt: now,
    updatedAt: now,
    syncState: 'local'
  };
}

export async function listAssets(): Promise<BrewAsset[]> {
  const database = await getDatabase();
  const assets = await database.getAll(ASSET_STORE_NAME) as BrewAsset[];
  return assets.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function saveAsset(asset: BrewAsset): Promise<void> {
  const database = await getDatabase();
  await database.put(ASSET_STORE_NAME, asset);
}

export async function replaceAssets(assets: BrewAsset[]): Promise<void> {
  const database = await getDatabase();
  const transaction = database.transaction(ASSET_STORE_NAME, 'readwrite');
  await Promise.all(assets.map((asset) => transaction.store.put(asset)));
  await transaction.done;
}
