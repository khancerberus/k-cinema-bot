export interface MovieStarProps {
  title: string;
  year: string;
  director: string;
  synopsis: string;
  rating: number;
  lastWatched: string;
  posterUrl: string;
}

export const MovieStar = ({
  title,
  year,
  director,
  synopsis,
  rating,
  lastWatched,
  posterUrl,
}: MovieStarProps) => {
  return (
    <div className="flex items-center gap-4 outline-2 outline-[#cf0060] rounded-xl p-2 w-full h-42 relative hover:bg-[#cf0060]/10 transition-all duration-300 cursor-pointer hover:shadow-md hover:shadow-[#cf0060]/60">
      <div className="w-24 h-36 shrink-0">
        <img src={posterUrl} alt={title + " (" + year + ") poster"} />
      </div>

      <div className="flex-1 flex flex-col gap-2 h-full justify-between items-start">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-[#ff2a4b]">
            {title} ({year})
          </h2>
          <p>
            <span className="font-bold">Director:</span> {director}
          </p>
          <p>
            <span className="font-bold">Sinopsis:</span> {synopsis}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center text-lg px-4">
        <p className="text-md font-bold">Rating Promedio</p>
        <span className="text-4xl text-[#ffa300]">{rating}★</span>
      </div>

      <div className="absolute right-2 bottom-1 text-sm text-[#00fff9] opacity-90 ">
        <p><span className="font-bold">Ultima vez visto:</span> {lastWatched}</p>
      </div>
    </div>
  );
};
