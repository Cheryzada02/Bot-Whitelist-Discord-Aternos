import Discord from "discord.js";
import 'dotenv/config';
import fs from "fs";
import fetch from "node-fetch";
import path from "path";

// Cliente Discord
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
  DISCORD_TOKEN, CLIENT_ID, GUILD_ID, CANAL_USUARIOS, CANAL_STAFF,
  ROL_VERIFICADO, ROL_STAFF, CANAL_LOGS, IP_SERVIDOR, AUTOPING_URL
} = process.env;

// Ruta whitelist
const WHITELIST_PATH = path.join(process.cwd(), "whitelist.json");
if (!fs.existsSync(WHITELIST_PATH)) fs.writeFileSync(WHITELIST_PATH, JSON.stringify([]));

// Logs embed
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

// Manejo de errores
client.on("error", err => enviarLog(`❌ Error: ${err.message}`, Discord.Colors.Red));
client.on("warn", warn => enviarLog(`⚠️ Warn: ${warn}`, Discord.Colors.Yellow));
process.on("unhandledRejection", reason => enviarLog(`❌ Unhandled Rejection: ${reason}`, Discord.Colors.Red));

// Evitar solicitudes duplicadas
const pendingRequests = new Set();

// Bot listo
client.once("ready", async () => {
  console.log(`Bot listo: ${client.user.tag}`);
  client.user.setActivity("Minecraft", { type: Discord.ActivityType.Playing });
  enviarLog("✅ Bot iniciado y listo", Discord.Colors.Green);

  // Autoping
  setInterval(() => {
    fetch(AUTOPING_URL)
      .then(() => enviarLog("⏱️ Ping enviado para mantener bot activo", Discord.Colors.Blurple))
      .catch(err => enviarLog(`❌ Error en ping: ${err.message}`, Discord.Colors.Red));
  }, 5 * 60 * 1000);

  enviarBotonVerificacion();
});

// Botón de verificación
async function enviarBotonVerificacion() {
  const canal = await client.channels.fetch(CANAL_USUARIOS).catch(console.error);
  if (!canal) return;

  const boton = new Discord.ButtonBuilder()
    .setCustomId("verify_button")
    .setLabel("Solicitar Whitelist")
    .setStyle(Discord.ButtonStyle.Primary);

  const fila = new Discord.ActionRowBuilder().addComponents(boton);

  canal.send({
    content: "Pulsa el botón para solicitar whitelist:",
    components: [fila]
  }).catch(console.error);
}

// Interacciones
client.on("interactionCreate", async interaction => {
  try {
    // Botón de solicitud
    if (interaction.isButton() && interaction.customId === "verify_button") {
      if (pendingRequests.has(interaction.user.id)) {
        await interaction.reply({ content: "Ya tienes una solicitud pendiente.", ephemeral: true });
        return;
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

      modal.addComponents(new Discord.ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    // Modal enviado
    if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_")) {
      const username = interaction.fields.getTextInputValue("minecraft_username");
      const staffCanal = await client.channels.fetch(CANAL_STAFF);
      if (!staffCanal) return;

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

    // Aceptar o rechazar (solo staff)
    if (interaction.isButton() && (interaction.customId.startsWith("aceptar_") || interaction.customId.startsWith("rechazar_"))) {
      const staffMember = interaction.member;
      if (!staffMember.roles.cache.has(ROL_STAFF)) {
        if (!interaction.replied)
          await interaction.reply({ content: "❌ No tienes permisos para realizar esta acción.", ephemeral: true });
        return;
      }

      const parts = interaction.customId.split("_");
      const userId = parts[1];
      const username = parts.slice(2).join("_");

      const guild = await client.guilds.fetch(GUILD_ID);
      const member = await guild.members.fetch(userId);
      if (!member) return;

      if (interaction.customId.startsWith("aceptar_")) {
        await member.roles.add(ROL_VERIFICADO);
        const whitelist = JSON.parse(fs.readFileSync(WHITELIST_PATH));
        if (!whitelist.includes(username)) whitelist.push(username);
        fs.writeFileSync(WHITELIST_PATH, JSON.stringify(whitelist, null, 2));

        await member.send(`✅ Tu solicitud fue aceptada. IP del servidor: ${IP_SERVIDOR}`);
        await interaction.update({ content: `✅ ${member.user.tag} ha sido verificado`, components: [] });
        pendingRequests.delete(userId);
        enviarLog(`${member.user.tag} aceptado por ${staffMember.user.tag} (Minecraft: ${username})`, Discord.Colors.Green);

      } else {
        await member.send(`❌ Tu solicitud fue rechazada por el staff.`);
        await interaction.update({ content: `❌ ${member.user.tag} fue rechazado`, components: [] });
        pendingRequests.delete(userId);
        enviarLog(`${member.user.tag} rechazado por ${staffMember.user.tag} (Minecraft: ${username})`, Discord.Colors.Red);
      }
    }

  } catch (err) {
    console.error(err);
    if (!interaction.replied) await interaction.reply({ content: "❌ Ocurrió un error.", ephemeral: true });
  }
});

client.login(DISCORD_TOKEN);
