// Ítem de la lista de recomendaciones. recommendedBy es null si no consta en la DB
export interface RecommendationItem {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: string | null;
  posterUrl: string | null;
  recommendedBy: string | null;
  // ISO 8601
  recommendedAt: string | null;
}
