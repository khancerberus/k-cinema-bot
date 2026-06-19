export const NavBar = () => {
  return (
    <nav className="flex items-center h-14 px-4 py-2 gap-6">
      <h1 className="text-2xl font-bold font-bebaskai">
        <a href="/">K-Cinema Bot</a>
      </h1>

      <div className="flex gap-4">
        <a href="#" className="text-white hover:text-[#ffa300]">
          Recomendaciones
        </a>
        <a href="/rated-movies" className="text-white hover:text-[#ffa300]">
          Rated Movies
        </a>
        <a href="/current-movie" className="text-white hover:text-[#ffa300]">
          Current Movie
        </a>
      </div>
    </nav>
  );
};
