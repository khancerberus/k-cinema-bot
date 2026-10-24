import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { apiFetch, readApiError } from "../lib/api";
import { getSession, saveSession } from "../lib/session";
import type { ChannelProfile } from "../types/channel.type";

const inputClassName =
  "w-full bg-[#000117] border border-[#cf0060]/60 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-[#00fff9]";

// Login PROVISIONAL: nombre del canal + ID de Twitch. TODO: OAuth de Twitch/Kick
export const LoginPage = () => {
  const navigate = useNavigate();
  const session = getSession();
  const [channelUsername, setChannelUsername] = useState("");
  const [channelId, setChannelId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await apiFetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelUsername, channelId }),
      });

      if (!response.ok) {
        toast.error(await readApiError(response));
        return;
      }

      const channel = (await response.json()) as ChannelProfile;
      saveSession({ channelId: channel.channelId, channelUsername: channel.channelUsername });
      navigate(`/${channel.channelUsername}`);
    } catch (error) {
      console.error("Error:", error);
      toast.error("No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-10">
      <h1 className="text-8xl font-bold mb-2 font-bebaskai text-center">K-Cinema</h1>
      <p className="text-stone-500 mb-8 text-center">Entra con tu canal para ver y editar tu perfil</p>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 outline-2 outline-[#cf0060] rounded-xl p-6 w-full max-w-sm bg-[#cf0060]/10 shadow-md shadow-[#cf0060]/60"
      >
        <label className="flex flex-col gap-1">
          <span className="font-bold">Nombre del canal</span>
          <input
            className={inputClassName}
            type="text"
            placeholder="tucanal"
            autoComplete="username"
            value={channelUsername}
            onChange={(e) => setChannelUsername(e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-bold">ID de Twitch</span>
          <input
            className={inputClassName}
            type="text"
            inputMode="numeric"
            placeholder="123456789"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value.trim())}
            required
          />
          <span className="text-xs text-stone-500">
            Es el ID numérico de tu cuenta. No cambia aunque cambies el nombre del canal.
          </span>
        </label>

        <button
          type="submit"
          className="px-4 py-2 bg-[#cf0060] text-white rounded hover:bg-[#ff2a4b] transition-colors cursor-pointer disabled:bg-gray-500 disabled:cursor-not-allowed"
          disabled={!channelUsername || !channelId || submitting}
        >
          {submitting ? "Entrando..." : "Entrar"}
        </button>

        {session && (
          <a href={`/${session.channelUsername}`} className="text-sm text-center text-[#00fff9] hover:underline">
            Continuar como {session.channelUsername}
          </a>
        )}
      </form>
    </div>
  );
};
