// ========================
// IMPORTS & CONFIG
// ========================
import 'dotenv/config';
import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from "discord.js";

// --- CONFIGURATION ---
const BACKUP_CHANNEL_ID = "1452397713252548638"; // Your record channel
const dataDir = "./data";

// Ensure data dir exists
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// File Paths
const assignedFileF1 = path.join(dataDir, "assignedPlayersF1.json");
const assignedFileF2 = path.join(dataDir, "assignedPlayersF2.json");
const registrationFile = path.join(dataDir, "registrationData.json");
const liveEmbedFile = path.join(dataDir, "liveLineup.json");
const carNumberClaimFile = path.join(dataDir, "carNumberClaims.json");

// Initial empty state
let assignedPlayersF1 = {};
let assignedPlayersF2 = {};
let registrationData = {};
let liveLineupIds = { F1: null, F2: null };
let carNumberClaims = { F1: [], F2: [] };

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
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(PORT, () => console.log(`Health check server running on port ${PORT}`));

// ========================
// DISCORD CLIENT
// ========================
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.MessageContent 
    ] 
});

// ========================
// DATA PERSISTENCE (THE FIX)
// ========================

// 1. Function to save to local file AND upload to Discord Backup Channel
const saveData = async (type) => {
    // Save to local file first (for immediate access)
    fs.writeFileSync(assignedFileF1, JSON.stringify(assignedPlayersF1, null, 2));
    fs.writeFileSync(assignedFileF2, JSON.stringify(assignedPlayersF2, null, 2));
    fs.writeFileSync(registrationFile, JSON.stringify(registrationData, null, 2));
    fs.writeFileSync(liveEmbedFile, JSON.stringify(liveLineupIds, null, 2));
    fs.writeFileSync(carNumberClaimFile, JSON.stringify(carNumberClaims, null, 2));

    // Create a master backup object
    const masterBackup = {
        assignedPlayersF1,
        assignedPlayersF2,
        registrationData,
        liveLineupIds,
        carNumberClaims,
        timestamp: new Date().toISOString()
    };

    // Upload to Discord Channel
    try {
        const channel = await client.channels.fetch(BACKUP_CHANNEL_ID);
        if (channel && channel.isTextBased()) {
            const buffer = Buffer.from(JSON.stringify(masterBackup, null, 2), 'utf-8');
            const attachment = new AttachmentBuilder(buffer, { name: 'backup_data.json' });
            
            // Send silently to avoid spam notifications
            await channel.send({ 
                content: `Data Update: ${type} - ${new Date().toLocaleString()}`, 
                files: [attachment] 
            });
            console.log("✅ Data backed up to Discord Channel");
        }
    } catch (err) {
        console.error("❌ Failed to backup to Discord Channel:", err);
    }
};

// 2. Function to load data from Discord Backup Channel on Startup
const loadDataFromDiscord = async () => {
    console.log("🔄 Attempting to load data from Backup Channel...");
    try {
        const channel = await client.channels.fetch(BACKUP_CHANNEL_ID);
        if (!channel || !channel.isTextBased()) return;

        // Fetch last 10 messages to find the latest backup
        const messages = await channel.messages.fetch({ limit: 10 });
        const backupMsg = messages.find(m => m.attachments.size > 0);

        if (backupMsg) {
            const attachment = backupMsg.attachments.first();
            const response = await fetch(attachment.url);
            const data = await response.json();

            // Restore variables
            if (data.assignedPlayersF1) assignedPlayersF1 = data.assignedPlayersF1;
            if (data.assignedPlayersF2) assignedPlayersF2 = data.assignedPlayersF2;
            if (data.registrationData) registrationData = data.registrationData;
            if (data.liveLineupIds) liveLineupIds = data.liveLineupIds;
            if (data.carNumberClaims) carNumberClaims = data.carNumberClaims;

            console.log("✅ Data successfully restored from Discord Backup!");
        } else {
            console.log("⚠️ No backup found. Starting with fresh data.");
        }
    } catch (err) {
        console.error("❌ Failed to load remote data:", err);
    }
};

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
    updateChannelId: "1432371785181040640",
    liveLineupChannelId: "1432371611927056544"
  }
};

const getAssignedPlayers = (series) => series === "F1" ? assignedPlayersF1 : assignedPlayersF2;

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
  const assigned = getAssignedPlayers(series);
  return Object.values(assigned).filter(p => p.team === team && p.role === role).length;
};

const isCarNumberTaken = (series, number, userId) => {
  return Object.entries(registrationData).some(([uid, data]) => data.series === series && data.carnumber === number && uid !== userId);
};

const updateLiveLineup = async (guild, series) => {
  const config = seriesConfigs[series];
  const assignedPlayers = getAssignedPlayers(series);
  const embed = new EmbedBuilder().setTitle(`${series} Live Team Lineup`).setColor("Gold").setTimestamp();

  for (const team in config.teamRoleIds) {
    let list = "";
    for (const [key, val] of Object.entries(assignedPlayers)) {
      if (val.team === team) list += `<@${key}> - ${val.role}\n`;
    }
    if (!list) list = "No members yet.";
    embed.addFields({ name: team, value: list });
  }

  const channel = guild.channels.cache.get(config.liveLineupChannelId);
  if (!channel?.isTextBased()) return;

  try {
    if (liveLineupIds[series]) {
      const msg = await channel.messages.fetch(liveLineupIds[series]).catch(() => null);
      if (msg) await msg.edit({ embeds: [embed] });
      else throw new Error("Message not found");
    } else {
      const msg = await channel.send({ embeds: [embed] });
      liveLineupIds[series] = msg.id;
      await saveData("NewLiveEmbed");
    }
  } catch {
    const msg = await channel.send({ embeds: [embed] });
    liveLineupIds[series] = msg.id;
    await saveData("NewLiveEmbed");
  }
};

// ========================
// COMMANDS SETUP
// ========================
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

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

  new SlashCommandBuilder().setName("resetdata").setDescription("Reset all bot data (admin only)"),
  new SlashCommandBuilder().setName("cleanname").setDescription("Reset all user nicknames (admin only)"),
  
  new SlashCommandBuilder().setName("carnumberclaim").setDescription("Claim car numbers for a league (admin only)")
    .addStringOption(o => o.setName("league").setDescription("F1 or F2").setRequired(true).addChoices(...seriesChoices))
    .addIntegerOption(o => o.setName("number").setDescription("Car number to claim").setRequired(true))
].map(c => c.toJSON());

// ========================
// ADMIN CHECK
// ========================
const isAdmin = async (interaction) => {
  try {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    return member.roles.cache.has("1432285963287003156") || member.permissions.has("Administrator");
  } catch { return false; }
};

// ========================
// CLIENT READY
// ========================
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  startCronitorHeartbeat();

  // Load Data from Discord Channel before starting
  await loadDataFromDiscord();

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

// ========================
// AUTOCOMPLETE HANDLER
// ========================
client.on("interactionCreate", async interaction => {
  if (!interaction.isAutocomplete()) return;

  const focused = interaction.options.getFocused(true);
  const league = interaction.options.getString("league");
  const config = league ? seriesConfigs[league] : null;
  if (!config) return interaction.respond([]);

  if (focused.name === "team") {
    const choices = Object.keys(config.teamRoleIds);
    return interaction.respond(choices.filter(c => c.toLowerCase().startsWith(focused.value.toLowerCase())).slice(0, 25).map(c => ({ name: c, value: c })));
  }

  if (focused.name === "role") {
    const choices = Object.keys(config.playerRoles);
    return interaction.respond(choices.filter(c => c.toLowerCase().startsWith(focused.value.toLowerCase())).map(c => ({ name: c, value: c })));
  }
});

// ========================
// COMMAND HANDLER
// ========================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;
  const { commandName, options, user, guild } = interaction;
  
  // Basic Error Handling Wrapper
  try {
      const league = options.getString("league");
      const config = league ? seriesConfigs[league] : null;
      const assignedPlayers = league ? getAssignedPlayers(league) : null;

      // -------------------- HELP --------------------
      if (commandName === "help") {
        return interaction.reply({
          content: `**Commands**\n/sign, /move, /release, /register, /profile, /lineupyear, /resetdata, /cleanname, /carnumberclaim`,
          ephemeral: true
        });
      }

      // -------------------- RESET DATA --------------------
      if (commandName === "resetdata") {
        if (!(await isAdmin(interaction))) return interaction.reply({ content: "Not authorized.", ephemeral: true });

        assignedPlayersF1 = {};
        assignedPlayersF2 = {};
        registrationData = {};
        liveLineupIds = { F1: null, F2: null };
        carNumberClaims = { F1: [], F2: [] };
        
        await saveData("ResetData"); // Updates Discord Channel
        return interaction.reply({ content: "✅ All bot data reset and synced!", ephemeral: true });
      }

      // -------------------- CLEANNAME --------------------
      if (commandName === "cleanname") {
        if (!(await isAdmin(interaction))) return interaction.reply({ content: "Not authorized.", ephemeral: true });
        
        // Defer reply because this takes time
        await interaction.deferReply({ ephemeral: true });
        const members = await guild.members.fetch();
        let count = 0;
        for (const [id, m] of members) {
             if (!m.user.bot) {
                 await m.setNickname(null).catch(() => {});
                 count++;
             }
        }
        return interaction.editReply({ content: `✅ Attempted to reset ${count} nicknames.` });
      }

      // -------------------- CARNUMBERCLAIM --------------------
      if (commandName === "carnumberclaim") {
        if (!(await isAdmin(interaction))) return interaction.reply({ content: "Not authorized.", ephemeral: true });

        const number = options.getInteger("number");
        if (!carNumberClaims[league]) carNumberClaims[league] = [];
        if (carNumberClaims[league].includes(number)) return interaction.reply({ content: `Car number ${number} is already claimed in ${league}!`, ephemeral: true });

        carNumberClaims[league].push(number);
        await saveData("CarClaim");

        return interaction.reply({ content: `✅ Car number ${number} claimed for ${league}`, ephemeral: true });
      }

      // -------------------- REGISTER --------------------
      if (commandName === "register") {
        const carNumber = options.getInteger("carnumber");
        const username = options.getString("username");
        const flag = options.getString("flag");

        if (isCarNumberTaken(league, carNumber, user.id) || (carNumberClaims[league] && carNumberClaims[league].includes(carNumber)))
          return interaction.reply({ content: `Car number ${carNumber} is already taken in ${league}!`, ephemeral: true });

        registrationData[user.id] = { series: league, carnumber: carNumber, username, flag };
        await saveData("Register");

        try {
          const member = await guild.members.fetch(user.id);
          if (member) await member.setNickname(`${carNumber} | ${username} ${flag}`);
        } catch {}

        return interaction.reply({ content: `Registered as ${carNumber} | ${username} ${flag} in ${league}`, ephemeral: true });
      }

      // -------------------- PROFILE --------------------
      if (commandName === "profile") {
          const targetUser = options.getUser("user") || user;
          const reg = registrationData[targetUser.id];
          const assign = assignedPlayersF1[targetUser.id] || assignedPlayersF2[targetUser.id];
          
          const embed = new EmbedBuilder()
            .setTitle(`${targetUser.username}'s Profile`)
            .setColor("Blue")
            .addFields(
                { name: "League", value: reg ? reg.series : "Unregistered", inline: true },
                { name: "Car #", value: reg ? `${reg.carnumber}` : "N/A", inline: true },
                { name: "Team", value: assign ? assign.team : "Free Agent", inline: true },
                { name: "Role", value: assign ? assign.role : "None", inline: true }
            );
          return interaction.reply({ embeds: [embed] });
      }

      // -------------------- SIGN --------------------
      if (commandName === "sign") {
        const target = options.getUser("user");
        const team = options.getString("team");
        const role = options.getString("role");

        if (!config.teamRoleIds[team]) return interaction.reply({ content: "Invalid team.", ephemeral: true });
        if (!config.playerRoles[role]) return interaction.reply({ content: "Invalid role.", ephemeral: true });
        if (countRoleInTeam(league, team, role) >= config.playerRoles[role].max) return interaction.reply({ content: `${role} limit reached in ${team}`, ephemeral: true });

        assignedPlayers[`${target.id}`] = { team, role };
        await saveData("Sign"); // Save to Discord

        try {
          const member = await guild.members.fetch(target.id);
          const roleId = config.playerRoles[role].id;
          if (member && roleId) member.roles.add(roleId).catch(() => {});
        } catch {}

        updateLiveLineup(guild, league);
        sendEmbed(guild, "Sign", `<@${target.id}> signed as ${role} in ${team}`, "Green", user.tag, config.updateChannelId);
        return interaction.reply({ content: `Signed ${target.tag} as ${role} in ${team}`, ephemeral: true });
      }

      // -------------------- MOVE --------------------
      if (commandName === "move") {
        const target = options.getUser("user");
        const team = options.getString("team");
        const role = options.getString("role");

        if (!assignedPlayers[`${target.id}`]) return interaction.reply({ content: "User not signed yet.", ephemeral: true });
        if (!config.teamRoleIds[team]) return interaction.reply({ content: "Invalid team.", ephemeral: true });
        if (countRoleInTeam(league, team, role) >= config.playerRoles[role].max) return interaction.reply({ content: `${role} limit reached in ${team}`, ephemeral: true });

        const oldRoleId = config.playerRoles[assignedPlayers[`${target.id}`].role]?.id;
        assignedPlayers[`${target.id}`] = { team, role };
        await saveData("Move"); // Save to Discord

        try {
          const member = await guild.members.fetch(target.id);
          if (member) {
            if (oldRoleId) member.roles.remove(oldRoleId).catch(() => {});
            member.roles.add(config.playerRoles[role].id).catch(() => {});
          }
        } catch {}

        updateLiveLineup(guild, league);
        sendEmbed(guild, "Move", `<@${target.id}> moved to ${role} in ${team}`, "Orange", user.tag, config.updateChannelId);
        return interaction.reply({ content: `Moved ${target.tag} to ${role} in ${team}`, ephemeral: true });
      }

      // -------------------- RELEASE --------------------
      if (commandName === "release") {
        const target = options.getUser("user");
        if (!assignedPlayers[`${target.id}`]) return interaction.reply({ content: "User not signed yet.", ephemeral: true });

        const oldRoleId = config.playerRoles[assignedPlayers[`${target.id}`].role]?.id;
        delete assignedPlayers[`${target.id}`];
        await saveData("Release"); // Save to Discord

        try {
          const member = await guild.members.fetch(target.id);
          if (member && oldRoleId) member.roles.remove(oldRoleId).catch(() => {});
        } catch {}

        updateLiveLineup(guild, league);
        sendEmbed(guild, "Release", `<@${target.id}> released from all roles in ${league}`, "Red", user.tag, config.updateChannelId);
        return interaction.reply({ content: `Released ${target.tag} from all roles in ${league}`, ephemeral: true });
      }

      // -------------------- LINEUPYEAR --------------------
      if (commandName === "lineupyear") {
        updateLiveLineup(guild, league);
        return interaction.reply({ content: `${league} lineup updated!`, ephemeral: true });
      }

  } catch (error) {
      console.error("Command Error:", error);
      if (!interaction.replied && !interaction.deferred) {
          interaction.reply({ content: "An error occurred while executing this command.", ephemeral: true });
      }
  }
});
