// ========================
// CRONITOR HEARTBEAT
// ========================
const CRONITOR_URL =
  "https://cronitor.link/p/5228af7c42f54ba681f4b7c436c08f1b/luqCyv";

let heartbeatStarted = false;

function startCronitorHeartbeat() {
  if (heartbeatStarted) return;
  heartbeatStarted = true;

  setInterval(async () => {
    try {
      await fetch(CRONITOR_URL);
      console.log("Cronitor heartbeat sent");
    } catch (err) {
      console.error("Cronitor heartbeat failed", err);
    }
  }, 5 * 1000); // every 1 minute
}

// ========================
// IMPORTS
// ========================
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import fs from "fs";
import 'dotenv/config';
import express from "express";
import fetch from "node-fetch";

// ========================
// EXPRESS HEALTH CHECK
// ========================
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("Bot is alive!"));

app.listen(PORT, () => console.log(`Health check server running on port ${PORT}`));

// ========================
// DISCORD CLIENT
// ========================
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

// ========================
// CONFIG FOR F1/F2
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
    adminRoles: [ "1432285963287003156" ],
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
    adminRoles: [ "1432285963287003156" ],
    updateChannelId: "1432371785181040640",
    liveLineupChannelId: "1432371611927056544"
  }
};

// ========================
// DATA FILES
// ========================
const assignedFile = "./data/assignedPlayers.json";
const registrationFile = "/data/registrationData.json";
const liveEmbedFile = "/data/liveLineup.json";

// Load data
let assignedPlayers = fs.existsSync(assignedFile)
  ? JSON.parse(fs.readFileSync(assignedFile, "utf8"))
  : {};
let registrationData = fs.existsSync(registrationFile) ? JSON.parse(fs.readFileSync(registrationFile, "utf8")) : {};
let liveLineupIds = fs.existsSync(liveEmbedFile)
  ? JSON.parse(fs.readFileSync(liveEmbedFile, "utf8"))
  : { F1: null, F2: null };

// Save helpers
const saveAssigned = () => fs.writeFileSync(assignedFile, JSON.stringify(assignedPlayers, null, 2));
const saveRegistration = () => fs.writeFileSync(registrationFile, JSON.stringify(registrationData, null, 2));
const saveLiveEmbedIds = () => fs.writeFileSync(liveEmbedFile, JSON.stringify(liveLineupIds, null, 2));

// ========================
// HELPER FUNCTIONS
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
  return Object.values(assignedPlayers).filter(p => p.series === series && p.team === team && p.role === role).length;
};

const isCarNumberTaken = (series, number, userId) => {
  return Object.entries(registrationData).some(([uid, data]) => data.series === series && data.carnumber === number && uid !== userId);
};

// ========================
// LIVE LINEUP UPDATER (NEW EMBED EVERY TIME)
// ========================
const updateLiveLineup = async (guild, series) => {
  const config = seriesConfigs[series];
  const embed = new EmbedBuilder().setTitle(`${series} Live Team Lineup`).setColor("Gold").setTimestamp();

  for (const team in config.teamRoleIds) {
    let list = "";
    for (const uid in assignedPlayers) {
      if (assignedPlayers[uid].series === series && assignedPlayers[uid].team === team)
        list += `<@${uid}> - ${assignedPlayers[uid].role}\n`;
    }
    if (!list) list = "No members yet.";
    embed.addFields({ name: team, value: list });
  }

  const channel = guild.channels.cache.get(config.liveLineupChannelId);
  if (!channel?.isTextBased()) return;

  // Always send a new embed
  const msg = await channel.send({ embeds: [embed] });
  liveLineupIds[series] = msg.id;
  saveLiveEmbedIds();
};

// ========================
// COMMANDS
// ========================
const seriesChoices = [
  { name: "F1", value: "F1" },
  { name: "F2", value: "F2" }
];

const commands = [
  new SlashCommandBuilder()
    .setName("sign").setDescription("Sign a user to a league team and role")
    .addStringOption(o => o.setName("league").setDescription("F1 or F2").setRequired(true).addChoices(...seriesChoices))
    .addUserOption(o => o.setName("user").setDescription("User to sign").setRequired(true))
    .addStringOption(o => o.setName("team").setDescription("Team").setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName("role").setDescription("Role").setRequired(true).setAutocomplete(true)),

  new SlashCommandBuilder()
    .setName("move").setDescription("Move a user to a new team and role")
    .addStringOption(o => o.setName("league").setDescription("F1 or F2").setRequired(true).addChoices(...seriesChoices))
    .addUserOption(o => o.setName("user").setDescription("User to move").setRequired(true))
    .addStringOption(o => o.setName("team").setDescription("Team").setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName("role").setDescription("Role").setRequired(true).setAutocomplete(true)),

  new SlashCommandBuilder()
    .setName("release").setDescription("Release a user from all bot-assigned roles")
    .addStringOption(o => o.setName("league").setDescription("F1 or F2").setRequired(true).addChoices(...seriesChoices))
    .addUserOption(o => o.setName("user").setDescription("User to release").setRequired(true)),

  new SlashCommandBuilder()
    .setName("register").setDescription("Register car number, username, flag")
    .addStringOption(o => o.setName("league").setDescription("F1 or F2").setRequired(true).addChoices(...seriesChoices))
    .addIntegerOption(o => o.setName("carnumber").setDescription("Car number").setRequired(true))
    .addStringOption(o => o.setName("username").setDescription("Username").setRequired(true))
    .addStringOption(o => o.setName("flag").setDescription("Flag emoji").setRequired(false)),

  new SlashCommandBuilder()
    .setName("profile").setDescription("Show user profile")
    .addStringOption(o => o.setName("league").setDescription("F1 or F2").setRequired(true).addChoices(...seriesChoices))
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(false)),

  new SlashCommandBuilder()
    .setName("lineupyear").setDescription("Show all teams lineup")
    .addStringOption(o => o.setName("league").setDescription("F1 or F2").setRequired(true).addChoices(...seriesChoices)),

  new SlashCommandBuilder()
    .setName("help").setDescription("Show commands"),

  new SlashCommandBuilder()
    .setName("resetdata").setDescription("Reset all bot data (admin only)")
].map(c => c.toJSON());

// ========================
// REST CLIENT
// ========================
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

// ========================
// CLIENT READY
// ========================
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  startCronitorHeartbeat();

  try {
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log("Commands registered!");

    client.guilds.cache.forEach(guild => {
      updateLiveLineup(guild, "F1");
      updateLiveLineup(guild, "F2");
    });
  } catch (err) {
    console.error(err);
  }
});

// ========================
// CLIENT LOGIN
// ========================
client.login(process.env.DISCORD_TOKEN);

// ========================
// AUTOCOMPLETE HANDLER
// ========================
client.on("interactionCreate", async interaction => {
  if (interaction.isAutocomplete()) {
    const focused = interaction.options.getFocused(true);
    const league = interaction.options.getString("league");
    const config = league ? seriesConfigs[league] : null;
    if (!config) return interaction.respond([]);

    if (focused.name === "team") {
      const choices = Object.keys(config.teamRoleIds);
      const filtered = choices.filter(c => c.toLowerCase().startsWith(focused.value.toLowerCase()));
      return interaction.respond(filtered.map(c => ({ name: c, value: c })));
    }

    if (focused.name === "role") {
      const choices = Object.keys(config.playerRoles);
      const filtered = choices.filter(c => c.toLowerCase().startsWith(focused.value.toLowerCase()));
      return interaction.respond(filtered.map(c => ({ name: c, value: c })));
    }
  }
});

// ========================
// INTERACTION HANDLER
// ========================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;
  const { commandName, options, user, guild } = interaction;
  const league = options.getString("league");
  const config = league ? seriesConfigs[league] : null;

  if (!config && commandName !== "help" && commandName !== "resetdata") {
    return interaction.reply({ content: "Invalid league.", ephemeral: true });
  }

  // HELP
  if (commandName === "help") {
    return interaction.reply({
      content: `
**Commands**
/sign - Sign a user to a team/role
/move - Move a user to a new team/role
/release - Remove a user from all bot roles
/register - Register car number, username, flag
/profile - Show user profile
/lineupyear - Show all teams lineup
/resetdata - Reset all bot data (admin only)
/help - Show this message
      `,
      ephemeral: true
    });
  }

  // RESET DATA
  if (commandName === "resetdata") {
    if (user.id !== "902878740659441674") return interaction.reply({ content: "Not authorized.", ephemeral: true });
    assignedPlayers = {};
    registrationData = {};
    liveLineupIds = { F1: null, F2: null };
    saveAssigned(); saveRegistration(); saveLiveEmbedIds();
    return interaction.reply({ content: "✅ All bot data reset!", ephemeral: true });
  }

  // REGISTER
  if (commandName === "register") {
    const carNumber = options.getInteger("carnumber");
    const username = options.getString("username");
    const flag = options.getString("flag") || "";

    if (isCarNumberTaken(league, carNumber, user.id)) {
      return interaction.reply({ content: `Car number ${carNumber} already taken in ${league}!`, ephemeral: true });
    }

    registrationData[user.id] = { series: league, carnumber: carNumber, username, flag };
    saveRegistration();

    try {
      const member = await guild.members.fetch(user.id);
      if (member) await member.setNickname(`${carNumber} | ${username} ${flag}`);
    } catch {}

    return interaction.reply({ content: `Registered as ${carNumber} | ${username} ${flag} in ${league}`, ephemeral: true });
  }

  // PROFILE
  if (commandName === "profile") {
    const target = options.getUser("user") || user;
    const reg = registrationData[target.id];
    const assigned = assignedPlayers[target.id];
    const embed = new EmbedBuilder().setTitle(`${target.tag} Profile`).setColor("Blue");

    if (reg && reg.series === league) {
      embed.addFields(
        { name: "Car Number", value: reg.carnumber.toString(), inline: true },
        { name: "Username", value: reg.username, inline: true },
        { name: "Flag", value: reg.flag || "None", inline: true }
      );
    } else { embed.addFields({ name: "Registration", value: "Not registered" }); }

    if (assigned && assigned.series === league) {
      embed.addFields(
        { name: "Team", value: assigned.team, inline: true },
        { name: "Role", value: assigned.role, inline: true }
      );
    } else { embed.addFields({ name: "Team Info", value: "Not signed" }); }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // SIGN
  if (commandName === "sign") {
    const target = options.getUser("user");
    const team = options.getString("team");
    const role = options.getString("role");

    if (!config.teamRoleIds[team]) return interaction.reply({ content: "Invalid team.", ephemeral: true });
    if (!config.playerRoles[role]) return interaction.reply({ content: "Invalid role.", ephemeral: true });
    if (countRoleInTeam(league, team, role) >= config.playerRoles[role].max) {
      return interaction.reply({ content: `${role} limit reached for ${team}`, ephemeral: true });
    }

    assignedPlayers[target.id] = { series: league, team, role };
    saveAssigned();

    try {
      const member = await guild.members.fetch(target.id);
      await member.roles.add(config.teamRoleIds[team]);
      await member.roles.add(config.playerRoles[role].id);
    } catch {}

    updateLiveLineup(guild, league);
    sendEmbed(guild, "Sign", `${target.tag} signed as ${role} in ${team}`, "Green", user.tag, config.updateChannelId);

    return interaction.reply({ content: `✅ ${target.tag} signed as ${role} in ${team} (${league})`, ephemeral: true });
  }

  // MOVE
  if (commandName === "move") {
    const target = options.getUser("user");
    const team = options.getString("team");
    const role = options.getString("role");

    if (!assignedPlayers[target.id] || assignedPlayers[target.id].series !== league) {
      return interaction.reply({ content: `${target.tag} is not signed in ${league}.`, ephemeral: true });
    }

    if (countRoleInTeam(league, team, role) >= config.playerRoles[role].max) {
      return interaction.reply({ content: `${role} limit reached for ${team}`, ephemeral: true });
    }

    const old = assignedPlayers[target.id];
    try {
      const member = await guild.members.fetch(target.id);
      if (member) {
        if (config.teamRoleIds[old.team]) member.roles.remove(config.teamRoleIds[old.team]).catch(() => {});
        if (config.playerRoles[old.role]) member.roles.remove(config.playerRoles[old.role].id).catch(() => {});
        await member.roles.add(config.teamRoleIds[team]);
        await member.roles.add(config.playerRoles[role].id);
      }
    } catch {}

    assignedPlayers[target.id] = { series: league, team, role };
    saveAssigned();
    updateLiveLineup(guild, league);
    sendEmbed(guild, "Move", `${target.tag} moved to ${role} in ${team}`, "Orange", user.tag, config.updateChannelId);

    return interaction.reply({ content: `✅ ${target.tag} moved to ${role} in ${team} (${league})`, ephemeral: true });
  }

  // RELEASE
  if (commandName === "release") {
    const target = options.getUser("user");
    if (!assignedPlayers[target.id] || assignedPlayers[target.id].series !== league) {
      return interaction.reply({ content: `${target.tag} is not signed in ${league}.`, ephemeral: true });
    }

    const old = assignedPlayers[target.id];
    try {
      const member = await guild.members.fetch(target.id);
      if (member) {
        if (config.teamRoleIds[old.team]) member.roles.remove(config.teamRoleIds[old.team]).catch(() => {});
        if (config.playerRoles[old.role]) member.roles.remove(config.playerRoles[old.role].id).catch(() => {});
      }
    } catch {}

    delete assignedPlayers[target.id];
    saveAssigned();
    updateLiveLineup(guild, league);
    sendEmbed(guild, "Release", `${target.tag} released from ${old.team}`, "Red", user.tag, config.updateChannelId);

    return interaction.reply({ content: `✅ ${target.tag} has been released from ${league}`, ephemeral: true });
  }

  // LINEUP YEAR
  if (commandName === "lineupyear") {
    updateLiveLineup(guild, league);
    return interaction.reply({ content: `✅ ${league} live lineup updated.`, ephemeral: true });
  }
});
