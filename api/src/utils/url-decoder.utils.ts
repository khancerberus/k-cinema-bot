export function extractTmdbId(urlString: string): number | null {
  try {
    const url = new URL(urlString);

    // La regex busca "/movie/", "/tv/" o "/person/" seguido de uno o más dígitos.
    // Usamos un grupo de captura (\d+) para extraer solo el número.
    const match = url.pathname.match(/\/(?:movie|tv|person)\/(\d+)/);

    if (match && match[1]) {
      return parseInt(match[1], 10);
    }

    return null;
  } catch (error) {
    console.error('URL proporcionada no es válida:', error);
    return null;
  }
}
