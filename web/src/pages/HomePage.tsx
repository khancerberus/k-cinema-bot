import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { FilmMetadataProps } from "../components/MovieRatingCard";
import { TopMoviesCard } from "../components/TopMoviesCard";
import { RecentMoviesCarousel } from "../components/RecentMoviesCarousel";
import { ChannelSettingsCard } from "../components/ChannelSettingsCard";
import { apiFetch, channelPath, fetchRatedMovies, readApiError, type RatedMoviesQuery } from "../lib/api";
import { useChannel } from "../lib/channel-context";
import { MEDIA_LABELS, type ChannelProfile, type ChannelSection, type MediaType } from "../types/channel.type";

// Máximo que admite la API por página
const MAX_PAGE_SIZE = 100;
const MEDIA_TYPES: MediaType[] = ["movie", "game"];

const sectionSubtitle = (section: ChannelSection) => {
  const { plural } = MEDIA_LABELS[section.mediaType];
  const article = section.mediaType === "game" ? "Los" : "Las";
  if (section.kind === "recent") {
    return `${article} ${plural} ${section.mediaType === "game" ? "jugados" : "vistas"} más recientemente`;
  }
  return `${article} ${plural} con ${section.kind === "top-best" ? "mejor" : "peor"} rating promedio`;
};

// Clave de un elemento oculto: el mismo ID puede ser una película y un juego
const hiddenKey = (mediaType: MediaType, tmdbId: number) => `${mediaType}:${tmdbId}`;

export const HomePage = () => {
  const { channel, setChannel, isOwner } = useChannel();
  // Elementos de cada sección (id de sección → películas o juegos), pedidos ya ordenados a la API
  const [sectionMovies, setSectionMovies] = useState<Record<string, FilmMetadataProps[]>>({});
  // Títulos de los ocultos (mediaType:id → título), para la lista del editor
  const [hiddenTitles, setHiddenTitles] = useState<Record<string, string>>({});
  // Mientras se edita, la página muestra el borrador para ver los cambios al momento
  const [draft, setDraft] = useState<ChannelProfile | null>(null);
  const [saving, setSaving] = useState(false);

  const profile = draft ?? channel;
  const hiddenKeys = useMemo(
    () => new Set(profile.settings.hidden.map((item) => hiddenKey(item.mediaType, item.tmdbId))),
    [profile.settings.hidden],
  );

  // Cada top pide su tamaño más la cantidad de ocultos, para seguir lleno al ocultar alguno
  const sectionsKey = JSON.stringify(
    profile.settings.sections.map((section) => [section.id, section.kind, section.size, section.mediaType]),
  );
  const hiddenCount = profile.settings.hidden.length;

  useEffect(() => {
    const controller = new AbortController();
    const sections = JSON.parse(sectionsKey) as Array<[string, ChannelSection["kind"], number, MediaType]>;

    const timer = setTimeout(() => {
      Promise.all(
        sections.map(async ([id, kind, size, mediaType]) => {
          const query: RatedMoviesQuery =
            kind === "recent"
              ? { sort: "lastWatched", dir: "desc", pageSize: size }
              : {
                  sort: "rating",
                  dir: kind === "top-best" ? "desc" : "asc",
                  pageSize: Math.min(MAX_PAGE_SIZE, size + hiddenCount),
                };
          const page = await fetchRatedMovies(channel.channelUsername, query, controller.signal, mediaType);
          return [id, page.items] as const;
        }),
      )
        .then((entries) => setSectionMovies(Object.fromEntries(entries)))
        .catch((error: unknown) => {
          if (!controller.signal.aborted) console.error("Error fetching movie data:", error);
        });
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [channel.channelUsername, sectionsKey, hiddenCount]);

  // Solo al editar: títulos de los ocultos que no aparecen en ninguna sección
  const hiddenIdsKey = draft
    ? draft.settings.hidden.map((item) => hiddenKey(item.mediaType, item.tmdbId)).join(",")
    : "";
  useEffect(() => {
    if (!hiddenIdsKey) return;
    const controller = new AbortController();
    const keys = hiddenIdsKey.split(",");

    Promise.all(
      MEDIA_TYPES.map(async (mediaType) => {
        const ids = keys
          .filter((key) => key.startsWith(`${mediaType}:`))
          .map((key) => Number(key.split(":")[1]))
          .slice(0, MAX_PAGE_SIZE);
        if (!ids.length) return [];
        const page = await fetchRatedMovies(
          channel.channelUsername,
          { ids, pageSize: ids.length },
          controller.signal,
          mediaType,
        );
        return page.items.map((item) => [hiddenKey(mediaType, item.tmdbId), `${item.title} (${item.year})`]);
      }),
    )
      .then((entries) => setHiddenTitles(Object.fromEntries(entries.flat())))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) console.error("Error fetching hidden movies:", error);
      });

    return () => controller.abort();
  }, [channel.channelUsername, hiddenIdsKey]);

  const hide = (mediaType: MediaType, tmdbId: number) => {
    if (!draft) return;
    setDraft({
      ...draft,
      settings: {
        ...draft.settings,
        hidden: [...draft.settings.hidden, { mediaType, tmdbId }],
      },
    });
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);

    try {
      const response = await apiFetch(channelPath(channel.channelUsername), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: draft.displayName,
          description: draft.description,
          accentColor: draft.accentColor,
          settings: draft.settings,
        }),
      });

      if (!response.ok) {
        toast.error(await readApiError(response));
        return;
      }

      setChannel((await response.json()) as ChannelProfile);
      setDraft(null);
      toast.success("Perfil actualizado");
    } catch (error) {
      console.error("Error:", error);
      toast.error("No se pudo guardar el perfil.");
    } finally {
      setSaving(false);
    }
  };

  const titleFor = (mediaType: MediaType, tmdbId: number) => {
    const item = Object.values(sectionMovies)
      .flat()
      .find((m) => m.mediaType === mediaType && m.tmdbId === tmdbId);
    return item
      ? `${item.title} (${item.year})`
      : (hiddenTitles[hiddenKey(mediaType, tmdbId)] ?? `${mediaType === "game" ? "IGDB" : "TMDB"} ${tmdbId}`);
  };

  const renderSection = (section: ChannelSection) => {
    if (section.kind === "recent") {
      return (
        <RecentMoviesCarousel
          key={section.id}
          channelUsername={channel.channelUsername}
          title={section.title}
          movies={(sectionMovies[section.id] ?? []).slice(0, section.size)}
          mediaType={section.mediaType}
        />
      );
    }

    return (
      <TopMoviesCard
        key={section.id}
        channelUsername={channel.channelUsername}
        title={section.title}
        subtitle={sectionSubtitle(section)}
        movies={(sectionMovies[section.id] ?? [])
          .filter((movie) => !hiddenKeys.has(hiddenKey(section.mediaType, movie.tmdbId)))
          .slice(0, section.size)}
        accentColor={section.kind === "top-best" ? "#ffa300" : "#ff2a4b"}
        onHide={draft ? (tmdbId) => hide(section.mediaType, tmdbId) : undefined}
        mediaType={section.mediaType}
      />
    );
  };

  const topSections = profile.settings.sections.filter((s) => s.kind !== "recent");
  const otherSections = profile.settings.sections.filter((s) => s.kind === "recent");

  return (
    <div>
      <header className="flex flex-col items-center justify-center p-5 text-center">
        <h1 className="text-8xl font-bold mb-2 font-bebaskai" style={{ color: profile.accentColor }}>
          {profile.displayName}
        </h1>
        <p className="text-stone-500 max-w-2xl">
          {profile.description || "Lo mejor y lo peor de lo que hemos visto"}
        </p>
        {isOwner && !draft && (
          <button
            className="mt-4 border border-[#00fff9] text-[#00fff9] px-3 py-1 rounded text-sm opacity-90 hover:bg-[#00fff9]/10 transition-colors duration-300 cursor-pointer"
            onClick={() => setDraft(structuredClone(channel))}
          >
            Editar perfil
          </button>
        )}
      </header>

      <div className="flex flex-col gap-8 px-8 py-4 w-full xl:w-300 mx-auto">
        {draft && (
          <ChannelSettingsCard
            draft={draft}
            onChange={setDraft}
            titleFor={titleFor}
            onSave={save}
            onCancel={() => setDraft(null)}
            saving={saving}
          />
        )}

        {topSections.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{topSections.map(renderSection)}</div>
        )}

        {otherSections.map(renderSection)}
      </div>
    </div>
  );
};
