export interface Star {
  id: number;
  userId: number;
  tmdbId: number;
  score: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubmitStarDto {
  channelUsername: string;
  userId: number;
  username: string;
  stars: number;
}

export type CreateStarDto = Omit<Star, 'id' | 'createdAt' | 'updatedAt'>;
