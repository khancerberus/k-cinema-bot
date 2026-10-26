import type { CategoryAverage } from "../types/movie-star.type";

interface CategoryBarsProps {
  categories: CategoryAverage[];
  // compact: versión pequeña para las tarjetas de la lista
  compact?: boolean;
}

const MAX_SCORE = 5;

// Promedio de cada categoría como barra sobre 5. También es la vista exacta del radar
export const CategoryBars = ({ categories, compact = false }: CategoryBarsProps) => {
  if (!categories.length) return null;

  return (
    <dl className={`grid gap-x-3 ${compact ? "gap-y-1 text-xs" : "gap-y-2 text-sm"} grid-cols-[auto_1fr_auto] items-center w-full`}>
      {categories.map((category) => (
        <div key={category.key} className="contents">
          <dt className="text-gray-300 truncate">{category.label}</dt>
          <div
            className={`${compact ? "h-1.5" : "h-2"} rounded-full bg-white/10 overflow-hidden`}
            role="presentation"
          >
            <div
              className="h-full rounded-full bg-[#ffa300]"
              style={{ width: `${(category.average / MAX_SCORE) * 100}%` }}
            />
          </div>
          <dd className="text-gray-200 tabular-nums text-right">{category.average.toFixed(1)}</dd>
        </div>
      ))}
    </dl>
  );
};
