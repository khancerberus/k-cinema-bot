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

// Comandos del bot personalizables por canal
export interface ChannelCommands {
  // !kcinema: {url} se reemplaza por el enlace al perfil del canal
  kcinema: { message: string };
}

export interface ChannelSettings {
  sections: ChannelSection[];
  hidden: HiddenItem[];
  // Opcional: los canales creados antes de existir no lo tienen guardado
  commands?: ChannelCommands;
}

export const MEDIA_TYPES: MediaType[] = ['movie'];
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
});
