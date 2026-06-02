export interface SetMovieBody {
  channelUsername: string;
  tmdbId: number;
}

export interface SendRecommendationBody {
  channelUsername: string;
  recommendation: string;
  userId: string;
  username: string;
}
