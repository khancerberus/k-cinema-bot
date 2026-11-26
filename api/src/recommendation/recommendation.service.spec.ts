import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { RecommendationService } from './recommendation.service';
import { Recommendation } from './recommendation.model';
import { TmdbService } from '@/tmdb/tmdb.service';
import { LowRatedRecommendationException } from '@/exceptions/low-rated-rec.exception';

describe('RecommendationService', () => {
  let service: RecommendationService;
  const tmdb = { getMovie: jest.fn(), addMovieToList: jest.fn() };
  const model = { create: jest.fn() };

  const body = {
    userId: '1',
    username: 'pepe',
    movieOrTmdbId: 'https://www.themoviedb.org/movie/123-algo',
  };
  const movie = (vote_average: number, vote_count: number) => ({
    title: 'Peli',
    release_date: '2000-01-01',
    vote_average,
    vote_count,
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    tmdb.addMovieToList.mockResolvedValue('added');
    model.create.mockResolvedValue({ id: 1 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationService,
        { provide: TmdbService, useValue: tmdb },
        { provide: getModelToken(Recommendation), useValue: model },
      ],
    }).compile();

    service = module.get<RecommendationService>(RecommendationService);
  });

  it('rechaza sin guardar una peli con ≤ 50% en TMDB', async () => {
    tmdb.getMovie.mockResolvedValue(movie(5, 300));

    await expect(service.recommend(body)).rejects.toBeInstanceOf(
      LowRatedRecommendationException,
    );
    expect(tmdb.addMovieToList).not.toHaveBeenCalled();
    expect(model.create).not.toHaveBeenCalled();
  });

  it('guarda una peli con más de 50% en TMDB', async () => {
    tmdb.getMovie.mockResolvedValue(movie(5.1, 300));

    await expect(service.recommend(body)).resolves.toContain('Peli (2000)');
    expect(tmdb.addMovieToList).toHaveBeenCalledWith(123, 8655050);
    expect(model.create).toHaveBeenCalled();
  });

  it('acepta una peli sin votos en TMDB', async () => {
    tmdb.getMovie.mockResolvedValue(movie(0, 0));

    await expect(service.recommend(body)).resolves.toContain('Peli');
    expect(model.create).toHaveBeenCalled();
  });
});
