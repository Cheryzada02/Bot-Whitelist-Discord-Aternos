import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import fs from 'fs';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

// Configuración
const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;
const canalUsuarios = process.env.CANAL_USUARIOS;
const canalStaff = process.env.CANAL_STAFF;
const rolVerificado = process.env.ROL_VERIFICADO;
const rolStaff = process.env.ROL_STAFF;
const ipServidor = process.env.IP_SERVIDOR;
const canalLogs = process.env.CANAL_LOGS;

// Crear cliente Discord
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages] });

// Cuando el bot esté listo
client.once('ready', () => {
    console.log(`Bot listo: ${client.user.tag}`);

    // Enviar embed inicial al canal de usuarios
    const canal = client.channels.cache.get(canalUsuarios);
    if(canal) {
        const embed = new EmbedBuilder()
            .setTitle('Iniciar Whitelist')
            .setDescription('Pulsa para solicitar tu acceso a la whitelist.')
            .setColor('Green');
        canal.send({ embeds: [embed] });
    }

    // Autoping cada 5 minutos para evitar que Render apague el bot
    setInterval(() => {
        fetch('https://your-app-name.onrender.com')
            .then(() => log('Ping enviado para mantener bot activo'))
            .catch(console.error);
    }, 5 * 60 * 1000); // 5 minutos
});

// Función de logs
function log(mensaje) {
    const canal = client.channels.cache.get(canalLogs);
    if(canal) canal.send(mensaje);
}

// Event listener para interacciones de botones (verificación)
client.on('interactionCreate', async interaction => {
    if(!interaction.isButton()) return;
    if(interaction.customId === 'verificar') {
        try {
            const member = interaction.guild.members.cache.get(interaction.user.id);
            if(!member) return;

            // Asignar rol verificado
            await member.roles.add(rolVerificado);

            // Mandar mensaje privado con IP
            await interaction.user.send(`¡Tu acceso a la whitelist ha sido aprobado! IP del servidor: ${ipServidor}`);

            log(`Usuario verificado: ${interaction.user.tag}`);
        } catch(e) {
            console.error(e);
        }
    }
});

// Leer whitelist.json para verificación
let whitelist = [];
const wlPath = './whitelist.json';
if(fs.existsSync(wlPath)) whitelist = JSON.parse(fs.readFileSync(wlPath));

// Login
client.login(token);
