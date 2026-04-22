export interface Character {
  id: string;
  name: string;
  imageUrl: string; // base64
}

export type MangaStyle = 'Hokuto no Ken' | 'Dragon Ball' | 'Standard Manga' | 'Noir' | 'Sci-Fi';

export type PageLayout = 'TITLE_SPREAD' | 'TITLE_SINGLE' | 'LAYOUT_3_A' | 'LAYOUT_4_A' | 'LAYOUT_5_A';

export interface Panel {
  id: string;
  description: string;
  style: MangaStyle;
  imageUrl?: string;
  isGenerating?: boolean;
}

export interface MangaPage {
  id: string;
  title: string;
  panels: Panel[];
  layout: PageLayout;
}
