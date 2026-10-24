import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { FilmMetadataProps } from "../components/MovieRatingCard";
import { TopMoviesCard } from "../components/TopMoviesCard";
import { RecentMoviesCarousel } from "../components/RecentMoviesCarousel";
import { ChannelSettingsCard } from "../components/ChannelSettingsCard";
import { apiFetch, channelPath, fetchRatedMovies, readApiError, type RatedMoviesQuery } from "../lib/api";
import { useChannel } from "../lib/channel-context";
import type { ChannelProfile, ChannelSection } from "../types/channel.type";

// Máximo que admite la API por página
const MAX_PAGE_SIZE = 100;

const SECTION_SUBTITLES: Record<ChannelSection["kind"], string> = {
  "top-best": "Las películas con mejor rating promedio",
  "top-worst": "Las películas con peor rating promedio",
  recent: "Las películas vistas más recientemente",
};

export const HomePage = () => {
  const { channel, setChannel, isOwner } = useChannel();
  // Películas de cada sección (id de sección → películas), pedidas ya ordenadas a la API
  const [sectionMovies, setSectionMovies] = useState<Record<string, FilmMetadataProps[]>>({});
  // Títulos de las películas ocultas, para la lista del editor
  const [hiddenTitles, setHiddenTitles] = useState<Record<number, string>>({});
  // Mientras se edita, la página muestra el borrador para ver los cambios al momento
  const [draft, setDraft] = useState<ChannelProfile | null>(null);
  const [saving, setSaving] = useState(false);

  const profile = draft ?? channel;
  const hiddenIds = useMemo(
    () => new Set(profile.settings.hidden.map((item) => item.tmdbId)),
    [profile.settings.hidden],
  );

  // Cada top pide su tamaño más la cantidad de ocultas, para seguir lleno al ocultar alguna
  const sectionsKey = JSON.stringify(
    profile.settings.sections.map((section) => [section.id, section.kind, section.size]),
  );
  const hiddenCount = profile.settings.hidden.length;

  useEffect(() => {
    const controller = new AbortController();
    const sections = JSON.parse(sectionsKey) as Array<[string, ChannelSection["kind"], number]>;

    const timer = setTimeout(() => {
      Promise.all(
        sections.map(async ([id, kind, size]) => {
          const query: RatedMoviesQuery =
            kind === "recent"
              ? { sort: "lastWatched", dir: "desc", pageSize: size }
              : {
                  sort: "rating",
                  dir: kind === "top-best" ? "desc" : "asc",
                  pageSize: Math.min(MAX_PAGE_SIZE, size + hiddenCount),
                };
          const page = await fetchRatedMovies(channel.channelUsername, query, controller.signal);
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

  // Solo al editar: títulos de las ocultas que no aparecen en ninguna sección
  const hiddenIdsKey = draft ? draft.settings.hidden.map((item) => item.tmdbId).join(",") : "";
  useEffect(() => {
    if (!hiddenIdsKey) return;
    const controller = new AbortController();
    const ids = hiddenIdsKey.split(",").map(Number).slice(0, MAX_PAGE_SIZE);

    fetchRatedMovies(channel.channelUsername, { ids, pageSize: ids.length }, controller.signal)
      .then((page) =>
        setHiddenTitles(
          Object.fromEntries(page.items.map((movie) => [movie.tmdbId, `${movie.title} (${movie.year})`])),
        ),
      )
      .catch((error: unknown) => {
        if (!controller.signal.aborted) console.error("Error fetching hidden movies:", error);
      });

    return () => controller.abort();
  }, [channel.channelUsername, hiddenIdsKey]);

  const hide = (tmdbId: number) => {
    if (!draft) return;
    setDraft({
      ...draft,
      settings: {
        ...draft.settings,
        hidden: [...draft.settings.hidden, { mediaType: "movie", tmdbId }],
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

  const titleFor = (tmdbId: number) => {
    const movie = Object.values(sectionMovies)
      .flat()
      .find((m) => m.tmdbId === tmdbId);
    return movie ? `${movie.title} (${movie.year})` : (hiddenTitles[tmdbId] ?? `TMDB ${tmdbId}`);
  };

  // Cada tipo de contenido tiene su propio render. Hoy solo existen películas;
  // series o juegos se añadirán aquí con su mediaType
  const renderSection = (section: ChannelSection) => {
    if (section.mediaType !== "movie") return null;

    if (section.kind === "recent") {
      return (
        <RecentMoviesCarousel
          key={section.id}
          channelUsername={channel.channelUsername}
          title={section.title}
          movies={(sectionMovies[section.id] ?? []).slice(0, section.size)}
        />
      );
    }

    return (
      <TopMoviesCard
        key={section.id}
        channelUsername={channel.channelUsername}
        title={section.title}
        subtitle={SECTION_SUBTITLES[section.kind]}
        movies={(sectionMovies[section.id] ?? [])
          .filter((movie) => !hiddenIds.has(movie.tmdbId))
          .slice(0, section.size)}
        accentColor={section.kind === "top-best" ? "#ffa300" : "#ff2a4b"}
        onHide={draft ? hide : undefined}
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
