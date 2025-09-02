import Discord from "discord.js";
import 'dotenv/config';
import fetch from "node-fetch";

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
const GUILD_ID = process.env.GUILD_ID;
const CANAL_USUARIOS = process.env.CANAL_USUARIOS;
const CANAL_STAFF = process.env.CANAL_STAFF;
const ROL_VERIFICADO = process.env.ROL_VERIFICADO;
const CANAL_LOGS = process.env.CANAL_LOGS;
const IP_SERVIDOR = process.env.IP_SERVIDOR;

// Conexión al bot
client.once("ready", () => {
  console.log(`Bot listo: ${client.user.tag}`);
  client.user.setActivity("Minecraft", { type: Discord.ActivityType.Playing });

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

// Enviar mensaje con botón de verificación al canal de usuarios
async function enviarBotonVerificacion() {
  const canal = await client.channels.fetch(CANAL_USUARIOS);
  if (!canal) return console.log("Canal de usuarios no encontrado");

  const boton = new Discord.ButtonBuilder()
    .setCustomId("verify_button")
    .setLabel("Iniciar whitelist")
    .setStyle(Discord.ButtonStyle.Primary);

  const fila = new Discord.ActionRowBuilder().addComponents(boton);

  canal.send({
    content: "Pulsa el botón para solicitar la whitelist:",
    components: [fila]
  });
}

// Interacciones con botones
client.on("interactionCreate", async (interaction) => {

  // Usuario pulsa botón de verificación
  if (interaction.isButton() && interaction.customId === "verify_button") {
    const staffCanal = await client.channels.fetch(CANAL_STAFF);
    if (!staffCanal) return console.log("Canal de staff no encontrado");

    // Crear botones de aprobación/rechazo
    const aceptarBtn = new Discord.ButtonBuilder()
      .setCustomId(`aceptar_${interaction.user.id}`)
      .setLabel("Aceptar")
      .setStyle(Discord.ButtonStyle.Success);

    const rechazarBtn = new Discord.ButtonBuilder()
      .setCustomId(`rechazar_${interaction.user.id}`)
      .setLabel("Rechazar")
      .setStyle(Discord.ButtonStyle.Danger);

    const fila = new Discord.ActionRowBuilder().addComponents(aceptarBtn, rechazarBtn);

    // Enviar mensaje al canal de staff
    await staffCanal.send({
      content: `Solicitud de whitelist de ${interaction.user.tag}`,
      components: [fila]
    });

    await interaction.reply({ content: "✅ Tu solicitud ha sido enviada al staff.", ephemeral: true });
    enviarLog(`Solicitud de whitelist enviada por ${interaction.user.tag}`);
  }

  // Staff pulsa botón de aceptar/rechazar
  if (interaction.isButton() && (interaction.customId.startsWith("aceptar_") || interaction.customId.startsWith("rechazar_"))) {
    const userId = interaction.customId.split("_")[1];
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(userId);

    if (interaction.customId.startsWith("aceptar_")) {
      await member.roles.add(ROL_VERIFICADO);
      await member.send(`✅ Tu solicitud fue aceptada. IP del servidor: ${IP_SERVIDOR}`);
      interaction.update({ content: `✅ ${member.user.tag} ha sido verificado`, components: [] });
      enviarLog(`${member.user.tag} aceptado por ${interaction.user.tag}`);
    } else {
      await member.send(`❌ Tu solicitud fue rechazada por el staff.`);
      interaction.update({ content: `❌ ${member.user.tag} fue rechazado`, components: [] });
      enviarLog(`${member.user.tag} rechazado por ${interaction.user.tag}`);
    }
  }
});

// Llamar la función para enviar el botón al iniciar
client.on("ready", enviarBotonVerificacion);

client.login(TOKEN);
