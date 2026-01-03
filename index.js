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
    MessageFlags,
    PermissionFlagsBits 
} from "discord.js";

// --- CONSTANTS ---
const ADMIN_ROLE_ID = "1432737274231259351";
const CLAIM_LIST_CHANNEL_ID = "1452244527749533726";
const BACKUP_CHANNEL_ID = "1452397713252548638";

const dataDir = "./data";
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const files = {
    F1: path.join(dataDir, "assignedPlayersF1.json"),
    F2: path.join(dataDir, "assignedPlayersF2.json"),
    reg: path.join(dataDir, "registrationData.json"),
    live: path.join(dataDir, "liveLineup.json"),
    claims: path.join(dataDir, "carNumberClaims.json")
};

// --- INITIALIZE FILES ---
const initFile = (path, defaultContent) => {
    if (!fs.existsSync(path)) fs.writeFileSync(path, JSON.stringify(defaultContent, null, 2));
};

initFile(files.F1, {});
initFile(files.F2, {});
initFile(files.reg, {});
initFile(files.live, { F1: null, F2: null });
initFile(files.claims, { F1: [], F2: [], embeds: { live: null } });

// --- LOAD DATA ---
// We keep these in memory for speed, but save immediately on change
let db = {
    F1: JSON.parse(fs.readFileSync(files.F1, "utf8")),
    F2: JSON.parse(fs.readFileSync(files.F2, "utf8")),
    reg: JSON.parse(fs.readFileSync(files.reg, "utf8")),
    live: JSON.parse(fs.readFileSync(files.live, "utf8")),
    claims: JSON.parse(fs.readFileSync(files.claims, "utf8"))
};

// ========================
// CRONITOR HEARTBEAT
// ========================
const CRONITOR_URL = "https://cronitor.link/p/5228af7c42f54ba681f4b7c436c08f1b/luqCyv";
let heartbeatStarted = false;
function startCronitorHeartbeat() {
    if (heartbeatStarted) return;
    heartbeatStarted = true;
    setInterval(async () => {
        try { await fetch(CRONITOR_URL); } catch (err) { console.error("Heartbeat failed", err.message); }
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
const saveDB = (key, file) => fs.writeFileSync(file, JSON.stringify(db[key], null, 2));

const saveData = (type) => {
    if (type === "F1") saveDB("F1", files.F1);
    if (type === "F2") saveDB("F2", files.F2);
    if (type === "reg") saveDB("reg", files.reg);
    if (type === "live") saveDB("live", files.live);
    if (type === "claims") saveDB("claims", files.claims);
};

// ========================
// BACKUP HELPER
// ========================
const sendDataBackup = async (guild, actionType) => {
    const channel = guild.channels.cache.get(BACKUP_CHANNEL_ID);
    if (!channel?.isTextBased()) return;

    const completeData = { ...db, lastUpdate: new Date().toISOString(), trigger: actionType };

    try {
        const buffer = Buffer.from(JSON.stringify(completeData, null, 2), "utf-8");
        const attachment = new AttachmentBuilder(buffer, { name: 'backup_data.json' });

        await channel.send({
            content: `📦 **Data Backup** | Action: \`${actionType}\` | Time: <t:${Math.floor(Date.now() / 1000)}:R>`,
            files: [attachment]
        });
    } catch (err) { console.error("Failed to send backup:", err); }
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
    return Object.values(db[series]).filter(p => p.team === team && p.role === role).length;
};

const isCarNumberTaken = (series, number, userId) => {
    const registered = Object.entries(db.reg).some(([uid, data]) => data.series === series && data.carnumber === number && uid !== userId);
    const claimed = (db.claims[series] || []).some(c => c.number === number);
    return registered || claimed;
};

// --- UPDATE LIVE LINEUP ---
const updateLiveLineup = async (guild, series) => {
    const config = seriesConfigs[series];
    const assignedPlayers = db[series];
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
        if (db.live[series]) {
            const msg = await channel.messages.fetch(db.live[series]).catch(() => null);
            if (msg) {
                await msg.edit({ embeds: [embed] });
                return;
            }
        }
        // If message doesn't exist or fetch failed, send new
        const newMsg = await channel.send({ embeds: [embed] });
        db.live[series] = newMsg.id;
        saveData("live");
    } catch (err) { console.error(`Lineup update error (${series})`, err); }
};

// --- UPDATE CLAIM BOARD ---
const updateClaimBoard = async (guild) => {
    const channel = guild.channels.cache.get(CLAIM_LIST_CHANNEL_ID);
    if (!channel?.isTextBased()) return;

    const formatList = (list) => {
        if (!list || list.length === 0) return "None";
        return list.sort((a, b) => a.number - b.number)
            .map(item => `**${item.number}** - ${item.userId === 'ADMIN_CLAIM' ? 'Admin Reserved' : `<@${item.userId}>`}`)
            .join("\n");
    };

    const embed = new EmbedBuilder()
        .setTitle("🏁 Claimed Car Numbers")
        .setColor("Blue")
        .setDescription("List of numbers currently claimed/reserved in the league.")
        .addFields(
            { name: "🏎️ F1 Claims", value: formatList(db.claims.F1), inline: true },
            { name: "🏎️ F2 Claims", value: formatList(db.claims.F2), inline: true }
        ).setTimestamp();

    try {
        if (db.claims.embeds?.live) {
            const msg = await channel.messages.fetch(db.claims.embeds.live).catch(() => null);
            if (msg) {
                await msg.edit({ embeds: [embed] });
                return;
            }
        }
        const msg = await channel.send({ embeds: [embed] });
        db.claims.embeds = { live: msg.id };
        saveData("claims");
    } catch (err) { console.error("Error updating claim board:", err); }
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
        .addUserOption(o => o.setName("user").setDescription("User to release").setRequired(true)),

    new SlashCommandBuilder().setName("register").setDescription("Register car number, username, flag")
        .addStringOption(o => o.setName("league").setDescription("F1 or F2").setRequired(true).addChoices(...seriesChoices))
        .addIntegerOption(o => o.setName("carnumber").setDescription("Car number").setRequired(true))
        .addStringOption(o => o.setName("username").setDescription("Username").setRequired(true))
        .addStringOption(o => o.setName("flag").setDescription("Flag emoji").setRequired(true)),

    new SlashCommandBuilder().setName("profile").setDescription("Show user profile")
        .addUserOption(o => o.setName("user").setDescription("User").setRequired(false)),

    new SlashCommandBuilder().setName("lineupyear").setDescription("Force update the live lineup")
        .addStringOption(o => o.setName("league").setDescription("F1 or F2").setRequired(true).addChoices(...seriesChoices)),

    new SlashCommandBuilder().setName("help").setDescription("Show commands"),
    new SlashCommandBuilder().setName("resetdata").setDescription("Reset all bot data (Admin Only)"),
    new SlashCommandBuilder().setName("cleanname").setDescription("Reset all user nicknames (Admin Only)"),

    new SlashCommandBuilder().setName("carnumberclaim").setDescription("Reserve a car number")
        .addStringOption(o => o.setName("league").setDescription("F1 or F2").setRequired(true).addChoices(...seriesChoices))
        .addIntegerOption(o => o.setName("number").setDescription("The Car Number to claim").setRequired(true)),
].map(c => c.toJSON());

// ========================
// CLIENT READY
// ========================
client.once("ready", async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    startCronitorHeartbeat();

    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log("✅ Commands registered!");

        // Refresh boards on startup
        for (const guild of client.guilds.cache.values()) {
            updateLiveLineup(guild, "F1");
            updateLiveLineup(guild, "F2");
            updateClaimBoard(guild);
        }
    } catch (err) { console.error("Startup error:", err); }
});

client.login(process.env.DISCORD_TOKEN);

// ========================
// AUTOCOMPLETE HANDLER
// ========================
client.on("interactionCreate", async interaction => {
    if (!interaction.isAutocomplete()) return;

    const focused = interaction.options.getFocused(true);
    const league = interaction.options.getString("league");

    // FIX: If league is not selected yet, we cannot offer choices
    if (!league) return interaction.respond([{ name: "⚠️ Select League Option First", value: "NONE" }]);

    const config = seriesConfigs[league];
    
    if (focused.name === "team") {
        const choices = Object.keys(config.teamRoleIds);
        const filtered = choices.filter(c => c.toLowerCase().includes(focused.value.toLowerCase())).slice(0, 25);
        return interaction.respond(filtered.map(c => ({ name: c, value: c })));
    }

    if (focused.name === "role") {
        const choices = Object.keys(config.playerRoles);
        const filtered = choices.filter(c => c.toLowerCase().includes(focused.value.toLowerCase())).slice(0, 25);
        return interaction.respond(filtered.map(c => ({ name: c, value: c })));
    }
});

// ========================
// COMMAND HANDLER
// ========================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    // GLOBAL ERROR HANDLER
    try {
        const { commandName, options, user, guild, member } = interaction;
        const league = options.getString("league");
        const config = league ? seriesConfigs[league] : null;

        // --- HELP ---
        if (commandName === "help") {
            return interaction.reply({
                content: `**Commands**\n/sign, /move, /release, /register, /profile, /carnumberclaim\n\n**Admin**\n/resetdata, /cleanname, /lineupyear`,
                flags: MessageFlags.Ephemeral
            });
        }

        // --- RESET DATA ---
        if (commandName === "resetdata") {
            if (!member.roles.cache.has(ADMIN_ROLE_ID)) 
                return interaction.reply({ content: "❌ No permission.", flags: MessageFlags.Ephemeral });

            // Remove roles loop...
            const resetSeries = async (seriesCode) => {
                const assigned = db[seriesCode];
                const conf = seriesConfigs[seriesCode];
                for (const uid in assigned) {
                    const m = await guild.members.fetch(uid).catch(() => null);
                    if (m && conf.playerRoles[assigned[uid].role]) {
                        await m.roles.remove(conf.playerRoles[assigned[uid].role].id).catch(() => {});
                    }
                }
            };
            await resetSeries("F1");
            await resetSeries("F2");

            db = {
                F1: {}, F2: {}, reg: {}, live: { F1: null, F2: null },
                claims: { F1: [], F2: [], embeds: { live: null } }
            };
            
            // Save empty states
            Object.keys(files).forEach(k => saveData(k));
            
            updateClaimBoard(guild);
            sendDataBackup(guild, "RESET_DATA");
            return interaction.reply({ content: "✅ All data reset.", flags: MessageFlags.Ephemeral });
        }

        // --- CLEAN NAMES ---
        if (commandName === "cleanname") {
            if (!member.roles.cache.has(ADMIN_ROLE_ID)) return interaction.reply({ content: "❌ No permission.", flags: MessageFlags.Ephemeral });
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const members = await guild.members.fetch();
            let count = 0;
            for (const [, m] of members) {
                if (!m.user.bot && m.nickname) {
                    await m.setNickname(null).catch(() => {});
                    count++;
                }
            }
            return interaction.editReply(`✅ Cleaned ${count} nicknames.`);
        }

        // --- CLAIM NUMBER ---
        if (commandName === "carnumberclaim") {
            const num = options.getInteger("number");
            if (num < 0 || num > 999) return interaction.reply({ content: "❌ Invalid number (0-999).", flags: MessageFlags.Ephemeral });
            if (isCarNumberTaken(league, num, user.id)) return interaction.reply({ content: `❌ Number **${num}** is taken in ${league}!`, flags: MessageFlags.Ephemeral });

            db.claims[league].push({ number: num, userId: user.id });
            saveData("claims");
            updateClaimBoard(guild);
            return interaction.reply({ content: `✅ Reserved **${num}** in ${league}.`, flags: MessageFlags.Ephemeral });
        }

        // --- REGISTER ---
        if (commandName === "register") {
            const num = options.getInteger("carnumber");
            const username = options.getString("username");
            const flag = options.getString("flag");

            if (isCarNumberTaken(league, num, user.id)) return interaction.reply({ content: `❌ Number ${num} is taken!`, flags: MessageFlags.Ephemeral });

            db.reg[user.id] = { series: league, carnumber: num, username, flag };
            saveData("reg");

            const m = await guild.members.fetch(user.id).catch(() => null);
            if (m) await m.setNickname(`${num} | ${username} ${flag}`).catch(() => {});

            return interaction.reply({ content: `✅ Registered: ${num} | ${username} ${flag}`, flags: MessageFlags.Ephemeral });
        }

        // --- PROFILE ---
        if (commandName === "profile") {
            const target = options.getUser("user") || user;
            const pF1 = db.F1[target.id];
            const pF2 = db.F2[target.id];
            const rData = db.reg[target.id];

            const embed = new EmbedBuilder().setTitle(`Profile: ${target.tag}`).setColor("Blue");
            if (pF1) embed.addFields({ name: "F1 Status", value: `${pF1.team} - ${pF1.role}` });
            if (pF2) embed.addFields({ name: "F2 Status", value: `${pF2.team} - ${pF2.role}` });
            if (!pF1 && !pF2) embed.addFields({ name: "Status", value: "Not Signed" });
            
            embed.addFields({ name: "Registration", value: rData ? `Car: ${rData.carnumber} | Flag: ${rData.flag}` : "Not Registered" });
            return interaction.reply({ embeds: [embed] });
        }

        // --- LINEUP FORCE UPDATE ---
        if (commandName === "lineupyear") {
            await updateLiveLineup(guild, league);
            return interaction.reply({ content: "✅ Lineup updated.", flags: MessageFlags.Ephemeral });
        }

        // --- SIGN ---
        if (commandName === "sign") {
            const target = options.getUser("user");
            const team = options.getString("team");
            const role = options.getString("role");

            if (!config.teamRoleIds[team] || !config.playerRoles[role]) 
                return interaction.reply({ content: "❌ Invalid Team or Role. Please select from the list.", flags: MessageFlags.Ephemeral });

            if (countRoleInTeam(league, team, role) >= config.playerRoles[role].max)
                return interaction.reply({ content: `❌ ${role} is full for ${team}.`, flags: MessageFlags.Ephemeral });

            // 1. Try Discord Roles FIRST
            const m = await guild.members.fetch(target.id).catch(() => null);
            if (!m) return interaction.reply({ content: "❌ User not in server.", flags: MessageFlags.Ephemeral });

            const roleId = config.playerRoles[role].id;
            try {
                await m.roles.add(roleId);
            } catch (e) {
                return interaction.reply({ content: "❌ **Bot Error:** I cannot assign this role. My role must be higher than the target role.", flags: MessageFlags.Ephemeral });
            }

            // 2. Update DB Only if Discord success
            db[league][target.id] = { team, role };
            saveData(league);

            updateLiveLineup(guild, league);
            sendEmbed(guild, "Sign", `<@${target.id}> signed as ${role} in ${team}`, "Green", user.tag, config.updateChannelId);
            sendDataBackup(guild, "SIGN");
            return interaction.reply({ content: `✅ Signed ${target.tag} to ${team}.`, flags: MessageFlags.Ephemeral });
        }

        // --- MOVE ---
        if (commandName === "move") {
            const target = options.getUser("user");
            const team = options.getString("team");
            const role = options.getString("role");

            if (!db[league][target.id]) return interaction.reply({ content: "❌ User is not signed to this league yet.", flags: MessageFlags.Ephemeral });
            if (!config.teamRoleIds[team] || !config.playerRoles[role]) return interaction.reply({ content: "❌ Invalid selection.", flags: MessageFlags.Ephemeral });
            
            if (countRoleInTeam(league, team, role) >= config.playerRoles[role].max)
                return interaction.reply({ content: `❌ ${role} is full for ${team}.`, flags: MessageFlags.Ephemeral });

            const m = await guild.members.fetch(target.id).catch(() => null);
            const oldRoleId = config.playerRoles[db[league][target.id].role]?.id;
            const newRoleId = config.playerRoles[role].id;

            try {
                if (m) {
                    if (oldRoleId) await m.roles.remove(oldRoleId).catch(() => {});
                    await m.roles.add(newRoleId);
                }
            } catch (e) {
                return interaction.reply({ content: "❌ Permissions Error: Could not update user roles.", flags: MessageFlags.Ephemeral });
            }

            db[league][target.id] = { team, role };
            saveData(league);

            updateLiveLineup(guild, league);
            sendEmbed(guild, "Move", `<@${target.id}> moved to ${role} in ${team}`, "Orange", user.tag, config.updateChannelId);
            sendDataBackup(guild, "MOVE");
            return interaction.reply({ content: `✅ Moved ${target.tag}.`, flags: MessageFlags.Ephemeral });
        }

        // --- RELEASE ---
        if (commandName === "release") {
            const target = options.getUser("user");
            if (!db[league][target.id]) return interaction.reply({ content: "❌ User is not signed.", flags: MessageFlags.Ephemeral });

            const oldRoleId = config.playerRoles[db[league][target.id].role]?.id;
            const m = await guild.members.fetch(target.id).catch(() => null);

            // Update DB first for release, to ensure they are gone even if role removal fails
            delete db[league][target.id];
            saveData(league);

            if (m && oldRoleId) await m.roles.remove(oldRoleId).catch(() => {});

            updateLiveLineup(guild, league);
            sendEmbed(guild, "Release", `<@${target.id}> released from ${league}`, "Red", user.tag, config.updateChannelId);
            sendDataBackup(guild, "RELEASE");
            return interaction.reply({ content: `✅ Released ${target.tag}.`, flags: MessageFlags.Ephemeral });
        }

    } catch (criticalErr) {
        console.error("Critical Command Error:", criticalErr);
        if (!interaction.replied && !interaction.deferred) {
            interaction.reply({ content: "☠️ Critical Bot Error. Check console.", flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    }
});
