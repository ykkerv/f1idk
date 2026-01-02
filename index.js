// ========================
// IMPORTS & CONFIG
// ========================
import 'dotenv/config';
import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    AttachmentBuilder,
    MessageFlags 
} from "discord.js";

// --- CONFIGURATION ---
const BACKUP_CHANNEL_ID = "1452397713252548638"; 
const dataDir = path.join(process.cwd(), "data");

// Ensure data dir exists
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// File Paths
const paths = {
    assignedF1: path.join(dataDir, "assignedPlayersF1.json"),
    assignedF2: path.join(dataDir, "assignedPlayersF2.json"),
    registration: path.join(dataDir, "registrationData.json"),
    liveLineup: path.join(dataDir, "liveLineup.json"),
    carClaims: path.join(dataDir, "carNumberClaims.json")
};

// ========================
// 🛑 DEFAULT DATA (Hardcoded for Render Persistence) 🛑
// ========================
const DEFAULTS = {
    assignedF1: {
        "1153396013009215591": { "team": "McLaren F1 team", "role": "Team Principal F1" },
        "663160900877811738": { "team": "McLaren F1 team", "role": "Main Driver F1" },
        "1176937840278507632": { "team": "McLaren F1 team", "role": "Main Driver F1" },
        "902878740659441674": { "team": "McLaren F1 team", "role": "Reserve Driver F1" },
        "1119501208713961523": { "team": "McLaren F1 team", "role": "Engineer F1" },
        "518740889191841803": { "team": "Mercedes-AMG PETRONAS F1 team", "role": "Main Driver F1" },
        "1439601182786978005": { "team": "Mercedes-AMG PETRONAS F1 team", "role": "Main Driver F1" },
        "1364145921977225307": { "team": "Mercedes-AMG PETRONAS F1 team", "role": "Team Principal F1" },
        "1336279717778690138": { "team": "Oracle Red Bull Racing F1 team", "role": "Main Driver F1" },
        "1363528232615280906": { "team": "Oracle Red Bull Racing F1 team", "role": "Reserve Driver F1" },
        "917703934192275517": { "team": "Oracle Red Bull Racing F1 team", "role": "Engineer F1" },
        "1170790804554530828": { "team": "Scuderia Ferrari F1 team", "role": "Main Driver F1" },
        "1298178343052513330": { "team": "Scuderia Ferrari F1 team", "role": "Main Driver F1" },
        "1190909698220761098": { "team": "MoneyGram Haas F1 team", "role": "Main Driver F1" },
        "1040179360868597781": { "team": "Williams Racing F1 team", "role": "Main Driver F1" },
        "1186752653464707102": { "team": "BWT Alpine F1 team", "role": "Main Driver F1" },
        "749968335168471061": { "team": "Visa Cash App Racing Bulls F1 team", "role": "Main Driver F1" },
        "771932278079094816": { "team": "Visa Cash App Racing Bulls F1 team", "role": "Main Driver F1" },
        "975250844758982717": { "team": "Visa Cash App Racing Bulls F1 team", "role": "Reserve Driver F1" },
        "814540938789650434": { "team": "Visa Cash App Racing Bulls F1 team", "role": "Engineer F1" },
        "737724257383219220": { "team": "Aston Martin Aramco F1 team", "role": "Reserve Driver F1" },
        "1185826673854259200": { "team": "Aston Martin Aramco F1 team", "role": "Main Driver F1" },
        "1424046314492002367": { "team": "Aston Martin Aramco F1 team", "role": "Team Principal F1" },
        "940298559717249025": { "team": "Aston Martin Aramco F1 team", "role": "Main Driver F1" }
    },
    assignedF2: {
        "1111913693907795970": { "team": "McLaren F2 team", "role": "Reserve Driver F2" },
        "1170790804554530828": { "team": "McLaren F2 team", "role": "Main Driver F2" },
        "1153396013009215591": { "team": "McLaren F2 team", "role": "Team Principal F2" },
        "940298559717249025": { "team": "McLaren F2 team", "role": "Main Driver F2" },
        "1439601182786978005": { "team": "Mercedes-AMG PETRONAS F2 team", "role": "Team Principal F2" },
        "902878740659441674": { "team": "Mercedes-AMG PETRONAS F2 team", "role": "Main Driver F2" },
        "1040179360868597781": { "team": "Mercedes-AMG PETRONAS F2 team", "role": "Main Driver F2" },
        "1364145921977225307": { "team": "Mercedes-AMG PETRONAS F2 team", "role": "Reserve Driver F2" },
        "1336279717778690138": { "team": "Oracle Red Bull Racing F2 team", "role": "Team Principal F2" },
        "1238085761727860766": { "team": "Oracle Red Bull Racing F2 team", "role": "Main Driver F2" },
        "1153255596867452938": { "team": "Oracle Red Bull Racing F2 team", "role": "Main Driver F2" },
        "917703934192275517": { "team": "Oracle Red Bull Racing F2 team", "role": "Engineer F2" },
        "794170362815971348": { "team": "Scuderia Ferrari F2 team", "role": "Team Principal F2" },
        "1232988113949822992": { "team": "Scuderia Ferrari F2 team", "role": "Main Driver F2" },
        "663160900877811738": { "team": "Scuderia Ferrari F2 team", "role": "Main Driver F2" },
        "1434220317789786215": { "team": "Scuderia Ferrari F2 team", "role": "Reserve Driver F2" },
        "518740889191841803": { "team": "Visa Cash App Racing Bulls F2 team", "role": "Main Driver F2" },
        "1186752653464707102": { "team": "BWT Alpine F2 team", "role": "Main Driver F2" },
        "1185826673854259200": { "team": "Williams Racing F2 team", "role": "Main Driver F2" },
        "1363291837581885573": { "team": "Williams Racing F2 team", "role": "Main Driver F2" },
        "1424046314492002367": { "team": "Aston Martin Aramco F2 team", "role": "Team Principal F2" },
        "737724257383219220": { "team": "Aston Martin Aramco F2 team", "role": "Main Driver F2" },
        "771932278079094816": { "team": "Aston Martin Aramco F2 team", "role": "Main Driver F2" },
        "1190909698220761098": { "team": "Stake F2 team Kick Sauber", "role": "Team Principal F2" }
    },
    carClaims: {
        "F1": [
            { "number": 81, "userId": "902878740659441674" },
            { "number": 13, "userId": "1186752653464707102" },
            { "number": 25, "userId": "1185826673854259200" },
            { "number": 69, "userId": "1170790804554530828" },
            { "number": 5, "userId": "771932278079094816" },
            { "number": 8, "userId": "940298559717249025" },
            { "number": 1, "userId": "518740889191841803" }
        ],
        "F2": [
            { "number": 1, "userId": "902878740659441674" },
            { "number": 6, "userId": "1434220317789786215" },
            { "number": 13, "userId": "1186752653464707102" },
            { "number": 3, "userId": "1185826673854259200" },
            { "number": 5, "userId": "771932278079094816" },
            { "number": 8, "userId": "940298559717249025" }
        ]
    },
    liveLineup: {
        "F1": "1452400029078913155",
        "F2": "1452400031377395722"
    },
    registration: {}
};

// ========================
// INITIAL STATE (LOADS DEFAULTS FIRST)
// ========================
let assignedPlayersF1 = JSON.parse(JSON.stringify(DEFAULTS.assignedF1));
let assignedPlayersF2 = JSON.parse(JSON.stringify(DEFAULTS.assignedF2));
let registrationData = JSON.parse(JSON.stringify(DEFAULTS.registration));
let liveLineupIds = JSON.parse(JSON.stringify(DEFAULTS.liveLineup));
let carNumberClaims = JSON.parse(JSON.stringify(DEFAULTS.carClaims));

// ========================
// CRASH PREVENTION
// ========================
process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));

// ========================
// DATA PERSISTENCE
// ========================

const saveData = async (reason) => {
    try {
        // 1. Physical Write to Local Files
        fs.writeFileSync(paths.assignedF1, JSON.stringify(assignedPlayersF1, null, 2));
        fs.writeFileSync(paths.assignedF2, JSON.stringify(assignedPlayersF2, null, 2));
        fs.writeFileSync(paths.registration, JSON.stringify(registrationData, null, 2));
        fs.writeFileSync(paths.liveLineup, JSON.stringify(liveLineupIds, null, 2));
        fs.writeFileSync(paths.carClaims, JSON.stringify(carNumberClaims, null, 2));

        console.log(`💾 Local Files Updated: ${reason}`);

        // 2. Backup to Discord
        const masterBackup = {
            assignedPlayersF1, assignedPlayersF2,
            registrationData, liveLineupIds, carNumberClaims,
            lastUpdate: new Date().toISOString()
        };

        const channel = await client.channels.fetch(BACKUP_CHANNEL_ID);
        if (channel?.isTextBased()) {
            const buffer = Buffer.from(JSON.stringify(masterBackup, null, 2));
            const attachment = new AttachmentBuilder(buffer, { name: 'backup_data.json' });
            await channel.send({ 
                content: `🚀 Data Sync [${reason}]`, 
                files: [attachment] 
            });
        }
    } catch (err) {
        console.error("Save Error:", err);
    }
};

const loadData = async () => {
    console.log("🔄 Starting Data Load...");
    
    // 1. Restore from Discord (Backup takes priority over Defaults)
    try {
        const channel = await client.channels.fetch(BACKUP_CHANNEL_ID);
        if (!channel?.isTextBased()) return;

        const messages = await channel.messages.fetch({ limit: 5 });
        const backupMsg = messages.find(m => m.attachments.size > 0);

        if (backupMsg) {
            const response = await fetch(backupMsg.attachments.first().url);
            const data = await response.json();

            // Overwrite variables ONLY if backup data exists
            if (data.assignedPlayersF1) assignedPlayersF1 = data.assignedPlayersF1;
            if (data.assignedPlayersF2) assignedPlayersF2 = data.assignedPlayersF2;
            if (data.registrationData) registrationData = data.registrationData;
            if (data.liveLineupIds) liveLineupIds = data.liveLineupIds;
            if (data.carNumberClaims) carNumberClaims = data.carNumberClaims;

            // Update local files to match
            fs.writeFileSync(paths.assignedF1, JSON.stringify(assignedPlayersF1, null, 2));
            fs.writeFileSync(paths.assignedF2, JSON.stringify(assignedPlayersF2, null, 2));
            fs.writeFileSync(paths.registration, JSON.stringify(registrationData, null, 2));
            fs.writeFileSync(paths.liveLineup, JSON.stringify(liveLineupIds, null, 2));
            fs.writeFileSync(paths.carClaims, JSON.stringify(carNumberClaims, null, 2));

            console.log("♻️ Data restored from Discord Backup.");
        } else {
            console.log("⚠️ No Discord backup found. Using DEFAULTS.");
        }
    } catch (err) {
        console.error("Backup Restore Failed (Using Defaults):", err);
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

// ========================
// HELPERS
// ========================
const getAssignedPlayers = (series) => series === "F1" ? assignedPlayersF1 : assignedPlayersF2;

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
  // 1. Check active registrations
  const regTaken = Object.entries(registrationData).some(([uid, data]) => data.series === series && data.carnumber === number && uid !== userId);
  
  // 2. Check claim list (Array of objects {number, userId})
  const claimTaken = carNumberClaims[series]?.some(c => c.number === number);

  return regTaken || claimTaken;
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
      if (msg) {
          await msg.edit({ embeds: [embed] });
      } else {
          // Message ID exists in DB but not in channel (deleted), send new
          const newMsg = await channel.send({ embeds: [embed] });
          liveLineupIds[series] = newMsg.id;
          await saveData("FixLiveEmbed");
      }
    } else {
      const msg = await channel.send({ embeds: [embed] });
      liveLineupIds[series] = msg.id;
      await saveData("NewLiveEmbed");
    }
  } catch (e) { console.error("Lineup error:", e); }
};

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

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

// ========================
// COMMAND DEFINITIONS
// ========================
const seriesChoices = [{ name: "F1", value: "F1" }, { name: "F2", value: "F2" }];
const commands = [
  new SlashCommandBuilder().setName("sign").setDescription("Sign a user to a team")
    .addStringOption(o => o.setName("league").setDescription("F1 or F2").setRequired(true).addChoices(...seriesChoices))
    .addUserOption(o => o.setName("user").setDescription("User to sign").setRequired(true))
    .addStringOption(o => o.setName("team").setDescription("Team").setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName("role").setDescription("Role").setRequired(true).setAutocomplete(true)),

  new SlashCommandBuilder().setName("move").setDescription("Move a user to a new team/role")
    .addStringOption(o => o.setName("league").setDescription("F1 or F2").setRequired(true).addChoices(...seriesChoices))
    .addUserOption(o => o.setName("user").setDescription("User to move").setRequired(true))
    .addStringOption(o => o.setName("team").setDescription("Team").setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName("role").setDescription("Role").setRequired(true).setAutocomplete(true)),

  new SlashCommandBuilder().setName("release").setDescription("Release a user")
    .addStringOption(o => o.setName("league").setDescription("F1 or F2").setRequired(true).addChoices(...seriesChoices))
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder().setName("register").setDescription("Register car number, flag")
    .addStringOption(o => o.setName("league").setDescription("F1 or F2").setRequired(true).addChoices(...seriesChoices))
    .addIntegerOption(o => o.setName("carnumber").setDescription("Car number").setRequired(true))
    .addStringOption(o => o.setName("username").setDescription("Username").setRequired(true))
    .addStringOption(o => o.setName("flag").setDescription("Flag emoji").setRequired(true)),

  new SlashCommandBuilder().setName("profile").setDescription("Show user profile")
    .addStringOption(o => o.setName("league").setDescription("F1 or F2").setRequired(true).addChoices(...seriesChoices))
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(false)),

  new SlashCommandBuilder().setName("lineupyear").setDescription("Force refresh lineup")
    .addStringOption(o => o.setName("league").setDescription("F1 or F2").setRequired(true).addChoices(...seriesChoices)),

  new SlashCommandBuilder().setName("help").setDescription("Show commands"),
  new SlashCommandBuilder().setName("resetdata").setDescription("Reset all data (Admin)"),
  new SlashCommandBuilder().setName("cleanname").setDescription("Reset nicknames (Admin)"),
  
  new SlashCommandBuilder().setName("carnumberclaim").setDescription("Claim car numbers (Admin)")
    .addStringOption(o => o.setName("league").setDescription("F1 or F2").setRequired(true).addChoices(...seriesChoices))
    .addIntegerOption(o => o.setName("number").setDescription("Car number").setRequired(true))
].map(c => c.toJSON());

const isAdmin = async (interaction) => {
  try {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    return member.roles.cache.has("1432285963287003156") || member.permissions.has("Administrator");
  } catch { return false; }
};

// ========================
// STARTUP
// ========================
client.once("ready", async () => {
  console.log(`Bot Active: ${client.user.tag}`);
  
  // Attempt to load from Discord first. 
  // If that fails, the variables are ALREADY populated with your DEFAULTS.
  await loadData(); 

  // Force a "Fresh" save to Discord to ensure the defaults are backed up if the channel is empty
  setTimeout(() => saveData("StartupSync"), 5000);

  setInterval(async () => {
    try { await fetch("https://cronitor.link/p/5228af7c42f54ba681f4b7c436c08f1b/luqCyv"); } catch(e) {}
  }, 60000);

  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    client.guilds.cache.forEach(guild => {
      updateLiveLineup(guild, "F1");
      updateLiveLineup(guild, "F2");
    });
  } catch (err) { console.error(err); }
});

// ========================
// INTERACTION HANDLER
// ========================
client.on("interactionCreate", async interaction => {
  if (interaction.isAutocomplete()) {
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
    return;
  }

  if (!interaction.isCommand()) return;

  try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (e) { return; }

  const { commandName, options, user, guild } = interaction;

  try {
      const league = options.getString("league");
      const config = league ? seriesConfigs[league] : null;
      const assignedPlayers = league ? getAssignedPlayers(league) : null;

      if (commandName === "help") {
        return interaction.editReply({ content: `**Commands**\n/sign, /move, /release, /register, /profile, /lineupyear, /resetdata, /cleanname, /carnumberclaim` });
      }

      if (commandName === "resetdata") {
        if (!(await isAdmin(interaction))) return interaction.editReply({ content: "Not authorized." });
        
        // Reset to DEFAULTS, not empty objects
        assignedPlayersF1 = JSON.parse(JSON.stringify(DEFAULTS.assignedF1));
        assignedPlayersF2 = JSON.parse(JSON.stringify(DEFAULTS.assignedF2));
        registrationData = {};
        liveLineupIds = JSON.parse(JSON.stringify(DEFAULTS.liveLineup));
        carNumberClaims = JSON.parse(JSON.stringify(DEFAULTS.carClaims));
        
        await saveData("ResetData");
        return interaction.editReply({ content: "✅ All data reset to DEFAULT state!" });
      }

      if (commandName === "cleanname") {
        if (!(await isAdmin(interaction))) return interaction.editReply({ content: "Not authorized." });
        const members = await guild.members.fetch();
        for (const [id, m] of members) { if (!m.user.bot) await m.setNickname(null).catch(() => {}); }
        return interaction.editReply({ content: `✅ Nicknames reset.` });
      }

      if (commandName === "carnumberclaim") {
        if (!(await isAdmin(interaction))) return interaction.editReply({ content: "Not authorized." });
        const number = options.getInteger("number");
        
        if (!carNumberClaims[league]) carNumberClaims[league] = [];
        
        // Check for existing claim (Object array structure)
        if (carNumberClaims[league].some(c => c.number === number)) {
            return interaction.editReply({ content: `Number ${number} already claimed!` });
        }
        
        // Add new claim
        carNumberClaims[league].push({ number: number, userId: "ADMIN_CLAIM" });
        
        await saveData("CarClaim");
        return interaction.editReply({ content: `✅ Car number ${number} claimed for ${league}` });
      }

      if (commandName === "register") {
        const carNumber = options.getInteger("carnumber");
        const username = options.getString("username");
        const flag = options.getString("flag");
        
        if (isCarNumberTaken(league, carNumber, user.id))
          return interaction.editReply({ content: `Car number ${carNumber} is taken!` });
        
        registrationData[user.id] = { series: league, carnumber: carNumber, username, flag };
        await saveData("Register");
        try {
          const member = await guild.members.fetch(user.id);
          await member.setNickname(`${carNumber} | ${username} ${flag}`);
        } catch {}
        return interaction.editReply({ content: `Registered as ${carNumber} | ${username} ${flag}` });
      }

      if (commandName === "profile") {
          const targetUser = options.getUser("user") || user;
          const reg = registrationData[targetUser.id];
          const assign = assignedPlayersF1[targetUser.id] || assignedPlayersF2[targetUser.id];
          const embed = new EmbedBuilder()
            .setTitle(`${targetUser.username}'s Profile`).setColor("Blue")
            .addFields(
                { name: "League", value: reg ? reg.series : "Unregistered", inline: true },
                { name: "Car #", value: reg ? `${reg.carnumber}` : "N/A", inline: true },
                { name: "Team", value: assign ? assign.team : "Free Agent", inline: true },
                { name: "Role", value: assign ? assign.role : "None", inline: true }
            );
          return interaction.editReply({ embeds: [embed] });
      }

      if (commandName === "sign") {
        const target = options.getUser("user");
        const team = options.getString("team");
        const role = options.getString("role");
        if (!config.teamRoleIds[team] || !config.playerRoles[role]) return interaction.editReply({ content: "Invalid config." });
        if (countRoleInTeam(league, team, role) >= config.playerRoles[role].max) return interaction.editReply({ content: "Role limit reached." });

        assignedPlayers[`${target.id}`] = { team, role };
        await saveData("Sign");
        try {
          const member = await guild.members.fetch(target.id);
          member.roles.add(config.playerRoles[role].id).catch(() => {});
        } catch {}
        updateLiveLineup(guild, league);
        sendEmbed(guild, "Sign", `<@${target.id}> signed: ${role} @ ${team}`, "Green", user.tag, config.updateChannelId);
        return interaction.editReply({ content: `Signed ${target.tag}` });
      }

      if (commandName === "move") {
        const target = options.getUser("user");
        const team = options.getString("team");
        const role = options.getString("role");
        if (!assignedPlayers[`${target.id}`]) return interaction.editReply({ content: "User not signed." });
        const oldRole = config.playerRoles[assignedPlayers[target.id].role]?.id;
        assignedPlayers[target.id] = { team, role };
        await saveData("Move");
        try {
          const member = await guild.members.fetch(target.id);
          if (oldRole) await member.roles.remove(oldRole).catch(() => {});
          await member.roles.add(config.playerRoles[role].id).catch(() => {});
        } catch {}
        updateLiveLineup(guild, league);
        sendEmbed(guild, "Move", `<@${target.id}> moved to ${role} @ ${team}`, "Orange", user.tag, config.updateChannelId);
        return interaction.editReply({ content: `Moved ${target.tag}` });
      }

      if (commandName === "release") {
        const target = options.getUser("user");
        if (!assignedPlayers[target.id]) return interaction.editReply({ content: "User not signed." });
        const oldRole = config.playerRoles[assignedPlayers[target.id].role]?.id;
        delete assignedPlayers[target.id];
        await saveData("Release");
        try {
          const member = await guild.members.fetch(target.id);
          if (oldRole) await member.roles.remove(oldRole).catch(() => {});
        } catch {}
        updateLiveLineup(guild, league);
        sendEmbed(guild, "Release", `<@${target.id}> released`, "Red", user.tag, config.updateChannelId);
        return interaction.editReply({ content: `Released ${target.tag}` });
      }

      if (commandName === "lineupyear") {
        updateLiveLineup(guild, league);
        return interaction.editReply({ content: `Lineup refreshed.` });
      }

  } catch (error) {
      console.error(error);
      return interaction.editReply({ content: "Error occurred." }).catch(() => {});
  }
});

// ========================
// HEALTH CHECK
// ========================
const app = express();
app.get("/", (req, res) => res.send("Bot is running and syncing."));
app.listen(process.env.PORT || 3000);

client.login(process.env.DISCORD_TOKEN);
