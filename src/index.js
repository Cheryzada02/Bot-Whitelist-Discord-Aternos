import Discord from "discord.js";
import 'dotenv/config';
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMembers,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.MessageContent
  ]
});

// Variables de entorno
const {
  DISCORD_TOKEN,
  GUILD_ID,
  CANAL_USUARIOS,
  CANAL_STAFF,
  ROL_VERIFICADO,
  ROL_STAFF,
  CANAL_LOGS,
  IP_SERVIDOR
} = process.env;

// Ruta del whitelist.json
const WHITELIST_PATH = path.join(process.cwd(), "whitelist.json");

// Crear whitelist.json si no existe
if (!fs.existsSync(WHITELIST_PATH)) fs.writeFileSync(WHITELIST_PATH, JSON.stringify([]));

// Conjunto para evitar solicitudes duplicadas
const pendingRequests = new Set();

// Función para enviar logs en embed
async function enviarLog(mensaje, color = Discord.Colors.Blue) {
  try {
    const canal = await client.channels.fetch(CANAL_LOGS);
    if (!canal) return console.log("Canal de logs no encontrado");
    const embed = new Discord.EmbedBuilder()
      .setColor(color)
      .setTitle("Log del Bot")
      .setDescription(mensaje)
      .setTimestamp();
    canal.send({ embeds: [embed] }).catch(console.error);
  } catch (err) {
    console.error("Error enviando log:", err);
  }
}

// Función para enviar embed con botón de verificación
async function enviarBotonVerificacion() {
  try {
    const canal = await client.channels.fetch(CANAL_USUARIOS);
    if (!canal) return console.log("Canal de usuarios no encontrado");

    const embed = new Discord.EmbedBuilder()
      .setColor(Discord.Colors.Blurple)
      .setTitle("Solicitar Whitelist")
      .setDescription("Pulsa el botón para solicitar tu whitelist en el servidor.")
      .setTimestamp();

    const boton = new Discord.ButtonBuilder()
      .setCustomId("verify_button")
      .setLabel("Solicitar Whitelist")
      .setStyle(Discord.ButtonStyle.Primary);

    const fila = new Discord.ActionRowBuilder().addComponents(boton);
    await canal.send({ embeds: [embed], components: [fila] });
  } catch (err) {
    console.error("Error enviando embed de verificación:", err);
    enviarLog(`❌ Error enviando embed de verificación: ${err.message}`, Discord.Colors.Red);
  }
}

// Manejo de errores globales
client.on("error", err => enviarLog(`❌ Error: ${err.message}`, Discord.Colors.Red));
client.on("warn", warn => enviarLog(`⚠️ Warn: ${warn}`, Discord.Colors.Yellow));
process.on("unhandledRejection", reason => enviarLog(`❌ Unhandled Rejection: ${reason}`, Discord.Colors.Red));

// Evento ready
client.once("ready", async () => {
  console.log(`Bot listo: ${client.user.tag}`);
  client.user.setActivity("Minecraft", { type: Discord.ActivityType.Playing });
  enviarLog("✅ Bot iniciado y listo", Discord.Colors.Green);

  // Enviar embed de verificación al canal de usuarios
  enviarBotonVerificacion();

  // Autoping cada 5 minutos
  setInterval(() => {
    fetch("https://bot-whitelist-discord-aternos.onrender.com")
      .then(() => enviarLog("⏱️ Ping enviado para mantener bot activo", Discord.Colors.Blurple))
      .catch(err => enviarLog(`❌ Error en ping: ${err.message}`, Discord.Colors.Red));
  }, 5 * 60 * 1000);
});

// Interacciones
client.on("interactionCreate", async (interaction) => {
  try {
    // Usuario pulsa botón de verificación
    if (interaction.isButton() && interaction.customId === "verify_button") {
      if (pendingRequests.has(interaction.user.id)) {
        return interaction.reply({ content: "Ya tienes una solicitud pendiente.", ephemeral: true });
      }
      pendingRequests.add(interaction.user.id);

      const modal = new Discord.ModalBuilder()
        .setCustomId(`modal_${interaction.user.id}`)
        .setTitle("Solicitud Whitelist");

      const input = new Discord.TextInputBuilder()
        .setCustomId("minecraft_username")
        .setLabel("Tu nombre de usuario en Minecraft")
        .setStyle(Discord.TextInputStyle.Short)
        .setRequired(true);

      const fila = new Discord.ActionRowBuilder().addComponents(input);
      modal.addComponents(fila);
      await interaction.showModal(modal);
    }

    // Usuario envía modal
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
    }

    // Staff aprueba o rechaza
    if (interaction.isButton() && (interaction.customId.startsWith("aceptar_") || interaction.customId.startsWith("rechazar_"))) {
      const member = await (async () => {
        const parts = interaction.customId.split("_");
        const userId = parts[1];
        const username = parts.slice(2).join("_");
        const guild = await client.guilds.fetch(GUILD_ID);
        return { guild, member: await guild.members.fetch(userId), userId, username };
      })();

      // Solo rol staff puede interactuar
      if (!interaction.member.roles.cache.has(ROL_STAFF)) {
        return interaction.reply({ content: "❌ No tienes permiso para aceptar/rechazar.", ephemeral: true });
      }

      if (interaction.customId.startsWith("aceptar_")) {
        await member.member.roles.add(ROL_VERIFICADO);
        const whitelist = JSON.parse(fs.readFileSync(WHITELIST_PATH));
        if (!whitelist.includes(member.username)) whitelist.push(member.username);
        fs.writeFileSync(WHITELIST_PATH, JSON.stringify(whitelist, null, 2));

        await member.member.send(`✅ Tu solicitud fue aceptada. IP del servidor: ${IP_SERVIDOR}`);
        pendingRequests.delete(member.userId);
        await interaction.update({ content: `✅ ${member.member.user.tag} ha sido verificado`, components: [] });
        enviarLog(`${member.member.user.tag} aceptado por ${interaction.user.tag} (Minecraft: ${member.username})`, Discord.Colors.Green);
      } else {
        await member.member.send(`❌ Tu solicitud fue rechazada por el staff.`);
        pendingRequests.delete(member.userId);
        await interaction.update({ content: `❌ ${member.member.user.tag} fue rechazado`, components: [] });
        enviarLog(`${member.member.user.tag} rechazado por ${interaction.user.tag} (Minecraft: ${member.username})`, Discord.Colors.Red);
      }
    }

  } catch (err) {
    console.error(err);
    if (interaction.deferred || interaction.replied) return;
    await interaction.reply({ content: "❌ Ocurrió un error.", ephemeral: true });
  }
});

client.login(DISCORD_TOKEN);
