import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { apiFetch, readApiError, TWITCH_LOGIN_URL } from "../lib/api";
import { getSession, saveSession } from "../lib/session";
import type { ChannelProfile } from "../types/channel.type";

// Lee y borra de la URL el resultado del login con Twitch (#token=... o #error=...)
const takeLoginResult = () => {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get("token");
  const error = params.get("error");
  if (token || error) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  return { token, error };
};

export const LoginPage = () => {
  const navigate = useNavigate();
  const session = getSession();
  const [finishing, setFinishing] = useState(() => window.location.hash.includes("token="));

  useEffect(() => {
    const { token, error } = takeLoginResult();
    if (error) {
      toast.error(error);
      return;
    }
    if (!token) return;

    const finishLogin = async () => {
      try {
        const response = await apiFetch("/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          toast.error(await readApiError(response));
          return;
        }

        const channel = (await response.json()) as ChannelProfile;
        saveSession({ token, channelId: channel.channelId, channelUsername: channel.channelUsername });
        navigate(`/${channel.channelUsername}`, { replace: true });
      } catch (err) {
        console.error("Error:", err);
        toast.error("No se pudo iniciar sesión.");
      } finally {
        setFinishing(false);
      }
    };
    void finishLogin();
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-10">
      <h1 className="text-8xl font-bold mb-2 font-bebaskai text-center">K-Cinema</h1>
      <p className="text-stone-500 mb-8 text-center">Entra con tu canal para ver y editar tu perfil</p>

      <div className="flex flex-col gap-4 outline-2 outline-[#cf0060] rounded-xl p-6 w-full max-w-sm bg-[#cf0060]/10 shadow-md shadow-[#cf0060]/60">
        {finishing ? (
          <p className="text-center text-stone-400">Entrando...</p>
        ) : (
          <a
            href={TWITCH_LOGIN_URL}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#9146ff] text-white font-bold rounded hover:bg-[#772ce8] transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0 1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
            </svg>
            Entrar con Twitch
          </a>
        )}

        {session && !finishing && (
          <Link to={`/${session.channelUsername}`} className="text-sm text-center text-[#00fff9] hover:underline">
            Continuar como {session.channelUsername}
          </Link>
        )}
      </div>
    </div>
  );
};
