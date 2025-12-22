// ========================
// IMPORTS & CONFIG
// ========================
import 'dotenv/config';
import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } from "discord.js";

// ========================
// DATA FILES
// ========================
const dataDir = "./data";
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const assignedFileF1 = path.join(dataDir, "assignedPlayersF1.json");
const assignedFileF2 = path.join(dataDir, "assignedPlayersF2.json");
const registrationFile = path.join(dataDir, "registrationData.json");
const liveEmbedFile = path.join(dataDir, "liveLineup.json");
const carNumberClaimFile = path.join(dataDir, "carNumberClaims.json");
const backupChannelId = "1452397713252548638";

if (!fs.existsSync(assignedFileF1)) fs.writeFileSync(assignedFileF1, JSON.stringify({}, null, 2));
if (!fs.existsSync(assignedFileF2)) fs.writeFileSync(assignedFileF2, JSON.stringify({}, null, 2));
if (!fs.existsSync(registrationFile)) fs.writeFileSync(registrationFile, JSON.stringify({}, null, 2));
if (!fs.existsSync(liveEmbedFile)) fs.writeFileSync(liveEmbedFile, JSON.stringify({ F1: null, F2: null }, null, 2));
if (!fs.existsSync(carNumberClaimFile)) fs.writeFileSync(carNumberClaimFile, JSON.stringify({ F1: [], F2: [], embeds: {} }, null, 2));

let assignedPlayersF1 = JSON.parse(fs.readFileSync(assignedFileF1, "utf8"));
let assignedPlayersF2 = JSON.parse(fs.readFileSync(assignedFileF2, "utf8"));
let registrationData = JSON.parse(fs.readFileSync(registrationFile, "utf8"));
let liveLineupIds = JSON.parse(fs.readFileSync(liveEmbedFile, "utf8"));
let carNumberClaims = JSON.parse(fs.readFileSync(carNumberClaimFile, "utf8"));

// ========================
// CRONITOR HEARTBEAT
// ========================
const CRONITOR_URL = "https://cronitor.link/p/5228af7c42f54ba681f4b7c436c08f1b/luqCyv";
let heartbeatStarted = false;
function startCronitorHeartbeat() {
  if (heartbeatStarted) return;
  heartbeatStarted = true;
  setInterval(async () => {
    try { await fetch(CRONITOR_URL); console.log("Cronitor heartbeat sent"); }
    catch (err) { console.error("Cronitor heartbeat failed", err); }
  }, 60 * 1000);
}

// ========================
// EXPRESS HEALTH CHECK
// ========================
const app = express();
const PORT = process.env.PORT || 10000;
app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(PORT, () => console.log(`Health check server running on port ${PORT}`));

// ========================
// F1/F2 CONFIG
// ========================
const seriesConfigs = {
  F1: {
    teamRoleIds: {
      "McLaren F1 team": "1432661469975281724",
      "Mercedes-AMG PETRONAS F1 team": "1432661710849703998",
      "Oracle Red Bull Racing F1 team": "1432661838146834525",
      "Scuderia Ferrari F1 team": "1432662095182172241",
      "MoneyGram Haas F1 team": "1432662285444190279",
      "Williams Racing F1 team": "1432662869245296641",
      "BWT Alpine F1 team": "1432663841346555984",
      "Visa Cash App Racing Bulls F1 team": "1432664100848144447",
      "Aston Martin Aramco F1 team": "1432664278862790746",
      "Stake F1 team Kick Sauber": "1432664415450304582",
    },
    playerRoles: {
      "Team Principal F1": { id: "1432668072870940754", max: 1 },
      "Main Driver F1": { id: "1432738660075442377", max: 2 },
      "Reserve Driver F1": { id: "1432739468770541739", max: 2 },
      "Engineer F1": { id: "1432786005106102342", max: 2 }
    },
    updateChannelId: "1432370687888064735",
    liveLineupChannelId: "1432370391929716787"
  },
  F2: {
    teamRoleIds: {
      "McLaren F2 team": "1432691339094528053",
      "Mercedes-AMG PETRONAS F2 team": "1432721882582614058",
      "Oracle Red Bull Racing F2 team": "1432362082250260640",
      "Scuderia Ferrari F2 team": "1432734720449577101",
      "MoneyGram Haas F2 team": "1432734837248360444",
      "Williams Racing F2 team": "1432734965577285855",
      "BWT Alpine F2 team": "1432735063640113254",
      "Visa Cash App Racing Bulls F2 team": "1432735203645722695",
      "Aston Martin Aramco F2 team": "1432735425327399063",
      "Stake F2 team Kick Sauber": "1432735535763427458",
    },
    playerRoles: {
      "Team Principal F2": { id: "1432668794911854635", max: 1 },
      "Main Driver F2": { id: "1436021035638984806", max: 2 },
      "Reserve Driver F2": { id: "1436021153977077771", max: 2 },
      "Engineer F2": { id: "1435197815461642400", max: 2 }
    },
    updateChannelId: "1432371785181040640",
    liveLineupChannelId: "1432371611927056544"
  }
};

// ========================
// SAVE HELPERS
// ========================
const saveAssignedF1 = () => fs.writeFileSync(assignedFileF1, JSON.stringify(assignedPlayersF1, null, 2));
const saveAssignedF2 = () => fs.writeFileSync(assignedFileF2, JSON.stringify(assignedPlayersF2, null, 2));
const saveRegistration = () => fs.writeFileSync(registrationFile, JSON.stringify(registrationData, null, 2));
const saveLiveEmbedIds = () => fs.writeFileSync(liveEmbedFile, JSON.stringify(liveLineupIds, null, 2));
const saveCarNumberClaims = () => fs.writeFileSync(carNumberClaimFile, JSON.stringify(carNumberClaims, null, 2));

const getAssignedPlayers = (series) => series === "F1" ? assignedPlayersF1 : assignedPlayersF2;
const saveAssigned = (series) => series === "F1" ? saveAssignedF1() : saveAssignedF2();

// ========================
// HELPERS
// ========================
const sendEmbed = async (guild, title, description, color, executorTag, updateChannelId) => {
  const embed = new EmbedBuilder()
    .setTitle(`Team Update: ${title}`)
    .setDescription(description)
    .setColor(color)
    .setTimestamp()
    .setFooter({ text: `Action by ${executorTag}` });

  const logChannel = guild.channels.cache.get(updateChannelId);
  if (logChannel?.isTextBased()) logChannel.send({ embeds: [embed] }).catch(console.error);
};

const isCarNumberTaken = (series, number, userId) => {
  // Check registration data (keyed by ID)
  if (Object.entries(registrationData).some(([uid, data]) => data.series === series && data.carnumber === number && uid !== userId))
    return true;
  // Check direct claims list (array of objects)
  if (carNumberClaims[series]?.some(c => c.number === number && c.userId !== userId))
    return true;
  return false;
};

// ========================
// LIVE LINEUP & CAR NUMBER EMBEDS
// ========================
const updateLiveLineup = async (guild, series) => {
  const config = seriesConfigs[series];
  const assignedPlayers = getAssignedPlayers(series);
  const embed = new EmbedBuilder().setTitle(`${series} Live Team Lineup`).setColor("Gold").setTimestamp();

  const MAX_FIELD_LENGTH = 1024;
  const safeString = (str) => (typeof str === "string" ? str : String(str));

  for (const team in config.teamRoleIds) {
    let list = "";
    for (const [key, val] of Object.entries(assignedPlayers)) {
      if (val.team === team) list += `<@${key}> - ${safeString(val.role)}\n`;
    }
    if (!list) list = "No members yet.";
    list = list.slice(0, MAX_FIELD_LENGTH);
    embed.addFields({ name: team, value: list });
  }

  const channel = guild.channels.cache.get(config.liveLineupChannelId);
  if (!channel?.isTextBased()) return;

  try {
    if (liveLineupIds[series]) {
      const msg = await channel.messages.fetch(liveLineupIds[series]).catch(() => null);
      if (msg) return msg.edit({ embeds: [embed] });
    }
    const msg = await channel.send({ embeds: [embed] });
    liveLineupIds[series] = msg.id;
    saveLiveEmbedIds();
  } catch (err) {
    console.error("Failed to update live lineup:", err);
  }
};

const updateCarNumberEmbed = async (guild) => {
  const channel = guild.channels.cache.get("1452244527749533726");
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle(`Claimed Car Numbers`)
    .setColor("Blue")
    .setTimestamp();

  const MAX_FIELD_LENGTH = 1024;
  const formatList = (list) => list && list.length ? list.map(c => `#${c.number} — <@${c.userId}>`).join("\n").slice(0, MAX_FIELD_LENGTH) : "No list yet";

  embed.addFields({ name: "F1", value: formatList(carNumberClaims.F1) }, { name: "F2", value: formatList(carNumberClaims.F2) });

  try {
    if (!carNumberClaims.embeds) carNumberClaims.embeds = {};
    if (carNumberClaims.embeds.live) {
      const msg = await channel.messages.fetch(carNumberClaims.embeds.live).catch(() => null);
      if (msg) return msg.edit({ embeds: [embed] });
    }
    const msg = await channel.send({ embeds: [embed] });
    carNumberClaims.embeds.live = msg.id;
    saveCarNumberClaims();
  } catch (err) {
    console.error("Failed to update car number embed:", err);
  }
};

const updateBackupEmbed = async (guild) => {
  const channel = guild.channels.cache.get(backupChannelId);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle("WARL Backup Embed (PMO)")
    .setColor("Purple")
    .setTimestamp();

  // --- Assigned Players ---
  const f1Players = Object.entries(assignedPlayersF1).map(
    ([uid, val]) => `<@${uid}> - ${val.role} (${val.team})`
  );
  embed.addFields({
    name: "Assigned Players F1",
    value: f1Players.length ? f1Players.join("\n").slice(0, 1024) : "No players yet."
  });

  const f2Players = Object.entries(assignedPlayersF2).map(
    ([uid, val]) => `<@${uid}> - ${val.role} (${val.team})`
  );
  embed.addFields({
    name: "Assigned Players F2",
    value: f2Players.length ? f2Players.join("\n").slice(0, 1024) : "No players yet."
  });

  // --- Car Numbers ---
  const carNumbersF1 = (carNumberClaims.F1 || []).map(c => `#${c.number} — <@${c.userId}>`);
  const carNumbersF2 = (carNumberClaims.F2 || []).map(c => `#${c.number} — <@${c.userId}>`);
  embed.addFields(
    { name: "Car Numbers F1", value: carNumbersF1.length ? carNumbersF1.join("\n").slice(0, 1024) : "No car numbers yet." },
    { name: "Car Numbers F2", value: carNumbersF2.length ? carNumbersF2.join("\n").slice(0, 1024) : "No car numbers yet." }
  );

  try {
    if (!global.backupEmbedId) {
      const msg = await channel.send({ embeds: [embed] });
      global.backupEmbedId = msg.id;
    } else {
      const msg = await channel.messages.fetch(global.backupEmbedId).catch(() => null);
      if (msg) await msg.edit({ embeds: [embed] });
      else {
        const newMsg = await channel.send({ embeds: [embed] });
        global.backupEmbedId = newMsg.id;
      }
    }
  } catch (err) {
    console.error("Failed to update backup embed:", err);
  }
};

// ========================
// DISCORD CLIENT
// ========================
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

// ========================
// COMMANDS
// ========================
const seriesChoices = [{ name: "F1", value: "F1" }, { name: "F2", value: "F2" }];
const commands = [
  new SlashCommandBuilder().setName("sign").setDescription("Sign a user to a league team and role")
    .addStringOption(o => o.setName("league").setDescription("F1 or F2").setRequired(true).addChoices(...seriesChoices))
    .addUserOption(o => o.setName("user").setDescription("User to sign").setRequired(true))
    .addStringOption(o => o.setName("team").setDescription("Team").setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName("role").setDescription("Role").setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName("move").setDescription("Move a user to a new team and role")
    .addStringOption(o => o.setName("league").setDescription("F1 or F2").setRequired(true).addChoices(...seriesChoices))
    .addUserOption(o => o.setName("user").setDescription("User to move").setRequired(true))
    .addStringOption(o => o.setName("team").setDescription("Team").setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName("role").setDescription("Role").setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName("release").setDescription("Release a user from all bot-assigned roles")
    .addStringOption(o => o.setName("league").setDescription("F1 or F2").setRequired(true).addChoices(...seriesChoices))
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("register").setDescription("Register car number, username, flag")
    .addStringOption(o => o.setName("league").setDescription("F1 or F2").setRequired(true).addChoices(...seriesChoices))
    .addIntegerOption(o => o.setName("carnumber").setDescription("Car number").setRequired(true))
    .addStringOption(o => o.setName("username").setDescription("Username").setRequired(true))
    .addStringOption(o => o.setName("flag").setDescription("Flag emoji").setRequired(true)),
  new SlashCommandBuilder().setName("profile").setDescription("Show user profile")
    .addStringOption(o => o.setName("league").setDescription("F1 or F2").setRequired(true).addChoices(...seriesChoices))
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(false)),
  new SlashCommandBuilder().setName("lineupyear").setDescription("Show all teams lineup")
    .addStringOption(o => o.setName("league").setDescription("F1 or F2").setRequired(true).addChoices(...seriesChoices)),
  new SlashCommandBuilder().setName("help").setDescription("Show commands"),
  new SlashCommandBuilder().setName("resetdata").setDescription("Reset all bot data (restricted user only)"),
  new SlashCommandBuilder().setName("carnumberclaim").setDescription("Claim car numbers for a league")
    .addStringOption(o => o.setName("league").setDescription("F1 or F2").setRequired(true).addChoices(...seriesChoices))
    .addIntegerOption(o => o.setName("number").setDescription("Car number to claim").setRequired(true))
].map(c => c.toJSON());

// ========================
// CLIENT READY
// ========================
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  startCronitorHeartbeat();

  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("Commands registered!");
    client.guilds.cache.forEach(async guild => {
      await updateLiveLineup(guild, "F1");
      await updateLiveLineup(guild, "F2");
      await updateCarNumberEmbed(guild);
      await updateBackupEmbed(guild);
    });
  } catch (err) { console.error(err); }
});

client.login(process.env.DISCORD_TOKEN);

// ========================
// AUTOCOMPLETE & COMMAND HANDLER
// ========================
client.on("interactionCreate", async interaction => {
  if (interaction.isAutocomplete()) {
    const focused = interaction.options.getFocused(true);
    const league = interaction.options.getString("league");
    const config = league ? seriesConfigs[league] : null;
    if (!config) return interaction.respond([]);

    if (["team", "role"].includes(focused.name)) {
      const choices = focused.name === "team"
        ? Object.keys(config.teamRoleIds)
        : Object.keys(config.playerRoles);
      return interaction.respond(choices.map(c => ({ name: c, value: c })).slice(0, 25));
    }
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  const guild = interaction.guild;
  const user = interaction.user;
  const executorTag = user.tag;

  // Helper to get series config and assigned players
  const series = interaction.options.getString("league");
  const config = seriesConfigs[series];
  // Note: 'series' might be null for commands that don't use it, but here all commands seem to use it except maybe help/reset
  // We handle invalid series locally inside commands or rely on required=true

  const assigned = series ? getAssignedPlayers(series) : null;

  try {
    switch (commandName) {
      case "sign": {
        if (!config) return interaction.reply({ content: "Invalid series.", ephemeral: true });
        const targetUser = interaction.options.getUser("user");
        const team = interaction.options.getString("team");
        const role = interaction.options.getString("role");

        if (!config.teamRoleIds[team] || !config.playerRoles[role]) {
          return interaction.reply({ content: "Invalid team or role.", ephemeral: true });
        }

        const roleLimit = config.playerRoles[role].max;
        const currentCount = Object.values(assigned).filter(p => p.team === team && p.role === role).length;
        if (currentCount >= roleLimit) return interaction.reply({ content: `${role} role for ${team} is full.`, ephemeral: true });

        assigned[targetUser.id] = { team, role };
        saveAssigned(series);

        sendEmbed(guild, "Sign", `<@${targetUser.id}> signed to ${team} as ${role}.`, "Green", executorTag, config.updateChannelId);
        await updateLiveLineup(guild, series);
        await updateBackupEmbed(guild);
        return interaction.reply({ content: `<@${targetUser.id}> signed successfully.`, ephemeral: true });
      }

      case "move": {
        if (!config) return interaction.reply({ content: "Invalid series.", ephemeral: true });
        const targetUser = interaction.options.getUser("user");
        const team = interaction.options.getString("team");
        const role = interaction.options.getString("role");

        if (!assigned[targetUser.id]) return interaction.reply({ content: "User not signed yet.", ephemeral: true });
        assigned[targetUser.id] = { team, role };
        saveAssigned(series);

        sendEmbed(guild, "Move", `<@${targetUser.id}> moved to ${team} as ${role}.`, "Orange", executorTag, config.updateChannelId);
        await updateLiveLineup(guild, series);
        await updateBackupEmbed(guild);
        return interaction.reply({ content: `<@${targetUser.id}> moved successfully.`, ephemeral: true });
      }

      case "release": {
        if (!config) return interaction.reply({ content: "Invalid series.", ephemeral: true });
        const targetUser = interaction.options.getUser("user");
        if (!assigned[targetUser.id]) return interaction.reply({ content: "User not signed yet.", ephemeral: true });

        delete assigned[targetUser.id];
        saveAssigned(series);

        sendEmbed(guild, "Release", `<@${targetUser.id}> released from ${series}.`, "Red", executorTag, config.updateChannelId);
        await updateLiveLineup(guild, series);
        await updateBackupEmbed(guild);
        return interaction.reply({ content: `<@${targetUser.id}> released successfully.`, ephemeral: true });
      }

      case "register": {
        if (!config) return interaction.reply({ content: "Invalid series.", ephemeral: true });
        const targetUser = user;
        const carNumber = interaction.options.getInteger("carnumber");
        const username = interaction.options.getString("username");
        const flag = interaction.options.getString("flag");

        if (isCarNumberTaken(series, carNumber, targetUser.id)) return interaction.reply({ content: "Car number already taken.", ephemeral: true });

        registrationData[targetUser.id] = { series, carnumber: carNumber, username, flag };
        saveRegistration();

        await updateCarNumberEmbed(guild);
        await updateBackupEmbed(guild);
        return interaction.reply({ content: `Car number #${carNumber} registered successfully!`, ephemeral: true });
      }

      case "carnumberclaim": {
        if (!config) return interaction.reply({ content: "Invalid series.", ephemeral: true });
        const numberToClaim = interaction.options.getInteger("number");

        if (isCarNumberTaken(series, numberToClaim, user.id)) {
          return interaction.reply({ content: `Car number #${numberToClaim} is already taken in ${series}.`, ephemeral: true });
        }

        if (!carNumberClaims[series]) carNumberClaims[series] = [];
        
        // Remove previous claim by this user in this series if you only want 1 claim per user
        // (Optional: if you want to allow multiple claims, remove this filter line)
        carNumberClaims[series] = carNumberClaims[series].filter(c => c.userId !== user.id);

        carNumberClaims[series].push({ number: numberToClaim, userId: user.id });
        saveCarNumberClaims();

        await updateCarNumberEmbed(guild);
        await updateBackupEmbed(guild);

        return interaction.reply({ content: `Successfully claimed car number #${numberToClaim} for ${series}.`, ephemeral: true });
      }

      case "profile": {
        const targetUser = interaction.options.getUser("user") || user;
        const reg = registrationData[targetUser.id];
        // Note: assigned depends on 'series', but profile doesn't strictly need league input if we search both,
        // however the command requires 'league'.
        if (!assigned) return interaction.reply({ content: "Please specify a league.", ephemeral: true });
        const assign = assigned[targetUser.id];
        const profileEmbed = new EmbedBuilder()
          .setTitle(`${targetUser.tag} Profile`)
          .setColor("Blue")
          .addFields(
            { name: "League", value: reg?.series || series || "-", inline: true },
            { name: "Team", value: assign?.team || "-", inline: true },
            { name: "Role", value: assign?.role || "-", inline: true },
            { name: "Car Number", value: reg?.carnumber ? `#${reg.carnumber}` : "-", inline: true },
            { name: "Username", value: reg?.username || "-", inline: true },
            { name: "Flag", value: reg?.flag || "-", inline: true }
          )
          .setTimestamp();

        return interaction.reply({ embeds: [profileEmbed], ephemeral: true });
      }

      case "lineupyear": {
        if (!config) return interaction.reply({ content: "Invalid series.", ephemeral: true });
        const embed = new EmbedBuilder().setTitle(`${series} Teams Lineup`).setColor("Gold").setTimestamp();
        for (const team in config.teamRoleIds) {
          const list = Object.entries(assigned)
            .filter(([uid, val]) => val.team === team)
            .map(([uid, val]) => `<@${uid}> - ${val.role}`)
            .join("\n") || "No members yet.";
          embed.addFields({ name: team, value: list });
        }
        return interaction.reply({ embeds: [embed], ephemeral: false });
      }

      case "help": {
        return interaction.reply({
          content: `Available commands: /sign, /move, /release, /register, /carnumberclaim, /profile, /lineupyear, /resetdata`,
          ephemeral: true
        });
      }

      case "resetdata": {
        if (user.id !== process.env.ADMIN_ID) return interaction.reply({ content: "Not authorized.", ephemeral: true });

        assignedPlayersF1 = {};
        assignedPlayersF2 = {};
        registrationData = {};
        liveLineupIds = { F1: null, F2: null };
        carNumberClaims = { F1: [], F2: [], embeds: {} };

        saveAssignedF1(); saveAssignedF2(); saveRegistration(); saveLiveEmbedIds(); saveCarNumberClaims();
        await client.guilds.cache.forEach(g => { updateLiveLineup(g, "F1"); updateLiveLineup(g, "F2"); updateCarNumberEmbed(g); updateBackupEmbed(g); });
        return interaction.reply({ content: "All data has been reset.", ephemeral: true });
      }

      default:
        return interaction.reply({ content: "Unknown command.", ephemeral: true });
    }
  } catch (err) {
    console.error(err);
    return interaction.reply({ content: "Error executing command.", ephemeral: true });
  }

});
