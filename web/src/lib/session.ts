// Sesión del streamer tras el login con Twitch: el token (JWT firmado por la API)
// se envía como "Authorization: Bearer" y el canal se usa para la UI (isOwner, "Mi perfil").
export interface Session {
  token: string;
  channelId: string;
  channelUsername: string;
}

const SESSION_KEY = "kcinema.session";

// Lee "exp" del JWT sin verificarlo (solo para no mostrar una sesión caducada;
// quien valida de verdad es la API)
const isExpired = (token: string) => {
  try {
    const payload: unknown = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    const exp = (payload as { exp?: unknown }).exp;
    return typeof exp === "number" && exp * 1000 <= Date.now();
  } catch {
    return true;
  }
};

export const getSession = (): Session | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as Session).token === "string" &&
      typeof (parsed as Session).channelId === "string" &&
      typeof (parsed as Session).channelUsername === "string" &&
      !isExpired((parsed as Session).token)
    ) {
      return parsed as Session;
    }
    // Sesión del login provisional (sin token) o caducada
    localStorage.removeItem(SESSION_KEY);
    return null;
  } catch {
    return null;
  }
};

export const saveSession = (session: Session) => {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Sin almacenamiento disponible (modo privado, etc.): la sesión dura solo esta visita
  }
};

export const clearSession = () => {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Nada que limpiar
  }
};
