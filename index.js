"use strict";

// Dependencies
const {
        Client,
        Intents,
        MessageEmbed,
        MessageButton,
        MessageActionRow,
        Modal,
        TextInputComponent,
} = require("discord.js");
const fs = require("fs");

// Load config
const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));

const TIER_OPTIONS = ["LT5", "HT5", "LT4", "HT4", "LT3", "HT3", "LT2", "HT2", "LT1", "HT1"];
const RESULT_RANK_OPTIONS = ["N/A", ...TIER_OPTIONS];
const VALID_REGIONS = ["AS", "AU", "EU", "NA"];

function getAvatarUrl(username) {
        return config.avatarUrl.replace("{username}", encodeURIComponent(username));
}

const bot = new Client({
        intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
});

var usersInQueue = [];
var queue;
var activeTesterIds = []; // New array to store multiple tester IDs
var noTesterMessage;

// Function to register all commands
async function registerCommands(guild) {
        return await guild.commands.set([
                {
                        name: "queue",
                        description: "Make queue.",
                },
                {
                        name: "stopqueue",
                        description: "Deletes queue.",
                },
                {
                        name: "remove",
                        description: "Removes a user from queue.",
                        options: [
                                {
                                        type: "USER",
                                        name: "user",
                                        description: "User to remove in queue.",
                                        required: true,
                                },
                        ],
                },
                {
                        name: "rank",
                        description: "Set a rank to the specified user.",
                        options: [
                                {
                                        type: "STRING",
                                        name: "user",
                                        description: "User to give a rank.",
                                        required: true,
                                },
                                {
                                        type: "STRING",
                                        name: "rank",
                                        description:
                                                "The rank to give to the user.",
                                        required: true,
                                },
                        ],
                },
                {
                        name: "result",
                        description: "Send test result.",
                        options: [
                                {
                                        type: "USER",
                                        name: "user",
                                        description:
                                                "The user who took the test.",
                                        required: true,
                                },
                                {
                                        type: "STRING",
                                        name: "region",
                                        description: "The region of the user.",
                                        required: true,
                                },
                                {
                                        type: "STRING",
                                        name: "username",
                                        description:
                                                "The username of the user.",
                                        required: true,
                                },
                                {
                                        type: "STRING",
                                        name: "previous_rank",
                                        description:
                                                "The previous rank of the user (use N/A if not tested).",
                                        required: true,
                                        autocomplete: true,
                                },
                                {
                                        type: "STRING",
                                        name: "rank_earned",
                                        description:
                                                "The rank earned by the user (use N/A if not tested).",
                                        required: true,
                                        autocomplete: true,
                                },
                        ],
                },
                {
                        name: "refresh",
                        description: "Refresh all slash commands.",
                },
                {
                        name: "jointester",
                        description: "Join as an active tester.",
                },
                {
                        name: "leavetester",
                        description: "Leave the active tester queue.",
                },
                {
                        name: "verify",
                        description: "Register your Minecraft username and region.",
                },
                {
                        name: "information",
                        description: "Show waitlist information and actions.",
                },
                {
                        name: "next",
                        description: "Create a ticket for the next player in queue.",
                },
                {
                        name: "addplayer",
                        description: "Add or update a player on the tierlist website.",
                        options: [
                                {
                                        type: "STRING",
                                        name: "username",
                                        description: "Minecraft username (verified via Mojang).",
                                        required: true,
                                },
                                {
                                        type: "INTEGER",
                                        name: "points",
                                        description: "cPvP points earned by the player.",
                                        required: true,
                                },
                                {
                                        type: "STRING",
                                        name: "region",
                                        description: "Player region (NA, EU, AS, OC). Defaults to AS.",
                                        required: false,
                                },
                        ],
                },
                {
                        name: "removeplayer",
                        description: "Remove a player from the tierlist website.",
                        options: [
                                {
                                        type: "STRING",
                                        name: "username",
                                        description: "Minecraft username to remove.",
                                        required: true,
                                },
                        ],
                },
                {
                        name: "listplayers",
                        description: "List all players currently on the tierlist.",
                },
                {
                        name: "addtester",
                        description: "Grant the Tester role to a Discord member (Owner only).",
                        options: [
                                {
                                        type: "USER",
                                        name: "user",
                                        description: "The member to make a tester.",
                                        required: true,
                                },
                        ],
                },
                {
                        name: "removetester",
                        description: "Remove the Tester role from a Discord member (Owner only).",
                        options: [
                                {
                                        type: "USER",
                                        name: "user",
                                        description: "The member to remove from testers.",
                                        required: true,
                                },
                        ],
                },
        ]);
}

// ─── PLAYERS.JSON HELPERS ────────────────────────────────────────────────
function loadPlayers() {
        try {
                if (!fs.existsSync("players.json")) return [];
                return JSON.parse(fs.readFileSync("players.json", "utf-8"));
        } catch (e) {
                console.error("Failed to load players.json:", e);
                return [];
        }
}

function savePlayers(players) {
        try {
                // Always sort highest points first before saving
                players.sort((a, b) => b.points - a.points);
                fs.writeFileSync("players.json", JSON.stringify(players, null, 2), "utf-8");
        } catch (e) {
                console.error("Failed to save players.json:", e);
        }
}

function loadVerifications() {
        try {
                if (!fs.existsSync("verifications.json")) return {};
                return JSON.parse(fs.readFileSync("verifications.json", "utf-8"));
        } catch (e) {
                console.error("Failed to load verifications.json:", e);
                return {};
        }
}

function saveVerifications(verifications) {
        try {
                fs.writeFileSync("verifications.json", JSON.stringify(verifications, null, 2), "utf-8");
        } catch (e) {
                console.error("Failed to save verifications.json:", e);
        }
}

function getVerification(discordId) {
        return loadVerifications()[discordId] || null;
}

async function updateTierRole(member, tier) {
        const tierRoleNames = new Set(TIER_OPTIONS.map((name) => name.toLowerCase()));
        const oldTierRoles = member.roles.cache.filter((role) =>
                tierRoleNames.has(role.name.toLowerCase()) && role.name.toLowerCase() !== tier.toLowerCase()
        );
        if (oldTierRoles.size > 0) await member.roles.remove(oldTierRoles);

        const earnedRole = member.guild.roles.cache.find(
                (role) => role.name.toLowerCase() === tier.toLowerCase()
        );
        if (!earnedRole) return false;
        if (!member.roles.cache.has(earnedRole.id)) await member.roles.add(earnedRole);
        return true;
}

async function assignWaitlistRole(member) {
        const waitlistRole = getWaitlistRole(member.guild);
        if (!waitlistRole) return false;
        if (!member.roles.cache.has(waitlistRole.id)) await member.roles.add(waitlistRole);
        return true;
}

async function removeWaitlistRole(member) {
        const waitlistRole = getWaitlistRole(member.guild);
        if (!waitlistRole) return false;
        if (member.roles.cache.has(waitlistRole.id)) await member.roles.remove(waitlistRole);
        return true;
}

async function enforceCooldownWaitlistLock(member, verification = getVerification(member.id)) {
        const cooldownMessage = getCooldownMessage(verification);
        if (!cooldownMessage) return null;
        await removeWaitlistRole(member);
        return cooldownMessage;
}

async function addTrophyReaction(message) {
        try {
                await message.react("🏆");
        } catch (error) {
                console.error("Failed to add trophy reaction to result message:", error);
        }
}

function getWaitlistRole(guild) {
        return config.waitlistRoleID
                ? guild.roles.cache.get(config.waitlistRoleID)
                : guild.roles.cache.find(
                        (role) => role.name.toLowerCase() === (config.waitlistRoleName || "Waitlist").toLowerCase()
                );
}

function buildInformationPanel() {
        const buttons = new MessageActionRow().addComponents(
                new MessageButton()
                        .setCustomId("startVerification")
                        .setLabel("Verify Account")
                        .setStyle("PRIMARY"),
                new MessageButton()
                        .setCustomId("enterWaitlist")
                        .setLabel("Enter Waitlist")
                        .setStyle("PRIMARY"),
                new MessageButton()
                        .setCustomId("viewCooldown")
                        .setLabel("View Cooldown")
                        .setStyle("PRIMARY"),
        );
        const embed = new MessageEmbed()
                .setColor("#ed145b")
                .setTitle("📝 Evaluation Testing Waitlist")
                .setDescription([
                        "Upon applying, you will be added to a waitlist channel.",
                        "Here you will be pinged when a tester of your region is available.",
                        "If you are HT3 or higher, a high ticket will be created.",
                        "",
                        "• Region should be the region of the server you wish to test on",
                        "",
                        "• Username should be the name of the account you will be testing on",
                        "",
                        "🔴 Failure to provide authentic information will result in a denied test.",
                ].join("\n"));
        return { embeds: [embed], components: [buttons] };
}

async function clearNoTesterMessage() {
        if (!noTesterMessage) return;
        try {
                await noTesterMessage.delete();
        } catch (e) {
                if (e.code !== 10008) console.error("Failed to delete no-testers message:", e);
        }
        noTesterMessage = null;
}

function getCooldownMessage(verification) {
        if (!verification || !verification.cooldownUntil) return null;
        const remaining = new Date(verification.cooldownUntil).getTime() - Date.now();
        if (remaining <= 0) return null;
        const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
        return `⏳ This player is on cooldown for ${days} more day${days === 1 ? "" : "s"} (until <t:${Math.floor(new Date(verification.cooldownUntil).getTime() / 1000)}:F>).`;
}

function setTestCooldown(discordId) {
        const verifications = loadVerifications();
        if (!verifications[discordId]) return;
        const testedAt = new Date();
        const cooldownUntil = new Date(testedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
        verifications[discordId].lastTestedAt = testedAt.toISOString();
        verifications[discordId].cooldownUntil = cooldownUntil.toISOString();
        saveVerifications(verifications);
}

// Assign rank label + CSS class based on points
function getRankFromPoints(points) {
        if (points >= 300) return { rankLabel: "Combat Master", rankCls: "rc-cm" };
        if (points >= 200) return { rankLabel: "Combat Ace",    rankCls: "rc-ca" };
        if (points >= 150) return { rankLabel: "Veteran",       rankCls: "rc-vet" };
        if (points >= 100) return { rankLabel: "Elite",         rankCls: "rc-eli" };
        return               { rankLabel: "Player",          rankCls: "rc-ch" };
}

// Assign default tiers based on rank label
function getDefaultTiers(rankLabel) {
        const t = {
                "Combat Master": "HT3",
                "Combat Ace":    "HT2",
                "Veteran":       "LT2",
                "Elite":         "LT3",
                "Player":        "LT3",
        }[rankLabel] || "LT3";
        return {
                tiers: Array(8).fill(t),
                catTiers: {
                        overall: t, vanilla: t, sword: t, pot: t,
                        axe: t, uhc: t, smp: t, mace: t,
                },
        };
}

// Verify Minecraft username via Mojang API (Node 18+ native fetch)
async function verifyMojangUsername(username) {
        try {
                const res = await fetch(
                        `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`
                );
                if (res.status === 404 || res.status === 204) return null;
                if (!res.ok) return null;
                const data = await res.json();
                return data; // { id, name }
        } catch (e) {
                console.error("Mojang API error:", e);
                return null;
        }
}

// Builds the "No Testers Online" embed sent after stopqueue
function buildNoTesterEmbed() {
        const now = new Date();
        const timestamp = now.toLocaleString("en-US", {
                timeZone: "Asia/Jakarta",
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
        });

        return new MessageEmbed()
                .setTitle(config.serverName)
                .setColor("#FF0000")
                .addFields(
                        {
                                name: "❌ No Testers Online",
                                value: [
                                        "No testers for your region are available at this time.",
                                        "You will be pinged when a tester is available.",
                                        "Check back later!",
                                ].join("\n"),
                                inline: false,
                        },
                )
                .setFooter({ text: `Last testing session: ${timestamp}` });
}

// Add these functions after the existing dependencies
async function createTicket(guild, user, tester) {
        const verification = getVerification(user.id);
        const ticketChannel = await guild.channels.create(
                `ticket-${user.username}`,
                {
                        type: "GUILD_TEXT",
                        permissionOverwrites: [
                                {
                                        id: guild.id,
                                        deny: ["VIEW_CHANNEL"],
                                },
                                {
                                        id: user.id,
                                        allow: [
                                                "VIEW_CHANNEL",
                                                "SEND_MESSAGES",
                                        ],
                                },
                                {
                                        id: tester,
                                        allow: [
                                                "VIEW_CHANNEL",
                                                "SEND_MESSAGES",
                                        ],
                                },
                        ],
                },
        );

        const closeButton = new MessageActionRow().addComponents(
                new MessageButton()
                        .setCustomId("closeTicket")
                        .setLabel("Close Ticket")
                        .setStyle("DANGER"),
        );

        const embed = new MessageEmbed()
                .setTitle("Test Ticket")
                .setDescription(`Welcome <@${user.id}>!\nTester: <@${tester}>`)
                .addFields(
                        {
                                name: "Minecraft Username",
                                value: verification ? `\`${verification.minecraftUsername}\`` : "Not verified",
                                inline: true,
                        },
                        {
                                name: "Region",
                                value: verification ? verification.region : "Not verified",
                                inline: true,
                        },
                );

        await ticketChannel.send({
                embeds: [embed],
                components: [closeButton],
        });
        return ticketChannel;
}

function isUnknownMessageError(error) {
        return error?.code === 10008 || error?.httpStatus === 404;
}

function invalidateQueueState() {
        queue = null;
        usersInQueue = [];
        activeTesterIds = [];
}

async function editQueueMessage(embed) {
        if (!queue) return false;

        try {
                await queue.edit({ embeds: [embed] });
                return true;
        } catch (error) {
                if (isUnknownMessageError(error)) {
                        invalidateQueueState();
                        return false;
                }

                console.error("Failed to update queue message:", error);
                return false;
        }
}

async function deleteQueueMessage() {
        if (!queue) return;

        try {
                await queue.delete();
        } catch (error) {
                if (!isUnknownMessageError(error)) {
                        console.error("Failed to delete queue message:", error);
                }
        } finally {
                queue = null;
        }
}

// Main
bot.on("ready", async () => {
        console.log("PvP Tierlist is running.");

        bot.user.setPresence({
                activities: [
                        {
                                name: "LUMINOUSITY TIERLIST",
                                type: "WATCHING",
                        },
                ],
                status: "online",
        });

        const guild = bot.guilds.cache.first();
        if (guild) {
                await registerCommands(guild);
        } else {
                console.error("No guilds found for the bot.");
        }

        setInterval(async () => {
                if (queue) {
                        // Update queue embed
                        const embed = new MessageEmbed().setTitle(
                                "Tester(s) Available!",
                        ).setDescription(`The queue updates every 10 seconds.

**Queue**:
${usersInQueue.map((user, index) => `${index + 1}. <@${user}>`).join("\n")}

**Active Testers**:
${activeTesterIds.map((testerId) => `<@${testerId}>`).join("\n")}`);

                        await editQueueMessage(embed);
                }
        }, 10 * 1000);
});

function hasPermission(member) {
        return (
                member.roles.cache.some((r) => r.id === config.roleID) ||
                member.roles.cache.some((r) => r.id === config.ownerRoleID)
        );
}

// Modify the interactionCreate event for slash commands
bot.on("interactionCreate", async (interaction) => {
        if (interaction.isAutocomplete()) {
                if (interaction.commandName !== "result") return interaction.respond([]);
                const focused = interaction.options.getFocused().toUpperCase();
                const choices = RESULT_RANK_OPTIONS
                        .filter((tier) => tier.startsWith(focused))
                        .slice(0, 25)
                        .map((tier) => ({ name: tier, value: tier }));
                return interaction.respond(choices);
        }
        if (!interaction.isCommand()) return;

        if (interaction.commandName === "verify" || interaction.commandName === "information") {
                return interaction.reply({
                        ...buildInformationPanel(),
                        ephemeral: interaction.commandName === "verify",
                });
        }

        if (!hasPermission(interaction.member)) {
                return interaction.reply({
                        content: "You do not have permission to use this command.",
                        ephemeral: true,
                });
        }

        const { commandName } = interaction;

        switch (commandName) {
                case "queue":
                        if (
                                !interaction.member.roles.cache.some(
                                        (r) => r.id === config.roleID,
                                )
                        ) {
                                return interaction.reply({
                                        content: "You do not have the required role.",
                                        ephemeral: true,
                                });
                        }

                        await clearNoTesterMessage();
                        if (queue) {
                                await deleteQueueMessage();
                        }

                        // Reset and initialize active testers with the queue creator
                        activeTesterIds = [interaction.user.id];

                        const button = new MessageActionRow().addComponents(
                                new MessageButton()
                                        .setCustomId("joinQueue")
                                        .setLabel("Join Queue")
                                        .setStyle("PRIMARY"),
                        );

                        const embed = new MessageEmbed().setTitle(
                                "Tester(s) Available!",
                        ).setDescription(`The queue updates every 10 seconds.

 **Queue**:

 **Active Testers**:
 ${activeTesterIds.map((testerId) => `<@${testerId}>`).join("\n")}`);

                        const channel = interaction.guild.channels.cache.get(
                                config.channelID,
                        );
                        if (!channel) {
                                return interaction.reply({
                                        content: "Channel not found.",
                                        ephemeral: true,
                                });
                        }

                        const waitlistRole = getWaitlistRole(interaction.guild);
                        queue = await channel.send({
                                content: waitlistRole ? `<@&${waitlistRole.id}>` : undefined,
                                embeds: [embed],
                                components: [button],
                        });
                        await interaction.reply({
                                content: "Queue created successfully.",
                                ephemeral: true,
                        });
                        break;
                case "jointester":
                        if (!queue) {
                                return interaction.reply({
                                        content: "There is no active queue.",
                                        ephemeral: true,
                                });
                        }

                        if (
                                !interaction.member.roles.cache.some(
                                        (r) => r.id === config.roleID,
                                )
                        ) {
                                return interaction.reply({
                                        content: "You do not have the required role.",
                                        ephemeral: true,
                                });
                        }

                        if (activeTesterIds.includes(interaction.user.id)) {
                                return interaction.reply({
                                        content: "You are already an active tester.",
                                        ephemeral: true,
                                });
                        }

                        activeTesterIds.push(interaction.user.id);

                        // update queue embed
                        const newEmbed = new MessageEmbed().setTitle(
                                "Tester(s) Available!",
                        )
                                .setDescription(`The queue updates every 10 seconds.

 **Queue**:
${usersInQueue.map((user, index) => `${index + 1}. <@${user}>`).join("\n")}

 **Active Testers**:
${activeTesterIds.map((testerId) => `<@${testerId}>`).join("\n")}`);

                        if (!await editQueueMessage(newEmbed)) {
                                return interaction.reply({
                                        content: "The queue message is no longer available. Please create a new queue.",
                                        ephemeral: true,
                                });
                        }

                        await interaction.reply({
                                content: "You have been added as an active tester.",
                                ephemeral: true,
                        });
                        break;
                case "leavetester": {
                        const testerIndex = activeTesterIds.indexOf(interaction.user.id);
                        if (testerIndex === -1) {
                                return interaction.reply({
                                        content: "You are not an active tester.",
                                        ephemeral: true,
                                });
                        }

                        activeTesterIds.splice(testerIndex, 1);
                        if (queue) {
                                const updatedEmbed = new MessageEmbed().setTitle(
                                        "Tester(s) Available!",
                                ).setDescription(`The queue updates every 10 seconds.

 **Queue**:
 ${usersInQueue.map((user, index) => `${index + 1}. <@${user}>`).join("\n")}

 **Active Testers**:
 ${activeTesterIds.map((testerId) => `<@${testerId}>`).join("\n")}`);

                                if (!await editQueueMessage(updatedEmbed)) {
                                        return interaction.reply({
                                                content: "The queue message is no longer available. Your active tester status was cleared.",
                                                ephemeral: true,
                                        });
                                }
                        }

                        await interaction.reply({
                                content: "You have left the active tester queue.",
                                ephemeral: true,
                        });
                        break;
                }
                case "next": {
                        if (!queue) {
                                return interaction.reply({
                                        content: "There is no active queue.",
                                        ephemeral: true,
                                });
                        }

                        if (usersInQueue.length === 0) {
                                return interaction.reply({
                                        content: "The queue is empty.",
                                        ephemeral: true,
                                });
                        }

                        // Remove the user synchronously before the first await so two
                        // rapid /next interactions cannot process the same queue entry.
                        const nextUserId = usersInQueue.shift();
                        let nextUser;
                        try {
                                nextUser = await interaction.guild.members.fetch(nextUserId);
                        } catch (e) {
                                return interaction.reply({
                                        content: "Could not find the next user. They may have left the server.",
                                        ephemeral: true,
                                });
                        }

                        const nextVerification = getVerification(nextUser.id);
                        if (!nextVerification) {
                                usersInQueue.unshift(nextUser.id);
                                return interaction.reply({
                                        content: `❌ <@${nextUser.id}> must use \`/verify\` before a ticket can be created.`,
                                        ephemeral: true,
                                });
                        }
                        const nextCooldownMessage = await enforceCooldownWaitlistLock(nextUser, nextVerification);
                        if (nextCooldownMessage) {
                                return interaction.reply({
                                        content: `❌ <@${nextUser.id}> cannot be tested while on cooldown.\n${nextCooldownMessage}`,
                                        ephemeral: true,
                                });
                        }

                        const ticketName = `ticket-${nextUser.user.username}`.toLowerCase();
                        const existingTickets = interaction.guild.channels.cache.filter(
                                (channel) =>
                                        channel.type === "GUILD_TEXT" &&
                                        channel.name.toLowerCase() === ticketName,
                        );
                        if (existingTickets.size > 0) {
                                return interaction.reply({
                                        content: `⚠️ <@${nextUser.id}> already has an open ticket: ${existingTickets.first()}.`,
                                        ephemeral: true,
                                });
                        }

                        const closeButton = new MessageActionRow().addComponents(
                                new MessageButton()
                                        .setCustomId("closeTicket")
                                        .setLabel("Close Ticket")
                                        .setStyle("DANGER")
                                        .setEmoji("🔒"),
                        );

                        const ticketChannel = await interaction.guild.channels.create(
                                `ticket-${nextUser.user.username}`,
                                {
                                        type: "GUILD_TEXT",
                                        parent: config.ticketCategoryID,
                                        reason: "Ticket created via /next command",
                                        permissionOverwrites: [
                                                {
                                                        id: interaction.guild.id,
                                                        deny: ["VIEW_CHANNEL"],
                                                },
                                                {
                                                        id: nextUser.id,
                                                        allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY"],
                                                },
                                                {
                                                        id: interaction.user.id,
                                                        allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY"],
                                                },
                                                {
                                                        id: config.roleID,
                                                        allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY"],
                                                },
                                        ],
                                },
                        );

                        const ticketEmbed = new MessageEmbed()
                                .setTitle("New Ticket")
                                .setColor("#0099ff")
                                .setDescription(`Welcome <@${nextUser.id}>!\nYour tester is <@${interaction.user.id}>.\n\nPlease fill out the following information:`)
                                .addFields(
                                        {
                                                name: "Minecraft Username:",
                                                value: `\`${nextVerification.minecraftUsername}\``,
                                                inline: false,
                                        },
                                        {
                                                name: "Region:",
                                                value: nextVerification.region,
                                                inline: true,
                                        },
                                        {
                                                name: "Server IP:",
                                                value: nextVerification.serverIp || "Not provided",
                                                inline: true,
                                        },
                                        { name: "Previous Tier:", value: "Tier before", inline: false },
                                );

                        await ticketChannel.send({
                                content: `<@${nextUser.id}>`,
                                embeds: [ticketEmbed],
                                components: [closeButton],
                        });

                        await interaction.reply({
                                content: `Ticket created for <@${nextUser.id}> in ${ticketChannel}.`,
                                ephemeral: true,
                        });
                        break;
                }
                case "stopqueue":
                        if (!queue) {
                                return interaction.reply({
                                        content: "No active queue to be deleted.",
                                        ephemeral: true,
                                });
                        }

                        const stoppedChannel = queue.channel;
                        usersInQueue = [];
                        activeTesterIds = [];
                        await deleteQueueMessage();

                        await clearNoTesterMessage();
                        noTesterMessage = await stoppedChannel.send({ embeds: [buildNoTesterEmbed()] });
                        await interaction.reply({
                                content: "Queue successfully deleted.",
                                ephemeral: true,
                        });
                        break;

                case "remove": {
                        if (!queue) {
                                return interaction.reply({
                                        content: "No active queue.",
                                        ephemeral: true,
                                });
                        }

                        const removeUser = interaction.options.getUser("user");
                        if (usersInQueue.includes(removeUser.id)) {
                                usersInQueue = usersInQueue.filter((u) => u !== removeUser.id);
                                await interaction.reply({
                                        content: `<@${removeUser.id}> has been removed from the queue.`,
                                        ephemeral: true,
                                });
                        } else {
                                await interaction.reply({
                                        content: "That user is not in the queue.",
                                        ephemeral: true,
                                });
                        }
                        break;
                }

                case "rank": {
                        const rankUserStr = interaction.options.getString("user", true);
                        const rankRoleStr = interaction.options.getString("rank", true);

                        const userIdMatch = rankUserStr.match(/\d+/);
                        const rankIdMatch = rankRoleStr.match(/\d+/);

                        if (!userIdMatch || !rankIdMatch) {
                                return interaction.reply({
                                        content: "Invalid user or role ID.",
                                        ephemeral: true,
                                });
                        }

                        const rankMember = interaction.guild.members.cache.get(userIdMatch[0]);
                        const rankRole = interaction.guild.roles.cache.find((r) => r.id === rankIdMatch[0]);

                        if (!rankMember || !rankRole) {
                                return interaction.reply({
                                        content: "Please mention a valid user and role.",
                                        ephemeral: true,
                                });
                        }

                        await rankMember.roles.add(rankRole);
                        await interaction.reply({
                                content: `Rank **${rankRole.name}** assigned to <@${rankMember.id}> successfully.`,
                                ephemeral: true,
                        });
                        break;
                }

                case "result": {
                        const resultUser = interaction.options.getUser("user");
                        const resultRegion = interaction.options.getString("region");
                        const resultUsername = interaction.options.getString("username").trim();
                        const resultPreviousRank = interaction.options.getString("previous_rank").toUpperCase();
                        const resultRankEarned = interaction.options.getString("rank_earned").toUpperCase();
                        const verification = getVerification(resultUser.id);

                        if (!VALID_REGIONS.includes(resultRegion.toUpperCase())) {
                                return interaction.reply({
                                        content: `❌ Invalid region. Use one of: ${VALID_REGIONS.join(", ")}`,
                                        ephemeral: true,
                                });
                        }
                        if (!verification) {
                                return interaction.reply({
                                        content: `❌ <@${resultUser.id}> must use \`/verify\` before a result can be submitted.`,
                                        ephemeral: true,
                                });
                        }
                        if (verification.discordId !== resultUser.id || verification.discordUsername !== resultUser.tag) {
                                return interaction.reply({
                                        content: "❌ The Discord username does not match the saved verification data.",
                                        ephemeral: true,
                                });
                        }
                        const cooldownMessage = getCooldownMessage(verification);
                        if (cooldownMessage) {
                                return interaction.reply({ content: cooldownMessage, ephemeral: true });
                        }
                        if (verification.minecraftUsername.toLowerCase() !== resultUsername.toLowerCase()) {
                                return interaction.reply({
                                        content: `❌ The verified Minecraft username for <@${resultUser.id}> is **${verification.minecraftUsername}**.`,
                                        ephemeral: true,
                                });
                        }
                        if (!RESULT_RANK_OPTIONS.includes(resultPreviousRank) || !RESULT_RANK_OPTIONS.includes(resultRankEarned)) {
                                return interaction.reply({
                                        content: `❌ Previous rank and rank earned must be one of: ${RESULT_RANK_OPTIONS.join(", ")}`,
                                        ephemeral: true,
                                });
                        }

                        const verifiedUsername = verification.minecraftUsername;
                        const avatarUrl = getAvatarUrl(verifiedUsername);

                        const resultEmbed = new MessageEmbed()
                                .setTitle(`${resultUser.username}'s Test Results 🏆`)
                                .setThumbnail(avatarUrl)
                                .setColor("#8B0000")
                                .addFields(
                                        { name: "Tester:", value: `<@${interaction.user.id}>`, inline: false },
                                        { name: "Region:", value: resultRegion, inline: false },
                                        { name: "Username:", value: verifiedUsername, inline: false },
                                        { name: "Previous Rank:", value: resultPreviousRank, inline: false },
                                        { name: "Rank Earned:", value: resultRankEarned, inline: false },
                                );

                        const resultMember = await interaction.guild.members.fetch(resultUser.id);
                        const roleUpdated = resultRankEarned === "N/A"
                                ? true
                                : await updateTierRole(resultMember, resultRankEarned);
                        const waitlistRoleUpdated = await removeWaitlistRole(resultMember);
                        setTestCooldown(resultUser.id);
                        await interaction.reply({
                                content: `<@${resultUser.id}>`,
                                embeds: [resultEmbed],
                        });
                        await addTrophyReaction(await interaction.fetchReply());
                        if (!roleUpdated) {
                                await interaction.followUp({
                                        content: `⚠️ Result posted, but I could not find a server role named **${resultRankEarned}**.`,
                                        ephemeral: true,
                                });
                        }
                        if (!waitlistRoleUpdated) {
                                await interaction.followUp({
                                        content: `⚠️ Result posted, but I could not find a role named **${config.waitlistRoleName || "Waitlist"}** to remove.`,
                                        ephemeral: true,
                                });
                        }
                        break;
                }

                case "refresh":
                        await interaction.deferReply({ ephemeral: true });
                        try {
                                await registerCommands(interaction.guild);
                                await interaction.editReply({ content: "Commands refreshed successfully!" });
                        } catch (error) {
                                console.error(error);
                                await interaction.editReply({ content: "Failed to refresh commands. Check console for errors." });
                        }
                        break;

                case "addplayer": {
                        await interaction.deferReply({ ephemeral: false });

                        const apUsername = interaction.options.getString("username", true).trim();
                        const apPoints   = interaction.options.getInteger("points",   true);
                        const apRegion   = (interaction.options.getString("region") || "AS").toUpperCase();

                        // Validate points range
                        if (apPoints < 0 || apPoints > 99999) {
                                return interaction.editReply({ content: "❌ Points must be between 0 and 99999." });
                        }

                        // Validate region
                        const validRegions = ["NA", "EU", "AS", "OC"];
                        if (!validRegions.includes(apRegion)) {
                                return interaction.editReply({ content: `❌ Invalid region. Use one of: ${validRegions.join(", ")}` });
                        }

                        // Verify username with Mojang
                        const mojangData = await verifyMojangUsername(apUsername);
                        if (!mojangData) {
                                return interaction.editReply({
                                        content: `❌ **${apUsername}** could not be verified with Mojang. Make sure the username is a valid Minecraft Java Edition account.`,
                                });
                        }

                        const verifiedName = mojangData.name; // use exact casing from Mojang
                        const uuid         = mojangData.id;
                        const { rankLabel, rankCls } = getRankFromPoints(apPoints);
                        const { tiers, catTiers }    = getDefaultTiers(rankLabel);

                        // Load, upsert, sort, save
                        const players = loadPlayers();
                        const existingIdx = players.findIndex(
                                p => p.name.toLowerCase() === verifiedName.toLowerCase()
                        );

                        const playerEntry = {
                                name:      verifiedName,
                                uuid:      uuid,
                                points:    apPoints,
                                region:    apRegion,
                                rankLabel: rankLabel,
                                rankCls:   rankCls,
                                tiers:     existingIdx >= 0 ? players[existingIdx].tiers    : tiers,
                                catTiers:  existingIdx >= 0 ? players[existingIdx].catTiers : catTiers,
                                addedBy:   interaction.user.tag,
                                addedAt:   existingIdx >= 0 ? players[existingIdx].addedAt : new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                        };

                        const isUpdate = existingIdx >= 0;
                        if (isUpdate) {
                                players[existingIdx] = playerEntry;
                        } else {
                                players.push(playerEntry);
                        }
                        savePlayers(players);

                        // Find new rank position
                        const sorted    = players.sort((a, b) => b.points - a.points);
                        const newRank   = sorted.findIndex(p => p.name.toLowerCase() === verifiedName.toLowerCase()) + 1;
                        const avatarUrl = getAvatarUrl(verifiedName);

                        const apEmbed = new MessageEmbed()
                                .setColor(isUpdate ? "#f59e0b" : "#4ade80")
                                .setTitle(isUpdate ? `✏️ Player Updated` : `✅ Player Added to Tierlist`)
                                .setThumbnail(avatarUrl)
                                .addFields(
                                        { name: "Minecraft Username", value: `\`${verifiedName}\``, inline: true },
                                        { name: "UUID",               value: `\`${uuid.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5")}\``, inline: true },
                                        { name: "\u200b",             value: "\u200b", inline: true },
                                        { name: "Points",  value: `**${apPoints}**`, inline: true },
                                        { name: "Rank",    value: `${rankLabel}`,    inline: true },
                                        { name: "Region",  value: apRegion,          inline: true },
                                        { name: "Leaderboard Position", value: `**#${newRank}** out of **${players.length}** players`, inline: false },
                                )
                                .setFooter({ text: `Added by ${interaction.user.tag} · Website updates every 30s` })
                                .setTimestamp();

                        return interaction.editReply({ embeds: [apEmbed] });
                }

                case "removeplayer": {
                        const rpUsername = interaction.options.getString("username", true).trim();
                        const players    = loadPlayers();
                        const idx        = players.findIndex(
                                p => p.name.toLowerCase() === rpUsername.toLowerCase()
                        );

                        if (idx === -1) {
                                return interaction.reply({
                                        content: `❌ **${rpUsername}** was not found on the tierlist.`,
                                        ephemeral: true,
                                });
                        }

                        const removed = players.splice(idx, 1)[0];
                        savePlayers(players);

                        return interaction.reply({
                                embeds: [
                                        new MessageEmbed()
                                                .setColor("#ef4444")
                                                .setTitle("🗑️ Player Removed")
                                                .setDescription(`**${removed.name}** has been removed from the tierlist.`)
                                                .addFields(
                                                        { name: "Points",    value: `${removed.points}`, inline: true },
                                                        { name: "Rank",      value: removed.rankLabel,   inline: true },
                                                        { name: "Region",    value: removed.region,      inline: true },
                                                )
                                                .setFooter({ text: `Removed by ${interaction.user.tag}` })
                                                .setTimestamp(),
                                ],
                                ephemeral: false,
                        });
                }

                case "listplayers": {
                        const players = loadPlayers();
                        if (!players.length) {
                                return interaction.reply({ content: "No players on the tierlist yet.", ephemeral: true });
                        }
                        const sorted  = players.sort((a, b) => b.points - a.points);
                        const listing = sorted
                                .slice(0, 25)
                                .map((p, i) => `**#${i+1}** ${p.name} — ${p.points} pts (${p.rankLabel}) [${p.region}]`)
                                .join("\n");

                        return interaction.reply({
                                embeds: [
                                        new MessageEmbed()
                                                .setColor("#4ade80")
                                                .setTitle(`📋 Tierlist — ${sorted.length} Players`)
                                                .setDescription(listing + (sorted.length > 25 ? `\n…and ${sorted.length - 25} more` : ""))
                                                .setFooter({ text: "Sorted by points (highest first)" }),
                                ],
                                ephemeral: true,
                        });
                }

                case "addtester": {
                        // Owner-only
                        if (!interaction.member.roles.cache.some((r) => r.id === config.ownerRoleID)) {
                                return interaction.reply({
                                        content: "❌ Only server owners can grant the Tester role.",
                                        ephemeral: true,
                                });
                        }

                        const atUser = interaction.options.getMember("user");
                        if (!atUser) {
                                return interaction.reply({ content: "❌ Could not find that member.", ephemeral: true });
                        }

                        const testerRole = interaction.guild.roles.cache.get(config.roleID);
                        if (!testerRole) {
                                return interaction.reply({ content: "❌ Tester role not found. Check `config.json → roleID`.", ephemeral: true });
                        }

                        if (atUser.roles.cache.has(config.roleID)) {
                                return interaction.reply({
                                        content: `ℹ️ <@${atUser.id}> already has the **${testerRole.name}** role.`,
                                        ephemeral: true,
                                });
                        }

                        await atUser.roles.add(testerRole);
                        return interaction.reply({
                                embeds: [
                                        new MessageEmbed()
                                                .setColor("#4ade80")
                                                .setTitle("✅ Tester Role Granted")
                                                .setDescription(`<@${atUser.id}> has been given the **${testerRole.name}** role and can now use all bot commands.`)
                                                .setFooter({ text: `Granted by ${interaction.user.tag}` })
                                                .setTimestamp(),
                                ],
                        });
                }

                case "removetester": {
                        // Owner-only
                        if (!interaction.member.roles.cache.some((r) => r.id === config.ownerRoleID)) {
                                return interaction.reply({
                                        content: "❌ Only server owners can remove the Tester role.",
                                        ephemeral: true,
                                });
                        }

                        const rtUser = interaction.options.getMember("user");
                        if (!rtUser) {
                                return interaction.reply({ content: "❌ Could not find that member.", ephemeral: true });
                        }

                        const testerRoleRt = interaction.guild.roles.cache.get(config.roleID);
                        if (!testerRoleRt) {
                                return interaction.reply({ content: "❌ Tester role not found. Check `config.json → roleID`.", ephemeral: true });
                        }

                        if (!rtUser.roles.cache.has(config.roleID)) {
                                return interaction.reply({
                                        content: `ℹ️ <@${rtUser.id}> does not have the **${testerRoleRt.name}** role.`,
                                        ephemeral: true,
                                });
                        }

                        await rtUser.roles.remove(testerRoleRt);
                        return interaction.reply({
                                embeds: [
                                        new MessageEmbed()
                                                .setColor("#ef4444")
                                                .setTitle("🚫 Tester Role Removed")
                                                .setDescription(`<@${rtUser.id}> has had the **${testerRoleRt.name}** role removed and can no longer use tester commands.`)
                                                .setFooter({ text: `Removed by ${interaction.user.tag}` })
                                                .setTimestamp(),
                                ],
                        });
                }
        }
});

bot.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;

        if (interaction.customId === "startVerification") {
                const modal = new Modal()
                        .setCustomId("verificationModal")
                        .setTitle("Verify Minecraft Account")
                        .addComponents(
                                new MessageActionRow().addComponents(
                                        new TextInputComponent()
                                                .setCustomId("minecraftUsername")
                                                .setLabel("What's your Minecraft username?")
                                                .setPlaceholder("Example: archiveAnung")
                                                .setStyle("SHORT")
                                                .setRequired(true)
                                                .setMaxLength(16),
                                ),
                                new MessageActionRow().addComponents(
                                        new TextInputComponent()
                                                .setCustomId("region")
                                                .setLabel("Region?")
                                                .setPlaceholder("Example: AS, AU, EU, NA")
                                                .setStyle("SHORT")
                                                .setRequired(true)
                                                .setMaxLength(2),
                                ),
                                new MessageActionRow().addComponents(
                                        new TextInputComponent()
                                                .setCustomId("serverIp")
                                                .setLabel("Server IP")
                                                .setPlaceholder("Example: cookiessmp")
                                                .setStyle("SHORT")
                                                .setRequired(true)
                                                .setMaxLength(100),
                                ),
                        );
                return interaction.showModal(modal);
        }

        if (interaction.customId === "enterWaitlist") {
                const verification = getVerification(interaction.user.id);
                if (!verification) {
                        return interaction.reply({
                                content: "❌ Click **Verify Account** first so your Minecraft username and region can be saved.",
                                ephemeral: true,
                        });
                }
                const cooldownMessage = await enforceCooldownWaitlistLock(interaction.member, verification);
                if (cooldownMessage) {
                        return interaction.reply({
                                content: `${cooldownMessage}\nYour Waitlist role was removed. You can enter the waitlist again after your cooldown ends.`,
                                ephemeral: true,
                        });
                }
                const waitlistRoleUpdated = await assignWaitlistRole(interaction.member);
                return interaction.reply({
                        content: waitlistRoleUpdated
                                ? "✅ You have been added to the Waitlist."
                                : `⚠️ Your account is registered, but I could not find a role named **${config.waitlistRoleName || "Waitlist"}**.`,
                        ephemeral: true,
                });
        }

        if (interaction.customId === "viewCooldown") {
                const verification = getVerification(interaction.user.id);
                if (!verification) {
                        return interaction.reply({
                                content: "You do not have a saved verification yet. Click **Verify Account** first.",
                                ephemeral: true,
                        });
                }
                const cooldownMessage = await enforceCooldownWaitlistLock(interaction.member, verification);
                return interaction.reply({
                        content: cooldownMessage
                                ? `${cooldownMessage}\nYour Waitlist role was removed. You cannot re-enter the waitlist until the cooldown ends.`
                                : "✅ You are not on cooldown and may enter the waitlist.",
                        ephemeral: true,
                });
        }

        if (interaction.customId === "closeTicket") {
                const member = interaction.member;
                const hasPermission =
                        member.roles.cache.some(
                                (r) => r.id === config.roleID,
                        ) || member.permissions.has("ADMINISTRATOR");

                if (!hasPermission) {
                        return interaction.reply({
                                content: "You do not have permission to close this ticket.",
                                ephemeral: true,
                        });
                }

                await interaction.reply({
                        content: "🔒 Closing ticket in 5 seconds...",
                        ephemeral: false,
                });

                setTimeout(async () => {
                        try {
                                await interaction.channel.delete();
                        } catch (error) {
                                console.error(
                                        "Error deleting ticket channel:",
                                        error,
                                );
                        }
                }, 5000);
        }

        if (interaction.customId === "joinQueue") {
                const verification = getVerification(interaction.user.id);
                if (!verification) {
                        return interaction.reply({
                                content: "❌ Please use `/verify` before joining the testing queue.",
                                ephemeral: true,
                        });
                }
                const cooldownMessage = await enforceCooldownWaitlistLock(interaction.member, verification);
                if (cooldownMessage) {
                        return interaction.reply({
                                content: `❌ You cannot join the testing queue while on cooldown.\n${cooldownMessage}\nYour Waitlist role was removed.`,
                                ephemeral: true,
                        });
                }
                if (usersInQueue.includes(interaction.user.id)) {
                        await interaction.reply({
                                content: "You are already in the queue.",
                                ephemeral: true,
                        });
                } else {
                        usersInQueue.push(interaction.user.id);
                        await interaction.reply({
                                content: "You have successfully joined the queue.",
                                ephemeral: true,
                        });
                }
        }
});

bot.on("interactionCreate", async (interaction) => {
        if (!interaction.isModalSubmit() || interaction.customId !== "verificationModal") return;

        const minecraftUsername = interaction.fields.getTextInputValue("minecraftUsername").trim();
        const region = interaction.fields.getTextInputValue("region").trim().toUpperCase();
        const serverIp = interaction.fields.getTextInputValue("serverIp").trim();
        if (!VALID_REGIONS.includes(region)) {
                return interaction.reply({
                        content: `❌ Invalid region. Use one of: ${VALID_REGIONS.join(", ")}`,
                        ephemeral: true,
                });
        }

        const verifications = loadVerifications();
        const previousVerification = verifications[interaction.user.id] || {};
        const cooldownMessage = await enforceCooldownWaitlistLock(interaction.member, previousVerification);
        verifications[interaction.user.id] = {
                ...previousVerification,
                discordId: interaction.user.id,
                discordUsername: interaction.user.tag,
                minecraftUsername,
                minecraftUuid: null,
                region,
                serverIp,
                verifiedAt: new Date().toISOString(),
        };
        saveVerifications(verifications);

        if (cooldownMessage) {
                return interaction.reply({
                        content: `✅ Updated **${minecraftUsername}** for <@${interaction.user.id}> in **${region}**.\n\n${cooldownMessage}\nYour Waitlist role was removed, and you cannot re-enter the waitlist until the cooldown ends.`,
                        ephemeral: true,
                });
        }

        const waitlistRoleUpdated = await assignWaitlistRole(interaction.member);
        return interaction.reply({
                content: waitlistRoleUpdated
                        ? `✅ Registered **${minecraftUsername}** for <@${interaction.user.id}> in **${region}**. The Waitlist role has been added.`
                        : `✅ Registered **${minecraftUsername}** for <@${interaction.user.id}> in **${region}**.\n⚠️ I could not find a role named **${config.waitlistRoleName || "Waitlist"}**.`,
                ephemeral: true,
        });
});

bot.on("messageCreate", async (message) => {
        if (message.author.bot) return;
        if (!message.content.startsWith(config.prefix)) return;

        const args = message.content
                .slice(config.prefix.length)
                .trim()
                .split(/ +/);
        const command = args.shift().toLowerCase();

        if (command === "help") {
                const embed = new MessageEmbed()
                        .setTitle("Bot Commands")
                        .setDescription(
                                `Prefix: \`${config.prefix}\`\n\nAvailable Commands:`,
                        )
                        .addFields(
                                { name: `${config.prefix}queue`, value: "Create a queue (Tester role required)", inline: false },
                                { name: `${config.prefix}stopqueue`, value: "Delete the queue (Tester/Admin)", inline: false },
                                { name: `${config.prefix}remove <user>`, value: "Remove a user from queue (Tester/Admin)", inline: false },
                                { name: `${config.prefix}rank <user> <role>`, value: "Assign a rank to a user (Tester/Admin)", inline: false },
                                { name: `${config.prefix}result <@user> <region> <username> <prev_rank> <rank_earned>`, value: "Send test results (Tester/Admin)", inline: false },
                                 { name: `${config.prefix}verify`, value: "Register your Minecraft username, region, and server IP", inline: false },
                                 { name: `${config.prefix}information`, value: "Show waitlist information and actions", inline: false },
                                { name: `${config.prefix}addplayer <username> <points> [region]`, value: "Add/update a player on the tierlist (Tester/Admin)", inline: false },
                                { name: `${config.prefix}removeplayer <username>`, value: "Remove a player from the tierlist (Tester/Admin)", inline: false },
                                { name: `${config.prefix}listplayers`, value: "List all tierlist players (Tester/Admin)", inline: false },
                                { name: `${config.prefix}addtester <@user>`, value: "Grant the Tester role to a member (Owner only)", inline: false },
                                { name: `${config.prefix}removetester <@user>`, value: "Remove the Tester role from a member (Owner only)", inline: false },
                                { name: `${config.prefix}refresh`, value: "Refresh slash commands (Admin only)", inline: false },
                                { name: `${config.prefix}help`, value: "Show this help message", inline: false },
                                { name: `${config.prefix}jointester`, value: "Join as an active tester (Tester role required)", inline: false },
                        )
                        .setColor("#0099ff");

                return message.reply({ embeds: [embed] });
        }

        if (command === "verify" || command === "information") {
                return message.reply({
                        ...buildInformationPanel(),
                });
        }

        if (command === "queue") {
                if (
                        !message.member.roles.cache.some(
                                (r) => r.id === config.roleID,
                        )
                ) {
                        return message.reply(
                                "You do not have the required role.",
                        );
                }

                await clearNoTesterMessage();
                if (queue) {
                        await deleteQueueMessage();
                }

                // Reset and initialize active testers with the queue creator
                activeTesterIds = [message.author.id];

                const button = new MessageActionRow().addComponents(
                        new MessageButton()
                                .setCustomId("joinQueue")
                                .setLabel("Join Queue")
                                .setStyle("PRIMARY"),
                );

                const embed = new MessageEmbed().setTitle(
                        "Tester(s) Available!",
                ).setDescription(`The queue updates every 10 seconds.

 **Queue**:

 **Active Testers**:
 ${activeTesterIds.map((testerId) => `<@${testerId}>`).join("\n")}`);

                const channel = message.guild.channels.cache.get(
                        config.channelID,
                );
                if (!channel) {
                        return message.reply("Channel not found.");
                }

                const waitlistRole = getWaitlistRole(message.guild);
                queue = await channel.send({
                        content: waitlistRole ? `<@&${waitlistRole.id}>` : undefined,
                        embeds: [embed],
                        components: [button],
                });
                return message.reply("Queue created successfully.");
        }

        if (command === "stopqueue") {
                if (
                        !message.member.roles.cache.some(
                                (r) => r.id === config.roleID,
                        ) &&
                        !message.member.permissions.has("ADMINISTRATOR")
                ) {
                        return message.reply(
                                "You do not have the required permissions.",
                        );
                }

                if (!queue) {
                        return message.reply("No active queue to be deleted.");
                }

                const stoppedChannel = queue.channel;
                usersInQueue = [];
                activeTesterIds = [];
                await deleteQueueMessage();

                await clearNoTesterMessage();
                noTesterMessage = await stoppedChannel.send({ embeds: [buildNoTesterEmbed()] });
                return message.reply("Queue successfully deleted.");
        }

        if (command === "remove") {
                if (
                        !message.member.roles.cache.some(
                                (r) => r.id === config.roleID,
                        ) &&
                        !message.member.permissions.has("ADMINISTRATOR")
                ) {
                        return message.reply(
                                "You do not have the required permissions.",
                        );
                }

                if (args.length === 0) {
                        return message.reply(
                                "Please provide a user to remove.",
                        );
                }

                let user = args[0];
                const userIdMatch = user.match(/\d+/);

                if (userIdMatch) {
                        user = userIdMatch[0];

                        if (usersInQueue.includes(user)) {
                                usersInQueue = usersInQueue.filter(
                                        (u) => u !== user,
                                );
                                return message.reply(
                                        "User successfully removed from the queue.",
                                );
                        } else {
                                return message.reply(
                                        "User is not in the queue.",
                                );
                        }
                } else {
                        return message.reply("Invalid user ID.");
                }
        }

        if (command === "rank") {
                if (
                        !message.member.roles.cache.some(
                                (r) => r.id === config.roleID,
                        ) &&
                        !message.member.permissions.has("ADMINISTRATOR")
                ) {
                        return message.reply(
                                "You do not have the required permissions.",
                        );
                }

                if (args.length < 2) {
                        return message.reply(
                                "Please provide a user and a role.",
                        );
                }

                let user = args[0];
                let rank = args[1];

                const userIdMatch = user.match(/\d+/);
                const rankIdMatch = rank.match(/\d+/);

                if (userIdMatch && rankIdMatch) {
                        user = message.guild.members.cache.get(userIdMatch[0]);
                        rank = message.guild.roles.cache.find(
                                (r) => r.id === rankIdMatch[0],
                        );

                        if (!user || !rank) {
                                return message.reply(
                                        "Please mention a valid user and role.",
                                );
                        }

                        user.roles.add(rank);
                        return message.reply("Rank assigned successfully.");
                } else {
                        return message.reply("Invalid user or role ID.");
                }
        }

        if (command === "result") {
                if (
                        !message.member.roles.cache.some(
                                (r) => r.id === config.roleID,
                        ) &&
                        !message.member.permissions.has("ADMINISTRATOR")
                ) {
                        return message.reply(
                                "You do not have the required permissions.",
                        );
                }

                if (args.length < 5) {
                        return message.reply(
                                `Usage: ${config.prefix}result <@user> <region> <username> <previous_rank> <rank_earned>`,
                        );
                }

                const userMatch = args[0].match(/\d+/);
                if (!userMatch) {
                        return message.reply("Please mention a valid user.");
                }

                const user = await message.guild.members.fetch(userMatch[0]);
                if (!user) {
                        return message.reply("User not found.");
                }

                const region = args[1];
                const username = args[2];
                 const previousRank = args[3].toUpperCase();
                 const rankEarned = args[4].toUpperCase();
                 const verification = getVerification(user.id);

                 if (!VALID_REGIONS.includes(region.toUpperCase())) {
                         return message.reply(`Invalid region. Use one of: ${VALID_REGIONS.join(", ")}`);
                 }
                 if (verification && (verification.discordId !== user.id || verification.discordUsername !== user.user.tag)) {
                         return message.reply("The Discord username does not match the saved verification data.");
                 }
                 if (!verification) {
                         return message.reply(`<@${user.id}> must use ${config.prefix}verify before a result can be submitted.`);
                 }
                 const cooldownMessage = getCooldownMessage(verification);
                 if (cooldownMessage) {
                         return message.reply(cooldownMessage);
                 }
                  if (!RESULT_RANK_OPTIONS.includes(previousRank) || !RESULT_RANK_OPTIONS.includes(rankEarned)) {
                          return message.reply(`Previous rank and rank earned must be one of: ${RESULT_RANK_OPTIONS.join(", ")}`);
                 }
                 if (verification.minecraftUsername.toLowerCase() !== username.toLowerCase()) {
                         return message.reply(`The verified Minecraft username for <@${user.id}> is **${verification.minecraftUsername}**.`);
                 }

                 const verifiedUsername = verification.minecraftUsername;
                 const avatarUrl = getAvatarUrl(verifiedUsername);

                const embed = new MessageEmbed()
                        .setTitle(`${user.user.username}'s Test Results 🏆`)
                        .setThumbnail(avatarUrl)
                        .setColor("#8B0000")
                        .addFields(
                                { name: "Tester:", value: `<@${message.author.id}>`, inline: false },
                                { name: "Region:", value: region, inline: false },
                                { name: "Username:", value: verifiedUsername, inline: false },
                                { name: "Previous Rank:", value: previousRank, inline: false },
                                { name: "Rank Earned:", value: rankEarned, inline: false },
                        );

                  const roleUpdated = rankEarned === "N/A"
                          ? true
                          : await updateTierRole(user, rankEarned);
                  const waitlistRoleUpdated = await removeWaitlistRole(user);
                  setTestCooldown(user.id);
                 if (!roleUpdated) {
                          const resultMessage = await message.channel.send({
                                 content: `<@${user.id}>`,
                                 embeds: [embed],
                          });
                          await addTrophyReaction(resultMessage);
                          return message.reply(`Result posted, but no server role named **${rankEarned}** was found.`);
                 }
                  if (!waitlistRoleUpdated) {
                          await message.channel.send(`⚠️ Result posted, but I could not find a role named **${config.waitlistRoleName || "Waitlist"}** to remove.`);
                  }
                const resultMessage = await message.channel.send({
                        content: `<@${user.id}>`,
                        embeds: [embed],
                });
                await addTrophyReaction(resultMessage);
                return resultMessage;
        }

        if (command === "addplayer") {
                if (!hasPermission(message.member)) {
                        return message.reply("You do not have the required permissions.");
                }
                if (args.length < 2) {
                        return message.reply(
                                `Usage: \`${config.prefix}addplayer <minecraft_username> <points> [region]\`\nExample: \`${config.prefix}addplayer Notch 250 EU\``
                        );
                }

                const apUsername = args[0].trim();
                const apPoints   = parseInt(args[1], 10);
                const apRegion   = (args[2] || "AS").toUpperCase();

                if (isNaN(apPoints) || apPoints < 0 || apPoints > 99999) {
                        return message.reply("❌ Points must be a number between 0 and 99999.");
                }
                const validRegions = ["NA", "EU", "AS", "OC"];
                if (!validRegions.includes(apRegion)) {
                        return message.reply(`❌ Invalid region. Use one of: ${validRegions.join(", ")}`);
                }

                const loadingMsg = await message.reply("🔍 Verifying Minecraft username with Mojang...");

                const mojangData = await verifyMojangUsername(apUsername);
                if (!mojangData) {
                        return loadingMsg.edit(
                                `❌ **${apUsername}** could not be verified with Mojang. Make sure it is a valid Minecraft Java Edition username.`
                        );
                }

                const verifiedName = mojangData.name;
                const uuid         = mojangData.id;
                const { rankLabel, rankCls } = getRankFromPoints(apPoints);
                const { tiers, catTiers }    = getDefaultTiers(rankLabel);

                const players    = loadPlayers();
                const existingIdx = players.findIndex(
                        p => p.name.toLowerCase() === verifiedName.toLowerCase()
                );
                const isUpdate   = existingIdx >= 0;

                const playerEntry = {
                        name:      verifiedName,
                        uuid:      uuid,
                        points:    apPoints,
                        region:    apRegion,
                        rankLabel: rankLabel,
                        rankCls:   rankCls,
                        tiers:     isUpdate ? players[existingIdx].tiers    : tiers,
                        catTiers:  isUpdate ? players[existingIdx].catTiers : catTiers,
                        addedBy:   message.author.tag,
                        addedAt:   isUpdate ? players[existingIdx].addedAt : new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                };

                if (isUpdate) { players[existingIdx] = playerEntry; }
                else          { players.push(playerEntry); }
                savePlayers(players);

                const newRank = players.sort((a, b) => b.points - a.points)
                        .findIndex(p => p.name.toLowerCase() === verifiedName.toLowerCase()) + 1;

                const avatarUrl = getAvatarUrl(verifiedName);
                const apEmbed   = new MessageEmbed()
                        .setColor(isUpdate ? "#f59e0b" : "#4ade80")
                        .setTitle(isUpdate ? `✏️ Player Updated` : `✅ Player Added to Tierlist`)
                        .setThumbnail(avatarUrl)
                        .addFields(
                                { name: "Username", value: `\`${verifiedName}\``, inline: true },
                                { name: "Points",   value: `**${apPoints}**`,     inline: true },
                                { name: "Rank",     value: rankLabel,             inline: true },
                                { name: "Region",   value: apRegion,              inline: true },
                                { name: "Position", value: `**#${newRank}** of ${players.length}`, inline: true },
                        )
                        .setFooter({ text: `Added by ${message.author.tag} · Website updates every 30s` })
                        .setTimestamp();

                return loadingMsg.edit({ content: null, embeds: [apEmbed] });
        }

        if (command === "removeplayer") {
                if (!hasPermission(message.member)) {
                        return message.reply("You do not have the required permissions.");
                }
                if (args.length === 0) {
                        return message.reply(`Usage: \`${config.prefix}removeplayer <minecraft_username>\``);
                }

                const rpUsername = args[0].trim();
                const players    = loadPlayers();
                const idx        = players.findIndex(
                        p => p.name.toLowerCase() === rpUsername.toLowerCase()
                );

                if (idx === -1) {
                        return message.reply(`❌ **${rpUsername}** was not found on the tierlist.`);
                }

                const removed = players.splice(idx, 1)[0];
                savePlayers(players);

                return message.reply({
                        embeds: [
                                new MessageEmbed()
                                        .setColor("#ef4444")
                                        .setTitle("🗑️ Player Removed")
                                        .setDescription(`**${removed.name}** has been removed from the tierlist.`)
                                        .addFields(
                                                { name: "Points", value: `${removed.points}`, inline: true },
                                                { name: "Rank",   value: removed.rankLabel,   inline: true },
                                                { name: "Region", value: removed.region,      inline: true },
                                        )
                                        .setFooter({ text: `Removed by ${message.author.tag}` })
                                        .setTimestamp(),
                        ],
                });
        }

        if (command === "listplayers") {
                if (!hasPermission(message.member)) {
                        return message.reply("You do not have the required permissions.");
                }
                const players = loadPlayers();
                if (!players.length) {
                        return message.reply("No players on the tierlist yet.");
                }
                const sorted  = players.sort((a, b) => b.points - a.points);
                const listing = sorted
                        .slice(0, 25)
                        .map((p, i) => `**#${i+1}** ${p.name} — ${p.points} pts (${p.rankLabel}) [${p.region}]`)
                        .join("\n");

                return message.reply({
                        embeds: [
                                new MessageEmbed()
                                        .setColor("#4ade80")
                                        .setTitle(`📋 Tierlist — ${sorted.length} Players`)
                                        .setDescription(listing + (sorted.length > 25 ? `\n…and ${sorted.length - 25} more` : ""))
                                        .setFooter({ text: "Sorted by points (highest first)" }),
                        ],
                });
        }

        if (command === "addtester") {
                if (!message.member.roles.cache.some((r) => r.id === config.ownerRoleID)) {
                        return message.reply("❌ Only server owners can grant the Tester role.");
                }
                if (args.length === 0) {
                        return message.reply(`Usage: \`${config.prefix}addtester <@user>\``);
                }

                const atMatch = args[0].match(/\d+/);
                if (!atMatch) {
                        return message.reply("❌ Please mention a valid user.");
                }

                let atMember;
                try { atMember = await message.guild.members.fetch(atMatch[0]); }
                catch (e) { return message.reply("❌ Could not find that member."); }

                const testerRole = message.guild.roles.cache.get(config.roleID);
                if (!testerRole) {
                        return message.reply("❌ Tester role not found. Check `config.json → roleID`.");
                }

                if (atMember.roles.cache.has(config.roleID)) {
                        return message.reply(`ℹ️ <@${atMember.id}> already has the **${testerRole.name}** role.`);
                }

                await atMember.roles.add(testerRole);
                return message.reply({
                        embeds: [
                                new MessageEmbed()
                                        .setColor("#4ade80")
                                        .setTitle("✅ Tester Role Granted")
                                        .setDescription(`<@${atMember.id}> has been given the **${testerRole.name}** role and can now use all bot commands.`)
                                        .setFooter({ text: `Granted by ${message.author.tag}` })
                                        .setTimestamp(),
                        ],
                });
        }

        if (command === "removetester") {
                if (!message.member.roles.cache.some((r) => r.id === config.ownerRoleID)) {
                        return message.reply("❌ Only server owners can remove the Tester role.");
                }
                if (args.length === 0) {
                        return message.reply(`Usage: \`${config.prefix}removetester <@user>\``);
                }

                const rtMatch = args[0].match(/\d+/);
                if (!rtMatch) {
                        return message.reply("❌ Please mention a valid user.");
                }

                let rtMember;
                try { rtMember = await message.guild.members.fetch(rtMatch[0]); }
                catch (e) { return message.reply("❌ Could not find that member."); }

                const testerRoleRt = message.guild.roles.cache.get(config.roleID);
                if (!testerRoleRt) {
                        return message.reply("❌ Tester role not found. Check `config.json → roleID`.");
                }

                if (!rtMember.roles.cache.has(config.roleID)) {
                        return message.reply(`ℹ️ <@${rtMember.id}> does not have the **${testerRoleRt.name}** role.`);
                }

                await rtMember.roles.remove(testerRoleRt);
                return message.reply({
                        embeds: [
                                new MessageEmbed()
                                        .setColor("#ef4444")
                                        .setTitle("🚫 Tester Role Removed")
                                        .setDescription(`<@${rtMember.id}> has had the **${testerRoleRt.name}** role removed and can no longer use tester commands.`)
                                        .setFooter({ text: `Removed by ${message.author.tag}` })
                                        .setTimestamp(),
                        ],
                });
        }

        if (command === "refresh") {
                if (!message.member.permissions.has("ADMINISTRATOR")) {
                        return message.reply(
                                "You do not have the required permissions.",
                        );
                }

                const msg = await message.reply("Refreshing commands...");

                try {
                        await registerCommands(message.guild);
                        return msg.edit("Commands refreshed successfully!");
                } catch (error) {
                        console.error(error);
                        return msg.edit(
                                "Failed to refresh commands. Check console for errors.",
                        );
                }
        }

        if (command === "jointester") {
                if (
                        !message.member.roles.cache.some(
                                (r) => r.id === config.roleID,
                        )
                ) {
                        return message.reply(
                                "You do not have the required role.",
                        );
                }

                if (!queue) {
                        return message.reply("There is no active queue.");
                }

                // Check if tester is already active
                if (activeTesterIds.includes(message.author.id)) {
                        return message.reply(
                                "You are already an active tester.",
                        );
                }

                // Add the new tester to the array
                activeTesterIds.push(message.author.id);

                // Update the queue embed
                const embed = new MessageEmbed().setTitle(
                        "Tester(s) Available!",
                ).setDescription(`The queue updates every 10 seconds.

**Queue**:
${usersInQueue.map((user, index) => `${index + 1}. <@${user}>`).join("\n")}

**Active Testers**:
${activeTesterIds.map((testerId) => `<@${testerId}>`).join("\n")}`);

                if (!await editQueueMessage(embed)) {
                        return message.reply("The queue message is no longer available. Please create a new queue.");
                }
                return message.reply(
                        "You have been added as an active tester.",
                );
        }
});

bot.login(config.token);
