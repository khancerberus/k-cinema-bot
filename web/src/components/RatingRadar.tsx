import { useState } from "react";
import type { CategoryAverage } from "../types/movie-star.type";

interface RatingRadarProps {
  categories: CategoryAverage[];
}

const MAX_SCORE = 5;
const SIZE = 340;
const CENTER = SIZE / 2;
const RADIUS = 105;
const LABEL_OFFSET = 26;
const RINGS = [1, 2, 3, 4, 5];
const SERIES_COLOR = "#ffa300";
const SURFACE_COLOR = "#000117";

// Punto del eje i (empezando arriba, en el sentido de las agujas del reloj) a una distancia r
const pointAt = (index: number, total: number, r: number) => {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  return { x: CENTER + Math.cos(angle) * r, y: CENTER + Math.sin(angle) * r };
};

const polygon = (points: Array<{ x: number; y: number }>) =>
  points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

// Radar del promedio por categoría (una sola serie). Con menos de 3 categorías no tiene forma: no se dibuja
export const RatingRadar = ({ categories }: RatingRadarProps) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = categories.length;
  if (total < 3) return null;

  const vertices = categories.map((category, index) =>
    pointAt(index, total, (category.average / MAX_SCORE) * RADIUS),
  );
  const active = hovered === null ? null : categories[hovered];

  return (
    <figure className="relative w-full max-w-[340px]">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full h-auto overflow-visible"
        role="img"
        aria-label={`Promedio por categoría: ${categories.map((c) => `${c.label} ${c.average}`).join(", ")}`}
      >
        {RINGS.map((ring) => (
          <polygon
            key={ring}
            points={polygon(categories.map((_, index) => pointAt(index, total, (ring / MAX_SCORE) * RADIUS)))}
            fill="none"
            stroke="rgb(255 255 255 / 0.1)"
            strokeWidth={1}
          />
        ))}
        {categories.map((category, index) => {
          const end = pointAt(index, total, RADIUS);
          return (
            <line
              key={category.key}
              x1={CENTER}
              y1={CENTER}
              x2={end.x}
              y2={end.y}
              stroke="rgb(255 255 255 / 0.1)"
              strokeWidth={1}
            />
          );
        })}

        <polygon
          points={polygon(vertices)}
          fill={SERIES_COLOR}
          fillOpacity={0.18}
          stroke={SERIES_COLOR}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {categories.map((category, index) => {
          const label = pointAt(index, total, RADIUS + LABEL_OFFSET);
          const anchor = Math.abs(label.x - CENTER) < 4 ? "middle" : label.x > CENTER ? "start" : "end";
          return (
            <text
              key={category.key}
              x={label.x}
              y={label.y}
              textAnchor={anchor}
              dominantBaseline="middle"
              className="fill-gray-300 text-[13px]"
            >
              {category.label}
              <tspan className="fill-gray-100 font-bold" dx={6}>
                {category.average.toFixed(1)}
              </tspan>
            </text>
          );
        })}

        {vertices.map((vertex, index) => (
          <g
            key={categories[index].key}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(index)}
            onBlur={() => setHovered(null)}
            tabIndex={0}
            className="outline-none"
          >
            {/* Zona de hover más grande que el punto */}
            <circle cx={vertex.x} cy={vertex.y} r={14} fill="transparent" />
            <circle
              cx={vertex.x}
              cy={vertex.y}
              r={hovered === index ? 6 : 4.5}
              fill={SERIES_COLOR}
              stroke={SURFACE_COLOR}
              strokeWidth={2}
            />
          </g>
        ))}
      </svg>

      {active && hovered !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded border border-white/15 bg-[#0b0c25] px-2 py-1 text-xs shadow-lg whitespace-nowrap"
          style={{
            left: `${(vertices[hovered].x / SIZE) * 100}%`,
            top: `${(vertices[hovered].y / SIZE) * 100}%`,
          }}
        >
          <span className="text-gray-300">{active.label}: </span>
          <span className="font-bold text-gray-100">{active.average.toFixed(1)}</span>
          <span className="text-gray-400"> / {MAX_SCORE}</span>
        </div>
      )}
    </figure>
  );
};
