import { TextBasedChannel } from "discord.js";
import * as Subscription from "../../subscribe/Subscription";
import { getSetting } from "../../../environment";

export type MeetupMention =
   | { type: "role"; id: string }
   | { type: "mass"; name: "everyone" | "here" };

export type RoleValidationResult =
   | { isValid: true; mention?: MeetupMention }
   | { isValid: false; message: string };

/**
 * Validates a requested subscription role against server settings and database.
 * Enforces Option A:
 * 1. Blocks @everyone / @here unless ALLOW_EVERYONE_PING is enabled and channel is in PING_WHITELIST_CHANNELS.
 * 2. Enforces that the specified role is registered in the database as an activity role.
 */
export async function validateSubscriptionRole(
   roleInput: string | undefined | null,
   guildId: string | null | undefined,
   channel: TextBasedChannel | null | undefined
): Promise<RoleValidationResult> {
   if (!roleInput || !roleInput.trim()) {
      return { isValid: true };
   }

   const raw = roleInput.trim();
   const normalized = raw.replace(/^@/, "").toLowerCase();

   // 1. Check for @everyone and @here mass pings
   if (normalized === "everyone" || normalized === "here") {
      const allowEveryoneSetting = getSetting(guildId, "ALLOW_EVERYONE_PING");
      const allowEveryone = allowEveryoneSetting === true || allowEveryoneSetting === "true";
      
      const whitelistRaw: string = getSetting(guildId, "PING_WHITELIST_CHANNELS") || "";
      const whitelistedChannels = whitelistRaw.split(",").map(c => c.trim().toLowerCase()).filter(Boolean);

      let channelName = "";
      let channelId = "";
      if (channel) {
         channelId = channel.id;
         if ("name" in channel && typeof (channel as any).name === "string") {
            channelName = (channel as any).name.toLowerCase();
         }
      }

      const isWhitelisted = whitelistedChannels.some(ch => {
         const clean = ch.replace(/^#/, "");
         return clean === channelName || clean === channelId;
      });

      if (!allowEveryone || !isWhitelisted) {
         return {
            isValid: false,
            message: `⚠️ **Invalid Role**: Pinging \`@${normalized}\` is disabled on this server or channel. Pings are restricted to registered activity roles only.`
         };
      }

      return {
         isValid: true,
         mention: { type: "mass", name: normalized }
      };
   }

   // 2. Validate against Database Registered Activity Roles
   try {
      const collection = await Subscription.collection();
      const docs = await collection.find({}).toArray();
      const guildRoles = channel && "guild" in channel
         ? channel.guild.roles.cache
         : undefined;

      const subscription = docs.find (doc => {
         const matches = doc.name.toLowerCase ().trim () === normalized
            || doc.id === raw
            || doc.name === raw;
         return matches && (!guildRoles || guildRoles.has (doc.id));
      });

      if (!subscription) {
         return {
            isValid: false,
            message: `⚠️ **Invalid Role**: \`${raw}\` is not a registered activity role for this server. Please choose a valid role using \`/boredbot activity list\` or the web generator.`
         };
      }

      return {
         isValid: true,
         mention: { type: "role", id: subscription.id }
      };
   } catch (e) {
      return {
         isValid: false,
         message: "⚠️ Could not validate the selected activity role. Please try again."
      };
   }
}
