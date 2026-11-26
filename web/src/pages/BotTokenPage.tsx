import { useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchBotTokenUrl } from "../lib/api";

const REQUIRED_SCOPE = "moderator:manage:banned_users";

interface TokenInfo {
  token: string;
  login?: string;
  scopes?: string[];
  expiresIn?: number;
  invalid?: boolean;
}

// Lee y borra de la URL el resultado del implicit grant. El token llega en el fragmento
// (#access_token=...), pero Twitch manda los errores en la query (?error=...&error_description=...)
const takeTwitchResult = () => {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  const token = hash.get("access_token");
  const code = query.get("error") ?? hash.get("error");
  const description = query.get("error_description") ?? hash.get("error_description");
  if (token || code) {
    window.history.replaceState(null, "", window.location.pathname);
  }
  const error = code ? `Twitch: ${description ?? code} (${code})` : null;
  return { token, error };
};

const formatExpiry = (seconds: number) => {
  if (seconds <= 0) return "no vence";
  const days = Math.floor(seconds / 86400);
  return days >= 1 ? `vence en ${days} días` : `vence en ${Math.ceil(seconds / 3600)} horas`;
};

// Generador del token de moderación del bot (timeouts de !rec)
export const BotTokenPage = () => {
  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const { token, error } = takeTwitchResult();
    if (error) {
      toast.error(error, { duration: Infinity, closeButton: true });
      return;
    }
    if (!token) return;

    // Se valida directamente contra Twitch: el token no pasa por la API
    fetch("https://id.twitch.tv/oauth2/validate", { headers: { Authorization: `OAuth ${token}` } })
      .then(async (response) => {
        if (!response.ok) {
          setInfo({ token, invalid: true });
          return;
        }
        const data = (await response.json()) as { login: string; scopes: string[]; expires_in: number };
        setInfo({ token, login: data.login, scopes: data.scopes, expiresIn: data.expires_in });
      })
      .catch(() => setInfo({ token, invalid: true }));
  }, []);

  const start = async () => {
    setRedirecting(true);
    try {
      window.location.href = await fetchBotTokenUrl();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo iniciar el login con Twitch.");
      setRedirecting(false);
    }
  };

  const copy = async () => {
    if (!info) return;
    await navigator.clipboard.writeText(info.token);
    toast.success("Token copiado");
  };

  const missingScope = info?.scopes && !info.scopes.includes(REQUIRED_SCOPE);

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-10">
      <h1 className="text-7xl font-bold mb-2 font-bebaskai text-center">Token del bot</h1>
      <p className="text-stone-500 mb-8 text-center max-w-md">
        Genera el token que usa el bot para dar timeout en <code>!rec</code>. Entra con la{" "}
        <strong>cuenta del bot</strong>, que debe ser mod en los canales.
      </p>

      <div className="flex flex-col gap-4 outline-2 outline-[#cf0060] rounded-xl p-6 w-full max-w-lg bg-[#cf0060]/10 shadow-md shadow-[#cf0060]/60">
        {info ? (
          <>
            {info.invalid ? (
              <p className="text-red-400">Twitch dice que este token no es válido. Genera otro.</p>
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-stone-400">Cuenta</dt>
                <dd>{info.login}</dd>
                <dt className="text-stone-400">Scopes</dt>
                <dd className={missingScope ? "text-red-400" : ""}>{info.scopes?.join(", ") || "ninguno"}</dd>
                <dt className="text-stone-400">Duración</dt>
                <dd>{formatExpiry(info.expiresIn ?? 0)}</dd>
              </dl>
            )}

            {missingScope && <p className="text-red-400 text-sm">Falta el scope {REQUIRED_SCOPE}.</p>}

            <div className="flex gap-2">
              <input
                readOnly
                type="password"
                value={info.token}
                aria-label="Token"
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
              Pégalo en <code>api/.env</code> como <code>BOT_MOD_TOKEN=...</code> y reinicia la API. No lo compartas.
            </p>
          </>
        ) : null}

        <button
          onClick={() => void start()}
          disabled={redirecting}
          className="px-4 py-2 bg-[#9146ff] text-white font-bold rounded hover:bg-[#772ce8] transition-colors cursor-pointer disabled:opacity-50"
        >
          {redirecting ? "Redirigiendo..." : info ? "Generar otro token" : "Generar token con Twitch"}
        </button>
      </div>
    </div>
  );
};
