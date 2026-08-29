import * as Discord from "discord.js";
import { getSetting } from "../environment";
import { logger } from "../logger";
import { sendAdminAlert } from "./settings-validator";

const log = logger("onboarding");

export const handleOnboardingMemberAdd = async (member: Discord.GuildMember) => {
    if (member.user.bot) return;
    const guildId = member.guild.id;

    try {
        const channelId = getSetting(guildId, "ONBOARDING_CHANNEL_ID");
        if (!channelId) return;

        const roleId = getSetting(guildId, "ONBOARDING_ROLE_ID");
        if (!roleId) {
            await sendAdminAlert(
                member.guild,
                "Onboarding Incomplete: Missing Role ID",
                "A new member joined and was prompted to introduce themselves, but `ONBOARDING_ROLE_ID` is not configured. Members will not receive a role after completing introduction.",
                { Member: `<@${member.id}> (${member.user.tag})`, "Onboarding Channel": `<#${channelId}>` }
            );
        }

        const channel = await member.guild.channels.fetch(channelId);
        if (channel?.isTextBased()) {
            const minLength = getSetting(guildId, "ONBOARDING_MIN_LENGTH");
            await channel.send(`Welcome to the server, <@${member.id}>! Please introduce yourself here before you get full access to the rest of the server. Tell us about your hobbies, how long you've been in Rochester, or where you moved from! (Minimum ${minLength} characters)`);
        }
    } catch (e) {
        log.error("Failed to greet new member in onboarding channel", e);
    }
};

const processMessage = async (message: Discord.Message | Discord.PartialMessage) => {
    if (message.author?.bot) return;
    if (!message.inGuild() || !message.member) return;
    const guildId = message.guildId;

    const onboardingChannelId = getSetting(guildId, "ONBOARDING_CHANNEL_ID");
    if (!onboardingChannelId || message.channelId !== onboardingChannelId) return;

    const content = message.content || "";
    const minLength = getSetting(guildId, "ONBOARDING_MIN_LENGTH");

    if (content.length >= minLength) {
        try {
            const roleId = getSetting(guildId, "ONBOARDING_ROLE_ID");
            if (!roleId) {
                log.warn(`Onboarding message met length threshold, but ONBOARDING_ROLE_ID is not configured in guild ${guildId}`);
                if (message.guild) {
                    await sendAdminAlert(
                        message.guild,
                        "Onboarding Verification Failed: Missing Role ID",
                        `A user completed their introduction in <#${onboardingChannelId}>, but no role could be granted because \`ONBOARDING_ROLE_ID\` is not configured.`,
                        { User: `<@${message.author.id}> (${message.author.tag})`, "Message Length": `${content.length} chars` }
                    );
                }
                return;
            }

            // Check if member already has the role
            if (message.member.roles.cache.has(roleId)) {
               return;
            }

            // Assign role
            await message.member.roles.add(roleId);
            log.info(`Assigned onboarding role to ${message.author.tag}`);

            // Create thread on the message
            if ('startThread' in message && typeof message.startThread === 'function') {
                await message.startThread({
                    name: `Welcome ${message.author.username}!`,
                    autoArchiveDuration: 1440,
                    reason: "User completed onboarding introduction"
                });
            }
        } catch (e) {
            log.error(`Failed to process valid onboarding message for ${message.author?.tag}`, e);
            if (message.guild) {
                await sendAdminAlert(
                    message.guild,
                    "Onboarding Role Assignment Failed",
                    `Failed to assign role to <@${message.author.id}>: ${e instanceof Error ? e.message : 'Unknown error'}. Check bot role hierarchy and Manage Roles permissions.`,
                    { User: `<@${message.author.id}> (${message.author.tag})` }
                );
            }
        }
    }
};

export const handleOnboardingMessageCreate = async (message: Discord.Message) => {
    await processMessage(message);
};

export const handleOnboardingMessageUpdate = async (oldMessage: Discord.Message | Discord.PartialMessage, newMessage: Discord.Message | Discord.PartialMessage) => {
    if (newMessage.partial) {
        try {
            newMessage = await newMessage.fetch();
        } catch (e) {
            log.error("Failed to fetch partial message in onboarding update", e);
            return;
        }
    }
    await processMessage(newMessage);
};
