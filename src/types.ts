export type RendererSettings = {
  accentColor: string;
  parchmentTone: 'warm' | 'light';
};

export type Brew = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  rendererSettings: RendererSettings;
};

export type OutlineItem = {
  id: string;
  level: number;
  text: string;
};

export type ViewMode = 'split' | 'editor' | 'preview';
export type MobileSection = 'library' | 'editor' | 'preview' | 'outline';
