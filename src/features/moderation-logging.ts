import * as Discord from "discord.js";
import { getSetting } from "../environment";
import { logger } from "../logger";

const log = logger("moderation-logging");

export const maxThreadTitleLength = 100;

export const truncate = (value: string, maxLength: number): string =>
   value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;

export type UserLike = Discord.User | Discord.PartialUser | { id: string; username?: string; tag?: string };

export const makeThreadTitle = (
   user: UserLike,
   member?: Discord.GuildMember | null
): string => {
   const nickname = member?.nickname ?? member?.displayName ?? "no nickname";
   const username = ("username" in user && user.username) ? user.username : user.id;
   return truncate(`${user.id} - ${username} - ${nickname}`, maxThreadTitleLength);
};

export const parseUserIdFromThread = (channel: Discord.Channel | null | undefined): string | null => {
   if (!channel || !("name" in channel) || typeof channel.name !== "string") {
      return null;
   }
   const match = channel.name.match(/^(\d{17,20})/);
   return match ? match[1] : null;
};

export const getReportForum = async (guild: Discord.Guild): Promise<Discord.ForumChannel> => {
   const channelId = getSetting(guild.id, "CHANNEL_MEMBER_REPORTS");
   if (!channelId) {
      throw new Error("CHANNEL_MEMBER_REPORTS is not configured");
   }

   const channel = await guild.channels.fetch(channelId);
   if (!channel || channel.type !== Discord.ChannelType.GuildForum) {
      throw new Error(`Member reports channel '${channelId}' is not a forum channel`);
   }

   return channel as Discord.ForumChannel;
};

export const findMemberReportThread = async (
   forum: Discord.ForumChannel,
   userId: string
): Promise<Discord.ThreadChannel | null> => {
   const startsWithUserId = (thread: Discord.ThreadChannel) =>
      thread.name === userId || thread.name.startsWith(`${userId} - `) || thread.name.startsWith(`${userId}-`);

   const active = await forum.threads.fetchActive();
   const activeThread = active.threads.find(startsWithUserId);
   if (activeThread) return activeThread;

   const archivedPublic = await forum.threads.fetchArchived({ type: "public" });
   const archivedThread = archivedPublic.threads.find(startsWithUserId);
   if (archivedThread) return archivedThread;

   return null;
};

export const postToMemberReportThread = async (
   guild: Discord.Guild,
   user: UserLike,
   member: Discord.GuildMember | null | undefined,
   embed: Discord.APIEmbed,
   actionReason?: string
): Promise<Discord.ThreadChannel | null> => {
   try {
      const channelId = getSetting(guild.id, "CHANNEL_MEMBER_REPORTS");
      if (channelId) {
         try {
            const forum = await getReportForum(guild);
            const title = makeThreadTitle(user, member);
            const existingThread = await findMemberReportThread(forum, user.id);

            if (existingThread) {
               if (existingThread.archived) {
                  await existingThread.setArchived(false, actionReason ?? "New moderation event logged");
               }

               await existingThread.send({
                  embeds: [embed],
                  allowedMentions: { parse: [] }
               });

               return existingThread;
            }

            const newThread = await forum.threads.create({
               name: title,
               message: {
                  embeds: [embed],
                  allowedMentions: { parse: [] }
               },
               reason: actionReason ?? "New member report / moderation event thread created"
            });

            return newThread;
         } catch (forumErr) {
            log.warn(`Could not post to forum channel, attempting fallback to BOT_LOG / ADMIN channel`, { error: String(forumErr) });
         }
      }

      // Fallback: post directly to CHANNEL_BOT_LOG or CHANNEL_BOT_ADMIN
      const fallbackChannelId = getSetting(guild.id, "CHANNEL_BOT_LOG") || getSetting(guild.id, "CHANNEL_BOT_ADMIN");
      if (fallbackChannelId) {
         const channel = await guild.channels.fetch(fallbackChannelId);
         if (channel && channel.isTextBased() && "send" in channel) {
            await channel.send({
               embeds: [embed],
               allowedMentions: { parse: [] }
            });
         }
      }

      return null;
   } catch (e) {
      log.error(`Failed to post to member report thread for user ${user.id}`, e);
      return null;
   }
};

// Embed Builders

export const makeBanEmbed = (
   user: UserLike,
   executor: UserLike | null,
   reason: string | null,
   timestamp: Date = new Date()
): Discord.APIEmbed => ({
   title: "🔨 Member Banned",
   color: 0xed4245,
   fields: [
      { name: "User", value: `<@${user.id}> (${user.id})` },
      {
         name: "Moderator",
         value: executor
            ? `<@${executor.id}> (${executor.tag ?? executor.username ?? executor.id})`
            : "Unknown (Missing audit log entry or permissions)"
      },
      { name: "Reason", value: reason ? truncate(reason, 1024) : "No reason provided" }
   ],
   timestamp: timestamp.toISOString()
});

export const makeKickEmbed = (
   user: UserLike,
   executor: UserLike | null,
   reason: string | null,
   timestamp: Date = new Date()
): Discord.APIEmbed => ({
   title: "👢 Member Kicked",
   color: 0xe67e22,
   fields: [
      { name: "User", value: `<@${user.id}> (${user.id})` },
      {
         name: "Moderator",
         value: executor
            ? `<@${executor.id}> (${executor.tag ?? executor.username ?? executor.id})`
            : "Unknown (Missing audit log entry or permissions)"
      },
      { name: "Reason", value: reason ? truncate(reason, 1024) : "No reason provided" }
   ],
   timestamp: timestamp.toISOString()
});

export const makeMessageDeleteEmbed = (
   user: UserLike,
   executor: UserLike,
   channelId: string,
   content: string | null,
   attachments: string[] = [],
   timestamp: Date = new Date()
): Discord.APIEmbed => ({
   title: "🗑️ Message Deleted by Moderator",
   color: 0x95a5a6,
   fields: [
      { name: "Author", value: `<@${user.id}> (${user.id})` },
      { name: "Moderator", value: `<@${executor.id}> (${executor.tag ?? executor.username ?? executor.id})` },
      { name: "Channel", value: `<#${channelId}> (${channelId})` },
      {
         name: "Message Content",
         value: content && content.trim().length > 0 ? truncate(content, 1024) : "*[Message content was not cached]*"
      },
      ...(attachments.length > 0
         ? [{ name: "Attachments", value: truncate(attachments.join("\n"), 1024) }]
         : [])
   ],
   timestamp: timestamp.toISOString()
});

export const makeModNoteEmbed = (
   user: UserLike,
   moderator: UserLike,
   note: string,
   timestamp: Date = new Date()
): Discord.APIEmbed => ({
   title: "📝 Mod Note Logged",
   color: 0x3498db,
   fields: [
      { name: "User", value: `<@${user.id}> (${user.id})` },
      { name: "Moderator", value: `<@${moderator.id}> (${moderator.tag ?? moderator.username ?? moderator.id})` },
      { name: "Note", value: truncate(note, 1024) }
   ],
   timestamp: timestamp.toISOString()
});

// Event Handlers

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const handleGuildBanAdd = async (ban: Discord.GuildBan): Promise<void> => {
   const isEnabled = getSetting(ban.guild.id, "LOG_MEMBER_BANS");
   if (!isEnabled) return;

   try {
      await wait(600); // Give Discord audit log a moment to populate

      let executor: Discord.User | Discord.PartialUser | null = null;
      let reason: string | null = ban.reason ?? null;

      try {
         const auditLogs = await ban.guild.fetchAuditLogs({
            type: Discord.AuditLogEvent.MemberBanAdd,
            limit: 5
         });

         const entry = Array.from(auditLogs.entries.values()).find(
            e => e.target?.id === ban.user.id && Date.now() - e.createdTimestamp < 30_000
         );

         if (entry) {
            executor = entry.executor;
            if (entry.reason) reason = entry.reason;
         }
      } catch (err) {
         log.debug("Could not fetch audit logs for ban event (missing View Audit Log permission?)", { error: String(err) });
      }

      const embed = makeBanEmbed(ban.user, executor, reason);
      await postToMemberReportThread(ban.guild, ban.user, null, embed, `Ban logged: ${ban.user.tag}`);
   } catch (e) {
      log.error(`Failed to handle GuildBanAdd for user ${ban.user.id}`, e);
   }
};

export const handleGuildMemberRemove = async (
   member: Discord.GuildMember | Discord.PartialGuildMember
): Promise<void> => {
   const isEnabled = getSetting(member.guild.id, "LOG_MEMBER_KICKS");
   if (!isEnabled) return;

   try {
      await wait(600); // Give Discord audit log a moment to populate

      let isKick = false;
      let executor: Discord.User | Discord.PartialUser | null = null;
      let reason: string | null = null;

      try {
         const auditLogs = await member.guild.fetchAuditLogs({
            type: Discord.AuditLogEvent.MemberKick,
            limit: 5
         });

         const entry = Array.from(auditLogs.entries.values()).find(
            e => e.target?.id === member.id && Date.now() - e.createdTimestamp < 15_000
         );

         if (entry) {
            isKick = true;
            executor = entry.executor;
            reason = entry.reason ?? null;
         }
      } catch (err) {
         log.debug("Could not fetch audit logs for member remove event", { error: String(err) });
      }

      // If no matching kick audit log was found, this was a voluntary leave or prune
      if (!isKick) return;

      const user = member.user;
      const embed = makeKickEmbed(user, executor, reason);
      await postToMemberReportThread(
         member.guild,
         user,
         member instanceof Discord.GuildMember ? member : null,
         embed,
         `Kick logged: ${user.tag}`
      );
   } catch (e) {
      log.error(`Failed to handle GuildMemberRemove for member ${member.id}`, e);
   }
};

export const handleMessageDelete = async (
   message: Discord.Message | Discord.PartialMessage
): Promise<void> => {
   if (!message.guild) return;

   const isEnabled = getSetting(message.guild.id, "LOG_MEMBER_MESSAGE_DELETES");
   if (!isEnabled) return;

   try {
      await wait(600); // Give Discord audit log a moment to populate

      const auditLogs = await message.guild.fetchAuditLogs({
         type: Discord.AuditLogEvent.MessageDelete,
         limit: 5
      });

      const entry = Array.from(auditLogs.entries.values()).find(e => {
         const channelMatch = e.extra && "channel" in e.extra && e.extra.channel?.id === message.channelId;
         const isRecent = Date.now() - e.createdTimestamp < 15_000;
         const isAuthorMatch = message.author ? e.target?.id === message.author.id : true;
         return channelMatch && isRecent && isAuthorMatch;
      });

      if (!entry || !entry.executor) {
         // No audit log found -> author deleted their own message (self-delete)
         return;
      }

      // If executor is the author, it's a self-delete
      const targetUserId = message.author?.id ?? entry.target?.id;
      if (targetUserId && entry.executor.id === targetUserId) {
         return;
      }

      // If executor is the bot itself, ignore unless needed
      if (entry.executor.id === message.client.user?.id) {
         return;
      }

      const targetUser = message.author ?? (entry.target as Discord.User | null) ?? { id: targetUserId ?? "unknown", username: "Unknown User" };
      const attachments = message.attachments ? Array.from(message.attachments.values()).map(a => a.url || a.name) : [];
      const embed = makeMessageDeleteEmbed(
         targetUser,
         entry.executor,
         message.channelId,
         message.content ?? null,
         attachments
      );

      await postToMemberReportThread(
         message.guild,
         targetUser,
         message.member ?? null,
         embed,
         `Message delete logged: Author ${targetUser.id}, Moderator ${entry.executor.tag ?? entry.executor.username ?? entry.executor.id}`
      );
   } catch (e) {
      log.error(`Failed to handle MessageDelete for message ${message.id}`, e);
   }
};

// On-demand Audit Log History Fetcher

export const fetchUserAuditHistory = async (
   guild: Discord.Guild,
   userId: string
): Promise<Discord.APIEmbed> => {
   try {
      const auditLogs = await guild.fetchAuditLogs({ limit: 100 });
      const entries = Array.from(auditLogs.entries.values()).filter(e => {
         if (e.targetId === userId) return true;
         if (e.target && "id" in e.target && e.target.id === userId) return true;
         return false;
      });

      const lines: string[] = [];

      for (const entry of Array.from(entries.values()).slice(0, 15)) {
         const timestampStr = `<t:${Math.floor(entry.createdTimestamp / 1000)}:R>`;
         const executorStr = entry.executor ? `<@${entry.executor.id}>` : "Unknown Mod";
         const reasonStr = entry.reason ? ` - *${truncate(entry.reason, 80)}*` : "";

         switch (entry.action) {
            case Discord.AuditLogEvent.MemberBanAdd:
               lines.push(`🔨 **Banned** by ${executorStr} ${timestampStr}${reasonStr}`);
               break;
            case Discord.AuditLogEvent.MemberBanRemove:
               lines.push(`🔓 **Unbanned** by ${executorStr} ${timestampStr}${reasonStr}`);
               break;
            case Discord.AuditLogEvent.MemberKick:
               lines.push(`👢 **Kicked** by ${executorStr} ${timestampStr}${reasonStr}`);
               break;
            case Discord.AuditLogEvent.MessageDelete: {
               const channelId = entry.extra && "channel" in entry.extra ? (entry.extra.channel as any)?.id : null;
               const channelStr = channelId ? ` in <#${channelId}>` : "";
               const count = entry.extra && "count" in entry.extra ? (entry.extra.count as number) : 1;
               lines.push(`🗑️ **Message(s) deleted** (${count})${channelStr} by ${executorStr} ${timestampStr}${reasonStr}`);
               break;
            }
            case Discord.AuditLogEvent.MemberUpdate: {
               const changes = entry.changes ? entry.changes.map(c => c.key).join(", ") : "";
               lines.push(`✏️ **Member updated** (${changes || "details updated"}) by ${executorStr} ${timestampStr}${reasonStr}`);
               break;
            }
            case Discord.AuditLogEvent.MemberRoleUpdate:
               lines.push(`🏷️ **Roles updated** by ${executorStr} ${timestampStr}${reasonStr}`);
               break;
            default:
               lines.push(`⚙️ **Action (${entry.action})** by ${executorStr} ${timestampStr}${reasonStr}`);
               break;
         }
      }

      if (lines.length === 0) {
         return {
            title: `📋 Audit Log History for <@${userId}>`,
            color: 0x3498db,
            description: `No moderation audit log actions found for <@${userId}> (${userId}) in recent server audit history.\n\n*Note: Voluntary member departures (clicking 'Leave Server') are not recorded in Discord audit logs. If this member left, it was a voluntary leave.*`,
            timestamp: new Date().toISOString()
         };
      }

      return {
         title: `📋 Audit Log History for <@${userId}>`,
         color: 0x3498db,
         description: lines.join("\n\n"),
         footer: { text: `Total matching entries shown: ${lines.length}` },
         timestamp: new Date().toISOString()
      };
   } catch (err) {
      log.error(`Failed to fetch user audit history for ${userId}`, err);
      return {
         title: `⚠️ Audit Log Lookup Failed`,
         color: 0xed4245,
         description: `Could not fetch audit log entries for <@${userId}>. Please check if the bot has the **View Audit Log** permission.`,
         timestamp: new Date().toISOString()
      };
   }
};
