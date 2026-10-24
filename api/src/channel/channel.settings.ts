// Tipos de contenido que se pueden puntuar. A futuro: 'series', 'game', ...
export type MediaType = 'movie';

export type SectionKind = 'top-best' | 'top-worst' | 'recent';

export interface ChannelSection {
  id: string;
  kind: SectionKind;
  mediaType: MediaType;
  title: string;
  size: number;
}

export interface HiddenItem {
  mediaType: MediaType;
  tmdbId: number;
}

export interface ChannelSettings {
  sections: ChannelSection[];
  hidden: HiddenItem[];
}

export const MEDIA_TYPES: MediaType[] = ['movie'];
export const SECTION_KINDS: SectionKind[] = ['top-best', 'top-worst', 'recent'];
export const MIN_SECTION_SIZE = 1;
export const MAX_SECTION_SIZE = 20;

export const defaultChannelSettings = (): ChannelSettings => ({
  sections: [
    {
      id: 'best',
      kind: 'top-best',
      mediaType: 'movie',
      title: 'Top 5 mejores',
      size: 5,
    },
    {
      id: 'worst',
      kind: 'top-worst',
      mediaType: 'movie',
      title: 'Top 5 peores',
      size: 5,
    },
    {
      id: 'recent',
      kind: 'recent',
      mediaType: 'movie',
      title: 'Últimas vistas',
      size: 10,
    },
  ],
  hidden: [],
});
