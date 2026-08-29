import * as Discord from "discord.js";
import { getSetting, getRawSetting, DynamicKey, dynamicKeys, env } from "../environment";
import { logger } from "../logger";

const log = logger("settings-validator");

export interface ValidationItem {
   key?: DynamicKey | string;
   status: "healthy" | "fallback" | "warning" | "error";
   symbol: "✅" | "🔁" | "⚠️" | "❌";
   title: string;
   message: string;
}

export interface ValidationReport {
   guildId: string | null;
   timestamp: string;
   isHealthy: boolean;
   summary: {
      healthy: number;
      fallback: number;
      warning: number;
      error: number;
   };
   items: ValidationItem[];
}

// In-memory deduplication/rate-limiting cache for admin alerts (5 min window)
const alertCache = new Map<string, number>();
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

export const isValidTimezone = (tz: string): boolean => {
   if (!tz) return false;
   try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz }).format();
      return true;
   } catch (_) {
      return false;
   }
};

/**
 * Checks dependencies between setting variables for a guild (or global scope).
 */
export const checkSettingDependencies = (guildId?: string | null): ValidationItem[] => {
   const items: ValidationItem[] = [];

   const rawBotAdmin = getRawSetting(guildId, "CHANNEL_BOT_ADMIN");
   const rawAdmin = getRawSetting(guildId, "CHANNEL_ADMIN");
   const resolvedBotAdmin = getSetting(guildId, "CHANNEL_BOT_ADMIN");
   const resolvedAdmin = getSetting(guildId, "CHANNEL_ADMIN");

   // Admin Channels Validation
   if (!rawBotAdmin && !rawAdmin) {
      items.push({
         key: "CHANNEL_BOT_ADMIN",
         status: "error",
         symbol: "❌",
         title: "Admin Channels Not Configured",
         message: "Neither CHANNEL_BOT_ADMIN nor CHANNEL_ADMIN is set. The bot cannot send alerts or execute admin commands."
      });
   } else {
      if (!rawBotAdmin && rawAdmin) {
         items.push({
            key: "CHANNEL_BOT_ADMIN",
            status: "fallback",
            symbol: "🔁",
            title: "CHANNEL_BOT_ADMIN Fallback Active",
            message: `CHANNEL_BOT_ADMIN is unset — automatically falling back to CHANNEL_ADMIN (\`${rawAdmin}\`).`
         });
      }
      if (!rawAdmin && rawBotAdmin) {
         items.push({
            key: "CHANNEL_ADMIN",
            status: "fallback",
            symbol: "🔁",
            title: "CHANNEL_ADMIN Fallback Active",
            message: `CHANNEL_ADMIN is unset — automatically falling back to CHANNEL_BOT_ADMIN (\`${rawBotAdmin}\`).`
         });
      }
      if (rawBotAdmin && rawAdmin) {
         items.push({
            key: "CHANNEL_ADMIN",
            status: "healthy",
            symbol: "✅",
            title: "Admin Channels Configured",
            message: "Both CHANNEL_ADMIN and CHANNEL_BOT_ADMIN are uniquely configured."
         });
      }
   }

   // Onboarding Validation
   const onboardingChannel = getSetting(guildId, "ONBOARDING_CHANNEL_ID");
   const onboardingRole = getSetting(guildId, "ONBOARDING_ROLE_ID");

   if (onboardingChannel && !onboardingRole) {
      items.push({
         key: "ONBOARDING_CHANNEL_ID",
         status: "error",
         symbol: "❌",
         title: "Missing Onboarding Role",
         message: "ONBOARDING_CHANNEL_ID is configured, but ONBOARDING_ROLE_ID is missing. Members will not receive a role when introducing themselves."
      });
   } else if (!onboardingChannel && onboardingRole) {
      items.push({
         key: "ONBOARDING_ROLE_ID",
         status: "warning",
         symbol: "⚠️",
         title: "Unlinked Onboarding Role",
         message: "ONBOARDING_ROLE_ID is configured, but ONBOARDING_CHANNEL_ID is unset. Onboarding verification cannot trigger."
      });
   } else if (onboardingChannel && onboardingRole) {
      items.push({
         key: "ONBOARDING_CHANNEL_ID",
         status: "healthy",
         symbol: "✅",
         title: "Onboarding Configuration Linked",
         message: "Both ONBOARDING_CHANNEL_ID and ONBOARDING_ROLE_ID are linked."
      });
   }

   // Meetups & Directory Validation
   const meetupChannel = getSetting(guildId, "CHANNEL_MEETUPS");
   const meetupDir = getSetting(guildId, "CHANNEL_MEETUPS_DIR");
   const meetupTz = getSetting(guildId, "MEETUP_TIMEZONE");

   if (meetupChannel && !meetupDir) {
      items.push({
         key: "CHANNEL_MEETUPS",
         status: "warning",
         symbol: "⚠️",
         title: "Missing Meetup Directory",
         message: "CHANNEL_MEETUPS is configured, but CHANNEL_MEETUPS_DIR is unset. Meetup directory sync is inactive."
      });
   } else if (!meetupChannel && meetupDir) {
      items.push({
         key: "CHANNEL_MEETUPS_DIR",
         status: "warning",
         symbol: "⚠️",
         title: "Missing Meetup Creation Channel",
         message: "CHANNEL_MEETUPS_DIR is configured, but CHANNEL_MEETUPS is unset. There is no channel to host/create meetups."
      });
   } else if (meetupChannel && meetupDir) {
      items.push({
         key: "CHANNEL_MEETUPS",
         status: "healthy",
         symbol: "✅",
         title: "Meetup Channels Linked",
         message: "Both CHANNEL_MEETUPS and CHANNEL_MEETUPS_DIR are configured."
      });
   }

   if (meetupTz) {
      if (!isValidTimezone(meetupTz)) {
         items.push({
            key: "MEETUP_TIMEZONE",
            status: "error",
            symbol: "❌",
            title: "Invalid Meetup Timezone",
            message: `"${meetupTz}" is not a valid IANA timezone (e.g. "America/Chicago", "America/New_York").`
         });
      }
   }

   // Moderation Logging & Reports Validation
   const memberReports = getSetting(guildId, "CHANNEL_MEMBER_REPORTS");
   const botLog = getSetting(guildId, "CHANNEL_BOT_LOG");
   const logBans = getSetting(guildId, "LOG_MEMBER_BANS");
   const logKicks = getSetting(guildId, "LOG_MEMBER_KICKS");
   const logDeletes = getSetting(guildId, "LOG_MEMBER_MESSAGE_DELETES");
   const modLoggingEnabled = logBans || logKicks || logDeletes;

   if (modLoggingEnabled && !memberReports && !botLog && !resolvedBotAdmin) {
      items.push({
         key: "LOG_MEMBER_BANS",
         status: "error",
         symbol: "❌",
         title: "Moderation Logging Enabled Without Log Channel",
         message: "Moderation logging (bans/kicks/deletes) is enabled, but no log channel (CHANNEL_MEMBER_REPORTS, CHANNEL_BOT_LOG, or Admin channel) is configured."
      });
   } else if (!memberReports && botLog) {
      items.push({
         key: "CHANNEL_MEMBER_REPORTS",
         status: "fallback",
         symbol: "🔁",
         title: "Member Reports Forum Fallback Active",
         message: "CHANNEL_MEMBER_REPORTS forum is unset — reports and mod notes will route directly to CHANNEL_BOT_LOG."
      });
   } else if (memberReports) {
      items.push({
         key: "CHANNEL_MEMBER_REPORTS",
         status: "healthy",
         symbol: "✅",
         title: "Member Reports Forum Configured",
         message: "CHANNEL_MEMBER_REPORTS is configured for user case file dossiers."
      });
   }

   // Reddit Webhook Validation
   const redditSecret = getSetting(guildId, "REDDIT_SECRET");
   const shitpostChannel = getSetting(guildId, "CHANNEL_SHITPOST");

   if (redditSecret && !shitpostChannel) {
      items.push({
         key: "REDDIT_SECRET",
         status: "error",
         symbol: "❌",
         title: "Missing Shitpost Channel for Reddit Webhook",
         message: "REDDIT_SECRET is configured, but CHANNEL_SHITPOST is not set. Incoming webhooks will fail."
      });
   }

   return items;
};

/**
 * Validates Discord channel and role links against a live Discord guild.
 */
export const checkDiscordPermissions = async (guild: Discord.Guild): Promise<ValidationItem[]> => {
   const items: ValidationItem[] = [];
   const me = guild.members.me || await guild.members.fetchMe().catch(() => null);

   if (!me) {
      items.push({
         status: "error",
         symbol: "❌",
         title: "Bot Guild Member Not Found",
         message: "Unable to fetch the bot's member object in this server to verify permissions."
      });
      return items;
   }

   const channelSettings: { key: DynamicKey; name: string; forum?: boolean; threads?: boolean }[] = [
      { key: "CHANNEL_ADMIN", name: "Admin Channel" },
      { key: "CHANNEL_BOT_ADMIN", name: "Bot Admin Channel" },
      { key: "CHANNEL_MEETUPS", name: "Meetups Channel", threads: true },
      { key: "CHANNEL_MEETUPS_DIR", name: "Meetups Directory Channel" },
      { key: "CHANNEL_BOT_LOG", name: "Bot Log Channel" },
      { key: "CHANNEL_MEMBER_REPORTS", name: "Member Reports Forum", forum: true, threads: true },
      { key: "CHANNEL_SHITPOST", name: "Shitpost Channel" },
      { key: "CHANNEL_THROWDOWN", name: "Throwdown Channel" },
      { key: "ONBOARDING_CHANNEL_ID", name: "Onboarding Channel", threads: true }
   ];

   for (const setting of channelSettings) {
      const channelId = getSetting(guild.id, setting.key);
      if (!channelId) continue;

      try {
         const channel = await guild.channels.fetch(channelId).catch(() => null);

         if (!channel) {
            items.push({
               key: setting.key,
               status: "error",
               symbol: "❌",
               title: `${setting.name} Not Found`,
               message: `Configured channel ID \`${channelId}\` does not exist in this server.`
            });
            continue;
         }

         if (setting.forum) {
            if (channel.type !== Discord.ChannelType.GuildForum) {
               items.push({
                  key: setting.key,
                  status: "error",
                  symbol: "❌",
                  title: `${setting.name} Channel Type Mismatch`,
                  message: `<#${channelId}> is not a Forum channel. CHANNEL_MEMBER_REPORTS requires a Forum Channel.`
               });
               continue;
            }
         } else if (!channel.isTextBased()) {
            items.push({
               key: setting.key,
               status: "error",
               symbol: "❌",
               title: `${setting.name} Channel Type Mismatch`,
               message: `<#${channelId}> is not a text channel.`
            });
            continue;
         }

         // Check Permissions
         const permissions = (channel as Discord.GuildChannel).permissionsFor(me);
         if (!permissions) continue;

         const missingPerms: string[] = [];
         if (!permissions.has(Discord.PermissionFlagsBits.ViewChannel)) missingPerms.push("View Channel");
         if (!permissions.has(Discord.PermissionFlagsBits.SendMessages)) missingPerms.push("Send Messages");
         if (!permissions.has(Discord.PermissionFlagsBits.EmbedLinks)) missingPerms.push("Embed Links");

         if (setting.threads) {
            if (!permissions.has(Discord.PermissionFlagsBits.CreatePublicThreads) && !permissions.has(Discord.PermissionFlagsBits.SendMessagesInThreads)) {
               missingPerms.push("Create/Send in Threads");
            }
         }

         if (missingPerms.length > 0) {
            items.push({
               key: setting.key,
               status: "error",
               symbol: "❌",
               title: `Missing Permissions in ${setting.name}`,
               message: `Bot is missing permissions in <#${channelId}>: ${missingPerms.join(", ")}.`
            });
         } else {
            items.push({
               key: setting.key,
               status: "healthy",
               symbol: "✅",
               title: `${setting.name} Verified`,
               message: `<#${channelId}> is accessible with all required permissions.`
            });
         }
      } catch (e) {
         items.push({
            key: setting.key,
            status: "error",
            symbol: "❌",
            title: `Error Checking ${setting.name}`,
            message: `Failed to fetch or inspect channel \`${channelId}\`: ${e instanceof Error ? e.message : 'Unknown error'}`
         });
      }
   }

   // Onboarding Role Verification
   const onboardingRoleId = getSetting(guild.id, "ONBOARDING_ROLE_ID");
   if (onboardingRoleId) {
      try {
         const role = await guild.roles.fetch(onboardingRoleId).catch(() => null);
         if (!role) {
            items.push({
               key: "ONBOARDING_ROLE_ID",
               status: "error",
               symbol: "❌",
               title: "Onboarding Role Not Found",
               message: `Configured role ID \`${onboardingRoleId}\` does not exist in this server.`
            });
         } else {
            if (!me.permissions.has(Discord.PermissionFlagsBits.ManageRoles)) {
               items.push({
                  key: "ONBOARDING_ROLE_ID",
                  status: "error",
                  symbol: "❌",
                  title: "Bot Missing Manage Roles Permission",
                  message: `The bot needs the "Manage Roles" permission to assign <@&${onboardingRoleId}> to new members.`
               });
            } else if (me.roles.highest.comparePositionTo(role) <= 0) {
               items.push({
                  key: "ONBOARDING_ROLE_ID",
                  status: "error",
                  symbol: "❌",
                  title: "Role Hierarchy Issue",
                  message: `The onboarding role <@&${onboardingRoleId}> is higher than or equal to the bot's highest role (${me.roles.highest.name}). The bot cannot assign this role.`
               });
            } else {
               items.push({
                  key: "ONBOARDING_ROLE_ID",
                  status: "healthy",
                  symbol: "✅",
                  title: "Onboarding Role Verified",
                  message: `Role <@&${onboardingRoleId}> is valid and assignable by the bot.`
               });
            }
         }
      } catch (e) {
         items.push({
            key: "ONBOARDING_ROLE_ID",
            status: "error",
            symbol: "❌",
            title: "Error Checking Onboarding Role",
            message: `Failed to fetch role \`${onboardingRoleId}\`: ${e instanceof Error ? e.message : 'Unknown error'}`
         });
      }
   }

   return items;
};

/**
 * Full guild settings audit combining dependency checks and Discord API verification.
 */
export const validateGuildSettings = async (
   guild: Discord.Guild | null,
   guildId?: string | null
): Promise<ValidationReport> => {
   const targetGuildId = guild?.id ?? guildId ?? null;
   const dependencyItems = checkSettingDependencies(targetGuildId);
   let discordItems: ValidationItem[] = [];

   if (guild) {
      discordItems = await checkDiscordPermissions(guild);
   }

   // Merge and deduplicate by key & title
   const allItems = [...dependencyItems, ...discordItems];
   const summary = {
      healthy: allItems.filter(i => i.status === "healthy").length,
      fallback: allItems.filter(i => i.status === "fallback").length,
      warning: allItems.filter(i => i.status === "warning").length,
      error: allItems.filter(i => i.status === "error").length
   };

   return {
      guildId: targetGuildId,
      timestamp: new Date().toISOString(),
      isHealthy: summary.error === 0,
      summary,
      items: allItems
   };
};

/**
 * Sends a throttled alert embed to the server's admin channel.
 */
export const sendAdminAlert = async (
   guild: Discord.Guild,
   title: string,
   description: string,
   details?: Record<string, string>
): Promise<boolean> => {
   const cacheKey = `${guild.id}:${title}`;
   const lastSent = alertCache.get(cacheKey);
   const now = Date.now();

   if (lastSent && now - lastSent < ALERT_COOLDOWN_MS) {
      log.debug(`Throttling admin alert "${title}" for guild ${guild.id}`);
      return false;
   }

   alertCache.set(cacheKey, now);

   const adminChannelId = getSetting(guild.id, "CHANNEL_BOT_ADMIN") || getSetting(guild.id, "CHANNEL_ADMIN");
   if (!adminChannelId) {
      log.warn(`Cannot send admin alert: no admin channel configured in guild ${guild.id}`);
      return false;
   }

   try {
      const channel = await guild.channels.fetch(adminChannelId).catch(() => null);
      if (!channel || !channel.isTextBased() || !("send" in channel)) {
         log.warn(`Admin channel ${adminChannelId} is not accessible to send alerts`);
         return false;
      }

      const fields = details
         ? Object.entries(details).map(([name, value]) => ({ name, value, inline: true }))
         : [];

      await channel.send({
         embeds: [{
            title: `⚠️ [BoredBot System Alert] ${title}`,
            description,
            color: 0xED4245,
            fields,
            timestamp: new Date().toISOString(),
            footer: {
               text: "Run /boredbot settings check to audit all configurations"
            }
         }],
         allowedMentions: { parse: [] }
      });

      return true;
   } catch (e) {
      log.error(`Failed to send admin alert to channel ${adminChannelId}`, e);
      return false;
   }
};

/**
 * Generates immediate companion warnings when a setting key is modified.
 */
export const getSettingChangeWarnings = (
   guildId: string | null | undefined,
   key: DynamicKey,
   newValue: any
): string[] => {
   const warnings: string[] = [];

   if (key === "ONBOARDING_CHANNEL_ID" && newValue) {
      const roleId = getSetting(guildId, "ONBOARDING_ROLE_ID");
      if (!roleId) {
         warnings.push("⚠️ **Note:** `ONBOARDING_CHANNEL_ID` is set, but `ONBOARDING_ROLE_ID` is not configured yet. New members will not receive a role until you set it.");
      }
   } else if (key === "ONBOARDING_ROLE_ID" && newValue) {
      const channelId = getSetting(guildId, "ONBOARDING_CHANNEL_ID");
      if (!channelId) {
         warnings.push("⚠️ **Note:** `ONBOARDING_ROLE_ID` is set, but `ONBOARDING_CHANNEL_ID` is not configured yet. Onboarding verification will not trigger until a channel is set.");
      }
   } else if (key === "CHANNEL_MEETUPS" && newValue) {
      const dirId = getSetting(guildId, "CHANNEL_MEETUPS_DIR");
      if (!dirId) {
         warnings.push("⚠️ **Note:** `CHANNEL_MEETUPS` is set, but `CHANNEL_MEETUPS_DIR` is not configured yet. Meetup directory sync is inactive.");
      }
   } else if (key === "CHANNEL_MEETUPS_DIR" && newValue) {
      const meetupId = getSetting(guildId, "CHANNEL_MEETUPS");
      if (!meetupId) {
         warnings.push("⚠️ **Note:** `CHANNEL_MEETUPS_DIR` is set, but `CHANNEL_MEETUPS` is not configured yet.");
      }
   } else if (key === "REDDIT_SECRET" && newValue) {
      const shitpostId = getSetting(guildId, "CHANNEL_SHITPOST");
      if (!shitpostId) {
         warnings.push("⚠️ **Note:** `REDDIT_SECRET` is set, but `CHANNEL_SHITPOST` is not configured yet. Reddit webhooks will fail without a shitpost channel.");
      }
   } else if (key === "CHANNEL_BOT_ADMIN" && !newValue) {
      const adminId = getSetting(guildId, "CHANNEL_ADMIN");
      if (adminId) {
         warnings.push(`🔁 **Note:** \`CHANNEL_BOT_ADMIN\` is unset — automatically falling back to \`CHANNEL_ADMIN\` (<#${adminId}>).`);
      } else {
         warnings.push("❌ **Warning:** Neither `CHANNEL_BOT_ADMIN` nor `CHANNEL_ADMIN` is configured. Admin alerts and commands may be disabled.");
      }
   } else if (key === "CHANNEL_ADMIN" && !newValue) {
      const botAdminId = getSetting(guildId, "CHANNEL_BOT_ADMIN");
      if (botAdminId) {
         warnings.push(`🔁 **Note:** \`CHANNEL_ADMIN\` is unset — automatically falling back to \`CHANNEL_BOT_ADMIN\` (<#${botAdminId}>).`);
      }
   }

   return warnings;
};
