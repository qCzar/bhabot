import * as Discord from "discord.js";
import { DateTime } from "luxon";
import schedule from "node-schedule";
import { getSetting } from "../../../environment";
import { logger, runWithLoggingContext } from "../../../logger";
import { weeklyOccurrences, occurrenceKey } from "../common/Recurrence";
import { validateSubscriptionRole } from "../common/ValidateRole";
import type { MeetupOptions } from "../common/MeetupOptions";
import * as M from "../common/Meetup";
import * as meetups from "../db/meetups";
import * as seriesDb from "../db/meetup-series";
import { createOccurrence } from "./CreateOccurrence";

const log = logger ("meetup:recurrence");

const asOptions = (series: seriesDb.MeetupSeries): MeetupOptions => ({
   title: series.title,
   date: series.firstOccurrenceAt,
   description: series.description,
   category: series.category,
   links: series.links,
   location: series.location?.value,
   location_comments: series.location?.comments,
   location_linked: series.location?.autoLink,
   maxRsvp: series.maxRsvp,
   rsvpDeadline: series.rsvpDeadlineOffsetMinutes === undefined
      ? undefined
      : DateTime.fromISO (series.firstOccurrenceAt).plus ({ minutes: series.rsvpDeadlineOffsetMinutes }).toISO (),
   duration: series.duration,
   subscription: series.subscription
});

export async function generateSeries(client: Discord.Client, series: seriesDb.MeetupSeries, now = DateTime.local ()): Promise<number> {
   if (series.state.type !== "Active") return 0;
   const windowDays = Number (getSetting (series.guildID, "MEETUP_RECURRENCE_WINDOW_DAYS"));
   const dates = weeklyOccurrences (series.firstOccurrenceAt, series.recurrence, now.plus ({ days: windowDays }), now);
   const existing = await meetups.find ({ seriesID: series.id });
   const existingKeys = new Set (existing.map (meetup => meetup.occurrenceKey));
   const channel = await client.channels.fetch (series.sourceChannelID);
   if (!channel || channel.type !== Discord.ChannelType.GuildText) throw new Error (`Meetup series channel '${series.sourceChannelID}' is unavailable`);

   const role = await validateSubscriptionRole (series.subscription, series.guildID, channel);
   if (!role.isValid) throw new Error (role.message);

   let created = 0;
   for (const date of dates) {
      const key = occurrenceKey (date);
      if (existingKeys.has (key)) continue;
      await createOccurrence ({
         client,
         channel,
         organizerID: series.organizerID,
         options: asOptions (series),
         timestamp: date.toISO (),
         mention: role.mention,
         seriesID: series.id,
         occurrenceKey: key
      });
      existingKeys.add (key);
      created++;
   }
   return created;
}

export async function generateAll(client: Discord.Client): Promise<void> {
   await meetups.ensureIndexes ();
   const active = await seriesDb.find ({ "state.type": "Active" });
   for (const series of active) {
      try { await generateSeries (client, series); }
      catch (error) { log.error (`Failed to generate recurring meetup '${series.id}'`, error); }
   }
}

export async function reconcileSeries(client: Discord.Client, series: seriesDb.MeetupSeries, from: DateTime): Promise<number> {
   const windowDays = Number (getSetting (series.guildID, "MEETUP_RECURRENCE_WINDOW_DAYS"));
   const through = DateTime.local ().plus ({ days: windowDays });
   const desiredDates = weeklyOccurrences (series.firstOccurrenceAt, series.recurrence, through, from.minus ({ seconds: 1 }));
   const desired = new Set (desiredDates.map (occurrenceKey));
   const desiredByLocalDate = new Map (desiredDates.map (date => [date.toFormat ("yyyy-MM-dd"), date]));
   const posted = await meetups.find ({
      seriesID: series.id,
      timestamp: { $gte: from.toISO (), $lte: through.toISO () },
      "state.type": "Live"
   });
   for (const meetup of posted) {
      if (meetup.occurrenceKey && desired.has (meetup.occurrenceKey)) continue;
      const localDate = DateTime.fromISO (meetup.timestamp).setZone (series.recurrence.timezone).toFormat ("yyyy-MM-dd");
      const moved = desiredByLocalDate.get (localDate);
      if (moved) {
         const updated = { ...meetup, timestamp: moved.toISO (), occurrenceKey: occurrenceKey (moved) };
         await meetups.update (updated);
         const movedChannel = await client.channels.fetch (meetup.threadID);
         if (movedChannel?.isThread ()) await movedChannel.setName (`🗓️  ${M.threadTitle (updated.title, updated.timestamp)}`);
         continue;
      }
      const reason = "The recurring meetup schedule changed.";
      await meetups.update ({ ...meetup, state: { type: "Cancelled", reason, timestamp: DateTime.local ().toISO () } });
      const channel = await client.channels.fetch (meetup.threadID);
      if (channel?.isThread ()) {
         await channel.setName (`(Cancelled) ${meetup.title}`);
         if (meetup.rsvps.length) await channel.send ({
            content: `🚫 This occurrence was cancelled because the series schedule changed. ${meetup.rsvps.map (id => `<@${id}>`).join (" ")}`,
            allowedMentions: { users: meetup.rsvps }
         });
      }
   }
   return generateSeries (client, series);
}

export async function init(client: Discord.Client): Promise<void> {
   await generateAll (client);
   schedule.scheduleJob ("20 0 * * *", () => runWithLoggingContext (() => generateAll (client)));
}
