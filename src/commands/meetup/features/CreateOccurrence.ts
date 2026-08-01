import * as Discord from "discord.js";
import { DateTime } from "luxon";
import { nanoid } from "nanoid";
import type { MeetupOptions } from "../common/MeetupOptions";
import type { MeetupMention } from "../common/ValidateRole";
import { meetupStarterPost } from "../common/MeetupStarter";
import * as M from "../common/Meetup";
import * as db from "../db/meetups";
import { render } from "./RenderAnnouncement";

type CreateOccurrenceOptions = {
   client: Discord.Client;
   channel: Discord.TextChannel;
   organizerID: string;
   options: MeetupOptions;
   timestamp?: string;
   mention?: MeetupMention;
   seriesID?: string;
   occurrenceKey?: string;
};

export async function createOccurrence(input: CreateOccurrenceOptions): Promise<db.Meetup> {
   const timestamp = DateTime.fromISO (input.timestamp ?? input.options.date).toISO ();
   let starterPost: Discord.Message | undefined;
   let thread: Discord.ThreadChannel | undefined;

   try {
      starterPost = await input.channel.send (meetupStarterPost (input.options.title, timestamp, input.mention));
      thread = await starterPost.startThread ({
         name: `🗓️  ${M.threadTitle (input.options.title, timestamp)}`,
         reason: input.seriesID ? "Recurring meetup discussion thread" : "Meetup discussion thread",
         autoArchiveDuration: 1440
      });

      const deadlineOffset = input.options.rsvpDeadline
         ? DateTime.fromISO (input.options.rsvpDeadline).diff (DateTime.fromISO (input.options.date), "minutes").minutes
         : undefined;
      const meetup: db.Meetup = {
         id: nanoid (),
         organizerID: input.organizerID,
         title: input.options.title,
         sourceChannelID: input.channel.id,
         threadID: thread.id,
         announcementID: "",
         createdAt: DateTime.local ().toISO (),
         category: input.options.category || "default",
         timestamp,
         description: input.options.description || "",
         links: input.options.links ?? [],
         rsvps: [input.organizerID],
         maybes: [],
         location: M.location (input.options),
         maxRsvp: input.options.maxRsvp,
         rsvpDeadline: deadlineOffset === undefined ? undefined : DateTime.fromISO (timestamp).plus ({ minutes: deadlineOffset }).toISO (),
         duration: input.options.duration ?? 2,
         subscription: input.options.subscription,
         seriesID: input.seriesID,
         occurrenceKey: input.occurrenceKey,
         overrides: [],
         state: { type: "Live" }
      };

      const post = await render (input.client, meetup);
      await post.pin ();
      await thread.members.add (input.organizerID);
      return db.insert ({ ...meetup, announcementID: post.id });
   }
   catch (error) {
      await thread?.delete ().catch (() => undefined);
      await starterPost?.delete ().catch (() => undefined);
      throw error;
   }
}
