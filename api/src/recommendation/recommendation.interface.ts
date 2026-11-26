export interface IRecommendation {
  id: number;
  userId: string;
  username: string;
  tmdbId: number;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateRecommendation = Omit<
  IRecommendation,
  'id' | 'createdAt' | 'updatedAt'
>;

// Ítem de la lista de recomendaciones de TMDB con quién lo recomendó, si consta en la DB
export interface RecommendationItem {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  year: string | null;
  posterUrl: string | null;
  recommendedBy: string | null;
  recommendedAt: Date | null;
}

export interface RecommendationBody {
  userId: string;
  username: string;
  movieOrTmdbId: string;
}
