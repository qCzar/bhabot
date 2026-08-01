import * as Discord from "discord.js";
import * as Interaction from "../interaction";
import { interactionFailed } from "../errors";
import { getSetting } from "../environment";
import { getWhitelistedChannelIds, isPingWhitelistedChannel } from "./ping-whitelist";
import {
   getPlatformAutocompleteChoices,
   getPlatformChoices,
   Platform,
   resolvePlatform
} from "./play-platforms";

export { getPlatformAutocompleteChoices, getPlatformChoices, resolvePlatform } from "./play-platforms";

export const playSubcommandConfig: Interaction.option = {
   type: Interaction.optionType.sub_command,
   name: "play",
   description: "Announce a game session",
   options: [
      {
         type: Interaction.optionType.string,
         name: "platform",
         description: "Platform for the game session",
         required: true,
         autocomplete: true
      },
      {
         type: Interaction.optionType.string,
         name: "message",
         description: "Message to include in the announcement",
         required: true
      }
   ]
};

async function getWhitelistedPlatforms (
   interaction: Discord.ChatInputCommandInteraction | Discord.AutocompleteInteraction
): Promise<Platform[]> {
   const whitelistRaw = getSetting (interaction.guildId, "PING_WHITELIST_CHANNELS") || "";
   const channelIds = getWhitelistedChannelIds (whitelistRaw);
   const channels = await Promise.all (
      channelIds.map (id => interaction.client.channels.fetch (id).catch (() => null))
   );
   const forums = channels.flatMap (channel => {
      if (!channel || channel.type !== Discord.ChannelType.GuildForum) return [];
      return [{ id: channel.id, availableTags: channel.availableTags }];
   });

   return getPlatformChoices (forums, whitelistRaw);
}

export async function handlePlaySubcommand (interaction: Discord.ChatInputCommandInteraction): Promise<void> {
   const platformId = interaction.options.getString ("platform");
   const message = interaction.options.getString ("message");

   if (!platformId || !message) {
      await interaction.reply ({ content: "You must provide a platform and message.", ephemeral: true }).catch (interactionFailed);
      return;
   }

   const whitelistRaw = getSetting (interaction.guildId, "PING_WHITELIST_CHANNELS") || "";
   const parentId = interaction.channel?.isThread () ? interaction.channel.parentId : null;
   if (!isPingWhitelistedChannel (whitelistRaw, interaction.channelId, parentId)) {
      await interaction.reply ({ content: "This command can only be used in whitelisted channels.", ephemeral: true }).catch (interactionFailed);
      return;
   }

   const platform = resolvePlatform (await getWhitelistedPlatforms (interaction), platformId);
   if (!platform) {
      await interaction.reply ({ content: "Please choose a platform from the available forum tags.", ephemeral: true }).catch (interactionFailed);
      return;
   }

   await interaction.reply ({
      content: `${platform.name} - ${message} - @everyone`,
      allowedMentions: { parse: ["everyone"] }
   }).catch (interactionFailed);
}

export async function handlePlayAutocomplete (interaction: Discord.AutocompleteInteraction): Promise<void> {
   const focusedValue = interaction.options.getFocused ();
   const search = typeof focusedValue === "string" ? focusedValue.toLowerCase () : "";
   const platforms = await getWhitelistedPlatforms (interaction);
   const choices = getPlatformAutocompleteChoices (platforms, search);

   await interaction.respond (choices);
}
