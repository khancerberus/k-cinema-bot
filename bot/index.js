import tmi from 'tmi.js';
import 'dotenv/config';

const MAX_CHAT_MESSAGE_LENGTH = 450;

const JELLYFIN_URL = process.env.JELLYFIN_URL; 
const JELLYFIN_API_KEY = process.env.JELLYFIN_API_KEY;

async function obtenerEstadoPeliActual(nombreUsuario) {
  try {
    const respuesta = await fetch(`${JELLYFIN_URL}/Sessions`, {
      method: 'GET',
      headers: {
        'Authorization': `MediaBrowser Token=${JELLYFIN_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!respuesta.ok) {
      throw new Error(`Error HTTP: ${respuesta.status}`);
    }

    const sesiones = await respuesta.json();
    const sesion = sesiones.find(s => s.UserName === nombreUsuario);

		// Verificamos si hay una sesión activa y contenido en reproducción
    if (!sesion || !sesion.NowPlayingItem || sesion.PlayState.PositionTicks === undefined) {
			return 'No estamos viendo nada en este momento.';
    }

    // Convertir Ticks a Segundos (1 segundo = 10,000,000 Ticks)
    const ticks = sesion.PlayState.PositionTicks;
    const segundosTotales = Math.floor(ticks / 10000000);

    // Calcular horas, minutos y segundos
    const horas = Math.floor(segundosTotales / 3600);
    const minutos = Math.floor((segundosTotales % 3600) / 60);
    const segundos = segundosTotales % 60;

    // Formatear como 01:30:23
    const formatoReloj = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;

    const nowPlaying = sesion.NowPlayingItem;

		if (nowPlaying.Type === 'Movie') {
			const nombrePelicula = nowPlaying.Name;
			const anioPelicula = nowPlaying.ProductionYear;
			const anioFormateado = anioPelicula ? ` (${anioPelicula})` : '';

			return `🍿Viendo: ${nombrePelicula}${anioFormateado} | ⏱️Tiempo: ${formatoReloj}`;
		}

		if (nowPlaying.Type === 'Episode') {
			const nombreSerie = nowPlaying.SeriesName || 'Serie desconocida';
			const nombreEpisodio = nowPlaying.Name || 'Episodio sin titulo';
			const temporada = Number.isInteger(nowPlaying.ParentIndexNumber)
				? String(nowPlaying.ParentIndexNumber).padStart(2, '0')
				: '??';
			const episodio = Number.isInteger(nowPlaying.IndexNumber)
				? String(nowPlaying.IndexNumber).padStart(2, '0')
				: '??';

			return `📺Viendo: ${nombreSerie} | S${temporada}E${episodio} - ${nombreEpisodio} | ⏱️Tiempo: ${formatoReloj}`;
		}

		return 'Ahora mismo estamos viendo algo, pero no es una pelicula ni un episodio de serie.';

  } catch (error) {
    console.error('Error obteniendo datos de Jellyfin:', error);
    return 'Hubo un problema al conectar con el servidor de Jellyfin.';
  }
}

function clampChatMessage(message) {
	if (typeof message !== 'string') {
		return 'Respuesta no valida de la API.';
	}

	if (message.length <= MAX_CHAT_MESSAGE_LENGTH) {
		return message;
	}

	return `${message.slice(0, MAX_CHAT_MESSAGE_LENGTH - 3)}...`;
}

const TWITCH_CHANNEL = process.env.TWITCH_CHANNEL;
const JELLYFIN_USER = process.env.JELLYFIN_USER;

if (!TWITCH_CHANNEL || !JELLYFIN_USER) {
	console.error('Faltan TWITCH_CHANNEL o JELLYFIN_USER en el .env del bot.');
	process.exit(1);
}

const client = new tmi.Client({
	options: { debug: true },
	identity: {
		username: process.env.BOT_USERNAME,
		password: process.env.BOT_TOKEN
	},
	channels: [ TWITCH_CHANNEL ]
});

client.connect().catch(console.error);

client.on('message', (channel, tags, message, self) => {
	if(self) return;
	const [command, ...args] = message.trim().split(' ');
	if(commands[command]) {
		commands[command](channel, tags, message, args);
	}
});

const commands = {
	'!peli': async (channel) => {
		const estadoPeli = await obtenerEstadoPeliActual(JELLYFIN_USER);
		client.say(channel, clampChatMessage(estadoPeli));
	}
}