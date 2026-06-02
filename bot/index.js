import tmi from 'tmi.js';
import 'dotenv/config';

const API_URL = process.env.API_URL;

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

		if (sesion.NowPlayingItem.Type !== 'Movie') {
			return 'Ahora mismo estamos viendo algo, pero no es una pelicula.';
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

    const nombrePelicula = sesion.NowPlayingItem.Name;
		const anioPelicula = sesion.NowPlayingItem.ProductionYear;
		const anioFormateado = anioPelicula ? ` (${anioPelicula})` : '';

		return `🍿Viendo: ${nombrePelicula}${anioFormateado} | ⏱️Tiempo: ${formatoReloj}`;

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

function extractApiMessage(rawBody) {
	if (!rawBody || !rawBody.trim()) {
		return null;
	}

	try {
		const parsedBody = JSON.parse(rawBody);

		if (typeof parsedBody === 'string' && parsedBody.trim()) {
			return parsedBody;
		}

		if (Array.isArray(parsedBody?.message)) {
			return parsedBody.message.join(', ');
		}

		if (typeof parsedBody?.message === 'string' && parsedBody.message.trim()) {
			return parsedBody.message;
		}

		if (typeof parsedBody?.error === 'string' && parsedBody.error.trim()) {
			return parsedBody.error;
		}

		return JSON.stringify(parsedBody);
	} catch {
		return rawBody;
	}
}

async function sendApiResponseToChat({ channel, response, fallbackMessage }) {
	const rawBody = await response.text();
	const apiMessage = extractApiMessage(rawBody);

	if (apiMessage) {
		client.say(channel, clampChatMessage(apiMessage));
		return;
	}

	if (fallbackMessage) {
		client.say(channel, fallbackMessage);
		return;
	}

	client.say(channel, `Error ${response.status}: ${response.statusText}`);
}

const client = new tmi.Client({
	options: { debug: true },
	identity: {
		username: process.env.BOT_USERNAME,
		password: process.env.BOT_TOKEN
	},
	channels: [ 'khancerberus' ]
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
	'!rec': async (channel, tags, message, args) => {
		if (!args.length) {
			client.say(channel, `@${tags['display-name'] || tags.username}, !rec <nombre pelicula> (<año>) | !rec <id de TMDB>`);
			return;
		}

		const displayName = tags['display-name'] || tags.username;
		const data = {
			userId: tags['user-id'],
			username: tags['display-name'] || tags.username,
			movieOrTmdbId: args.join(' ')
		};

		try {
			const response = await fetch(`${API_URL}/recommendation`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});

			await sendApiResponseToChat({
				channel,
				response,
				fallbackMessage: `${displayName}, asegurate de que el enlace sea correcto y vuelva a intentarlo.`
			});
		} catch (error) {
			client.say(channel, `Disculpa ${displayName}, hubo un error al procesar tu recomendación.`);
		}
	},
	'!star': async (channel, tags, message, args) => {
		const firstArg = args[0];
		if (!firstArg || isNaN(firstArg) || firstArg < 0.5 || firstArg > 5 || firstArg % 0.5 !== 0) {
			client.say(channel, `Disculpa ${tags['display-name'] || tags.username}, por favor proporciona un número del 0.5 al 5 y sus intermedios.`);
			return;
		}

		const data = {
			channelUsername: channel.replace('#', ''),
			userId: tags['user-id'],
			username: tags['display-name'] || tags.username,
			stars: firstArg
		};

		try {
			const response = await fetch(`${API_URL}/star/submit`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});

			await sendApiResponseToChat({
				channel,
				response,
				fallbackMessage: `Disculpa ${tags['display-name'] || tags.username}, hubo un error al enviar tu calificación.`
			});
		} catch (error) {
			console.log(error);
			client.say(channel, `Disculpa ${tags['display-name'] || tags.username}, hubo un error al enviar tu calificación.`);
			return;
		}
	},
	'!setmovie': async (channel, tags, message, args) => {
		if (!args.length) {
			client.say(channel, `Disculpa ${tags['display-name'] || tags.username}, por favor proporciona la url de tmdb de la película.`);
			return;
		}

		if (tags.username !== 'khancerberus' && !tags.mod) {
			client.say(channel, `Disculpa ${tags['display-name'] || tags.username}, solo el streamer o los mods puede usar este comando.`);
			return;
		}

		const data = {
			tmdbId: args,
			channelUsername: channel.replace('#', '')
		}

		try {
			const response = await fetch(`${API_URL}/current-movie/set`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});

			await sendApiResponseToChat({
				channel,
				response,
				fallbackMessage: `Disculpa ${tags['display-name'] || tags.username}, hubo un error al actualizar la película.`
			});
		} catch (error) {
			console.log(error);
			client.say(channel, `Disculpa ${tags['display-name'] || tags.username}, hubo un error al actualizar la película.`);
		}
	},
	'!peli': async (channel) => {
		const estadoPeli = await obtenerEstadoPeliActual('Victor');
		client.say(channel, clampChatMessage(estadoPeli));
	}
}