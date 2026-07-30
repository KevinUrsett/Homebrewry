import type { CampaignMap } from '../types';

export function createBlankCampaignMap(timestamp = new Date().toISOString()): CampaignMap {
  return { nodes: [], links: [], updatedAt: timestamp };
}
