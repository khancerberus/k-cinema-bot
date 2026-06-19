export interface Star {
  username: string;
  score: number;
  createdAt: string;
}

export interface MovieDetails {
  tmdbId: number;
  title: string;
  year: string;
  director: string;
  synopsis: string;
  rating: number;
  lastWatched: string;
  posterUrl: string;
  stars: Star[];
}