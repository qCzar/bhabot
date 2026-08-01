import * as Discord from "discord.js";
import { nanoid } from "nanoid";
import { DateTime } from "luxon";
import YAML from "yaml";

import * as Interaction from "../interaction";
import * as db from "../commands/meetup/db/meetups";
import * as M from "../commands/meetup/common/Meetup";
import { parse } from "../commands/meetup/common/MeetupOptions";
import { validateSubscriptionRole } from "../commands/meetup/common/ValidateRole";
import { render, refresh } from "../commands/meetup/features/RenderAnnouncement";
import { env, getSetting } from "../environment";
import { meetupCreatorMessage } from "./meetup-creator";

const { commandType, optionType } = Interaction;

export const meetupSubcommandGroupConfig: Interaction.option = {
   type: optionType.sub_command_group,
   name: "meetup",
   description: "Create, manage, and interact with meetups",
   options: [
      {
         type: optionType.sub_command,
         name: "create",
         description: "Create a new meetup from YAML options",
         options: [{
            type: optionType.string,
            name: "options",
            description: "Paste the YAML from the meetup web UI (omit to open the creator)",
            required: false
         }]
      },
      {
         type: optionType.sub_command,
         name: "edit",
         description: "Edit an existing meetup (use in meetup thread)",
         options: [{
            type: optionType.string,
            name: "options",
            description: "Paste the updated YAML from the meetup web UI",
            required: true
         }]
      },
      {
         type: optionType.sub_command,
         name: "cancel",
         description: "Cancel a meetup (use in meetup thread)",
         options: [{
            type: optionType.string,
            name: "reason",
            description: "Reason for cancelling the meetup",
            required: true
         }]
      },
      {
         type: optionType.sub_command,
         name: "announce",
         description: "Ping all RSVPs in the meetup (use in meetup thread)"
      },
      {
         type: optionType.sub_command,
         name: "help",
         description: "Show help information for the meetup command"
      }
   ]
};

export const meetupAdminSubcommandGroupConfig: Interaction.option = {
   type: optionType.sub_command_group,
   name: "meetup",
   description: "Admin meetup commands",
   options: [{
      type: optionType.sub_command,
      name: "refresh",
      description: "Refresh all live meetup announcements"
   }]
};

export const handleMeetupSubcommand = async (interaction: Discord.ChatInputCommandInteraction) => {
   const subcommand = interaction.options.getSubcommand ();
   switch (subcommand) {
      case "create":
         return handleCreate (interaction);
      case "edit":
         return handleEdit (interaction);
      case "cancel":
         return handleCancel (interaction);
      case "announce":
         return handleAnnounce (interaction);
      case "help":
         return handleHelp (interaction);
      default:
         return interaction.reply ({ content: "Unknown meetup command.", ephemeral: true });
   }
};

export const handleMeetupAdminSubcommand = async (interaction: Discord.ChatInputCommandInteraction) => {
   const subcommand = interaction.options.getSubcommand ();
   switch (subcommand) {
      case "refresh":
         return handleAdminRefresh (interaction);
      default:
         return interaction.reply ({ content: "Unknown admin command.", ephemeral: true });
   }
};



async function handleCreate (interaction: Discord.ChatInputCommandInteraction) {
   const optionsStr = interaction.options.getString ("options");

   if (!optionsStr) {
      return interaction.reply ({
         content:   meetupCreatorMessage (env.MEETUP_FORM_URL),
         ephemeral: true
      });
   }

   const channelMeetups = getSetting(interaction.guildId, "CHANNEL_MEETUPS");
   if (interaction.channelId !== channelMeetups) {
      return interaction.reply ({ content: "⚠️ Meetups can only be created in the meetups channel.", ephemeral: true });
   }

   const channel = interaction.channel;

   if (!channel || channel.type !== Discord.ChannelType.GuildText) {
      return interaction.reply ({ content: "⚠️ This command must be used in a text channel.", ephemeral: true });
   }

   let parsed: unknown;
   try { parsed = YAML.parse (optionsStr); }
   catch (e) {
      return interaction.reply ({ content: "⚠️ Could not parse the YAML options. Make sure you're pasting the full output from the web UI.", ephemeral: true });
   }

   const options = parse (parsed);

   if (options.failed) {
      return interaction.reply ({ content: `⚠️ Invalid meetup options: ${options.message}`, ephemeral: true });
   }

   const roleValidation = await validateSubscriptionRole (options.subscription, interaction.guildId, interaction.channel);
   if (!roleValidation.isValid) {
      return interaction.reply ({ content: roleValidation.message || "⚠️ Invalid role", ephemeral: true });
   }

   const thread = await channel.threads.create ({
      name:                `🗓️  ${M.threadTitle (options.title, options.date)}`,
      reason:              "Meetup discussion thread",
      autoArchiveDuration: 1440,
   });

   const meetup: db.Meetup = {
      id:              nanoid (),
      organizerID:     interaction.user.id,
      title:           options.title,
      sourceChannelID: channel.id,
      threadID:        thread.id,
      announcementID:  "",
      createdAt:       DateTime.local ().toISO (),
      category:        options.category || "default",
      timestamp:       DateTime.fromISO (options.date).toISO (),
      description:     options.description || "",
      links:           options.links ?? [],
      rsvps:           [interaction.user.id],
      maybes:          [],
      location:        M.location (options),
      maxRsvp:         options.maxRsvp,
      rsvpDeadline:    options.rsvpDeadline,
      duration:        options.duration ?? 2,
      subscription:    options.subscription,
      state:           { type: "Live" }
   };

   try {
      const post = await render (interaction.client, meetup);

      await db.insert ({
         ...meetup,
         announcementID: post.id
      });

      await post.pin ();
      await thread.members.add (interaction.user.id);

      return interaction.reply ({ content: `✅ Meetup **${options.title}** created!`, ephemeral: true });
   }
   catch (e) {
      await thread.delete ();
      return interaction.reply ({ content: "⚠️ Bot broke unexpectedly while trying to post meetup.", ephemeral: true });
   }
}


async function handleEdit (interaction: Discord.ChatInputCommandInteraction) {
   const channel = interaction.channel;

   if (!channel?.isThread ()) {
      return interaction.reply ({ content: "⚠️ This command must be used inside a meetup thread.", ephemeral: true });
   }

   const meetup = await db.findOne ({ threadID: channel.id });

   if (!meetup) {
      return interaction.reply ({ content: "⚠️ No meetup found for this thread.", ephemeral: true });
   }

   const isOrganizer = interaction.user.id === meetup.organizerID;
   const isMod = interaction.memberPermissions?.has (Discord.PermissionFlagsBits.KickMembers);

   if (!isOrganizer && !isMod) {
      return interaction.reply ({ content: "⚠️ Only the organizer or a moderator can edit this meetup.", ephemeral: true });
   }

   const optionsStr = interaction.options.getString ("options", true);

   let parsed: unknown;
   try { parsed = YAML.parse (optionsStr); }
   catch (e) {
      return interaction.reply ({ content: "⚠️ Could not parse the YAML options.", ephemeral: true });
   }

   const options = parse (parsed);

   if (options.failed) {
      return interaction.reply ({ content: `⚠️ Invalid meetup options: ${options.message}`, ephemeral: true });
   }

   const roleValidation = await validateSubscriptionRole (options.subscription, interaction.guildId, interaction.channel);
   if (!roleValidation.isValid) {
      return interaction.reply ({ content: roleValidation.message || "⚠️ Invalid role", ephemeral: true });
   }

   const updated: db.Meetup = {
      ...meetup,
      title:        options.title,
      timestamp:    DateTime.fromISO (options.date).toISO (),
      description:  options.description || meetup.description,
      category:     options.category || meetup.category,
      links:        options.links ?? meetup.links,
      location:     M.location (options) ?? meetup.location,
      maxRsvp:      options.maxRsvp ?? meetup.maxRsvp,
      rsvpDeadline: options.rsvpDeadline ?? meetup.rsvpDeadline,
      duration:     options.duration ?? meetup.duration,
      subscription: options.subscription ?? meetup.subscription
   };

   await db.update (updated);

   await channel.setName (`🗓️  ${M.threadTitle (updated.title, updated.timestamp)}`);

   return interaction.reply ({
      embeds: [{
         title:       "✅ Meetup Updated",
         description: `**${updated.title}** has been updated.`,
         color:       0x57F287
      }]
   });
}


async function handleCancel (interaction: Discord.ChatInputCommandInteraction) {
   const channel = interaction.channel;

   if (!channel?.isThread ()) {
      return interaction.reply ({ content: "⚠️ This command must be used inside a meetup thread.", ephemeral: true });
   }

   const meetup = await db.findOne ({ threadID: channel.id });

   if (!meetup) {
      return interaction.reply ({ content: "⚠️ No meetup found for this thread.", ephemeral: true });
   }

   const isOrganizer = interaction.user.id === meetup.organizerID;
   const isMod = interaction.memberPermissions?.has (Discord.PermissionFlagsBits.KickMembers);

   if (!isOrganizer && !isMod) {
      return interaction.reply ({ content: "⚠️ Only the organizer or a moderator can cancel this meetup.", ephemeral: true });
   }

   const reason = interaction.options.getString ("reason", true);

   await db.update ({
      ...meetup,
      state: { type: "Cancelled", reason, timestamp: DateTime.local ().toISO () }
   });

   await channel.setName (`(Cancelled) ${M.threadTitle (meetup.title, meetup.timestamp)}`);

   return interaction.reply ({
      embeds: [{
         title:       "🚫 Meetup Cancelled",
         description: `**${meetup.title}** has been cancelled.\n> ${reason}`,
         color:       0xED4245
      }]
   });
}


async function handleAnnounce (interaction: Discord.ChatInputCommandInteraction) {
   const channel = interaction.channel;

   if (!channel?.isThread ()) {
      return interaction.reply ({ content: "⚠️ This command must be used inside a meetup thread.", ephemeral: true });
   }

   const meetup = await db.findOne ({ threadID: channel.id });

   if (!meetup) {
      return interaction.reply ({ content: "⚠️ No meetup found for this thread.", ephemeral: true });
   }

   if (interaction.user.id !== meetup.organizerID) {
      return interaction.reply ({ content: "⚠️ Only the organizer can send announcements.", ephemeral: true });
   }

   const mentions = [...meetup.rsvps, ...meetup.maybes]
      .map (id => `<@${id}>`)
      .join (" ");

   if (!mentions) {
      return interaction.reply ({ content: "No RSVPs to ping.", ephemeral: true });
   }

   await channel.send ({ content: `📢 Announcement from the organizer!\n${mentions}` });
   return interaction.reply ({ content: "✅ RSVPs have been pinged.", ephemeral: true });
}


async function handleHelp (interaction: Discord.ChatInputCommandInteraction) {
   return interaction.reply ({
      embeds: [{
         title:       "📅 Meetup Commands",
         description: [
            "`/bored meetup create` — Open the meetup creator",
            "`/bored meetup create <options>` — Create a meetup from generated YAML",
            "`/bored meetup edit <options>` — Edit a meetup (in thread)",
            "`/bored meetup cancel <reason>` — Cancel a meetup (in thread)",
            "`/bored meetup announce` — Ping all RSVPs (in thread)",
            "`/bored meetup help` — Show this help",
            "`/boredbot meetup refresh` — Refresh all announcements"
         ].join ("\n"),
         color: 0x5865F2
      }],
      ephemeral: true
   });
}


async function handleAdminRefresh (interaction: Discord.ChatInputCommandInteraction) {
   // Assuming refresh is a global admin action, we use global or per-server bot admin channel
   const channelAdmin = getSetting(interaction.guildId, "CHANNEL_BOT_ADMIN");
   if (interaction.channelId !== channelAdmin) {
      return interaction.reply ({ content: "⚠️ This command can only be used in the bot admin channel.", ephemeral: true });
   }

   await refresh (interaction.client);
   return interaction.reply ({ content: "✅ All live meetup announcements have been refreshed.", ephemeral: true });
}
