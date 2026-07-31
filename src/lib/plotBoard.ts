import type { PlotBoard } from '../types';

export function createBlankPlotBoard(timestamp = new Date().toISOString()): PlotBoard {
  return { phases: [], lanes: [], beats: [], links: [], updatedAt: timestamp };
}
