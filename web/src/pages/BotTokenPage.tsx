import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TWITCH_BOT_AUTH_URL } from "../lib/api";

const REQUIRED_SCOPE = "moderator:manage:banned_users";

interface BotToken {
  refreshToken: string;
  login: string;
  scopes: string[];
}

// Lee y borra de la URL lo que deja la API al volver de Twitch (#refresh_token=... o #error=...)
const takeResult = () => {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const refreshToken = params.get("refresh_token");
  const error = params.get("error");
  if (refreshToken || error) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  const token: BotToken | null = refreshToken
    ? {
        refreshToken,
        login: params.get("login") ?? "",
        scopes: (params.get("scopes") ?? "").split(" ").filter(Boolean),
      }
    : null;
  return { token, error };
};

// Generador del token de moderación del bot (timeouts de !rec)
export const BotTokenPage = () => {
  // Se lee una sola vez al montar: takeResult borra el fragmento de la URL
  const [{ token, error }] = useState(takeResult);

  useEffect(() => {
    if (error) toast.error(error, { duration: Infinity, closeButton: true });
  }, [error]);

  const copy = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token.refreshToken);
    toast.success("Token copiado");
  };

  const missingScope = token && !token.scopes.includes(REQUIRED_SCOPE);

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-10">
      <h1 className="text-7xl font-bold mb-2 font-bebaskai text-center">Token del bot</h1>
      <p className="text-stone-500 mb-8 text-center max-w-md">
        Genera el token que usa el bot para dar timeout en <code>!rec</code>. Entra con la{" "}
        <strong>cuenta del bot</strong>, que debe ser mod en los canales.
      </p>

      <div className="flex flex-col gap-4 outline-2 outline-[#cf0060] rounded-xl p-6 w-full max-w-lg bg-[#cf0060]/10 shadow-md shadow-[#cf0060]/60">
        {token && (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-stone-400">Cuenta</dt>
              <dd>{token.login}</dd>
              <dt className="text-stone-400">Scopes</dt>
              <dd className={missingScope ? "text-red-400" : ""}>{token.scopes.join(", ") || "ninguno"}</dd>
            </dl>

            {missingScope && <p className="text-red-400 text-sm">Falta el scope {REQUIRED_SCOPE}.</p>}

            <div className="flex gap-2">
              <input
                readOnly
                type="password"
                value={token.refreshToken}
                aria-label="Refresh token"
                className="flex-1 bg-[#000117] border border-[#cf0060]/60 rounded px-3 py-2 text-gray-300"
              />
              <button
                onClick={() => void copy()}
                className="px-4 py-2 bg-[#cf0060] text-white font-bold rounded hover:bg-[#a8004e] cursor-pointer"
              >
                Copiar
              </button>
            </div>

            <p className="text-sm text-stone-400">
              Pégalo en el entorno de la API como <code>BOT_MOD_REFRESH_TOKEN=...</code> y reinicia la API. El bot
              renueva el acceso solo; no lo compartas.
            </p>
          </>
        )}

        <a
          href={TWITCH_BOT_AUTH_URL}
          className="text-center px-4 py-2 bg-[#9146ff] text-white font-bold rounded hover:bg-[#772ce8] transition-colors"
        >
          {token ? "Generar otro token" : "Generar token con Twitch"}
        </a>
      </div>
    </div>
  );
};
