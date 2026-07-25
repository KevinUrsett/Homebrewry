import { describe, expect, it } from 'vitest';
import { createAsset, MAX_IMAGE_SIZE } from './assetStore';

describe('createAsset', () => {
  it('creates a local image record with a stable identifier', () => {
    const file = new File(['pixels'], 'ashen-road.png', { type: 'image/png' });
    const asset = createAsset(file, 'Ash-covered road');

    expect(asset).toMatchObject({ name: 'ashen-road.png', alt: 'Ash-covered road', mimeType: 'image/png', syncState: 'local' });
    expect(asset.id).toBeTruthy();
  });

  it('rejects unsafe image formats and oversized files', () => {
    expect(() => createAsset(new File(['svg'], 'unsafe.svg', { type: 'image/svg+xml' }))).toThrow('PNG, JPEG, WebP, or GIF');
    expect(() => createAsset(new File([new Uint8Array(MAX_IMAGE_SIZE + 1)], 'large.png', { type: 'image/png' }))).toThrow('8 MB');
  });
});
