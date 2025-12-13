// index.js
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import fs from "fs";
import 'dotenv/config';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

// === CONFIG FOR F1/F2 ===
const seriesConfigs = {
  F1: {
    teamRoleIds: { "Ferrari": "1449475924696240230", "Redbull": "1449475946913468507", "Mercedes": "1449478536720023562" },
    playerRoles: { 
      "Team Principal": { id: "1449471486061445151", max: 1 },
      "Main Driver": { id: "1449471495167279105", max: 2 },
      "Reserve Driver": { id: "1449471496152940554", max: 2 },
      "Engineer": { id: "1449471498464268429", max: 2 }
    },
    adminRoles: [ "1439978039151689788" ],
    updateChannelId: "1449474143367200939",
    liveLineupChannelId: "1449488568161402993"
  },
  F2: {
    teamRoleIds: { "Ferrari": "1449489739865395402", "Redbull": "1449489663667605637" },
    playerRoles: { 
      "Team Principal": { id: "1449489674942021754", max: 1 },
      "Main Driver": { id: "1449489716477952070", max: 2 },
      "Reserve Driver": { id: "1449489720000000000", max: 2 },
      "Engineer": { id: "1449489725000000000", max: 2 }
    },
    adminRoles: [ "1439978039151689788" ],
    updateChannelId: "1449489596583907471",
    liveLineupChannelId: "1449489610483695746"
  }
};

// === DATA FILES ===
const assignedFile = "./assignedPlayers.json";
const registrationFile = "./registrationData.json";
const liveEmbedFile = "./liveLineup.json";

// Load data
let assignedPlayers = fs.existsSync(assignedFile) ? JSON.parse(fs.readFileSync(assignedFile, "utf8")) : {};
let registrationData = fs.existsSync(registrationFile) ? JSON.parse(fs.readFileSync(registrationFile, "utf8")) : {};
let liveLineupMessageId = fs.existsSync(liveEmbedFile) ? JSON.parse(fs.readFileSync(liveEmbedFile, "utf8")).messageId : null;

// Save helpers
const saveAssigned = () => fs.writeFileSync(assignedFile, JSON.stringify(assignedPlayers, null, 2));
const saveRegistration = () => fs.writeFileSync(registrationFile, JSON.stringify(registrationData, null, 2));
const saveLiveEmbedId = () => fs.writeFileSync(liveEmbedFile, JSON.stringify({ messageId: liveLineupMessageId }, null, 2));

// === HELPER FUNCTIONS ===
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

// === LIVE LINEUP UPDATER ===
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

  if (liveLineupMessageId) {
    try {
      const msg = await channel.messages.fetch(liveLineupMessageId);
      if (msg) return await msg.edit({ embeds: [embed] });
    } catch {}
  }

  const msg = await channel.send({ embeds: [embed] });
  liveLineupMessageId = msg.id;
  saveLiveEmbedId();
};

// === COMMANDS ===
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

// === REST client ===
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("Commands registered!");
    client.guilds.cache.forEach(guild => {
      updateLiveLineup(guild, "F1");
      updateLiveLineup(guild, "F2");
    });
  } catch (err) { console.error(err); }
});

client.login(process.env.DISCORD_TOKEN);

// === AUTOCOMPLETE HANDLER ===
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

// === INTERACTION HANDLER ===
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
    liveLineupMessageId = null;
    saveAssigned(); saveRegistration(); saveLiveEmbedId();
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
