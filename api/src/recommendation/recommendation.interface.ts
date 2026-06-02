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

export interface RecommendationBody {
  userId: string;
  username: string;
  movieOrTmdbId: string;
}
