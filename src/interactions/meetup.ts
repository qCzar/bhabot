import * as Discord from "discord.js";
import { nanoid } from "nanoid";
import { DateTime } from "luxon";
import YAML from "yaml";

import * as Interaction from "../interaction";
import * as db from "../commands/meetup/db/meetups";
import * as seriesDb from "../commands/meetup/db/meetup-series";
import * as M from "../commands/meetup/common/Meetup";
import { parse } from "../commands/meetup/common/MeetupOptions";
import { validateSubscriptionRole } from "../commands/meetup/common/ValidateRole";
import { refresh } from "../commands/meetup/features/RenderAnnouncement";
import { createOccurrence } from "../commands/meetup/features/CreateOccurrence";
import { generateSeries, reconcileSeries } from "../commands/meetup/features/GenerateRecurringMeetups";
import { env, getSetting } from "../environment";
import { meetupCreatorMessage, meetupEditMessage } from "./meetup-creator";

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
         }, {
            type: optionType.string,
            name: "scope",
            description: "Which recurring meetups to edit",
            required: false,
            choices: [
               { name: "This occurrence only", value: "occurrence" },
               { name: "This and future occurrences", value: "future" }
            ]
         }]
      },
      {
         type: optionType.sub_command,
         name: "edit",
         description: "Edit an existing meetup (use in meetup thread)",
         options: [{
            type: optionType.string,
            name: "options",
            description: "Paste updated YAML (omit to open this meetup in the editor)",
            required: false
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
         }, {
            type: optionType.string,
            name: "scope",
            description: "Cancel this occurrence or the recurring series",
            required: false,
            choices: [
               { name: "This occurrence only", value: "occurrence" },
               { name: "Entire series", value: "series" }
            ]
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
         content:   meetupCreatorMessage (env.MEETUP_FORM_URL, interaction.guildId),
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

   try {
      await interaction.deferReply ({ ephemeral: true });
      if (!options.recurrence) {
         await createOccurrence ({
            client: interaction.client,
            channel,
            organizerID: interaction.user.id,
            options,
            mention: roleValidation.mention
         });
         return interaction.editReply ({ content: `✅ Meetup **${options.title}** created!` });
      }

      const start = DateTime.fromISO (options.date);
      const recurrenceTimezone = options.recurrence.timezone || getSetting (interaction.guildId, "MEETUP_TIMEZONE");
      const zonedStart = DateTime.fromISO (options.date, { setZone: true }).setZone (recurrenceTimezone);
      if (!zonedStart.isValid || !options.recurrence.weekdays.includes (zonedStart.weekday)) {
         return interaction.editReply ({ content: "⚠️ The first meetup date must fall on one of the selected weekdays in the server timezone." });
      }
      const deadlineOffset = options.rsvpDeadline
         ? DateTime.fromISO (options.rsvpDeadline).diff (start, "minutes").minutes
         : undefined;
      const series: seriesDb.MeetupSeries = {
         id: nanoid (),
         guildID: interaction.guildId!,
         organizerID: interaction.user.id,
         sourceChannelID: channel.id,
         createdAt: DateTime.local ().toISO (),
         firstOccurrenceAt: start.toISO (),
         title: options.title,
         description: options.description || "",
         links: options.links ?? [],
         category: options.category || "default",
         location: M.location (options),
         maxRsvp: options.maxRsvp,
         rsvpDeadlineOffsetMinutes: deadlineOffset,
         duration: options.duration ?? 2,
         subscription: options.subscription,
         recurrence: {
            frequency: "weekly",
            interval: options.recurrence.interval,
            weekdays: [...new Set (options.recurrence.weekdays)],
            endDate: options.recurrence.endDate,
            timezone: recurrenceTimezone
         },
         state: { type: "Active" }
      };
      await seriesDb.insert (series);
      const created = await generateSeries (interaction.client, series, DateTime.local ().minus ({ seconds: 1 }));
      return interaction.editReply ({ content: `✅ Recurring meetup **${options.title}** created with ${created} occurrence(s) posted.` });
   }
   catch (e) {
      const content = "⚠️ Bot broke unexpectedly while trying to post meetup.";
      return interaction.deferred ? interaction.editReply ({ content }) : interaction.reply ({ content, ephemeral: true });
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

   const optionsStr = interaction.options.getString ("options");

   if (!optionsStr) {
      return interaction.reply ({
         content:   meetupEditMessage (env.MEETUP_FORM_URL, meetup.id, interaction.guildId),
         ephemeral: true
      });
   }

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

   const scope = interaction.options.getString ("scope") ?? "occurrence";
   const editableFields = ["title", "timestamp", "description", "category", "links", "location", "maxRsvp", "rsvpDeadline", "duration", "subscription"];

   if (scope === "future" && !meetup.seriesID)
      return interaction.reply ({ content: "⚠️ This meetup is not part of a recurring series.", ephemeral: true });

   if (scope === "future" && meetup.seriesID) {
      const series = await seriesDb.findOne ({ id: meetup.seriesID });
      if (!series) return interaction.reply ({ content: "⚠️ The recurring series could not be found.", ephemeral: true });

      const deadlineOffset = options.rsvpDeadline
         ? DateTime.fromISO (options.rsvpDeadline).diff (DateTime.fromISO (options.date), "minutes").minutes
         : series.rsvpDeadlineOffsetMinutes;
      const nextRecurrence = options.recurrence ? {
         frequency: "weekly" as const,
         interval: options.recurrence.interval,
         weekdays: [...new Set (options.recurrence.weekdays)],
         endDate: options.recurrence.endDate,
         timezone: options.recurrence.timezone || series.recurrence.timezone
      } : series.recurrence;
      const requestedTime = DateTime.fromISO (options.date, { setZone: true }).setZone (nextRecurrence.timezone);
      const firstOccurrenceAt = DateTime.fromISO (series.firstOccurrenceAt, { setZone: true })
         .setZone (nextRecurrence.timezone)
         .set ({ hour: requestedTime.hour, minute: requestedTime.minute, second: requestedTime.second, millisecond: requestedTime.millisecond })
         .toISO ();
      const updatedSeries = await seriesDb.update ({
         ...series,
         firstOccurrenceAt,
         title: options.title,
         description: options.description || series.description,
         category: options.category || series.category,
         links: options.links ?? series.links,
         location: M.location (options) ?? series.location,
         maxRsvp: options.maxRsvp ?? series.maxRsvp,
         rsvpDeadlineOffsetMinutes: deadlineOffset,
         duration: options.duration ?? series.duration,
         subscription: options.subscription ?? series.subscription,
         recurrence: nextRecurrence
      });

      const future = await db.find ({ seriesID: meetup.seriesID, timestamp: { $gte: meetup.timestamp }, "state.type": "Live" });
      for (const occurrence of future) {
         const overrides = new Set (occurrence.overrides ?? []);
         const next: db.Meetup = {
            ...occurrence,
            title: overrides.has ("title") ? occurrence.title : updated.title,
            description: overrides.has ("description") ? occurrence.description : updated.description,
            category: overrides.has ("category") ? occurrence.category : updated.category,
            links: overrides.has ("links") ? occurrence.links : updated.links,
            location: overrides.has ("location") ? occurrence.location : updated.location,
            maxRsvp: overrides.has ("maxRsvp") ? occurrence.maxRsvp : updated.maxRsvp,
            rsvpDeadline: overrides.has ("rsvpDeadline") || deadlineOffset === undefined
               ? occurrence.rsvpDeadline
               : DateTime.fromISO (occurrence.timestamp).plus ({ minutes: deadlineOffset }).toISO (),
            duration: overrides.has ("duration") ? occurrence.duration : updated.duration,
            subscription: overrides.has ("subscription") ? occurrence.subscription : updated.subscription
         };
         if (occurrence.id === meetup.id) next.timestamp = updated.timestamp;
         await db.update (next);
         const occurrenceChannel = await interaction.client.channels.fetch (next.threadID);
         if (occurrenceChannel?.isThread ()) await occurrenceChannel.setName (`🗓️  ${M.threadTitle (next.title, next.timestamp)}`);
      }
      if (options.recurrence) await reconcileSeries (interaction.client, updatedSeries, DateTime.fromISO (meetup.timestamp));
      return interaction.reply ({ content: `✅ **${updated.title}** and future occurrences have been updated.` });
   }

   if (meetup.seriesID) updated.overrides = [...new Set ([...(meetup.overrides ?? []), ...editableFields])];

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
   const scope = interaction.options.getString ("scope") ?? "occurrence";

   if (scope === "series" && !meetup.seriesID)
      return interaction.reply ({ content: "⚠️ This meetup is not part of a recurring series.", ephemeral: true });

   if (scope === "series" && meetup.seriesID) {
      const series = await seriesDb.findOne ({ id: meetup.seriesID });
      if (!series) return interaction.reply ({ content: "⚠️ The recurring series could not be found.", ephemeral: true });
      const cancelledAt = DateTime.local ().toISO ();
      await seriesDb.update ({ ...series, state: { type: "Cancelled", reason, timestamp: cancelledAt } });
      const future = await db.find ({ seriesID: meetup.seriesID, timestamp: { $gte: meetup.timestamp }, "state.type": "Live" });
      for (const occurrence of future) {
         await db.update ({ ...occurrence, state: { type: "Cancelled", reason, timestamp: cancelledAt } });
         const occurrenceChannel = await interaction.client.channels.fetch (occurrence.threadID);
         if (occurrenceChannel?.isThread ()) {
            await occurrenceChannel.setName (`(Cancelled) ${M.threadTitle (occurrence.title, occurrence.timestamp)}`);
            if (occurrence.id !== meetup.id && occurrence.rsvps.length) {
               await occurrenceChannel.send ({
                  content: `🚫 This recurring meetup has been cancelled. ${occurrence.rsvps.map (id => `<@${id}>`).join (" ")}`,
                  allowedMentions: { users: occurrence.rsvps }
               });
            }
         }
      }
      return interaction.reply ({
         embeds: [{
            title: "🚫 Meetup Series Cancelled",
            description: `**${meetup.title}** and ${future.length} future occurrence(s) have been cancelled.\n> ${reason}`,
            color: 0xED4245
         }]
      });
   }

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
            "`/bored meetup edit` — Open this meetup in the online editor",
            "`/bored meetup edit <options> [scope]` — Update this occurrence or this and future occurrences",
            "`/bored meetup cancel <reason> [scope]` — Cancel this occurrence or its recurring series",
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
