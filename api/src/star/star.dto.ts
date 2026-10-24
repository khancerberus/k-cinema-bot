import type { MediaType } from '@/channel/channel.settings';

export interface Star {
  id: number;
  userId: number;
  tmdbId: number;
  channelId: string;
  mediaType?: MediaType;
  score: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubmitStarDto {
  channelId: string;
  userId: number;
  username: string;
  stars: number;
}

export type CreateStarDto = Omit<Star, 'id' | 'createdAt' | 'updatedAt'>;
