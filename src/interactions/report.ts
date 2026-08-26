import * as Discord from "discord.js";
import * as Interaction from "../interaction";
import { getSetting } from "../environment";
import { interactionFailed } from "../errors";
import {
   getReportForum,
   findMemberReportThread,
   makeThreadTitle,
   truncate
} from "../features/moderation-logging";

export const reportSubcommandConfig: Interaction.option = {
   type: Interaction.optionType.sub_command,
   name: "report",
   description: "Report suspicious message activity to the member reporting forum",
   options: [
      {
         type: Interaction.optionType.user,
         name: "user",
         description: "The user whose message or behavior looks suspicious",
         required: true
      },
      {
         type: Interaction.optionType.string,
         name: "content",
         description: "What happened, why it looks suspicious, or other context",
         required: true
      },
      {
         type: Interaction.optionType.string,
         name: "message-link",
         description: "Optional Discord message link for the suspicious content",
         required: false
      }
   ]
};

const makeReportEmbed = (
   interaction: Discord.ChatInputCommandInteraction,
   user: Discord.User,
   content: string,
   messageLink: string | null
): Discord.APIEmbed => ({
   title: "Member Report",
   color: 0xffc857,
   fields: [
      { name: "Reported User", value: `<@${user.id}> (${user.id})` },
      { name: "Reported By", value: `<@${interaction.user.id}> (${interaction.user.id})` },
      { name: "Channel", value: interaction.channelId ? `<#${interaction.channelId}> (${interaction.channelId})` : "Unknown" },
      { name: "Reason", value: truncate (content, 1024) },
      ...(messageLink ? [{ name: "Message Link", value: messageLink }] : [])
   ],
   timestamp: new Date ().toISOString ()
});

const makeAdminAlertEmbed = (
   thread: Discord.ThreadChannel,
   user: Discord.User,
   reporter: Discord.User,
   sourceChannelId: string | null
): Discord.APIEmbed => ({
   title: "New Member Report",
   color: 0xffc857,
   description: `A new report was filed in ${thread}.`,
   fields: [
      { name: "Reported User", value: `<@${user.id}> (${user.id})` },
      { name: "Reported By", value: `<@${reporter.id}> (${reporter.id})` },
      { name: "Source Channel", value: sourceChannelId ? `<#${sourceChannelId}> (${sourceChannelId})` : "Unknown" },
      { name: "Report Thread", value: `${thread}` }
   ],
   timestamp: new Date ().toISOString ()
});

const sendAdminAlert = async (
   interaction: Discord.ChatInputCommandInteraction,
   thread: Discord.ThreadChannel,
   user: Discord.User
): Promise<void> => {
   const adminChannelId = getSetting (interaction.guildId, "CHANNEL_ADMIN");
   const adminChannel = await interaction.client.channels.fetch (adminChannelId);

   if (!adminChannel?.isTextBased () || !("send" in adminChannel)) {
      throw new Error (`Admin channel '${adminChannelId}' is not a sendable text channel`);
   }

   await adminChannel.send ({
      embeds: [makeAdminAlertEmbed (thread, user, interaction.user, interaction.channelId)],
      allowedMentions: { parse: [] }
   });
};

export const handleReportSubcommand = async (interaction: Discord.ChatInputCommandInteraction): Promise<void> => {
   const user = interaction.options.getUser ("user", true);
   const content = interaction.options.getString ("content", true);
   const messageLink = interaction.options.getString ("message-link");

   try {
      await interaction.deferReply ({ ephemeral: true });

      if (!interaction.guild) {
         throw new Error ("Report command must be used in a guild");
      }

      const forum = await getReportForum (interaction.guild);
      const member = await interaction.guild.members.fetch (user.id).catch (() => null);
      const title = makeThreadTitle (user, member);
      const embed = makeReportEmbed (interaction, user, content, messageLink);
      const existingThread = await findMemberReportThread (forum, user.id);

      const thread = existingThread ?? await forum.threads.create ({
         name: title,
         message: {
            embeds: [embed],
            allowedMentions: { parse: [] }
         },
         reason: `Member report filed by ${interaction.user.tag}`
      });

      if (existingThread) {
         if (existingThread.archived) {
            await existingThread.setArchived (false, "New member report filed");
         }

         await existingThread.send ({
            embeds: [embed],
            allowedMentions: { parse: [] }
         });
      }

      await sendAdminAlert (interaction, thread, user).catch (interactionFailed);

      await interaction.editReply ({
         content: "✅ Report filed. Thank you for helping keep an eye on things."
      });
   }
   catch (err) {
      interactionFailed (err as Error);

      if (interaction.deferred || interaction.replied) {
         await interaction.editReply ({ content: "⚠️ I couldn't file that report. Please let a moderator know." }).catch (interactionFailed);
      }
      else {
         await interaction.reply ({ content: "⚠️ I couldn't file that report. Please let a moderator know.", ephemeral: true }).catch (interactionFailed);
      }
   }
};
