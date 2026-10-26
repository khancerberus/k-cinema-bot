import {
  activeCategories,
  defaultChannelSettings,
  resolveSettings,
  type ChannelSettings,
} from './channel.settings';

describe('resolveSettings', () => {
  it('rellena los ajustes que no tienen los canales antiguos', () => {
    const legacy: ChannelSettings = { sections: [], hidden: [] };
    const resolved = resolveSettings(legacy);

    expect(resolved.voting.defaultMinutes).toBe(10);
    expect(resolved.appeals.enabled).toBe(true);
    expect(resolved.rating.categories.movie).toEqual([]);
    expect(resolved.rating.categories.game.map((c) => c.key)).toEqual([
      'graphics',
      'sound',
      'control',
      'originality',
    ]);
  });

  it('respeta lo guardado y omite las categorías archivadas al votar', () => {
    const settings: ChannelSettings = {
      ...defaultChannelSettings(),
      rating: {
        categories: {
          movie: [],
          game: [
            { key: 'graphics', label: 'Visual' },
            { key: 'sound', label: 'Sonido', archived: true },
          ],
        },
      },
    };

    expect(activeCategories(settings, 'game')).toEqual([
      { key: 'graphics', label: 'Visual' },
    ]);
    expect(activeCategories(settings, 'movie')).toEqual([]);
  });
});
