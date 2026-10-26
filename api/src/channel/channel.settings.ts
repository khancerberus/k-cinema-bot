// Tipos de contenido que se pueden puntuar. A futuro: 'series', ...
export type MediaType = 'movie' | 'game';

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

// Comandos del bot personalizables por canal
export interface ChannelCommands {
  // !kcinema: {url} se reemplaza por el enlace al perfil del canal
  kcinema: { message: string };
}

// Categoría de puntuación. La key no cambia nunca: renombrar solo cambia la label
// y quitar una categoría la archiva, así los votos antiguos siguen teniendo nombre.
export interface RatingCategory {
  key: string;
  label: string;
  archived?: boolean;
}

export interface RatingSettings {
  // Sin categorías activas se puntúa con una sola nota (como las películas)
  categories: Record<MediaType, RatingCategory[]>;
}

// Ventana de votación: tiempo que se puede puntuar tras activar un contenido
export interface VotingSettings {
  defaultMinutes: number;
}

// !apelar: pedir la corrección de un voto equivocado
export interface AppealSettings {
  enabled: boolean;
}

export interface ChannelSettings {
  sections: ChannelSection[];
  hidden: HiddenItem[];
  // Opcionales: los canales creados antes de existir no los tienen guardados
  commands?: ChannelCommands;
  rating?: RatingSettings;
  voting?: VotingSettings;
  appeals?: AppealSettings;
}

export type ResolvedChannelSettings = Required<ChannelSettings>;

export const MEDIA_TYPES: MediaType[] = ['movie', 'game'];

export const MAX_CATEGORIES = 6;
export const MAX_CATEGORY_LABEL_LENGTH = 20;
export const CATEGORY_KEY_PATTERN = /^[a-z0-9_-]{1,20}$/;
export const MIN_VOTING_MINUTES = 10;
export const MAX_VOTING_MINUTES = 240;
export const DEFAULT_VOTING_MINUTES = 10;

export const defaultRatingSettings = (): RatingSettings => ({
  categories: {
    movie: [],
    game: [
      { key: 'graphics', label: 'Gráficos' },
      { key: 'sound', label: 'Sonido' },
      { key: 'control', label: 'Control' },
      { key: 'originality', label: 'Originalidad' },
    ],
  },
});

// Ajustes con valores por defecto en lo que no esté guardado
export const resolveSettings = (
  settings: ChannelSettings,
): ResolvedChannelSettings => {
  const defaults = defaultRatingSettings();
  return {
    ...settings,
    commands: settings.commands ?? defaultChannelCommands(),
    rating: {
      categories: Object.fromEntries(
        MEDIA_TYPES.map((mediaType) => [
          mediaType,
          settings.rating?.categories?.[mediaType] ??
            defaults.categories[mediaType],
        ]),
      ) as Record<MediaType, RatingCategory[]>,
    },
    voting: settings.voting ?? { defaultMinutes: DEFAULT_VOTING_MINUTES },
    appeals: settings.appeals ?? { enabled: true },
  };
};

// Categorías con las que se vota ahora (sin las archivadas)
export const activeCategories = (
  settings: ChannelSettings,
  mediaType: MediaType,
) =>
  resolveSettings(settings)
    .rating.categories[mediaType].filter((category) => !category.archived)
    .map(({ key, label }) => ({ key, label }));
export const SECTION_KINDS: SectionKind[] = ['top-best', 'top-worst', 'recent'];
export const MIN_SECTION_SIZE = 1;
export const MAX_SECTION_SIZE = 20;

export const KCINEMA_URL_PLACEHOLDER = '{url}';
export const DEFAULT_KCINEMA_MESSAGE = 'Bienvenido a mi perfil: {url}';
export const MAX_KCINEMA_MESSAGE_LENGTH = 300;

export const defaultChannelCommands = (): ChannelCommands => ({
  kcinema: { message: DEFAULT_KCINEMA_MESSAGE },
});

// Mensaje de !kcinema con el enlace al perfil. Si el mensaje no incluye {url}, se añade al final
export const buildKcinemaMessage = (settings: ChannelSettings, url: string) => {
  const message =
    settings.commands?.kcinema?.message || DEFAULT_KCINEMA_MESSAGE;
  return message.includes(KCINEMA_URL_PLACEHOLDER)
    ? message.split(KCINEMA_URL_PLACEHOLDER).join(url)
    : `${message} ${url}`;
};

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
  commands: defaultChannelCommands(),
  rating: defaultRatingSettings(),
  voting: { defaultMinutes: DEFAULT_VOTING_MINUTES },
  appeals: { enabled: true },
});
