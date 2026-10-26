import {
  formatScores,
  parseDuration,
  parseItemReference,
  parseKCommand,
  parseScores,
  splitAppealArgs,
} from './star-input';

const GAME = [
  { key: 'graphics', label: 'Gráficos' },
  { key: 'sound', label: 'Sonido' },
  { key: 'control', label: 'Control' },
  { key: 'originality', label: 'Originalidad' },
];

describe('parseScores', () => {
  it('sin categorías acepta una sola nota (películas)', () => {
    expect(parseScores(['4.5'], [])).toEqual({
      ok: true,
      value: { score: 4.5, scores: {} },
    });
    expect(parseScores(['4', '3'], []).ok).toBe(false);
  });

  it('una nota se reparte a todas las categorías', () => {
    expect(parseScores(['4'], GAME)).toEqual({
      ok: true,
      value: {
        score: 4,
        scores: { graphics: 4, sound: 4, control: 4, originality: 4 },
      },
    });
  });

  it('una nota por categoría, en orden, y el promedio redondeado a un decimal', () => {
    const result = parseScores(['4', '3.5', '5', '4'], GAME);
    expect(result).toEqual({
      ok: true,
      value: {
        // 16.5 / 4 = 4.125
        score: 4.1,
        scores: { graphics: 4, sound: 3.5, control: 5, originality: 4 },
      },
    });
  });

  it('acepta coma decimal', () => {
    expect(parseScores(['3,5'], [])).toEqual({
      ok: true,
      value: { score: 3.5, scores: {} },
    });
  });

  it.each([
    [[]],
    [['abc']],
    [['0']],
    [['5.5']],
    [['3.3']],
    [['4', '4']],
    [['4', '4', '4', '4', '4']],
  ])('rechaza %j', (tokens) => {
    const result = parseScores(tokens, GAME);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Gráficos');
  });
});

describe('splitAppealArgs', () => {
  it('separa las notas del motivo', () => {
    expect(splitAppealArgs(['3', '3', '4', '3', 'me', 'equivoqué'])).toEqual({
      scoreTokens: ['3', '3', '4', '3'],
      reason: 'me equivoqué',
    });
    expect(splitAppealArgs(['4'])).toEqual({ scoreTokens: ['4'], reason: '' });
  });
});

describe('formatScores', () => {
  it('lista las notas en el orden de las categorías', () => {
    expect(
      formatScores(
        { sound: 3.5, graphics: 4, control: 5, originality: 4 },
        GAME,
      ),
    ).toBe('Gráficos 4 · Sonido 3.5 · Control 5 · Originalidad 4');
  });
});

describe('parseItemReference', () => {
  it('reconoce IDs y URLs', () => {
    expect(parseItemReference('movie', '603')).toEqual({ kind: 'id', id: 603 });
    expect(
      parseItemReference(
        'movie',
        'https://www.themoviedb.org/movie/603-the-matrix',
      ),
    ).toEqual({ kind: 'id', id: 603 });
    expect(
      parseItemReference('game', 'https://www.igdb.com/games/valheim'),
    ).toEqual({ kind: 'slug', slug: 'valheim' });
    // URL de otro sitio
    expect(
      parseItemReference('game', 'https://www.themoviedb.org/movie/603'),
    ).toBeNull();
  });

  it('en películas, un año al final afina la búsqueda', () => {
    expect(parseItemReference('movie', 'Matrix 1999')).toEqual({
      kind: 'search',
      query: 'Matrix',
      year: 1999,
    });
    expect(parseItemReference('game', 'FIFA 2004')).toEqual({
      kind: 'search',
      query: 'FIFA 2004',
    });
  });
});

describe('parseKCommand', () => {
  it('abre contenido con duración opcional', () => {
    expect(parseKCommand(['game', 'valheim'])).toEqual({
      action: 'open',
      mediaType: 'game',
      query: 'valheim',
    });
    expect(parseKCommand(['movie', 'Matrix', '1999', '15m'])).toEqual({
      action: 'open',
      mediaType: 'movie',
      query: 'Matrix 1999',
      minutes: 15,
    });
    expect(parseKCommand(['juego', 'hollow', 'knight', '20min'])).toMatchObject(
      {
        mediaType: 'game',
        query: 'hollow knight',
        minutes: 20,
      },
    );
  });

  it('cierra, alarga y resuelve apelaciones', () => {
    expect(parseKCommand(['close'])).toEqual({ action: 'close' });
    expect(parseKCommand(['extend', '5m'])).toEqual({
      action: 'extend',
      minutes: 5,
    });
    expect(parseKCommand(['aprobar', '@Fulano'])).toEqual({
      action: 'approve',
      username: 'fulano',
    });
    expect(parseKCommand(['rechazar', 'fulano'])).toEqual({
      action: 'reject',
      username: 'fulano',
    });
  });

  it('sin argumentos válidos muestra la ayuda', () => {
    expect(parseKCommand([])).toEqual({ action: 'help' });
    expect(parseKCommand(['game'])).toEqual({ action: 'help' });
    expect(parseKCommand(['serie', 'x'])).toEqual({ action: 'help' });
    expect(parseKCommand(['aprobar'])).toEqual({ action: 'help' });
  });

  it('parseDuration exige el sufijo m', () => {
    expect(parseDuration('15m')).toBe(15);
    expect(parseDuration('1999')).toBeNull();
  });
});
