import * as Discord from "discord.js";
import { DateTime } from "luxon";
import schedule from "node-schedule";
import { env, getSetting } from "../../../environment";
import { logger, runWithLoggingContext } from "../../../logger";
import * as db from "../db/meetups";
import * as M from "../common/Meetup";

const log = logger ("meetup:organizer-reminder");

export const REMINDER_DELAY_MS = 10 * 60 * 1000; // 10 minutes

const activeTimers = new Map<string, NodeJS.Timeout> ();

export function shouldSendReminder(meetup: db.Meetup, now = DateTime.local ()): boolean {
   if (meetup.state.type !== "Live" || meetup.rsvps.includes (meetup.organizerID) || !meetup.organizerMissingSince || meetup.organizerReminderSent) {
      return false;
   }

   const missingSince = DateTime.fromISO (meetup.organizerMissingSince);
   return now.diff (missingSince, "minutes").minutes >= 10;
}

export function shouldSendWarning(
   meetup: db.Meetup,
   maxHours = 24,
   proximityHours = 2,
   now = DateTime.local ()
): boolean {
   if (meetup.state.type !== "Live" || meetup.rsvps.includes (meetup.organizerID) || !meetup.organizerMissingSince || meetup.organizerWarningSent) {
      return false;
   }

   const missingSince = DateTime.fromISO (meetup.organizerMissingSince);
   const eventTime = DateTime.fromISO (meetup.timestamp);

   const durationWarning = maxHours > 1 && now.diff (missingSince, "hours").hours >= (maxHours - 1);
   const proximityWarning = proximityHours >= 0 && eventTime.diff (now, "hours").hours <= (proximityHours + 1) && eventTime > now;

   return durationWarning || proximityWarning;
}

export function shouldAutoCancel(
   meetup: db.Meetup,
   maxHours = 24,
   proximityHours = 2,
   now = DateTime.local ()
): boolean {
   if (meetup.state.type !== "Live" || meetup.rsvps.includes (meetup.organizerID) || !meetup.organizerMissingSince) {
      return false;
   }

   const missingSince = DateTime.fromISO (meetup.organizerMissingSince);
   const eventTime = DateTime.fromISO (meetup.timestamp);

   const durationExceeded = maxHours > 0 && now.diff (missingSince, "hours").hours >= maxHours;
   const proximityExceeded = proximityHours > 0 && eventTime.diff (now, "hours").hours <= proximityHours;

   return durationExceeded || proximityExceeded;
}

export function cancelReminderTimer(meetupId: string): void {
   const timer = activeTimers.get (meetupId);
   if (timer) {
      clearTimeout (timer);
      activeTimers.delete (meetupId);
   }
}

export function scheduleReminderTimer(client: Discord.Client, meetupId: string, delayMs: number): void {
   cancelReminderTimer (meetupId);
   const timer = setTimeout (() => {
      runWithLoggingContext (() => {
         sendReminder (client, meetupId);
      });
   }, Math.max (0, delayMs));

   activeTimers.set (meetupId, timer);
}

export async function handleOrganizerUnrsvped(client: Discord.Client, meetup: db.Meetup): Promise<void> {
   if (meetup.state.type !== "Live") return;

   const nowIso = DateTime.local ().toISO ();
   const updated: db.Meetup = {
      ...meetup,
      organizerMissingSince: meetup.organizerMissingSince || nowIso,
      organizerReminderSent: false,
      organizerWarningSent: false
   };

   await db.update (updated);
   scheduleReminderTimer (client, meetup.id, REMINDER_DELAY_MS);
}

export async function handleOrganizerRsvped(meetup: db.Meetup): Promise<void> {
   cancelReminderTimer (meetup.id);

   if (meetup.organizerMissingSince || meetup.organizerReminderSent || meetup.organizerWarningSent) {
      const updated: db.Meetup = {
         ...meetup,
         organizerMissingSince: undefined,
         organizerReminderSent: undefined,
         organizerWarningSent: undefined
      };
      await db.update (updated);
   }
}

export async function handleMeetupResolved(meetupId: string): Promise<void> {
   cancelReminderTimer (meetupId);
}

export async function sendReminder(client: Discord.Client, meetupId: string): Promise<void> {
   cancelReminderTimer (meetupId);

   const meetup = await db.findOne ({ id: meetupId });
   if (!meetup || meetup.state.type !== "Live" || meetup.rsvps.includes (meetup.organizerID) || meetup.organizerReminderSent) {
      return;
   }

   try {
      const channel = await client.channels.fetch (meetup.threadID);
      if (channel?.isThread ()) {
         await channel.send ({
            content: `⚠️ <@${meetup.organizerID}>, you are currently marked as not attending your meetup **${meetup.title}**.\n\nPlease choose an action:\n• **Re-RSVP** with the **Going!** button above\n• **Transfer** the meetup using \`/bored meetup transfer @user\`\n• **Cancel** the meetup using \`/bored meetup cancel reason:<reason>\`\n\n*Attendees: Any attendee marked as going can take over this meetup with \`/bored meetup claim\`.*`,
            allowedMentions: { users: [meetup.organizerID] }
         });
      }

      await db.update ({
         ...meetup,
         organizerReminderSent: true
      });
      log.info ("Sent 10-minute organizer RSVP reminder", { meetupId: meetup.id, title: meetup.title });
   }
   catch (error) {
      log.error ("Failed to send organizer RSVP reminder", error);
   }
}

export async function sendFinalWarning(client: Discord.Client, meetup: db.Meetup): Promise<void> {
   try {
      const channel = await client.channels.fetch (meetup.threadID);
      if (channel?.isThread ()) {
         await channel.send ({
            content: `⚠️ **Final Warning:** <@${meetup.organizerID}>, this meetup **${meetup.title}** will be automatically cancelled in 1 hour if no organizer is attending!\n\nPlease re-RSVP or transfer the meetup. Any attending member can also claim it using \`/bored meetup claim\`.\n@everyone`,
            allowedMentions: { parse: ["everyone"], users: [meetup.organizerID] }
         });
      }

      await db.update ({
         ...meetup,
         organizerWarningSent: true
      });
      log.info ("Sent 1-hour final auto-cancel warning", { meetupId: meetup.id, title: meetup.title });
   }
   catch (error) {
      log.error ("Failed to send final auto-cancel warning", error);
   }
}

export async function executeAutoCancel(client: Discord.Client, meetup: db.Meetup): Promise<void> {
   cancelReminderTimer (meetup.id);
   const reason = "Auto-cancelled: No organizer RSVP'd";
   const timestamp = DateTime.local ().toISO ();

   await db.update ({
      ...meetup,
      state: { type: "Cancelled", reason, timestamp }
   });

   try {
      const channel = await client.channels.fetch (meetup.threadID);
      if (channel?.isThread ()) {
         await channel.setName (`(Cancelled) ${M.threadTitle (meetup.title, meetup.timestamp)}`);
         await channel.send ({
            content: `🚫 **Meetup Cancelled**\nThis meetup has been automatically cancelled because there is no confirmed organizer.\n@everyone`,
            allowedMentions: { parse: ["everyone"] }
         });
      }
      log.info ("Meetup auto-cancelled due to missing organizer", { meetupId: meetup.id, title: meetup.title });
   }
   catch (error) {
      log.error ("Failed to update thread during auto-cancellation", error);
   }
}

export async function checkOverdueRemindersAndAutoCancellations(client: Discord.Client): Promise<void> {
   const liveMeetups = await db.find ({
      "state.type": "Live"
   });

   const now = DateTime.local ();

   for (const meetup of liveMeetups) {
      // If organizer is attending, ensure missing state is cleared
      if (meetup.rsvps.includes (meetup.organizerID)) {
         if (meetup.organizerMissingSince || meetup.organizerReminderSent || meetup.organizerWarningSent) {
            await handleOrganizerRsvped (meetup);
         }
         continue;
      }

      // If missing timestamp not recorded yet, record it
      if (!meetup.organizerMissingSince) {
         await handleOrganizerUnrsvped (client, meetup);
         continue;
      }

      const guildId = env.SERVER_ID;
      const maxHours = Number (getSetting (guildId, "MEETUP_AUTOCANCEL_NO_ORGANIZER_HOURS") ?? 24);
      const proximityHours = Number (getSetting (guildId, "MEETUP_AUTOCANCEL_BEFORE_START_HOURS") ?? 2);

      if (shouldAutoCancel (meetup, maxHours, proximityHours, now)) {
         await executeAutoCancel (client, meetup);
      }
      else if (shouldSendWarning (meetup, maxHours, proximityHours, now)) {
         await sendFinalWarning (client, meetup);
      }
      else if (shouldSendReminder (meetup, now)) {
         await sendReminder (client, meetup.id);
      }
   }
}

export async function init(client: Discord.Client): Promise<void> {
   const liveMeetups = await db.find ({
      "state.type": "Live"
   });

   const now = DateTime.local ();

   for (const meetup of liveMeetups) {
      if (!meetup.rsvps.includes (meetup.organizerID) && meetup.organizerMissingSince && !meetup.organizerReminderSent) {
         const missingSince = DateTime.fromISO (meetup.organizerMissingSince);
         const elapsedMs = now.diff (missingSince).milliseconds;
         const remainingMs = REMINDER_DELAY_MS - elapsedMs;

         if (remainingMs <= 0) {
            await sendReminder (client, meetup.id);
         }
         else {
            scheduleReminderTimer (client, meetup.id, remainingMs);
         }
      }
   }

   await checkOverdueRemindersAndAutoCancellations (client);

   // Periodic check every 5 minutes
   schedule.scheduleJob ("*/5 * * * *", () => {
      runWithLoggingContext (() => {
         checkOverdueRemindersAndAutoCancellations (client);
      });
   });
}
