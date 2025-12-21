// ========================
// IMPORTS & CONFIG
// ========================
import 'dotenv/config';
import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } from "discord.js";

const dataDir = "./data";
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const assignedFileF1 = path.join(dataDir, "assignedPlayersF1.json");
const assignedFileF2 = path.join(dataDir, "assignedPlayersF2.json");
const registrationFile = path.join(dataDir, "registrationData.json");
const liveEmbedFile = path.join(dataDir, "liveLineup.json");

if (!fs.existsSync(assignedFileF1)) fs.writeFileSync(assignedFileF1, JSON.stringify({}, null, 2));
if (!fs.existsSync(assignedFileF2)) fs.writeFileSync(assignedFileF2, JSON.stringify({}, null, 2));
if (!fs.existsSync(registrationFile)) fs.writeFileSync(registrationFile, JSON.stringify({}, null, 2));
if (!fs.existsSync(liveEmbedFile)) fs.writeFileSync(liveEmbedFile, JSON.stringify({ F1:null, F2:null }, null, 2));

let assignedPlayersF1 = JSON.parse(fs.readFileSync(assignedFileF1, "utf8"));
let assignedPlayersF2 = JSON.parse(fs.readFileSync(assignedFileF2, "utf8"));
let registrationData = JSON.parse(fs.readFileSync(registrationFile, "utf8"));
let liveLineupIds = JSON.parse(fs.readFileSync(liveEmbedFile, "utf8"));

// ========================
// CRONITOR HEARTBEAT
// ========================
const CRONITOR_URL = "https://cronitor.link/p/5228af7c42f54ba681f4b7c436c08f1b/luqCyv";
let heartbeatStarted = false;

function startCronitorHeartbeat() {
  if (heartbeatStarted) return;
  heartbeatStarted = true;
  setInterval(async () => {
    try { await fetch(CRONITOR_URL); }
    catch (err) { console.error("Cronitor heartbeat failed", err); }
  }, 60 * 1000);
}

// ========================
// EXPRESS HEALTH CHECK
// ========================
const app = express();
const PORT = process.env.PORT || 3000;
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
    adminRoles: ["1432285963287003156"],
    updateChannelId: "1432370687888064735",
    liveLineupChannelId: "1432370391929716787"
  },
  F2: {
    teamRoleIds: {
      "McLaren F2 team": "1432691339094528053",
      "Mercedes-AMG PETRONAS F2 team": "1432721882582614058",
      "Oracle Red Bull Racing F2 team": "1432362082250260640",
      "Scuderia Ferrari F2 team": "1432734720449577101",
      "MoneyGram Haas F2 team": "1432734837248360448",
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
    adminRoles: ["1432285963287003156"],
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

const countRoleInTeam = (series, team, role) => {
  const assigned = series === "F1" ? assignedPlayersF1 : assignedPlayersF2;
  return Object.values(assigned).filter(p => p.team === team && p.role === role).length;
};

const isCarNumberTaken = (series, number, userId) => {
  return Object.entries(registrationData)
    .some(([uid, data]) => data.series === series && data.carnumber === number && uid !== userId);
};

const getAssignedPlayers = (series) => series === "F1" ? assignedPlayersF1 : assignedPlayersF2;
const saveAssigned = (series) => series === "F1" ? saveAssignedF1() : saveAssignedF2();

// ========================
// ROLE HELPERS (ACTUAL FIX)
// ========================
const applyDiscordRoles = async (guild, userId, league, team, role) => {
  const member = await guild.members.fetch(userId);
  const config = seriesConfigs[league];
  await member.roles.add([
    config.teamRoleIds[team],
    config.playerRoles[role].id
  ]);
};

const removeDiscordRoles = async (guild, userId, league) => {
  const member = await guild.members.fetch(userId);
  const config = seriesConfigs[league];
  await member.roles.remove([
    ...Object.values(config.teamRoleIds),
    ...Object.values(config.playerRoles).map(r => r.id)
  ]);
};

// ========================
// LIVE LINEUP
// ========================
const updateLiveLineup = async (guild, series) => {
  const config = seriesConfigs[series];
  const assignedPlayers = getAssignedPlayers(series);
  const embed = new EmbedBuilder()
    .setTitle(`${series} Live Team Lineup`)
    .setColor("Gold")
    .setTimestamp();

  for (const team in config.teamRoleIds) {
    let list = "";
    for (const [uid, val] of Object.entries(assignedPlayers)) {
      if (val.team === team) list += `<@${uid}> - ${val.role}\n`;
    }
    if (!list) list = "No members yet.";
    embed.addFields({ name: team, value: list });
  }

  const channel = guild.channels.cache.get(config.liveLineupChannelId);
  if (!channel?.isTextBased()) return;

  try {
    if (liveLineupIds[series]) {
      const msg = await channel.messages.fetch(liveLineupIds[series]);
      await msg.edit({ embeds: [embed] });
    } else {
      const msg = await channel.send({ embeds: [embed] });
      liveLineupIds[series] = msg.id;
      saveLiveEmbedIds();
    }
  } catch {
    const msg = await channel.send({ embeds: [embed] });
    liveLineupIds[series] = msg.id;
    saveLiveEmbedIds();
  }
};

// ========================
// DISCORD CLIENT
// ========================
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

// ========================
// CLIENT READY
// ========================
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  startCronitorHeartbeat();

  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: [] });
  client.guilds.cache.forEach(g => {
    updateLiveLineup(g, "F1");
    updateLiveLineup(g, "F2");
  });
});

client.login(process.env.DISCORD_TOKEN);

// ========================
// COMMAND HANDLER
// ========================
client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName, options, user, guild } = interaction;
  const league = options.getString("league");
  const config = league ? seriesConfigs[league] : null;
  const assignedPlayers = getAssignedPlayers(league);

  if (commandName === "sign") {
    const target = options.getUser("user");
    const team = options.getString("team");
    const role = options.getString("role");

    if (countRoleInTeam(league, team, role) >= config.playerRoles[role].max)
      return interaction.reply({ content: "Role limit reached.", ephemeral: true });

    assignedPlayers[target.id] = { team, role };
    saveAssigned(league);

    await applyDiscordRoles(guild, target.id, league, team, role);

    updateLiveLineup(guild, league);
    sendEmbed(guild, "Sign", `<@${target.id}> signed as ${role} in ${team}`, "Green", user.tag, config.updateChannelId);
    return interaction.reply({ content: "Signed.", ephemeral: true });
  }

  if (commandName === "move") {
    const target = options.getUser("user");
    const team = options.getString("team");
    const role = options.getString("role");

    await removeDiscordRoles(guild, target.id, league);

    assignedPlayers[target.id] = { team, role };
    saveAssigned(league);

    await applyDiscordRoles(guild, target.id, league, team, role);

    updateLiveLineup(guild, league);
    sendEmbed(guild, "Move", `<@${target.id}> moved to ${role} in ${team}`, "Orange", user.tag, config.updateChannelId);
    return interaction.reply({ content: "Moved.", ephemeral: true });
  }

  if (commandName === "release") {
    const target = options.getUser("user");

    await removeDiscordRoles(guild, target.id, league);

    delete assignedPlayers[target.id];
    saveAssigned(league);

    updateLiveLineup(guild, league);
    sendEmbed(guild, "Release", `<@${target.id}> released from ${league}`, "Red", user.tag, config.updateChannelId);
    return interaction.reply({ content: "Released.", ephemeral: true });
  }
});
