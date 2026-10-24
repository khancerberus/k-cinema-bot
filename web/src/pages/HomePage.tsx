import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { FilmMetadataProps } from "../components/MovieRatingCard";
import { sortMovies } from "../components/MovieSort";
import { TopMoviesCard } from "../components/TopMoviesCard";
import { RecentMoviesCarousel } from "../components/RecentMoviesCarousel";
import { ChannelSettingsCard } from "../components/ChannelSettingsCard";
import { apiFetch, channelPath, fetchRatedMovies, readApiError } from "../lib/api";
import { useChannel } from "../lib/channel-context";
import type { ChannelProfile, ChannelSection } from "../types/channel.type";

const SECTION_SUBTITLES: Record<ChannelSection["kind"], string> = {
  "top-best": "Las películas con mejor rating promedio",
  "top-worst": "Las películas con peor rating promedio",
  recent: "Las películas vistas más recientemente",
};

export const HomePage = () => {
  const { channel, setChannel, isOwner } = useChannel();
  const [movieData, setMovieData] = useState<FilmMetadataProps[]>([]);
  // Mientras se edita, la página muestra el borrador para ver los cambios al momento
  const [draft, setDraft] = useState<ChannelProfile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRatedMovies(channel.channelUsername)
      .then((movies) => setMovieData(movies))
      .catch((error) => console.error("Error fetching movie data:", error));
  }, [channel.channelUsername]);

  const profile = draft ?? channel;
  const hiddenIds = useMemo(
    () => new Set(profile.settings.hidden.map((item) => item.tmdbId)),
    [profile.settings.hidden],
  );
  const visibleMovies = useMemo(
    () => movieData.filter((movie) => !hiddenIds.has(movie.tmdbId)),
    [movieData, hiddenIds],
  );

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
    const movie = movieData.find((m) => m.tmdbId === tmdbId);
    return movie ? `${movie.title} (${movie.year})` : `TMDB ${tmdbId}`;
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
          movies={sortMovies(movieData, { key: "lastWatched", direction: "desc" }).slice(0, section.size)}
        />
      );
    }

    const direction = section.kind === "top-best" ? "desc" : "asc";
    return (
      <TopMoviesCard
        key={section.id}
        channelUsername={channel.channelUsername}
        title={section.title}
        subtitle={SECTION_SUBTITLES[section.kind]}
        movies={sortMovies(visibleMovies, { key: "rating", direction }).slice(0, section.size)}
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
