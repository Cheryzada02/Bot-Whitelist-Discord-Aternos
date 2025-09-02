import Discord from "discord.js";
import 'dotenv/config'; // Carga variables de entorno
import fetch from "node-fetch"; // Para autoping

const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMembers,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.MessageContent
  ]
});

// Variables desde .env
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CANAL_USUARIOS = process.env.CANAL_USUARIOS;
const CANAL_STAFF = process.env.CANAL_STAFF;
const ROL_VERIFICADO = process.env.ROL_VERIFICADO;
const ROL_STAFF = process.env.ROL_STAFF;
const IP_SERVIDOR = process.env.IP_SERVIDOR;
const CANAL_LOGS = process.env.CANAL_LOGS;

// Conexión al bot
client.once("ready", () => {
  console.log(`Bot listo: ${client.user.tag}`);
  enviarLog("Bot iniciado y listo ✅");

  // Autoping cada 5 minutos
  setInterval(() => {
    fetch(process.env.RENDER_URL)
      .then(() => console.log("Ping enviado para mantener bot activo"))
      .catch(console.error);
  }, 5 * 60 * 1000);
});

// Función para enviar logs al canal de Discord
function enviarLog(mensaje) {
  const canal = client.channels.cache.get(CANAL_LOGS);
  if (canal) canal.send(mensaje);
}

// Comando de verificación simple
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;
  if (interaction.commandName === "verify") {
    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      const member = await guild.members.fetch(interaction.user.id);
      await member.roles.add(ROL_VERIFICADO);
      await interaction.reply({
        content: `✅ ¡Has sido verificado! La IP del servidor es: ${IP_SERVIDOR}`,
        ephemeral: true
      });
      enviarLog(`${interaction.user.tag} se verificó`);
    } catch (err) {
      console.error(err);
      enviarLog(`Error verificando a ${interaction.user.tag}`);
    }
  }
});

client.login(TOKEN);
