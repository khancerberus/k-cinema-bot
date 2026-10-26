import {
  MAX_CATEGORIES,
  MAX_CATEGORY_LABEL_LENGTH,
  MAX_VOTING_MINUTES,
  MEDIA_LABELS,
  MIN_VOTING_MINUTES,
  type ChannelSettings,
  type MediaType,
  type RatingCategory,
} from "../types/channel.type";

interface RatingSettingsEditorProps {
  settings: ChannelSettings;
  onChange: (settings: ChannelSettings) => void;
}

const inputClassName =
  "w-full min-w-0 bg-[#000117] border border-[#cf0060]/60 rounded px-2 py-1 text-sm text-gray-300 focus:outline-none focus:border-[#00fff9]";
const smallButtonClassName =
  "shrink-0 border border-[#cf0060]/60 text-gray-300 px-2 py-1 rounded text-xs hover:border-[#00fff9] hover:text-[#00fff9] transition-colors duration-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed";

const EDITABLE_TYPES: MediaType[] = ["game", "movie"];

// Clave estable a partir del nombre ("Diseño de niveles" → "diseno-de-niveles"). No cambia al renombrar
const keyFor = (label: string, taken: Set<string>) => {
  const base =
    label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 16) || "categoria";
  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base}-${n}`;
  return key;
};

// Categorías de puntuación, duración de la votación y apelaciones
export const RatingSettingsEditor = ({ settings, onChange }: RatingSettingsEditorProps) => {
  const setCategories = (mediaType: MediaType, categories: RatingCategory[]) =>
    onChange({
      ...settings,
      rating: { categories: { ...settings.rating.categories, [mediaType]: categories } },
    });

  const renderCategories = (mediaType: MediaType) => {
    const categories = settings.rating.categories[mediaType];
    const activeCount = categories.filter((c) => !c.archived).length;

    const update = (index: number, changes: Partial<RatingCategory>) =>
      setCategories(
        mediaType,
        categories.map((category, i) => (i === index ? { ...category, ...changes } : category)),
      );

    // Solo se reordenan las activas: el orden es el de !star 4 3 5 4
    const move = (index: number, offset: number) => {
      const next = [...categories];
      const target = index + offset;
      [next[index], next[target]] = [next[target], next[index]];
      setCategories(mediaType, next);
    };

    const add = () => {
      const label = `Categoría ${activeCount + 1}`;
      const key = keyFor(label, new Set(categories.map((c) => c.key)));
      setCategories(mediaType, [...categories, { key, label }]);
    };

    return (
      <fieldset key={mediaType} className="flex flex-col gap-2">
        <legend className="text-sm font-bold mb-1">
          Categorías de {MEDIA_LABELS[mediaType].plural}
        </legend>
        {categories.length === 0 && (
          <p className="text-xs text-stone-500">Sin categorías: se puntúa con una sola nota (!star 4).</p>
        )}
        <ol className="flex flex-col gap-2">
          {categories.map((category, index) => (
            <li key={category.key} className="flex flex-row items-center gap-2">
              <input
                className={`${inputClassName} ${category.archived ? "opacity-50" : ""}`}
                aria-label={`Nombre de la categoría ${category.key}`}
                maxLength={MAX_CATEGORY_LABEL_LENGTH}
                value={category.label}
                onChange={(e) => update(index, { label: e.target.value })}
              />
              <button
                className={smallButtonClassName}
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Subir ${category.label}`}
              >
                ↑
              </button>
              <button
                className={smallButtonClassName}
                onClick={() => move(index, 1)}
                disabled={index === categories.length - 1}
                aria-label={`Bajar ${category.label}`}
              >
                ↓
              </button>
              <button
                className={smallButtonClassName}
                onClick={() => update(index, { archived: !category.archived })}
                disabled={category.archived && activeCount >= MAX_CATEGORIES}
                title={
                  category.archived
                    ? "Volver a usarla en las próximas votaciones"
                    : "Deja de pedirse en las próximas votaciones; los votos antiguos la conservan"
                }
              >
                {category.archived ? "Restaurar" : "Archivar"}
              </button>
            </li>
          ))}
        </ol>
        <button
          className={`${smallButtonClassName} self-start`}
          onClick={add}
          disabled={activeCount >= MAX_CATEGORIES}
        >
          + Añadir categoría
        </button>
      </fieldset>
    );
  };

  const order = settings.rating.categories.game.filter((c) => !c.archived);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-bold text-[#00fff9]">Votaciones</h3>

      <div className="flex flex-wrap items-end gap-6">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">Duración por defecto (minutos)</span>
          <input
            type="number"
            className={`${inputClassName} w-28`}
            min={MIN_VOTING_MINUTES}
            max={MAX_VOTING_MINUTES}
            value={settings.voting.defaultMinutes}
            onChange={(e) => onChange({ ...settings, voting: { defaultMinutes: Number(e.target.value) } })}
          />
        </label>
        <label className="flex items-center gap-2 pb-1 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.appeals.enabled}
            onChange={(e) => onChange({ ...settings, appeals: { enabled: e.target.checked } })}
          />
          <span className="text-sm">Permitir !apelar en el chat</span>
        </label>
      </div>
      <p className="text-xs text-stone-500">
        La votación se abre con !k movie|game &lt;nombre&gt; [minutos, p. ej. 15m] y se cierra sola al terminar
        ({MIN_VOTING_MINUTES} a {MAX_VOTING_MINUTES} minutos). Con !apelar, quien se equivocó pide corregir su voto
        y tú o tus mods lo aprueban con !k aprobar @usuario.
      </p>

      {EDITABLE_TYPES.map(renderCategories)}
      {order.length > 0 && (
        <p className="text-xs text-stone-500">
          En el chat: !star 4 da la misma nota a todo; !star {order.map(() => "4").join(" ")} da una nota por
          categoría en este orden: {order.map((c) => c.label).join(", ")}. Los cambios se aplican desde la próxima
          votación.
        </p>
      )}
    </div>
  );
};
