export const NavBar = () => {
  return (
    <nav className="flex items-center h-14 px-4 py-2 gap-6">
      <h1 className="text-2xl font-bold font-bebaskai">K-Cinema Bot</h1>

      <div className="flex gap-4">
        <a href="#" className="text-white hover:text-[#ffa300]">Recomendaciones</a>
        <a href="#" className="text-white hover:text-[#ffa300]">Stars</a>
        <a href="#" className="text-white hover:text-[#ffa300]">Current Movie</a>
      </div>
    </nav>
  );
};
