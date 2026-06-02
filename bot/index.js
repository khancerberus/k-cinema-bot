import tmi from 'tmi.js';
import 'dotenv/config';

const API_URL = process.env.API_URL;

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
		if (!args) {
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
			if (response.ok) {
				client.say(channel, `Gracias por la recomendación, ${displayName}!`);
			} else {
				const errorResponse = await response.json();
				console.log(JSON.stringify(errorResponse));
				if (errorResponse.error === 'DuplicatedRecommendation') {
					client.say(channel, `Disculpa ${displayName}, ya han recomendado esa película antes.`);
					return;
				}
				console.error(`Error response from API: ${response.status} ${response.statusText}`);
				client.say(channel, `${displayName}, asegurate de que el enlace sea correcto y vuelva a intentarlo.`);
			}
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

		const star = '⭐'.repeat(firstArg);
		const halfStar = '½';
		const starsDisplay = firstArg % 1 === 0 ? star : star + halfStar;

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
			if (!response.ok) {
				const errorResponse = await response.json();
				console.log(JSON.stringify(errorResponse));
				client.say(channel, `Disculpa ${tags['display-name'] || tags.username}, hubo un error al enviar tu calificación.`);
				return;
			}
		} catch (error) {
			console.log(error);
			client.say(channel, `Disculpa ${tags['display-name'] || tags.username}, hubo un error al enviar tu calificación.`);
			return;
		}

		client.say(channel, `${tags['display-name'] || tags.username} le ha puesto ${starsDisplay} estrellas a la peli!`);
	},
	'!setmovie': async (channel, tags, message, args) => {
		if (!args) {
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
			const response = await fetch(`${API_URL}/set-movie`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
			const message = await response.text();
			if (response.ok) {
				client.say(channel, message);
			} else {
				const errorResponse = await response.json();
				console.log(JSON.stringify(errorResponse));
				client.say(channel, message);
			}
		} catch (error) {
			console.log(error);
			client.say(channel, `Disculpa ${tags['display-name'] || tags.username}, hubo un error al actualizar la película.`);
		}
	}
}