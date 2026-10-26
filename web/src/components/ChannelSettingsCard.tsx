import { useState } from "react";
import {
  MAX_KCINEMA_MESSAGE_LENGTH,
  MAX_SECTION_SIZE,
  MEDIA_LABELS,
  MIN_SECTION_SIZE,
  type ChannelProfile,
  type ChannelSection,
  type MediaType,
  type SectionKind,
} from "../types/channel.type";
import { RatingSettingsEditor } from "./RatingSettingsEditor";

const SECTION_KIND_LABELS: Record<SectionKind, string> = {
  "top-best": "Mejores",
  "top-worst": "Peores",
  recent: "Recientes",
};

interface ChannelSettingsCardProps {
  draft: ChannelProfile;
  onChange: (draft: ChannelProfile) => void;
  // Título de cada película o juego oculto, para mostrarlo en la lista
  titleFor: (mediaType: MediaType, tmdbId: number) => string;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

const inputClassName =
  "w-full min-w-0 bg-[#000117] border border-[#cf0060]/60 rounded px-2 py-1 text-sm text-gray-300 focus:outline-none focus:border-[#00fff9]";

export const ChannelSettingsCard = ({
  draft,
  onChange,
  titleFor,
  onSave,
  onCancel,
  saving,
}: ChannelSettingsCardProps) => {
  const updateSection = (id: string, changes: Partial<ChannelSection>) => {
    onChange({
      ...draft,
      settings: {
        ...draft.settings,
        sections: draft.settings.sections.map((section) =>
          section.id === id ? { ...section, ...changes } : section,
        ),
      },
    });
  };

  const unhide = (mediaType: MediaType, tmdbId: number) => {
    onChange({
      ...draft,
      settings: {
        ...draft.settings,
        hidden: draft.settings.hidden.filter(
          (item) => item.mediaType !== mediaType || item.tmdbId !== tmdbId,
        ),
      },
    });
  };

  const [newSection, setNewSection] = useState<{ mediaType: MediaType; kind: SectionKind }>({
    mediaType: "game",
    kind: "top-best",
  });

  const addSection = () => {
    const ids = new Set(draft.settings.sections.map((section) => section.id));
    let n = 1;
    while (ids.has(`${newSection.mediaType}-${newSection.kind}-${n}`)) n++;
    const { plural } = MEDIA_LABELS[newSection.mediaType];
    const title =
      newSection.kind === "recent"
        ? `Últimos ${plural}`
        : `Top 5 ${plural} ${newSection.kind === "top-best" ? "mejores" : "peores"}`;
    onChange({
      ...draft,
      settings: {
        ...draft.settings,
        sections: [
          ...draft.settings.sections,
          {
            id: `${newSection.mediaType}-${newSection.kind}-${n}`.slice(0, 20),
            kind: newSection.kind,
            mediaType: newSection.mediaType,
            title: title.slice(0, 40),
            size: newSection.kind === "recent" ? 10 : 5,
          },
        ],
      },
    });
  };

  const removeSection = (id: string) => {
    onChange({
      ...draft,
      settings: {
        ...draft.settings,
        sections: draft.settings.sections.filter((section) => section.id !== id),
      },
    });
  };

  return (
    <div className="flex flex-col gap-4 outline-2 outline-[#00fff9] rounded-xl p-4 w-full bg-[#00fff9]/5 shadow-md shadow-[#00fff9]/40">
      <div className="flex flex-row flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-bold text-[#00fff9]">Editar perfil</h2>
        <div className="flex flex-row gap-2">
          <button
            className="border border-stone-500 text-stone-300 px-3 py-1 rounded text-sm hover:bg-white/5 transition-colors duration-300 cursor-pointer"
            onClick={onCancel}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            className="bg-[#cf0060] text-white px-3 py-1 rounded text-sm hover:bg-[#ff2a4b] transition-colors duration-300 cursor-pointer disabled:bg-gray-500 disabled:cursor-not-allowed"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">Título del perfil</span>
          <input
            className={inputClassName}
            maxLength={60}
            value={draft.displayName}
            onChange={(e) => onChange({ ...draft, displayName: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">Color de acento</span>
          <input
            type="color"
            className="h-8 w-16 bg-transparent cursor-pointer"
            value={draft.accentColor}
            onChange={(e) => onChange({ ...draft, accentColor: e.target.value })}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold">Descripción</span>
        <textarea
          className={`${inputClassName} min-h-16`}
          maxLength={300}
          value={draft.description}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold">Mensaje del comando !kcinema</span>
        <input
          className={inputClassName}
          maxLength={MAX_KCINEMA_MESSAGE_LENGTH}
          value={draft.settings.commands.kcinema.message}
          onChange={(e) =>
            onChange({
              ...draft,
              settings: {
                ...draft.settings,
                commands: { ...draft.settings.commands, kcinema: { message: e.target.value } },
              },
            })
          }
        />
        <span className="text-xs text-stone-500">
          Lo responde el bot cuando alguien escribe !kcinema en tu chat. Escribe {"{url}"} donde quieras el enlace
          a tu perfil (si no lo pones, se añade al final). Tus mods también pueden cambiarlo con !kcinema set
          &lt;mensaje&gt;.
        </span>
      </label>

      <RatingSettingsEditor
        settings={draft.settings}
        onChange={(settings) => onChange({ ...draft, settings })}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-bold mb-2">Secciones</legend>
        {draft.settings.sections.map((section) => (
          <div key={section.id} className="grid grid-cols-[auto_1fr_5rem_auto] gap-2 items-center">
            <span className="text-xs text-stone-400 w-16" title={SECTION_KIND_LABELS[section.kind]}>
              {section.mediaType === "game" ? "🎮" : "🎬"} {SECTION_KIND_LABELS[section.kind]}
            </span>
            <input
              className={inputClassName}
              aria-label={`Título de la sección ${section.id}`}
              maxLength={40}
              value={section.title}
              onChange={(e) => updateSection(section.id, { title: e.target.value })}
            />
            <input
              type="number"
              className={inputClassName}
              aria-label={`Cantidad de la sección ${section.id}`}
              min={MIN_SECTION_SIZE}
              max={MAX_SECTION_SIZE}
              value={section.size}
              onChange={(e) =>
                updateSection(section.id, {
                  size: Math.min(MAX_SECTION_SIZE, Math.max(MIN_SECTION_SIZE, Number(e.target.value) || MIN_SECTION_SIZE)),
                })
              }
            />
            <button
              className="border border-[#cf0060]/60 text-gray-300 px-2 py-1 rounded text-xs hover:border-[#00fff9] hover:text-[#00fff9] transition-colors duration-300 cursor-pointer"
              onClick={() => removeSection(section.id)}
              aria-label={`Quitar la sección ${section.title}`}
            >
              Quitar
            </button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={`${inputClassName} w-auto`}
            aria-label="Contenido de la nueva sección"
            value={newSection.mediaType}
            onChange={(e) => setNewSection({ ...newSection, mediaType: e.target.value as MediaType })}
          >
            <option value="game">Juegos</option>
            <option value="movie">Películas</option>
          </select>
          <select
            className={`${inputClassName} w-auto`}
            aria-label="Tipo de la nueva sección"
            value={newSection.kind}
            onChange={(e) => setNewSection({ ...newSection, kind: e.target.value as SectionKind })}
          >
            {(Object.keys(SECTION_KIND_LABELS) as SectionKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {SECTION_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
          <button
            className="border border-[#00fff9] text-[#00fff9] px-2 py-1 rounded text-xs hover:bg-[#00fff9]/10 transition-colors duration-300 cursor-pointer"
            onClick={addSection}
          >
            + Añadir sección
          </button>
        </div>
        <p className="text-xs text-stone-500">
          El número es cuántos elementos se muestran ({MIN_SECTION_SIZE} a {MAX_SECTION_SIZE}).
        </p>
      </fieldset>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold">Ocultos en los tops</p>
        {draft.settings.hidden.length === 0 ? (
          <p className="text-xs text-stone-500">
            Ninguno. Usa el botón "Ocultar" de cada película o juego en los tops.
          </p>
        ) : (
          <ul className="flex flex-row flex-wrap gap-2">
            {draft.settings.hidden.map((item) => (
              <li
                key={`${item.mediaType}-${item.tmdbId}`}
                className="flex flex-row items-center gap-2 border border-[#cf0060]/60 rounded px-2 py-1 text-sm"
              >
                <span>{titleFor(item.mediaType, item.tmdbId)}</span>
                <button
                  className="text-[#00fff9] hover:underline cursor-pointer"
                  onClick={() => unhide(item.mediaType, item.tmdbId)}
                >
                  Mostrar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
