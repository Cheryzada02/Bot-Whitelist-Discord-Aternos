import Discord from "discord.js";
import 'dotenv/config';
import fetch from "node-fetch";
import fs from "fs";

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

// Cargar whitelist
let whitelist = [];
const whitelistPath = './src/data/whitelist.json';
if (fs.existsSync(whitelistPath)) {
  whitelist = JSON.parse(fs.readFileSync(whitelistPath, 'utf8'));
}

// Bot listo
client.once("ready", async () => {
  console.log(`Bot listo: ${client.user.tag}`);
  client.user.setActivity("Minecraft", { type: Discord.ActivityType.Playing });

  enviarLog("Bot iniciado y listo ✅");

  // Enviar botón de verificación al canal de usuarios
  enviarBotonVerificacion();

  // Autoping cada 5 minutos
  setInterval(() => {
    if (process.env.RENDER_URL) {
      fetch(process.env.RENDER_URL)
        .then(() => console.log("Ping enviado para mantener bot activo"))
        .catch(console.error);
    }
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

// Interacciones con botones y modales
client.on("interactionCreate", async (interaction) => {

  // Usuario pulsa botón de verificación
  if (interaction.isButton() && interaction.customId === "verify_button") {
    // Mostrar modal para que escriba su nombre de Minecraft
    const modal = new Discord.ModalBuilder()
      .setCustomId("verifyModal")
      .setTitle("Verificación Minecraft");

    const mcNameInput = new Discord.TextInputBuilder()
      .setCustomId("mcName")
      .setLabel("Tu nombre de usuario en Minecraft")
      .setStyle(Discord.TextInputStyle.Short)
      .setRequired(true);

    const row = new Discord.ActionRowBuilder().addComponents(mcNameInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
  }

  // Modal submit
  if (interaction.isModalSubmit() && interaction.customId === "verifyModal") {
    const mcName = interaction.fields.getTextInputValue("mcName");

    const staffCanal = await client.channels.fetch(CANAL_STAFF);
    if (!staffCanal) return console.log("Canal de staff no encontrado");

    // Crear botones para aprobar/rechazar
    const aceptarBtn = new Discord.ButtonBuilder()
      .setCustomId(`aceptar_${interaction.user.id}_${mcName}`)
      .setLabel("Aceptar")
      .setStyle(Discord.ButtonStyle.Success);

    const rechazarBtn = new Discord.ButtonBuilder()
      .setCustomId(`rechazar_${interaction.user.id}_${mcName}`)
      .setLabel("Rechazar")
      .setStyle(Discord.ButtonStyle.Danger);

    const fila = new Discord.ActionRowBuilder().addComponents(aceptarBtn, rechazarBtn);

    // Embed para el staff
    const embed = new Discord.EmbedBuilder()
      .setTitle("Nueva solicitud de whitelist")
      .setDescription(`Usuario: ${interaction.user.tag}\nMinecraft: ${mcName}`)
      .setColor("Blue");

    await staffCanal.send({ embeds: [embed], components: [fila] });

    await interaction.reply({ content: "✅ Tu solicitud ha sido enviada al staff.", ephemeral: true });
    enviarLog(`Solicitud de whitelist enviada por ${interaction.user.tag}`);
  }

  // Staff pulsa botón de aceptar/rechazar
  if (interaction.isButton() && (interaction.customId.startsWith("aceptar_") || interaction.customId.startsWith("rechazar_"))) {
    const [action, userId, mcName] = interaction.customId.split("_");
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(userId);
    const logChannel = await client.channels.fetch(CANAL_LOGS);

    if (action === "aceptar") {
      if (!whitelist.includes(mcName)) {
        whitelist.push(mcName);
        fs.writeFileSync(whitelistPath, JSON.stringify(whitelist, null, 2));
      }

      await member.roles.add(ROL_VERIFICADO);
      await member.send(`✅ Tu solicitud fue aceptada. IP del servidor: ${IP_SERVIDOR}`);
      await interaction.update({ content: `✅ ${member.user.tag} ha sido verificado`, components: [] });
      enviarLog(`${member.user.tag} aceptado por ${interaction.user.tag}`);
      if (logChannel) logChannel.send(`✅ ${member.user.tag} agregado a whitelist.`);
    } else {
      await member.send(`❌ Tu solicitud fue rechazada por el staff.`);
      await interaction.update({ content: `❌ ${member.user.tag} fue rechazado`, components: [] });
      enviarLog(`${member.user.tag} rechazado por ${interaction.user.tag}`);
      if (logChannel) logChannel.send(`❌ ${member.user.tag} fue rechazado.`);
    }
  }
});

client.login(TOKEN);
