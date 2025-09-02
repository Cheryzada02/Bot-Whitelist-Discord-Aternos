import Discord from "discord.js";
import 'dotenv/config';
import fs from "fs";
import fetch from "node-fetch";
import path from "path";

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
const AUTOPING_URL = "https://bot-whitelist-discord-aternos.onrender.com";

// Ruta para el whitelist.json
const WHITELIST_PATH = path.join(process.cwd(), "whitelist.json");
if (!fs.existsSync(WHITELIST_PATH)) fs.writeFileSync(WHITELIST_PATH, JSON.stringify([]));

// Función para enviar logs en embed
function enviarLog(mensaje, color = Discord.Colors.Blue) {
  const canal = client.channels.cache.get(CANAL_LOGS);
  if (!canal) return;
  const embed = new Discord.EmbedBuilder()
    .setColor(color)
    .setTitle("Log del Bot")
    .setDescription(mensaje)
    .setTimestamp();
  canal.send({ embeds: [embed] }).catch(console.error);
}

// Manejo de errores global
client.on("error", (err) => enviarLog(`❌ Error: ${err.message}`, Discord.Colors.Red));
client.on("warn", (warn) => enviarLog(`⚠️ Warn: ${warn}`, Discord.Colors.Yellow));
process.on("unhandledRejection", (reason) => enviarLog(`❌ Unhandled Rejection: ${reason}`, Discord.Colors.Red));

// Conexión al bot
client.once("ready", () => {
  console.log(`Bot listo: ${client.user.tag}`);
  client.user.setActivity("Minecraft", { type: Discord.ActivityType.Playing });
  enviarLog("✅ Bot iniciado y listo", Discord.Colors.Green);

  // Autoping cada 5 minutos
  setInterval(() => {
    fetch(AUTOPING_URL)
      .then(() => enviarLog("⏱️ Ping enviado para mantener bot activo", Discord.Colors.Blurple))
      .catch((err) => enviarLog(`❌ Error en ping: ${err.message}`, Discord.Colors.Red));
  }, 5 * 60 * 1000);

  // Enviar botón de verificación solo una vez al iniciar
  enviarBotonVerificacion();
});

// Función para enviar mensaje con botón de verificación
async function enviarBotonVerificacion() {
  const canal = await client.channels.fetch(CANAL_USUARIOS).catch(console.error);
  if (!canal) return console.log("Canal de usuarios no encontrado");

  const boton = new Discord.ButtonBuilder()
    .setCustomId("verify_button")
    .setLabel("Iniciar whitelist")
    .setStyle(Discord.ButtonStyle.Primary);

  const fila = new Discord.ActionRowBuilder().addComponents(boton);

  canal.send({
    content: "Pulsa el botón para solicitar la whitelist:",
    components: [fila]
  }).catch(console.error);
}

// Interacciones
client.on("interactionCreate", async (interaction) => {

  // Botón de verificación
  if (interaction.isButton() && interaction.customId === "verify_button") {
    const modal = new Discord.ModalBuilder()
      .setCustomId(`modal_${interaction.user.id}`)
      .setTitle("Solicitud Whitelist");

    const input = new Discord.TextInputBuilder()
      .setCustomId("minecraft_username")
      .setLabel("Tu nombre de usuario en Minecraft")
      .setStyle(Discord.TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new Discord.ActionRowBuilder().addComponents(input));

    await interaction.showModal(modal);
    return;
  }

  // Modal submit
  if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_")) {
    const username = interaction.fields.getTextInputValue("minecraft_username");

    const staffCanal = await client.channels.fetch(CANAL_STAFF);
    if (!staffCanal) return console.log("Canal de staff no encontrado");

    const aceptarBtn = new Discord.ButtonBuilder()
      .setCustomId(`aceptar_${interaction.user.id}_${username}`)
      .setLabel("Aceptar")
      .setStyle(Discord.ButtonStyle.Success);

    const rechazarBtn = new Discord.ButtonBuilder()
      .setCustomId(`rechazar_${interaction.user.id}_${username}`)
      .setLabel("Rechazar")
      .setStyle(Discord.ButtonStyle.Danger);

    const fila = new Discord.ActionRowBuilder().addComponents(aceptarBtn, rechazarBtn);

    await staffCanal.send({
      content: `Solicitud de whitelist de ${interaction.user.tag} (Minecraft: ${username})`,
      components: [fila]
    });

    await interaction.reply({ content: "✅ Tu solicitud ha sido enviada al staff.", ephemeral: true });
    enviarLog(`Solicitud de whitelist enviada por ${interaction.user.tag} (Minecraft: ${username})`, Discord.Colors.Blurple);
    return;
  }

  // Staff aprueba o rechaza
  if (interaction.isButton() && (interaction.customId.startsWith("aceptar_") || interaction.customId.startsWith("rechazar_"))) {
    const parts = interaction.customId.split("_");
    const userId = parts[1];
    const username = parts.slice(2).join("_");

    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(userId);

    if (interaction.customId.startsWith("aceptar_")) {
      await member.roles.add(ROL_VERIFICADO);

      const whitelist = JSON.parse(fs.readFileSync(WHITELIST_PATH));
      if (!whitelist.includes(username)) whitelist.push(username);
      fs.writeFileSync(WHITELIST_PATH, JSON.stringify(whitelist, null, 2));

      await interaction.update({ content: `✅ ${member.user.tag} ha sido verificado`, components: [] });
      await member.send(`✅ Tu solicitud fue aceptada. IP del servidor: ${IP_SERVIDOR}`);
      enviarLog(`${member.user.tag} aceptado por ${interaction.user.tag} (Minecraft: ${username})`, Discord.Colors.Green);
    } else {
      await interaction.update({ content: `❌ ${member.user.tag} fue rechazado`, components: [] });
      await member.send(`❌ Tu solicitud fue rechazada por el staff.`);
      enviarLog(`${member.user.tag} rechazado por ${interaction.user.tag} (Minecraft: ${username})`, Discord.Colors.Red);
    }
    return;
  }
});

client.login(TOKEN);
