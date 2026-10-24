interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

// Páginas visibles: la primera, la última y dos a cada lado de la actual; el resto se resume con "…"
const visiblePages = (page: number, totalPages: number) => {
  const pages: Array<number | "gap"> = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 2) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "gap") {
      pages.push("gap");
    }
  }
  return pages;
};

const buttonClassName =
  "min-w-9 border px-2 py-1 rounded text-sm transition-colors duration-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

export const Pagination = ({ page, totalPages, onChange }: PaginationProps) => {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Paginación" className="flex flex-row flex-wrap items-center justify-center gap-2 py-4">
      <button
        className={`${buttonClassName} border-[#cf0060]/60 text-gray-300 hover:border-[#00fff9] hover:text-[#00fff9]`}
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Página anterior"
      >
        «
      </button>

      {visiblePages(page, totalPages).map((item, index) =>
        item === "gap" ? (
          <span key={`gap-${index}`} className="text-stone-500 px-1">
            …
          </span>
        ) : (
          <button
            key={item}
            className={`${buttonClassName} ${
              item === page
                ? "border-[#00fff9] bg-[#00fff9]/15 text-[#00fff9] font-bold"
                : "border-[#cf0060]/60 text-gray-300 hover:border-[#00fff9] hover:text-[#00fff9]"
            }`}
            onClick={() => onChange(item)}
            aria-current={item === page ? "page" : undefined}
          >
            {item}
          </button>
        ),
      )}

      <button
        className={`${buttonClassName} border-[#cf0060]/60 text-gray-300 hover:border-[#00fff9] hover:text-[#00fff9]`}
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Página siguiente"
      >
        »
      </button>
    </nav>
  );
};
