interface MoviePosterProps {
  posterUrl: string;
  title: string;
  year: string;
  className?: string;
}

// La API devuelve "No poster available" cuando TMDB no tiene póster
export const MoviePoster = ({ posterUrl, title, year, className = "" }: MoviePosterProps) => {
  if (!posterUrl.startsWith("http")) {
    return (
      <div
        className={`flex items-center justify-center bg-[#cf0060]/20 text-stone-500 text-xs text-center p-1 ${className}`}
      >
        Sin póster
      </div>
    );
  }

  return (
    <img
      className={`object-cover ${className}`}
      src={posterUrl}
      alt={`${title} (${year}) poster`}
      loading="lazy"
    />
  );
};
