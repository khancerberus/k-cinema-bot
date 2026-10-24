export interface SetMovieBody {
  tmdbId: number;
  // Si es true, el bot avisa en el chat que ya se puede puntuar
  announce?: boolean;
}
