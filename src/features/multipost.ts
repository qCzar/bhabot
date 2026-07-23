import * as Discord from "discord.js";
import NodeCache from "node-cache";
import { World } from "../world";
import { getSetting } from "../environment";
import { logger } from "../logger";

const log = logger("multipost");
const EXEMPT_ROLES_COLLECTION = "multipost-exempt-roles";

interface ExemptRoleDoc {
    roleId: string;
    addedBy: string;
    addedAt: Date;
}

interface CachedMessage {
    messageId: string;
    channelId: string;
    content: string;
    hasAttachment: boolean;
    attachmentSize?: number;
    attachmentName?: string;
    timestamp: number;
}

const exemptRoles = new Set<string>();

// 15 seconds TTL for tracking messages
const messageCache = new NodeCache({ stdTTL: 15, checkperiod: 5 });

export const initializeMultipost = async (world: World) => {
    try {
        const docs = await world.mongodb
            .collection<ExemptRoleDoc>(EXEMPT_ROLES_COLLECTION)
            .find({})
            .toArray();
            
        for (const doc of docs) {
            exemptRoles.add(doc.roleId);
        }
        log.info(`Loaded ${exemptRoles.size} exempt roles for multipost detection`);
    } catch (e) {
        log.error("Failed to load exempt roles for multipost", e);
    }
};

export const addExemptRole = async (roleId: string, world: World, addedBy: string) => {
    await world.mongodb.collection<ExemptRoleDoc>(EXEMPT_ROLES_COLLECTION).updateOne(
        { roleId },
        { $set: { roleId, addedBy, addedAt: new Date() } },
        { upsert: true }
    );
    exemptRoles.add(roleId);
};

export const removeExemptRole = async (roleId: string, world: World) => {
    await world.mongodb.collection<ExemptRoleDoc>(EXEMPT_ROLES_COLLECTION).deleteOne({ roleId });
    exemptRoles.delete(roleId);
};

export const getExemptRoles = () => Array.from(exemptRoles);

export const handleMessageCreate = async (message: Discord.Message, discord: Discord.Client) => {
    // Ignore bots
    if (message.author.bot) return;

    // Ignore direct messages or missing member
    if (!message.inGuild() || !message.member) return;

    // Ignore Admins or users with Manage Messages
    if (message.member.permissions.has(Discord.PermissionFlagsBits.Administrator) || 
        message.member.permissions.has(Discord.PermissionFlagsBits.ManageMessages)) {
        return;
    }

    // Ignore users with exempt roles
    if (message.member.roles.cache.hasAny(...exemptRoles)) {
        return;
    }

    const userId = message.author.id;
    const content = message.content.trim();
    const hasAttachment = message.attachments.size > 0;
    const firstAttachment = hasAttachment ? message.attachments.first() : null;
    const attachmentSize = firstAttachment?.size;
    const attachmentName = firstAttachment?.name ?? undefined;

    // Ignore empty messages that also have no attachments (shouldn't happen, but just in case)
    if (!content && !hasAttachment) return;

    // Retrieve existing posts from this user in the cache
    const recentPosts: CachedMessage[] = messageCache.get(userId) || [];

    // Check if the user has posted a matching message in a different channel recently
    for (const post of recentPosts) {
        if (post.channelId !== message.channelId) {
            let isMatch = false;
            if (post.content === content && post.hasAttachment === hasAttachment) {
                if (hasAttachment) {
                    if (post.attachmentSize === attachmentSize && post.attachmentName === attachmentName) {
                        isMatch = true;
                    }
                } else {
                    isMatch = true;
                }
            }

            if (isMatch) {
                // Violation detected
                const timeoutMs = 6 * 60 * 60 * 1000; // 6 hours
                try {
                    await message.member.timeout(timeoutMs, "Multipost detection");
                    log.info(`Timed out user ${userId} for multiposting in channels ${post.channelId} and ${message.channelId}`);

                    const adminChannel = await discord.channels.fetch(getSetting(message.guildId, "CHANNEL_BOT_ADMIN"));
                    if (adminChannel?.isTextBased()) {
                        await adminChannel.send({
                            content: `🚨 **Multipost Detected** 🚨\nUser <@${userId}> timed out for 6 hours.\nChannels: <#${post.channelId}> and <#${message.channelId}>\nMessage content:\n> ${content || "*(No text, attachment only)*"}`
                        });
                    }
                } catch (e) {
                    log.error(`Failed to timeout user ${userId} for multiposting`, e);
                }

                // Prevent multiple timeouts for the same spam burst
                messageCache.del(userId);
                return;
            }
        }
    }

    // No violation yet, save this message to cache
    recentPosts.push({
        messageId: message.id,
        channelId: message.channelId,
        content,
        hasAttachment,
        attachmentSize,
        attachmentName,
        timestamp: Date.now()
    });

    messageCache.set(userId, recentPosts);
};
