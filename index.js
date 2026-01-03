// ========================
// IMPORTS & CONFIG
// ========================
import 'dotenv/config';
import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
// IMPORT MessageFlags HERE
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } from "discord.js";

// --- CONSTANTS ---
const ADMIN_ROLE_ID = "1432737274231259351";
const CLAIM_LIST_CHANNEL_ID = "1452244527749533726";
const BACKUP_CHANNEL_ID = "1452397713252548638";

const dataDir = "./data";
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const assignedFileF1 = path.join(dataDir, "assignedPlayersF1.json");
const assignedFileF2 = path.join(dataDir, "assignedPlayersF2.json");
const registrationFile = path.join(dataDir, "registrationData.json");
const liveEmbedFile = path.join(dataDir, "liveLineup.json");
const carNumberClaimFile = path.join(dataDir, "carNumberClaims.json");

// --- INITIALIZE FILES ---
if (!fs.existsSync(assignedFileF1)) fs.writeFileSync(assignedFileF1, JSON.stringify({}, null, 2));
if (!fs.existsSync(assignedFileF2)) fs.writeFileSync(assignedFileF2, JSON.stringify({}, null, 2));
if (!fs.existsSync(registrationFile)) fs.writeFileSync(registrationFile, JSON.stringify({}, null, 2));
if (!fs.existsSync(liveEmbedFile)) fs.writeFileSync(liveEmbedFile, JSON.stringify({ F1: null, F2: null }, null, 2));

if (!fs.existsSync(carNumberClaimFile)) {
    fs.writeFileSync(carNumberClaimFile, JSON.stringify({
        F1: [],
        F2: [],
        embeds: { live: null }
    }, null, 2));
}

// --- LOAD DATA ---
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
// BACKUP HELPER
// ========================
const sendDataBackup = async (guild, actionType) => {
    const channel = guild.channels.cache.get(BACKUP_CHANNEL_ID);
    if (!channel?.isTextBased()) return;

    const completeData = {
        assignedPlayersF1,
        assignedPlayersF2,
        registrationData,
        liveLineupIds,
        carNumberClaims,
        lastUpdate: new Date().toISOString(),
        trigger: actionType
    };

    try {
        const buffer = Buffer.from(JSON.stringify(completeData, null, 2), "utf-8");
        const attachment = new AttachmentBuilder(buffer, { name: 'backup_data.json' });

        await channel.send({
            content: `📦 **Data Backup** | Action: \`${actionType}\` | Time: <t:${Math.floor(Date.now() / 1000)}:R>`,
            files: [attachment]
        });
    } catch (err) {
        console.error("Failed to send backup:", err);
    }
};

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
    const registered = Object.entries(registrationData).some(([uid, data]) => data.series === series && data.carnumber === number && uid !== userId);
    const claimedList = carNumberClaims[series] || [];
    const claimed = claimedList.some(c => c.number === number);
    return registered || claimed;
};

// --- UPDATE LIVE LINEUP (TEAMS) ---
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
                const newMsg = await channel.send({ embeds: [embed] });
                liveLineupIds[series] = newMsg.id;
                saveLiveEmbedIds();
            }
        } else {
            const msg = await channel.send({ embeds: [embed] });
            liveLineupIds[series] = msg.id;
            saveLiveEmbedIds();
        }
    } catch (err) { console.error("Lineup update error", err); }
};

// --- UPDATE CLAIMED NUMBERS BOARD ---
const updateClaimBoard = async (guild) => {
    const channel = guild.channels.cache.get(CLAIM_LIST_CHANNEL_ID);
    if (!channel?.isTextBased()) return;

    const formatList = (list) => {
        if (!list || list.length === 0) return "None";
        return list
            .sort((a, b) => a.number - b.number)
            .map(item => `**${item.number}** - ${item.userId === 'ADMIN_CLAIM' ? 'Admin Reserved' : `<@${item.userId}>`}`)
            .join("\n");
    };

    const f1Claims = formatList(carNumberClaims.F1);
    const f2Claims = formatList(carNumberClaims.F2);

    const embed = new EmbedBuilder()
        .setTitle("🏁 Claimed Car Numbers")
        .setColor("Blue")
        .setDescription("List of numbers currently claimed/reserved in the league.")
        .addFields(
            { name: "🏎️ F1 Claims", value: f1Claims, inline: true },
            { name: "🏎️ F2 Claims", value: f2Claims, inline: true }
        )
        .setTimestamp();

    try {
        const messageId = carNumberClaims.embeds?.live;
        if (messageId) {
            const msg = await channel.messages.fetch(messageId).catch(() => null);
            if (msg) {
                await msg.edit({ embeds: [embed] });
                return;
            }
        }
        const msg = await channel.send({ embeds: [embed] });
        if (!carNumberClaims.embeds) carNumberClaims.embeds = {};
        carNumberClaims.embeds.live = msg.id;
        saveCarNumberClaims();
    } catch (err) { console.error("Error updating claim board:", err); }
};

// ========================
// DISCORD CLIENT
// ========================
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

// ========================
// COMMANDS SETUP
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
        .addUserOption(o => o.setName("user").setDescription("User to release").setRequired(true)),

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

    new SlashCommandBuilder().setName("resetdata").setDescription("Reset all bot data (Admin Role Only)"),

    new SlashCommandBuilder().setName("cleanname").setDescription("Reset all user nicknames (Admin Role Only)"),

    new SlashCommandBuilder().setName("carnumberclaim").setDescription("Claim/Reserve a car number for the list")
        .addStringOption(o => o.setName("league").setDescription("F1 or F2").setRequired(true).addChoices(...seriesChoices))
        .addIntegerOption(o => o.setName("number").setDescription("The Car Number to claim").setRequired(true)),
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

        client.guilds.cache.forEach(guild => {
            updateLiveLineup(guild, "F1");
            updateLiveLineup(guild, "F2");
            updateClaimBoard(guild);
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
        return interaction.respond(choices.filter(c => c.toLowerCase().startsWith(focused.value.toLowerCase())).map(c => ({ name: c, value: c })));
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
    const { commandName, options, user, guild, member } = interaction;
    const league = options.getString("league");
    const config = league ? seriesConfigs[league] : null;
    const assignedPlayers = getAssignedPlayers(league);

    // -------------------- HELP --------------------
    if (commandName === "help") {
        return interaction.reply({
            content: `**Commands**
/sign - Sign a user to a team/role
/move - Move a user to a new team/role
/release - Remove a user from all bot roles
/register - Register car number, username, flag
/profile - Show user profile
/lineupyear - Show all teams lineup
/resetdata - Reset all bot data (Admin Role Only)
/cleanname - Reset all nicknames (Admin Role Only)
/carnumberclaim - Reserve a car number on the board
/help - Show this message`,
            flags: MessageFlags.Ephemeral
        });
    }

    // -------------------- RESET DATA (SECURED) --------------------
    if (commandName === "resetdata") {
        if (!member.roles.cache.has(ADMIN_ROLE_ID)) {
            return interaction.reply({ content: "❌ You do not have permission to use this command.", flags: MessageFlags.Ephemeral });
        }

        // Remove roles from Discord
        for (const memberId in assignedPlayersF1) {
            const m = await guild.members.fetch(memberId).catch(() => null);
            if (m) {
                const roleId = seriesConfigs.F1.playerRoles[assignedPlayersF1[memberId].role]?.id;
                if (roleId) m.roles.remove(roleId).catch(() => { });
            }
        }
        for (const memberId in assignedPlayersF2) {
            const m = await guild.members.fetch(memberId).catch(() => null);
            if (m) {
                const roleId = seriesConfigs.F2.playerRoles[assignedPlayersF2[memberId].role]?.id;
                if (roleId) m.roles.remove(roleId).catch(() => { });
            }
        }

        assignedPlayersF1 = {};
        assignedPlayersF2 = {};
        registrationData = {};
        liveLineupIds = { F1: null, F2: null };
        carNumberClaims = { F1: [], F2: [], embeds: { live: null } };

        saveAssignedF1(); saveAssignedF2(); saveRegistration(); saveLiveEmbedIds(); saveCarNumberClaims();

        updateClaimBoard(guild); // Clear the board
        sendDataBackup(guild, "RESET_DATA"); // Backup after reset
        return interaction.reply({ content: "✅ All bot data has been reset.", flags: MessageFlags.Ephemeral });
    }

    // -------------------- CLEANNAME (SECURED) --------------------
    if (commandName === "cleanname") {
        if (!member.roles.cache.has(ADMIN_ROLE_ID)) {
            return interaction.reply({ content: "❌ You do not have permission to use this command.", flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const members = await guild.members.fetch();
        let count = 0;
        members.forEach(m => {
            if (!m.user.bot && m.nickname) {
                m.setNickname(null).catch(() => { });
                count++;
            }
        });
        return interaction.editReply({ content: `✅ Reset nicknames for approx ${count} members.` });
    }

    // -------------------- CARNUMBERCLAIM (FIXED) --------------------
    if (commandName === "carnumberclaim") {
        const numberToClaim = options.getInteger("number");

        if (numberToClaim < 0 || numberToClaim > 999) {
            return interaction.reply({ content: "❌ Please enter a valid car number (0-999).", flags: MessageFlags.Ephemeral });
        }

        if (isCarNumberTaken(league, numberToClaim, user.id)) {
            return interaction.reply({ content: `❌ Car number **${numberToClaim}** is already taken/reserved in ${league}!`, flags: MessageFlags.Ephemeral });
        }

        carNumberClaims[league].push({
            number: numberToClaim,
            userId: user.id
        });

        saveCarNumberClaims();
        updateClaimBoard(guild);
        sendDataBackup(guild, "CLAIM_NUMBER");

        return interaction.reply({ content: `✅ Successfully claimed/reserved number **${numberToClaim}** in ${league}.`, flags: MessageFlags.Ephemeral });
    }

    // -------------------- REGISTER --------------------
    if (commandName === "register") {
        const carNumber = options.getInteger("carnumber");
        const username = options.getString("username");
        const flag = options.getString("flag");

        if (!flag) return interaction.reply({ content: "Flag is required!", flags: MessageFlags.Ephemeral });
        if (isCarNumberTaken(league, carNumber, user.id))
            return interaction.reply({ content: `Car number ${carNumber} is already taken in ${league}!`, flags: MessageFlags.Ephemeral });

        registrationData[user.id] = { series: league, carnumber: carNumber, username, flag };
        saveRegistration();

        try {
            const member = await guild.members.fetch(user.id);
            if (member) await member.setNickname(`${carNumber} | ${username} ${flag}`);
        } catch { }

        sendDataBackup(guild, "REGISTER");
        return interaction.reply({ content: `Registered as ${carNumber} | ${username} ${flag} in ${league}`, flags: MessageFlags.Ephemeral });
    }

    // -------------------- SIGN --------------------
    if (commandName === "sign") {
        const target = options.getUser("user");
        const team = options.getString("team");
        const role = options.getString("role");

        if (!config.teamRoleIds[team]) return interaction.reply({ content: "Invalid team.", flags: MessageFlags.Ephemeral });
        if (!config.playerRoles[role]) return interaction.reply({ content: "Invalid role.", flags: MessageFlags.Ephemeral });
        if (countRoleInTeam(league, team, role) >= config.playerRoles[role].max) return interaction.reply({ content: `${role} limit reached in ${team}`, flags: MessageFlags.Ephemeral });

        assignedPlayers[`${target.id}`] = { team, role };
        saveAssigned(league);

        try {
            const member = await guild.members.fetch(target.id);
            const roleId = config.playerRoles[role].id;
            if (member && roleId) member.roles.add(roleId).catch(() => { });
        } catch { }

        updateLiveLineup(guild, league);
        sendEmbed(guild, "Sign", `<@${target.id}> signed as ${role} in ${team}`, "Green", user.tag, config.updateChannelId);
        sendDataBackup(guild, "SIGN");

        return interaction.reply({ content: `Signed ${target.tag} as ${role} in ${team}`, flags: MessageFlags.Ephemeral });
    }

    // -------------------- MOVE --------------------
    if (commandName === "move") {
        const target = options.getUser("user");
        const team = options.getString("team");
        const role = options.getString("role");

        if (!assignedPlayers[`${target.id}`]) return interaction.reply({ content: "User not signed yet.", flags: MessageFlags.Ephemeral });
        if (!config.teamRoleIds[team]) return interaction.reply({ content: "Invalid team.", flags: MessageFlags.Ephemeral });
        if (!config.playerRoles[role]) return interaction.reply({ content: "Invalid role.", flags: MessageFlags.Ephemeral });
        if (countRoleInTeam(league, team, role) >= config.playerRoles[role].max) return interaction.reply({ content: `${role} limit reached in ${team}`, flags: MessageFlags.Ephemeral });

        const oldRoleId = config.playerRoles[assignedPlayers[`${target.id}`].role]?.id;
        assignedPlayers[`${target.id}`] = { team, role };
        saveAssigned(league);

        try {
            const member = await guild.members.fetch(target.id);
            if (member) {
                if (oldRoleId) member.roles.remove(oldRoleId).catch(() => { });
                member.roles.add(config.playerRoles[role].id).catch(() => { });
            }
        } catch { }

        updateLiveLineup(guild, league);
        sendEmbed(guild, "Move", `<@${target.id}> moved to ${role} in ${team}`, "Orange", user.tag, config.updateChannelId);
        sendDataBackup(guild, "MOVE");

        return interaction.reply({ content: `Moved ${target.tag} to ${role} in ${team}`, flags: MessageFlags.Ephemeral });
    }

    // -------------------- RELEASE --------------------
    if (commandName === "release") {
        const target = options.getUser("user");
        if (!assignedPlayers[`${target.id}`]) return interaction.reply({ content: "User not signed yet.", flags: MessageFlags.Ephemeral });

        const oldRoleId = config.playerRoles[assignedPlayers[`${target.id}`].role]?.id;
        delete assignedPlayers[`${target.id}`];
        saveAssigned(league);

        try {
            const member = await guild.members.fetch(target.id);
            if (member && oldRoleId) member.roles.remove(oldRoleId).catch(() => { });
        } catch { }

        updateLiveLineup(guild, league);
        sendEmbed(guild, "Release", `<@${target.id}> released from all roles in ${league}`, "Red", user.tag, config.updateChannelId);
        sendDataBackup(guild, "RELEASE");

        return interaction.reply({ content: `Released ${target.tag} from all roles in ${league}`, flags: MessageFlags.Ephemeral });
    }

    // -------------------- LINEUPYEAR --------------------
    if (commandName === "lineupyear") {
        updateLiveLineup(guild, league);
        return interaction.reply({ content: `${league} lineup updated!`, flags: MessageFlags.Ephemeral });
    }

    // -------------------- PROFILE --------------------
    if (commandName === "profile") {
        const targetUser = options.getUser("user") || user;
        const pData = assignedPlayers[targetUser.id];
        const rData = registrationData[targetUser.id];

        const embed = new EmbedBuilder()
            .setTitle(`Profile: ${targetUser.tag}`)
            .setColor("Blue")
            .addFields(
                { name: "Team/Role", value: pData ? `${pData.team} - ${pData.role}` : "Not Signed" },
                { name: "Registration", value: rData ? `Car: ${rData.carnumber} | Flag: ${rData.flag}` : "Not Registered" }
            );

        return interaction.reply({ embeds: [embed] });
    }
});
