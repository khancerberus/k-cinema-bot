// Sesión PROVISIONAL: guarda en el navegador el canal con el que se hizo login.
// Cuando haya OAuth de Twitch/Kick, aquí se guardará el token de sesión.
export interface Session {
  channelId: string;
  channelUsername: string;
}

const SESSION_KEY = "kcinema.session";

export const getSession = (): Session | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as Session).channelId === "string" &&
      typeof (parsed as Session).channelUsername === "string"
    ) {
      return parsed as Session;
    }
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
